import { supabase } from '../lib/supabaseClient';
import { getToken } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../lib/firebaseClient';

export const notificationService = {
    async requestPermission(userId) {
        if (!('Notification' in window)) {
            console.warn('Este navegador no soporta notificaciones de escritorio.');
            return 'unsupported';
        }
        if (Notification.permission === 'granted') {
            if (userId) this.setupFCMToken(userId);
            return 'granted';
        }
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted' && userId) {
                this.setupFCMToken(userId);
            }
            return permission;
        } catch (error) {
            console.error('Error pidiendo permiso de notificación:', error);
            return 'default';
        }
    },

    async setupFCMToken(userId) {
        if (!messaging) return;
        try {
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (currentToken) {
                console.log('FCM Token obtenido:', currentToken);
                // Guardarlo en el perfil del usuario en Supabase
                const { error } = await supabase
                    .from('profiles')
                    .update({ fcm_token: currentToken })
                    .eq('id', userId);
                
                if (error) console.error('Error guardando token en Supabase:', error);
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } catch (err) {
            console.error('An error occurred while retrieving token. ', err);
        }
    },

    async registerServiceWorker() {

        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                // Register the worker from the public folder
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('ServiceWorker registrado con éxito con el scope:', registration.scope);
                return registration;
            } catch (error) {
                console.error('ServiceWorker registro fallado:', error);
                return null;
            }
        }
        return null;
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

    // Limpia notificaciones que tengan más de 30 días
    async cleanupOldNotifications(userId) {
        if (!userId) return;
        try {
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - 30);
            
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
