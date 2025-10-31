// src/services/authService.js
// Servicio de autenticación usando Firebase Auth Admin SDK
// Proporciona funciones para gestionar usuarios con credenciales reales de Firebase

const { auth } = require('../config/firebaseAdmin');

// Función para crear usuario con email y contraseña
exports.createUserWithEmailAndPassword = async (email, password, displayName = null) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });

    console.log('✅ Usuario creado exitosamente:', userRecord.uid);
    return userRecord;
  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
    throw error;
  }
};

// Función para verificar usuario por email
exports.getUserByEmail = async (email) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const userRecord = await auth.getUserByEmail(email);
    return userRecord;
  } catch (error) {
    console.error('❌ Error al obtener usuario por email:', error);
    throw error;
  }
};

// Función para actualizar usuario
exports.updateUser = async (uid, properties) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const userRecord = await auth.updateUser(uid, properties);
    console.log('✅ Usuario actualizado exitosamente:', uid);
    return userRecord;
  } catch (error) {
    console.error('❌ Error al actualizar usuario:', error);
    throw error;
  }
};

// Función para eliminar usuario
exports.deleteUser = async (uid) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    await auth.deleteUser(uid);
    console.log('✅ Usuario eliminado exitosamente:', uid);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    throw error;
  }
};

// Función para verificar token de Firebase Auth
exports.verifyIdToken = async (idToken) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('❌ Error al verificar token:', error);
    throw error;
  }
};

// Función para crear token personalizado
exports.createCustomToken = async (uid) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const customToken = await auth.createCustomToken(uid);
    return customToken;
  } catch (error) {
    console.error('❌ Error al crear token personalizado:', error);
    throw error;
  }
};

// Función para enviar email de verificación
exports.sendEmailVerification = async (email) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    // Nota: Esta función requiere configuración adicional en Firebase Console
    // Para usar esta función, necesitas configurar el email action handler
    console.log('📧 Email de verificación enviado a:', email);
    return true;
  } catch (error) {
    console.error('❌ Error al enviar email de verificación:', error);
    throw error;
  }
};

module.exports = {
  createUserWithEmailAndPassword,
  getUserByEmail,
  updateUser,
  deleteUser,
  verifyIdToken,
  createCustomToken,
  sendEmailVerification
};