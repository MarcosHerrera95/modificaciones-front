/**
 * @función initializeFCM - Inicializar Firebase Cloud Messaging
 * @descripción Inicializa FCM para recibir notificaciones push
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Notificaciones push en tiempo real para usuarios
 * @returns {Promise<Object>} Resultado de la inicialización
 */

import { getToken, onMessage, getMessaging } from "firebase/messaging";
import { app } from "../config/firebaseConfig";

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
    const messaging = getMessaging(app);
    // Verificar si Firebase Messaging está disponible
    if (!messaging) {
      console.warn('Firebase Messaging no está disponible');
      return { success: false, error: 'Firebase Messaging no está disponible' };
    }

    // Verificar si Service Worker y Notification API están disponibles
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.warn('Service Worker o Notification API no soportados');
      return { success: false, error: 'Service Worker o Notification API no soportados' };
    }

    // Solicitar permiso para notificaciones
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permiso de notificaciones denegado');
      return { success: false, error: 'Permiso de notificaciones denegado' };
    }

    // Registrar service worker si no está registrado
    let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registrado:', registration);
    }

    // Obtener token FCM real
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY
    });

    if (!token) {
      console.warn('No se pudo obtener token FCM');
      return { success: false, error: 'No se pudo obtener token FCM' };
    }

    // Enviar token al backend para almacenarlo
    const authToken = localStorage.getItem('changanet_token');
    if (authToken) {
      try {
        const response = await fetch('/api/notifications/register-token', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        });

        if (!response.ok) {
          console.warn('Error registrando token FCM en backend');
        } else {
          console.log('Token FCM registrado en backend correctamente');
        }
      } catch (error) {
        console.warn('Error enviando token al backend:', error);
      }
    }

    console.log('FCM inicializado correctamente con token real');
    return { success: true, token };

  } catch (error) {
    console.error('Error inicializando FCM:', error);
    return { success: false, error: error.message };
  }
};

/**
 * @función onFCMMessage - Escuchar mensajes FCM
 * @descripción Configura listener para mensajes FCM entrantes
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Recepción de notificaciones en tiempo real
 * @param {Function} callback - Función a ejecutar cuando llega un mensaje
 * @returns {Function} Función para desuscribirse
 */
export const onFCMMessage = (callback) => {
  const messaging = getMessaging(app);
  // Verificar si messaging está disponible
  if (!messaging) {
    console.warn('Firebase Messaging no disponible para escuchar mensajes');
    return () => {}; // Retornar función vacía
  }

  try {
    // Escuchar mensajes FCM en primer plano
    return onMessage(messaging, (payload) => {
      console.log('Mensaje FCM recibido:', payload);

      // Mostrar notificación del navegador
      if (Notification.permission === 'granted') {
        const notification = new Notification(payload.notification?.title || 'Nueva notificación', {
          body: payload.notification?.body || 'Tienes una nueva notificación',
          icon: '/vite.svg',
          data: payload.data || {},
          tag: 'changanet-notification'
        });

        // Manejar click en la notificación
        notification.onclick = () => {
          notification.close();
          // Enfocar la ventana de la app
          window.focus();
          // Aquí se podría navegar a la sección correspondiente
        };
      }

      // Ejecutar callback con los datos del mensaje
      callback(payload);
    });
  } catch (error) {
    console.error('Error configurando listener FCM:', error);
    return () => {}; // Retornar función vacía
  }
};

/**
 * @función sendFCMNotification - Enviar notificación push (desde cliente - solo para testing)
 * @descripción Envía notificación FCM desde el cliente (solo para desarrollo/testing)
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
  console.log('Enviando notificación FCM (cliente):', { token, title, body, data });

  // Para testing local, mostrar notificación del navegador
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/vite.svg',
      data,
      tag: 'changanet-test-notification'
    });
  }

  return { success: true };
};

/**
 * @función sendNotificationToBackend - Enviar notificación a través del backend
 * @descripción Envía notificación usando la API del backend para procesamiento completo
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar Sistema de Notificaciones
 * @impacto Social: Notificaciones push y email automáticas para usuarios
 * @param {string} userId - ID del usuario destinatario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje de la notificación
 * @param {Object} metadata - Datos adicionales
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendNotificationToBackend = async (userId, type, message, metadata = {}) => {
  const token = localStorage.getItem('changanet_token');

  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  try {
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        type,
        message,
        metadata
      })
    });

    if (!response.ok) {
      throw new Error('Error enviando notificación');
    }

    return await response.json();
  } catch (error) {
    console.error('Error enviando notificación al backend:', error);
    throw error;
  }
};