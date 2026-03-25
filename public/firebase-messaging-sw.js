importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDYUTD9r-797Dusa31767bbAywhqdocRJY",
  authDomain: "it-helpdesk-4aa0f.firebaseapp.com",
  projectId: "it-helpdesk-4aa0f",
  storageBucket: "it-helpdesk-4aa0f.firebasestorage.app",
  messagingSenderId: "91772122610",
  appId: "1:91772122610:web:d7bccc499aa404b1c1a76b",
  measurementId: "G-RM2W6M7LPT"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ', payload);
    const notificationTitle = payload.notification?.title || 'IT Helpdesk';
    const notificationOptions = {
        body: payload.notification?.body || 'Nueva alerta',
        icon: '/logo.svg',
        badge: '/logo.svg',
        data: payload.data,
        vibrate: [100, 50, 100]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data?.url || '/');
            }
        })
    );
});
