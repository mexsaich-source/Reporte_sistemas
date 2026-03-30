import { supabase } from '../lib/supabaseClient';
import { getToken, isSupported } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../lib/firebaseClient';

const DEVICE_KEY = 'it_helpdesk_fcm_device_id';

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
        await this.setupFCMToken(userId);
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

    async setupFCMToken(userId) {
        if (!messaging || !userId) return;
        try {
            const registration = await this.registerServiceWorker();

            if (!registration) {
                console.warn('No se pudo obtener el ServiceWorker para FCM.');
                return;
            }

            await registration.update?.();

            const currentToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (!currentToken) {
                console.warn('FCM: getToken devolvió vacío (revisa VAPID, dominio autorizado en Firebase y HTTPS).');
                return;
            }

            const userAgent = window.navigator.userAgent;
            const platform = window.navigator.platform || 'Desconocido';
            const deviceId = getOrCreateDeviceId();
            const deviceInfo = `${platform} | ${userAgent.includes('Mobile') ? 'Móvil' : 'PC'} | id:${deviceId.slice(0, 8)}…`;

            const row = {
                user_id: userId,
                token: currentToken,
                device_info: deviceInfo,
                last_seen_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('fcm_tokens')
                .upsert(row, { onConflict: 'user_id,token' });

            if (error) {
                console.error('Error guardando token multi-dispositivo:', error);
                await supabase.from('profiles').update({ fcm_token: currentToken }).eq('id', userId);
                return;
            }

            await supabase.from('profiles').update({ fcm_token: currentToken }).eq('id', userId);
            console.log('Dispositivo registrado para notificaciones (fcm_tokens + perfil).');
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

    // Limpia tokens que no se han visto en más de 60 días
    async cleanupOldTokens(userId) {
        if (!userId) return;
        try {
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - 60);
            
            const { error } = await supabase
                .from('fcm_tokens')
                .delete()
                .eq('user_id', userId)
                .lt('last_seen_at', limitDate.toISOString());
            
            if (error) console.error("Error limpiando tokens obsoletos:", error);
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
    }
};
