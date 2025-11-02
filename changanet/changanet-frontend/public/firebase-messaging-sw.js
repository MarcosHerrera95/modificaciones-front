// public/firebase-messaging-sw.js
/**
 * @archivo public/firebase-messaging-sw.js - Service Worker de Firebase Messaging
 * @descripción Maneja notificaciones push en background y clics en notificaciones (REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Notificaciones accesibles que funcionan sin que la app esté abierta
 */

// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Configuración de Firebase (misma que en el frontend)
const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.firebasestorage.app",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar Firebase Messaging
const messaging = firebase.messaging();

// Manejar mensajes en background
messaging.onBackgroundMessage((payload) => {
  console.log('📬 Mensaje recibido en background:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg', // Cambia por tu icono
    badge: '/vite.svg',
    data: payload.data,
    tag: payload.data?.tag || 'changanet-notification'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notificación clickeada:', event);

  event.notification.close();

  // Abrir la app o redirigir a una página específica
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una ventana abierta, enfócala
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abre una nueva
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});