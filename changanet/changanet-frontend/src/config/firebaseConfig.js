// src/config/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.firebasestorage.app",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = getAuth(app);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firebase Messaging (solo si es soportado)
let messaging = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn('Firebase Messaging no disponible:', error);
  }
}

// Función para solicitar permiso y obtener token FCM
export const requestFirebaseNotificationPermission = async () => {
  try {
    // Verificar si messaging está disponible
    if (!messaging) {
      throw new Error('Firebase Messaging no está disponible en este navegador');
    }

    // Solicitar permiso para notificaciones
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permiso denegado para notificaciones');
    }

    // Obtener token FCM
    const token = await getToken(messaging, {
      vapidKey: 'BBcq0rChqpfQkexHGzbzAcPNyEcXQ6pHimpgltESqpSgmMmiQEPK2yfv87taE80q794Q_wtvRc8Zlnal75mqpoo' // VAPID Key verificada y activa
    });

    console.log('🔔 Token FCM obtenido:', token);
    return token;
  } catch (error) {
    console.error('❌ Error al obtener token FCM:', error);
    throw error;
  }
};

// Función para escuchar mensajes en foreground
export const onForegroundMessage = () => {
  if (!messaging) {
    console.warn('Firebase Messaging no disponible para escuchar mensajes en foreground');
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('📬 Mensaje recibido en foreground:', payload);
    // Mostrar notificación en la UI
    const { title, body } = payload.notification;
    new Notification(title, { body });
  });
};

export { auth, googleProvider, messaging };

// Función de diagnóstico para verificar configuración
export const diagnoseFirebaseConfig = () => {
  console.log('🔍 Diagnóstico de Firebase:');
  console.log('- App inicializada:', !!app);
  console.log('- Auth disponible:', !!auth);
  console.log('- Google Provider configurado:', !!googleProvider);
  console.log('- Messaging disponible:', !!messaging);
  console.log('- VAPID Key configurada:', true);

  return {
    appInitialized: !!app,
    authAvailable: !!auth,
    googleProviderConfigured: !!googleProvider,
    messagingAvailable: !!messaging,
    vapidKeyConfigured: true
  };
};