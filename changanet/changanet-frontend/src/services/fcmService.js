/**
 * @función initializeFCM - Inicializar Firebase Cloud Messaging
 * @descripción Inicializa FCM para recibir notificaciones push
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Notificaciones Push con Firebase
 * @impacto Social: Notificaciones push en tiempo real para usuarios
 * @returns {Promise<Object>} Resultado de la inicialización
 */
export const initializeFCM = async () => {
  try {
    // Verificar si Firebase Messaging está disponible
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

    // Aquí iría la inicialización de Firebase Messaging
    // Por ahora, simulamos la inicialización exitosa
    console.log('FCM inicializado correctamente (simulado)');

    return { success: true };
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
  // Aquí iría la configuración del listener de Firebase Messaging
  // Por ahora, simulamos con un listener de prueba
  const handleMessage = (event) => {
    if (event.data && event.data.type === 'fcm_message') {
      callback(event.data.payload);
    }
  };

  // Escuchar mensajes del service worker
  navigator.serviceWorker.addEventListener('message', handleMessage);

  // Función para desuscribirse
  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
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