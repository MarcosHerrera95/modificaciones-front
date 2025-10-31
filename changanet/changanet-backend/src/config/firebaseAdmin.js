// src/config/firebaseAdmin.js
let admin;
let messaging;
let auth;
let storage;

// VERIFICACIÓN: Intentar inicializar Firebase Admin solo si existe el archivo de credenciales
try {
  admin = require('firebase-admin');
  const serviceAccount = require('../config/serviceAccountKey.json');

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'changanet-notifications',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'changanet-notifications.firebasestorage.app'
    });
    console.log('✅ Firebase Admin inicializado correctamente');
    messaging = admin.messaging();
    auth = admin.auth();
    storage = admin.storage();
    console.log('📬 Firebase Messaging habilitado');
    console.log('🔐 Firebase Auth habilitado');
    console.log('🗂️ Firebase Storage habilitado');
  } else {
    messaging = admin.messaging();
    auth = admin.auth();
    storage = admin.storage();
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin no disponible - funcionalidades de Firebase deshabilitadas');
  console.warn('Para habilitar Firebase, descarga las credenciales reales de Firebase Console.');
  admin = null;
  messaging = null;
  auth = null;
  storage = null;
}

// Función para enviar notificación push
exports.sendPushNotification = async (token, title, body) => {
  // VERIFICACIÓN: Verificar que Firebase Admin esté disponible
  if (!admin || !messaging) {
    console.warn('⚠️ Firebase Admin no disponible - notificación push no enviada');
    return null;
  }

  // Si no hay token, no podemos enviar la notificación
  if (!token) {
    console.warn('⚠️ Token FCM no proporcionado - notificación push no enviada');
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
  // VERIFICACIÓN: Verificar que Firebase Admin esté disponible
  if (!admin || !messaging) {
    console.warn('⚠️ Firebase Admin no disponible - notificaciones push multicast no enviadas');
    return null;
  }

  // Si no hay tokens, no podemos enviar las notificaciones
  if (!tokens || tokens.length === 0) {
    console.warn('⚠️ Tokens FCM no proporcionados - notificaciones push multicast no enviadas');
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

// Exportar funciones y servicios
module.exports = {
  sendPushNotification: exports.sendPushNotification,
  sendMulticastPushNotification: exports.sendMulticastPushNotification,
  messaging,
  auth,
  storage
};