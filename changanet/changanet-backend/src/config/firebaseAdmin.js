// src/config/firebaseAdmin.js
const admin = require('firebase-admin');
const serviceAccount = require('../config/serviceAccountKey.json');

// Inicializar Firebase Admin con credenciales de cuenta de servicio
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: "https://changanet-notifications-default-rtdb.firebaseio.com/" // Si usas Realtime Database
  });
}

const messaging = admin.messaging();

// Función para enviar notificación push
exports.sendPushNotification = async (token, title, body) => {
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