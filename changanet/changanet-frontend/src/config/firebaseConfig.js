/**
 * Inicializa la conexión con Firebase Authentication y Messaging.
 * Configura la app de Firebase con las credenciales del proyecto.
 * Exporta instancias reutilizables de auth, db y messaging.
 */

// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

/**
 * Configuración de Firebase con credenciales del proyecto.
 * Contiene las claves necesarias para conectar con los servicios de Firebase.
 */
const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.firebasestorage.app",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc"
};

/**
 * Inicializa la aplicación Firebase una sola vez.
 * Crea una instancia global de la app que será usada por todos los servicios.
 */
const app = initializeApp(firebaseConfig);

/**
 * Instancia de Firebase Authentication para manejo de usuarios.
 */
export const auth = getAuth(app);

/**
 * Proveedor de autenticación de Google para OAuth.
 */
export const googleProvider = new GoogleAuthProvider();

/**
 * Instancia de Firestore para base de datos en tiempo real.
 */
export const db = getFirestore(app);

/**
 * Instancia de Firebase Cloud Messaging para notificaciones push.
 * Solo se inicializa si es soportado por el navegador.
 */
let messaging = null;
try {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    messaging = getMessaging(app);
    console.log('✅ Firebase Messaging inicializado');
  } else {
    console.warn('⚠️ Firebase Messaging no soportado en este navegador');
  }
} catch (error) {
  console.warn('⚠️ Error inicializando Firebase Messaging:', error);
}

export { messaging };

/**
 * Solicita permiso al usuario y obtiene un token FCM para notificaciones push.
 * Utiliza la VAPID key para identificar la aplicación en Firebase Cloud Messaging.
 * Retorna el token si el permiso es concedido, null en caso contrario.
 */
export const requestFCMToken = async () => {
   try {
     if (!messaging) {
       console.warn("Firebase Messaging no disponible");
       return null;
     }

     if (!('Notification' in window)) {
       console.warn("Notificaciones no soportadas en este navegador");
       return null;
     }

     const permission = await Notification.requestPermission();
     if (permission === "granted") {
       // Clave VAPID obtenida desde Firebase Console para autenticación de mensajes
       const vapidKey = "BBcq0rChqpfQkexHGzbzAcPNyEcXQ6pHimpgltESqpSgmMmiQEPK2yfv87taE80q794Q_wtvRc8Zlnal75mqpoo";
       const fcmToken = await getToken(messaging, { vapidKey });
       console.log("Token FCM obtenido:", fcmToken);
       return fcmToken;
     } else {
       console.warn("Permiso de notificaciones denegado por el usuario");
       return null;
     }
   } catch (error) {
     console.error("Error al obtener token FCM:", error);
     return null;
   }
 };

/**
 * Configura un listener para mensajes FCM cuando la aplicación está en primer plano.
 * Muestra notificaciones nativas del navegador cuando llegan mensajes.
 */
export const onForegroundMessage = () => {
   if (!messaging) {
     console.warn('Firebase Messaging no está disponible');
     return;
   }

   try {
     onMessage(messaging, (payload) => {
       console.log('Mensaje FCM recibido en primer plano:', payload);
       // Crea una notificación nativa del navegador con el contenido del mensaje
       if (payload.notification) {
         const { title, body } = payload.notification;
         new Notification(title, { body, icon: '/vite.svg' });
       }
     });
   } catch (error) {
     console.error('Error configurando listener de mensajes FCM:', error);
   }
 };

/**
 * Función de diagnóstico que verifica el estado de la configuración de Firebase.
 * Retorna un objeto con el estado de cada servicio configurado.
 */
export const diagnoseFirebaseConfig = () => {
  console.log('Verificando configuración de Firebase:');
  console.log('- Aplicación inicializada:', !!app);
  console.log('- Autenticación disponible:', !!auth);
  console.log('- Proveedor Google configurado:', !!googleProvider);
  console.log('- Messaging disponible:', !!messaging);
  console.log('- Clave VAPID configurada:', true);

  return {
    appInitialized: !!app,
    authAvailable: !!auth,
    googleProviderConfigured: !!googleProvider,
    messagingAvailable: !!messaging,
    vapidKeyConfigured: true
  };
};