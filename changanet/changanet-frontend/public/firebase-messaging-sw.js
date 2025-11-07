// Firebase Messaging Service Worker para Changánet
// Solo inicializar si las credenciales están disponibles

try {
  // Verificar que estamos en un service worker
  if ('importScripts' in self) {
    importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

    const firebaseConfig = {
      apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
      authDomain: "changanet-notifications.firebaseapp.com",
      projectId: "changanet-notifications",
      storageBucket: "changanet-notifications.firebasestorage.app",
      messagingSenderId: "926478045621",
      appId: "1:926478045621:web:6704a255057b65a6e549fc",
      vapidKey: "BBcq0rChqpfQkexHGzbzAcPNyEcXQ6pHimpgltESqpSgmMmiQEPK2yfv87taE80q794Q_wtvRc8Zlnal75mqpoo"
    };

    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Manejar mensajes en background
    messaging.onBackgroundMessage((payload) => {
      console.log('Mensaje recibido en background:', payload);

      const notificationTitle = payload.notification?.title || 'Changánet';
      const notificationOptions = {
        body: payload.notification?.body || 'Tienes una nueva notificación',
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: payload.data?.tag || 'changanet-notification',
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'Ver'
          },
          {
            action: 'dismiss',
            title: 'Cerrar'
          }
        ]
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });

    // Manejar clics en notificaciones
    self.addEventListener('notificationclick', (event) => {
      console.log('Notificación clickeada:', event);

      event.notification.close();

      if (event.action === 'view') {
        // Abrir la aplicación
        event.waitUntil(
          clients.openWindow('/')
        );
      }
    });

    console.log('Firebase Messaging Service Worker inicializado correctamente');
  } else {
    console.warn('Firebase Messaging SW: importScripts no disponible');
  }
} catch (error) {
  console.error('Error inicializando Firebase Messaging SW:', error);
}