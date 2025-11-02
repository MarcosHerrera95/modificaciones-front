import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// IMPORTANTE: Inicializar Sentry lo más temprano posible
import { initializeSentry } from './config/sentryConfig';
initializeSentry();

// FCM Integration: Inicializar Firebase y registrar service worker
import { initializeFCM } from './services/fcmService';

// Inicializar FCM cuando la app se carga
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Registrar service worker para FCM
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registrado:', registration);

      // Inicializar FCM solo si el usuario está autenticado
      const userToken = localStorage.getItem('token');
      if (userToken) {
        const fcmResult = await initializeFCM();
        if (fcmResult.success) {
          console.log('FCM inicializado correctamente');
        } else {
          console.error('Error inicializando FCM:', fcmResult.error);
        }
      }
    } catch (error) {
      console.error('Error registrando Service Worker:', error);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
