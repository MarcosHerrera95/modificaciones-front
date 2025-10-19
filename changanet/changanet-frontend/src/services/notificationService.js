import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "../config/firebaseConfig";

// Solicitar permiso para notificaciones push
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return { success: true };
    } else {
      return { success: false, error: 'Permiso denegado' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Obtener token de registro para notificaciones
export const getMessagingToken = async () => {
  try {
    const token = await getToken(messaging, {
      vapidKey: 'TU_VAPID_KEY_AQUI' // Reemplaza con tu clave VAPID real
    });
    return { success: true, token };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Escuchar mensajes en primer plano
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

// Mostrar notificación local
export const showLocalNotification = (title, body, icon = '/favicon.ico') => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon,
      tag: 'changanet-notification'
    });
  }
};

// Enviar notificación push (simulada - en producción usarías Cloud Functions)
export const sendPushNotification = async (token, title, body) => {
  // Esta función simula el envío de notificaciones
  // En producción, usarías Firebase Cloud Functions o tu servidor backend
  console.log('Enviando notificación push:', { token, title, body });
  return { success: true };
};

// Configurar notificaciones automáticas
export const setupAutomaticNotifications = () => {
  // Configurar listeners para eventos que requieren notificaciones
  // Por ejemplo: nuevos mensajes, nuevas cotizaciones, etc.
  console.log('Configurando notificaciones automáticas');
};

// Limpiar token de notificaciones
export const deleteMessagingToken = async () => {
  try {
    // Firebase no tiene una función directa para eliminar token
    // En su lugar, puedes desuscribir del servicio
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};