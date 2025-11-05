/**
 * Servicio de autenticación para el frontend de Changánet.
 * Maneja registro, login y gestión de sesiones de usuario.
 * Incluye integración con backend para tokens JWT y comunicación postMessage.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth } from "../config/firebaseConfig";

/**
 * Registra un nuevo usuario usando email y contraseña.
 * Crea la cuenta en Firebase Auth y envía email de verificación.
 * Retorna el resultado de la operación con el usuario creado.
 */
export const registerWithEmail = async (email, password) => {
  try {
    // Verificar que Firebase Auth esté disponible
    if (!auth) {
      throw new Error('Servicio de autenticación no disponible. Verifica la configuración de Firebase.');
    }

    // Validar entrada
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos');
    }

    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Enviar email de verificación
    try {
      await sendEmailVerification(userCredential.user);
    } catch (verificationError) {
      console.warn('No se pudo enviar email de verificación:', verificationError);
      // No fallar el registro por esto
    }

    return {
      success: true,
      user: userCredential.user,
      message: 'Usuario registrado exitosamente. Revisa tu email para verificar la cuenta.'
    };
  } catch (error) {
    console.error('❌ Error en registro:', error);

    // Manejar errores específicos de Firebase
    let errorMessage = 'Error al registrar usuario';

    // Si es error de configuración, proporcionar información específica
    if (error.code === 'auth/configuration-not-found') {
      errorMessage = 'Error de configuración de Firebase. Verifica que el proyecto esté configurado correctamente en Firebase Console.';
      console.error('🔧 Solución: Ve a https://console.firebase.google.com/project/changanet-notifications/settings/general y verifica la configuración.');
    } else {
      // Otros errores de Firebase
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Este email ya está registrado. Intenta iniciar sesión en su lugar.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido. Verifica el formato.';
          break;
        case 'auth/weak-password':
          errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
          break;
        case 'auth/invalid-api-key':
          errorMessage = 'Clave API de Firebase inválida. Contacta al administrador.';
          break;
        case 'auth/app-deleted':
          errorMessage = 'Aplicación Firebase eliminada. Contacta al administrador.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Registro de usuarios deshabilitado. Contacta al administrador.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Inicia sesión de un usuario existente con email y contraseña.
 * Autentica las credenciales contra Firebase Auth.
 * Retorna el resultado con el usuario autenticado.
 */
export const loginWithEmail = async (email, password) => {
  try {
    // Verificar que Firebase Auth esté disponible
    if (!auth) {
      console.error('❌ Firebase Auth no disponible. Verificando configuración...');

      // Intentar diagnosticar el problema
      const { diagnoseFirebaseConfig } = await import('../config/firebaseConfig');
      const isConfigOk = diagnoseFirebaseConfig();

      if (!isConfigOk) {
        throw new Error('Firebase no está configurado correctamente. Revisa la consola para más detalles.');
      } else {
        throw new Error('Firebase Auth no está disponible temporalmente. Inténtalo más tarde.');
      }
    }

    // Validar entrada
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos');
    }

    console.log('🔐 Intentando login con Firebase Auth...');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Verificar si el email está verificado
    if (!userCredential.user.emailVerified) {
      console.warn('Email no verificado, pero permitiendo login');
      // Podríamos enviar otro email de verificación aquí si queremos ser estrictos
    }

    return {
      success: true,
      user: userCredential.user,
      message: 'Inicio de sesión exitoso'
    };
  } catch (error) {
    console.error('❌ Error en login:', error);

    // Manejar errores específicos de Firebase
    let errorMessage = 'Error al iniciar sesión';

    // Si es error de configuración, proporcionar información específica
    if (error.code === 'auth/configuration-not-found') {
      errorMessage = 'Error de configuración de Firebase. Verifica que el proyecto esté configurado correctamente en Firebase Console.';
      console.error('🔧 Solución: Ve a https://console.firebase.google.com/project/changanet-notifications/settings/general y verifica la configuración.');
    } else {
      // Otros errores de Firebase
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuario no encontrado. Verifica tu email.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Contraseña incorrecta';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Cuenta deshabilitada. Contacta al soporte.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera unos minutos antes de intentar nuevamente.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
          break;
        case 'auth/invalid-api-key':
          errorMessage = 'Clave API de Firebase inválida. Contacta al administrador.';
          break;
        case 'auth/app-deleted':
          errorMessage = 'Aplicación Firebase eliminada. Contacta al administrador.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Inicia sesión usando autenticación OAuth de Google.
 * Usa el flujo de redirección del backend para evitar problemas de COOP y popups.
 * Retorna el resultado con el usuario autenticado.
 */
export const loginWithGoogle = async () => {
  try {
    // En lugar de usar Firebase directamente, redirigir al backend OAuth
    // Esto evita problemas de COOP y popups bloqueados
    window.location.href = '/api/auth/google';
    return { success: true, redirecting: true };
  } catch (error) {
    console.error('❌ Error en loginWithGoogle:', error);
    return { success: false, error: 'Error al iniciar sesión con Google' };
  }
};

/**
 * Actualiza el token FCM del usuario en el backend.
 * Envía una petición PUT al endpoint de perfil con el nuevo token.
 * Utiliza el token JWT almacenado en localStorage para autenticación.
 */
export const updateUserFCMToken = async (token, userId) => {
  try {
    // Validar parámetros
    if (!token || !userId) {
      throw new Error('Token FCM y ID de usuario son requeridos');
    }

    // Usar el nuevo apiService con retry logic
    const { api } = await import('./apiService');

    const response = await api.put(`/profile/fcm-token`, {
      fcm_token: token,
      user_id: userId
    });

    return {
      success: true,
      message: 'Token FCM actualizado correctamente'
    };
  } catch (error) {
    console.error('Error updating FCM token:', error);

    let errorMessage = 'Error al actualizar token FCM';

    if (error.message?.includes('401')) {
      errorMessage = 'Sesión expirada. Inicia sesión nuevamente';
    } else if (error.message?.includes('403')) {
      errorMessage = 'No tienes permisos para esta acción';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Error de conexión. El token se actualizará cuando haya conexión';
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Inicia sesión usando autenticación OAuth de Facebook.
 * Abre un popup para el flujo de autenticación y retorna el usuario autenticado.
 */
export const loginWithFacebook = async () => {
  try {
    // Facebook login not implemented yet - placeholder
    return { success: false, error: 'Facebook login no implementado aún' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Envía un email de recuperación de contraseña usando Firebase Auth.
 * El usuario recibe un enlace para restablecer su contraseña.
 */
export const resetPassword = async (email) => {
  try {
    // Verificar que Firebase Auth esté disponible
    if (!auth) {
      throw new Error('Servicio de autenticación no disponible. Verifica la configuración de Firebase.');
    }

    // Validar email
    if (!email) {
      throw new Error('Email es requerido');
    }

    await sendPasswordResetEmail(auth, email);

    return {
      success: true,
      message: 'Email de recuperación enviado. Revisa tu bandeja de entrada.'
    };
  } catch (error) {
    console.error('Error en reset password:', error);

    // Manejar errores específicos de Firebase
    let errorMessage = 'Error al enviar email de recuperación';

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No existe una cuenta con este email';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Email inválido';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Demasiadas solicitudes. Inténtalo más tarde';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Error de conexión. Verifica tu internet';
        break;
      default:
        errorMessage = error.message || errorMessage;
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Cierra la sesión del usuario actual en Firebase Auth.
 * Elimina la sesión activa y limpia el estado de autenticación.
 */
export const logout = async () => {
  try {
    // Verificar que Firebase Auth esté disponible
    if (!auth) {
      // Si Firebase no está disponible, solo limpiar localStorage
      localStorage.removeItem('changanet_token');
      localStorage.removeItem('changanet_user');
      return { success: true, message: 'Sesión cerrada localmente' };
    }

    // Limpiar tokens locales antes de cerrar sesión en Firebase
    localStorage.removeItem('changanet_token');
    localStorage.removeItem('changanet_user');

    await signOut(auth);

    return {
      success: true,
      message: 'Sesión cerrada correctamente'
    };
  } catch (error) {
    console.error('Error en logout:', error);

    // Intentar limpiar localStorage aunque Firebase falle
    localStorage.removeItem('changanet_token');
    localStorage.removeItem('changanet_user');

    let errorMessage = 'Error al cerrar sesión';

    switch (error.code) {
      case 'auth/network-request-failed':
        errorMessage = 'Error de conexión, pero sesión cerrada localmente';
        break;
      default:
        errorMessage = error.message || errorMessage;
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Configura un observador para cambios en el estado de autenticación.
 * Ejecuta el callback proporcionado cuando el usuario inicia o cierra sesión.
 */
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};