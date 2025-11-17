import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// IMPORTANTE: Inicializar Sentry lo más temprano posible
import { initializeSentry } from './config/sentryConfig';
initializeSentry();

// IMPORTANTE: Inicializar Google Maps API lo más temprano posible
import { initGoogleMaps } from './services/mapService';
initGoogleMaps().then(() => {
  console.log('✅ Google Maps API cargado exitosamente');
}).catch(error => {
  console.warn('⚠️ Error cargando Google Maps API:', error.message);
});

// FCM Integration: Inicializar Firebase y registrar service worker (solo en producción)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Registrar service worker para FCM
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('✅ Service Worker registrado:', registration);
    } catch (error) {
      console.error('❌ Error registrando Service Worker:', error);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
