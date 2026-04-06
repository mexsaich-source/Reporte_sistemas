import { supabase } from '../lib/supabaseClient';
import { getToken, isSupported, deleteToken } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../lib/firebaseClient';

const DEVICE_KEY = 'it_helpdesk_fcm_device_id';
const TOKEN_ROTATED_SESSION_KEY = 'it_helpdesk_fcm_token_rotated';

function getOrCreateDeviceId() {
    try {
        let id = localStorage.getItem(DEVICE_KEY);
        if (!id) {
            id = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch {
        return `mem-${Date.now()}`;
    }
}

/**
 * Detecta la plataforma del navegador
 * @returns {'web' | 'ios' | 'android'}
 */
function detectPlatform() {
    const ua = window.navigator.userAgent.toLowerCase();
    
    if (ua.includes('iphone') || ua.includes('ipad')) {
        return 'ios';
    }
    if (ua.includes('android')) {
        return 'android';
    }
    return 'web';
}

/**
 * Genera información descriptiva del dispositivo
 * @returns {string}
 */
function generateDeviceInfo() {
    const ua = window.navigator.userAgent;
    const platform = window.navigator.platform || 'Unknown';
    const deviceId = getOrCreateDeviceId();
    const isMobile = ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone');
    const deviceType = isMobile ? 'Mobile' : 'Desktop';
    
    return `${platform} | ${deviceType} | id:${deviceId.slice(0, 8)}`;
}

export const notificationService = {
    /**
     * Flujo completo: permiso + SW actualizado + token FCM + upsert en Supabase.
     * Idempotente; llamar tras login y al abrir la app en un dispositivo nuevo.
     */
    async syncPushForUser(userId) {
        if (!userId || typeof window === 'undefined') return { ok: false, reason: 'no_user' };
        const supported = await isSupported().catch(() => false);
        if (!supported) {
            console.warn('Firebase Messaging no está soportado en este navegador.');
            return { ok: false, reason: 'unsupported' };
        }
        if (!('Notification' in window)) {
            console.warn('Este navegador no soporta notificaciones de escritorio.');
            return { ok: false, reason: 'no_notification_api' };
        }
        if (Notification.permission === 'denied') {
            return { ok: false, reason: 'denied' };
        }
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return { ok: false, reason: permission };
        }

        // Fuerza renovación de token una vez por sesión de navegador.
        // Esto ayuda cuando la misma cuenta entra desde otro navegador/dispositivo.
        let forceRefresh = false;
        try {
            const sessionKey = `${TOKEN_ROTATED_SESSION_KEY}:${userId}`;
            if (!sessionStorage.getItem(sessionKey)) {
                forceRefresh = true;
                sessionStorage.setItem(sessionKey, '1');
            }
        } catch {
            forceRefresh = false;
        }

        await this.setupFCMToken(userId, { forceRefresh });
        return { ok: true };
    },

    /** @returns {Promise<'granted'|'denied'|'default'|'unsupported'>} */
    async requestPermission(userId) {
        const r = await this.syncPushForUser(userId);
        if (r.reason === 'unsupported' || r.reason === 'no_notification_api') return 'unsupported';
        if (r.reason === 'denied') return 'denied';
        if (r.ok) return 'granted';
        return typeof r.reason === 'string' ? r.reason : 'default';
    },

    async setupFCMToken(userId, options = {}) {
        if (!messaging || !userId) return;
        const { forceRefresh = false } = options;
        try {
            const registration = await this.registerServiceWorker();

            if (!registration) {
                console.warn('No se pudo obtener el ServiceWorker para FCM.');
                return;
            }

            await registration.update?.();

            if (forceRefresh) {
                try {
                    await deleteToken(messaging);
                    console.log('🔁 Token FCM anterior invalidado para forzar renovación de sesión.');
                } catch (rotateErr) {
                    console.warn('No se pudo invalidar token previo, se intentará recuperar token actual:', rotateErr?.message || rotateErr);
                }
            }

            const currentToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (!currentToken) {
                console.warn('FCM: getToken devolvió vacío (revisa VAPID, dominio autorizado en Firebase y HTTPS).');
                return;
            }

            // Nueva estructura con platform automático
            const platform = detectPlatform();
            const deviceInfo = generateDeviceInfo();

            const row = {
                user_id: userId,
                token: currentToken,
                device_info: deviceInfo,
                platform: platform,
                is_active: true
                // NO incluir created_at ni last_seen_at - SQL los maneja con defaults y triggers
            };

            const { error } = await supabase
                .from('fcm_tokens')
                .upsert(row, { onConflict: 'user_id,token' })
                .select();

            if (error) {
                console.error('Error guardando token multi-dispositivo:', error);
                return;
            }

            console.log(`✅ Dispositivo registrado (${platform}):`, {
                token: currentToken.substring(0, 20) + '...',
                device: deviceInfo,
                userId: userId.substring(0, 8) + '...'
            });

        } catch (err) {
            console.error('Error al recuperar el token de FCM:', err);
        }
    },

    async registerServiceWorker() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/',
                    updateViaCache: 'none'
                });
                console.log('ServiceWorker registrado con éxito con el scope:', registration.scope);
                return registration;
            } catch (error) {
                console.error('ServiceWorker registro fallado:', error);
                return null;
            }
        }
        return null;
    },

    // Marca tokens como inactivos en lugar de borrar (soft delete)
    // Se ejecuta al hacer logout
    async deactivateTokensForLogout() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('fcm_tokens')
                .update({ is_active: false })
                .eq('user_id', user.id);

            if (error) {
                console.warn('Error deactivating tokens:', error);
            } else {
                console.log('✅ Todos los tokens marcados como inactivos (logout).');
            }
        } catch (err) {
            console.warn('Deactivate tokens error:', err.message);
        }
    },

    // Limpia tokens inactivos con más de 90 días (puede ejecutarse periódicamente)
    async cleanupOldTokens(userId) {
        if (!userId) return;
        try {
            const { error } = await supabase
                .from('fcm_tokens')
                .delete()
                .eq('user_id', userId)
                .eq('is_active', false)
                .lt('last_seen_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

            if (error) {
                console.error("Error limpiando tokens obsoletos:", error);
            } else {
                console.log('✅ Tokens obsoletos limpiados.');
            }
        } catch (err) {
            console.warn("Cleanup ignored:", err.message);
        }
    },

    // Envía una notificación local de escritorio (si la app está abierta y hay permisos)
    showLocalNotification(title, message) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            const options = {
                body: message,
                icon: '/logo.svg',
                badge: '/logo.svg',
                vibrate: [100, 50, 100],
                data: { url: window.location.origin }
            };

            // Intentar vía Service Worker (mejor para móvil/background)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.showNotification(title, options);
                }).catch(err => {
                    console.warn('SW ready error, falling back to standard notification:', err);
                    new Notification(title, options);
                });
            } else {
                new Notification(title, options);
            }
        } else {
            console.warn('Permiso de notificación no otorgado:', Notification.permission);
        }
    },

    // Limpia notificaciones con más de 1 día (cliente); el servidor puede usar cron SQL / Edge programada
    async cleanupOldNotifications(userId) {
        if (!userId) return;
        try {
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - 1);
            
            await supabase
                .from('notifications')
                .delete()
                .eq('user_id', userId)
                .lt('created_at', limitDate.toISOString());
                
        } catch (error) {
            console.error("Error limpiando notificaciones base:", error);
        }
    },

    // Obtiene todos los tokens activos de un usuario (para enviarles notificaciones)
    async getActiveTokensForUser(userId) {
        if (!userId) return [];
        try {
            const { data, error } = await supabase
                .from('fcm_tokens')
                .select('token, platform, device_info')
                .eq('user_id', userId)
                .eq('is_active', true);

            if (error) {
                console.error('Error obteniendo tokens activos:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.warn('Get active tokens error:', err.message);
            return [];
        }
    }
};
