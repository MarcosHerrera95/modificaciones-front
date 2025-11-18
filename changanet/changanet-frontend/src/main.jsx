import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthProvider';
import { NotificationProvider } from './context/NotificationContext';
import './index.css';

// IMPORTANTE: Inicializar Sentry lo más temprano posible
import { initializeSentry } from './config/sentryConfig';
initializeSentry();

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Registrar service worker para PWA
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('✅ Service Worker PWA registrado:', registration.scope);

      // Manejar actualizaciones del service worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nueva versión disponible
              console.log('🔄 Nueva versión del Service Worker disponible');

              // Mostrar notificación al usuario (opcional)
              if (confirm('Hay una nueva versión disponible. ¿Quieres actualizar?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });

      // FCM Integration: Solo en producción
      if (import.meta.env.PROD) {
        try {
          // Registrar service worker adicional para FCM
          const fcmRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('✅ Service Worker FCM registrado:', fcmRegistration.scope);
        } catch (fcmError) {
          console.error('❌ Error registrando Service Worker FCM:', fcmError);
        }
      }

    } catch (error) {
      console.error('❌ Error registrando Service Worker PWA:', error);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AuthProvider>
  </React.StrictMode>,
);
