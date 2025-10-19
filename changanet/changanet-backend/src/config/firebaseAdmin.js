// src/config/firebaseAdmin.js
const admin = require('firebase-admin');

// VERIFICACIÓN: Intentar inicializar Firebase Admin solo si existe el archivo de credenciales
let serviceAccount;
try {
  serviceAccount = require('../config/serviceAccountKey.json');
} catch (error) {
  console.warn('⚠️ Archivo serviceAccountKey.json no encontrado. Firebase Admin no se inicializará.');
  console.warn('Para habilitar notificaciones push, descarga las credenciales de Firebase Console.');
  serviceAccount = null;
}

// Inicializar Firebase Admin con credenciales de cuenta de servicio
if (serviceAccount && admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // databaseURL: "https://changanet-notifications-default-rtdb.firebaseio.com/" // Si usas Realtime Database
    });
    console.log('✅ Firebase Admin inicializado correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin:', error.message);
    console.warn('Las notificaciones push no funcionarán hasta que se configuren las credenciales correctamente.');
  }
} else if (!serviceAccount) {
  console.warn('⚠️ Firebase Admin no inicializado - faltan credenciales');
}

const messaging = admin.messaging();

// Función para enviar notificación push
exports.sendPushNotification = async (token, title, body) => {
  // VERIFICACIÓN: Verificar que Firebase Admin esté inicializado
  if (!admin.apps.length) {
    console.warn('⚠️ Firebase Admin no inicializado - notificación push no enviada');
    return null;
  }

  try {
    const message = {
      token,
      notification: {
        title,
        body
      },
      data: {
        timestamp: new Date().toISOString()
      }
    };

    const response = await messaging.send(message);
    console.log('📬 Notificación push enviada:', response);
    return response;
  } catch (error) {
    console.error('❌ Error al enviar notificación push:', error);
    throw error;
  }
};

// Función para enviar notificación a múltiples tokens
exports.sendMulticastPushNotification = async (tokens, title, body) => {
  // VERIFICACIÓN: Verificar que Firebase Admin esté inicializado
  if (!admin.apps.length) {
    console.warn('⚠️ Firebase Admin no inicializado - notificaciones push multicast no enviadas');
    return null;
  }

  try {
    const message = {
      tokens,
      notification: {
        title,
        body
      },
      data: {
        timestamp: new Date().toISOString()
      }
    };

    const response = await messaging.sendMulticast(message);
    console.log('📬 Notificaciones push enviadas:', response);
    return response;
  } catch (error) {
    console.error('❌ Error al enviar notificaciones push multicast:', error);
    throw error;
  }
};

module.exports = { sendPushNotification, sendMulticastPushNotification };