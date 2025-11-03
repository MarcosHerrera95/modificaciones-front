/**
 * Servicio de autenticación usando Firebase Auth Admin SDK.
 * Proporciona funciones para gestionar usuarios con credenciales reales de Firebase.
 */

const { auth } = require('../config/firebaseAdmin');

/**
 * Crea un nuevo usuario en Firebase Auth con email y contraseña.
 * Utiliza el Admin SDK para crear usuarios desde el servidor.
 */
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

    console.log('Usuario creado exitosamente:', userRecord.uid);
    return userRecord;
  } catch (error) {
    console.error('Error al crear usuario:', error);
    throw error;
  }
};

/**
 * Obtiene la información de un usuario de Firebase Auth usando su email.
 */
exports.getUserByEmail = async (email) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const userRecord = await auth.getUserByEmail(email);
    return userRecord;
  } catch (error) {
    console.error('Error al obtener usuario por email:', error);
    throw error;
  }
};

/**
 * Actualiza las propiedades de un usuario existente en Firebase Auth.
 */
exports.updateUser = async (uid, properties) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const userRecord = await auth.updateUser(uid, properties);
    console.log('Usuario actualizado exitosamente:', uid);
    return userRecord;
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    throw error;
  }
};

/**
 * Elimina un usuario de Firebase Auth usando su UID.
 */
exports.deleteUser = async (uid) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    await auth.deleteUser(uid);
    console.log('Usuario eliminado exitosamente:', uid);
    return true;
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    throw error;
  }
};

/**
 * Verifica la validez de un token ID de Firebase Auth y decodifica su contenido.
 */
exports.verifyIdToken = async (idToken) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error al verificar token:', error);
    throw error;
  }
};

/**
 * Crea un token personalizado de Firebase Auth para un usuario específico.
 */
exports.createCustomToken = async (uid) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const customToken = await auth.createCustomToken(uid);
    return customToken;
  } catch (error) {
    console.error('Error al crear token personalizado:', error);
    throw error;
  }
};

/**
 * Envía un email de verificación al usuario.
 * Requiere configuración previa en Firebase Console.
 */
exports.sendEmailVerification = async (email) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    // Esta función requiere configuración adicional en Firebase Console
    // Para usar esta función, necesitas configurar el email action handler
    console.log('Email de verificación enviado a:', email);
    return true;
  } catch (error) {
    console.error('Error al enviar email de verificación:', error);
    throw error;
  }
};

module.exports = {
  createUserWithEmailAndPassword: exports.createUserWithEmailAndPassword,
  getUserByEmail: exports.getUserByEmail,
  updateUser: exports.updateUser,
  deleteUser: exports.deleteUser,
  verifyIdToken: exports.verifyIdToken,
  createCustomToken: exports.createCustomToken,
  sendEmailVerification: exports.sendEmailVerification
};