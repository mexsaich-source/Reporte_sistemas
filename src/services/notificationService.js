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

    // --- PLAN C: FCM v1 desde el Frontend (Sin CLI) ---
    // Esta función genera un token de acceso temporal usando tu JSON de Firebase
    async getAccessTokenV1() {
        const sa = {
            "project_id": "it-helpdesk-4aa0f",
            "client_email": "firebase-adminsdk-fbsvc@it-helpdesk-4aa0f.iam.gserviceaccount.com",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDRIpqBQMmskArN\nThxoJBmaEFoJkjjzEAse5aAS4c8dATIPGM04y63Rjm+0FgqwSYG4MxrSCljdB+SF\n8vKEi1XRseRQgNvY2Lly3S1CuhHu8X40VggI875dZH5NU8q8Ypf3Y/+D4CP437fJ\nVRom4PIWJMnN9HFUbGjz9y0dTTkyTsFvnhCMzBcVHCfx0hVI9fPNvufEhspnvtpd\nJdP3ciy/FEL5vQrRDkYq80ji/M7LPrxJDT2tJmQxpemRgpEhHMJFgCff9ri0Hwnq\nnnSxUitO7xWnhpkwE6xjRJXREGUY9oVRe3jiy+XDVdEV0l1Rf+2GZ+y09dMdZXNR\nH7dMwj0LAgMBAAECggEAVEZ+/44FlxnWmIQdE2RUws5LEidP9rbk3FcJSgKf7R7B\ntu62KGh/i348ClSFiyOb+Af0C2crByr6jnXn/7yMYTuv9zbuIPS4yo5Rgl2sA19i\njaGLjFv4vvbTpMKa5I5QkdtEqLZmmJBCpgm6x6cHNyAtCGc0UiJ7qrBVCEVJwrja\nDt/Qqc73BOdPya1/xvurYbn1EOJpgjAjnMAW6PC+6xmYQsRb1AhQ1KEt8wwPFupt\nPWw/QWcuent9hkCigF6IrOR4x+CG77cZMZ6+lZIBJgV0mYvsL4dxPq0esVbDSuLD\nm5B4vbFzi7iKLevVMHcu6TEUg65SlDlODtm5rAztSQKBgQD1jr8ZKf0o/x9Pi3Dh\nWXNa55GLduY7TSsDES95VVH9ihVlOm4K4IgtBVzrM4+8ZDN30DpEMchSquV8id+N\no0kW2Tl/g2EGZa1SbV0meL0tJwCvJADqyJKDFscoHA7VxOqJ2GISdwsNqR/iWNhI\n8xoosbVUopwI6vPU1pWyeo56QwKBgQDaB1h6hyNkGHnHJAohsU/760cLord+rCIl\n6XSIU/1qTgig/qeCkKsedFyBOqOP/dNyMBlRgwVkxbxAtrbLqq2givCd3Dh+2KJX\nE2cjIWTzJNkD9IxHwDVWFN684kF1QZl84femNk00FQiVJEe6ZpDGc2xzMzLc9pK6\nsKZ20ZD5mQKBgEHMa0Z56t1GZ4RwD+JCjteH/4cIaC7xwZnDzB3OD/dJPexvGLeP\nbM3rhvd7TIOlsejkAgjt8gi8xFt3slCItXgK4w5ZDPGi4yuYJIK/jamArv0/P4Oq\nFSBNRTZpNkxvxI0FT1o1Td/uNp33QpVhltvaqoUwQXFeS9H3Ygt+LZlzAoGBAJfa\n8ec1ZJL88SSgl2XsJ7dgobUa+g8COS6KsZ2aUjDOdPgdJfKsbGLjzOI9Q1qxAarQ\nkXHSfdk4V+wC1sJ3+EKPQxPQJJFEtZ1MaFNxmOw4x+YXV/VJjFyOYKzSMaFHtW3j\nvSdJPvB9jeLCyCqt8TwnfGuoR07bdksNaoPrZrxRAoGAeNsoHivXSVePTyJKdBAb\nQQrfxiT5HxdLl5aEPrC2FsuiWzZtkjCVcZDrnmRn2sBsEbVNNo+cLwzbKDOCdlFn\npjVdC6AZ6/xPKv2v7QJsVzwWrhSSN89rL9BokjhujeY8HVXEaDk9XmGcnSwkr50O\nPHI9G91/KKdoQO1tQW/8vic=\n-----END PRIVATE KEY-----\n"
        };

        const header = { alg: "RS256", typ: "JWT" };
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: sa.client_email,
            scope: "https://www.googleapis.com/auth/firebase.messaging",
            aud: "https://oauth2.googleapis.com/token",
            exp: now + 3600,
            iat: now,
        };

        const base64Url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const unsignedToken = `${base64Url(header)}.${base64Url(payload)}`;

        // Convertir PEM a ArrayBuffer para Web Crypto
        const pemHeader = "-----BEGIN PRIVATE KEY-----";
        const pemFooter = "-----END PRIVATE KEY-----";
        const pemContents = sa.private_key.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
        const binaryDerString = window.atob(pemContents);
        const binaryDer = new Uint8Array(binaryDerString.length);
        for (let i = 0; i < binaryDerString.length; i++) binaryDer[i] = binaryDerString.charCodeAt(i);

        const cryptoKey = await window.crypto.subtle.importKey(
            "pkcs8",
            binaryDer.buffer,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signature = await window.crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            cryptoKey,
            new TextEncoder().encode(unsignedToken)
        );

        const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        const jwt = `${unsignedToken}.${base64Signature}`;

        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        });
        const data = await res.json();
        return data.access_token;
    },

    async sendPushToUser(userId, title, message) {
        if (!userId) return;
        
        try {
            const { data: profile } = await supabase.from('profiles').select('fcm_token').eq('id', userId).single();
            if (!profile?.fcm_token) return;

            const accessToken = await this.getAccessTokenV1();
            const projectId = "it-helpdesk-4aa0f";
            
            await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    message: {
                        token: profile.fcm_token,
                        notification: { title, body: message },
                        webpush: {
                            notification: {
                                icon: '/logo.svg',
                                badge: '/logo.svg'
                            },
                            fcm_options: { link: '/' }
                        }
                    }
                })
            });
            console.log('Push enviado con éxito (v1)');
        } catch (error) {
            console.error('Error enviando Push v1:', error);
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
