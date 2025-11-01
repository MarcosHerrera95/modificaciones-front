import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { messaging } from "../config/firebaseConfig";

// Configurar FCM
export const initializeFCM = async () => {
  try {
    // Solicitar permiso para notificaciones
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permiso de notificaciones denegado');
    }

    // Obtener token FCM
    const token = await getToken(messaging, {
      vapidKey: 'BBcq0rChqpfQkexHGzbzAcPNyEcXQ6pHimpgltESqpSgmMmiQEPK2yfv87taE80q794Q_wtvRc8Zlnal75mqpoo' // VAPID Key verificada y activa
    });

    // Actualizar token en el backend si hay usuario autenticado
    const userToken = localStorage.getItem('token');
    if (userToken && token) {
      try {
        const { updateUserFCMToken } = await import('./authService');
        await updateUserFCMToken(token, null); // El backend obtiene el userId del token JWT
      } catch (updateError) {
        console.error('Error updating FCM token in backend:', updateError);
      }
    }

    return { success: true, token };
  } catch (error) {
    console.error('Error inicializando FCM:', error);
    return { success: false, error: error.message };
  }
};

// Obtener token FCM del usuario
export const getFCMToken = async () => {
  try {
    const token = await getToken(messaging, {
      vapidKey: 'BBcq0rChqpfQkexHGzbzAcPNyEcXQ6pHimpgltESqpSgmMmiQEPK2yfv87taE80q794Q_wtvRc8Zlnal75mqpoo' // VAPID Key verificada y activa
    });
    return { success: true, token };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Escuchar mensajes en primer plano
export const onFCMMessage = (callback) => {
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};

// Eliminar token FCM
export const removeFCMToken = async () => {
  try {
    await deleteToken(messaging);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Enviar notificación push (desde el cliente - simulado)
export const sendFCMNotification = async (token, title, body, data = {}) => {
  // En producción, esto se haría desde el servidor backend
  console.log('Enviando notificación FCM:', { token, title, body, data });

  // Simular envío local para testing
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/vite.svg',
      data
    });
  }

  return { success: true };
};

// Verificar soporte de FCM
export const isFCMSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};