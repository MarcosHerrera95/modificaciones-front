// src/config/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.firebasestorage.app",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc",
  measurementId: "G-XXXXXXXXXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = getMessaging(app);

// Función para solicitar permiso y obtener token FCM
export const requestFirebaseNotificationPermission = async () => {
  try {
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
  onMessage(messaging, (payload) => {
    console.log('📬 Mensaje recibido en foreground:', payload);
    // Mostrar notificación en la UI
    const { title, body } = payload.notification;
    new Notification(title, { body });
  });
};

export { messaging };