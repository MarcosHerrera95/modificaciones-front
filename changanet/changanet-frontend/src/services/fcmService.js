/**
 * @archivo src/services/fcmService.js - Servicio de Firebase Cloud Messaging
 * @descripción Gestiona notificaciones push con Firebase FCM (REQ-19, REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Comunicación accesible en tiempo real para usuarios con discapacidades
 */

import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { getMessaging as getMessagingInstance } from "firebase/messaging";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.appspot.com",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

/**
 * @función initializeFCM - Inicialización de Firebase Cloud Messaging
 * @descripción Solicita permisos y obtiene token FCM para notificaciones push (REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Notificaciones que no requieren visión perfecta para ser efectivas
 * @returns {Promise<Object>} Resultado con token o error
 */
export const initializeFCM = async () => {
  try {
    // Verificar si ya tenemos permiso
    if (Notification.permission === 'denied') {
      return { success: false, error: 'Permiso de notificaciones denegado' };
    }

    // Solicitar permiso para notificaciones solo si no está concedido
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Permiso de notificaciones denegado' };
      }
    }

    // Obtener token FCM
    const token = await getToken(messaging, {
      vapidKey: 'BBcq0rChqpfQkexHGzbzAcPNyEcXQ6pHimpgltESqpSgmMmiQEPK2yfv87taE80q794Q_wtvRc8Zlnal75mqpoo' // VAPID Key verificada y activa
    });

    // Actualizar token en el backend si hay usuario autenticado
    const userToken = localStorage.getItem('changanet_token');
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

/**
 * @función getFCMToken - Obtener token FCM del usuario
 * @descripción Obtiene token FCM para notificaciones push (REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Token único para notificaciones personalizadas y accesibles
 * @returns {Promise<Object>} Resultado con token o error
 */
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

/**
 * @función onFCMMessage - Escuchar mensajes en primer plano
 * @descripción Configura listener para mensajes FCM cuando la app está abierta (REQ-19)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Mensajes en tiempo real accesibles sin interrupciones visuales
 * @param {Function} callback - Función a ejecutar al recibir mensaje
 * @returns {Function} Función para remover listener
 */
export const onFCMMessage = (callback) => {
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};

/**
 * @función removeFCMToken - Eliminar token FCM
 * @descripción Remueve token FCM del dispositivo (REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Control de privacidad para usuarios con necesidades especiales
 * @returns {Promise<Object>} Resultado de la operación
 */
export const removeFCMToken = async () => {
  try {
    await deleteToken(messaging);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * @función sendFCMNotification - Enviar notificación push (simulada)
 * @descripción Simula envío de notificación FCM desde cliente (REQ-19)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Testing accesible de notificaciones sin backend
 * @param {string} token - Token FCM del destinatario
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo de la notificación
 * @param {Object} data - Datos adicionales
 * @returns {Promise<Object>} Resultado del envío
 */
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

/**
 * @función isFCMSupported - Verificar soporte de FCM
 * @descripción Verifica si el navegador soporta Firebase Cloud Messaging (REQ-19)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Compatibilidad con navegadores accesibles para todos los usuarios
 * @returns {boolean} True si es soportado
 */
export const isFCMSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};