/**
 * Servicio de autenticación para el frontend de Changánet.
 * Maneja registro, login y gestión de sesiones de usuario.
 * Incluye integración con backend para tokens JWT y comunicación postMessage.
 */

/**
 * Registra un nuevo usuario usando email y contraseña.
 * Crea la cuenta en Firebase Auth y envía email de verificación.
 * Retorna el resultado de la operación con el usuario creado.
 */
export const registerWithEmail = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(userCredential.user);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Inicia sesión de un usuario existente con email y contraseña.
 * Autentica las credenciales contra Firebase Auth.
 * Retorna el resultado con el usuario autenticado.
 */
export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Inicia sesión usando autenticación OAuth de Google.
 * Abre una ventana popup que redirige al backend para el flujo OAuth.
 * Maneja la comunicación postMessage entre la popup y la ventana principal.
 * Retorna una promesa que se resuelve con el usuario y token JWT.
 */
export const loginWithGoogle = async () => {
  try {
    // Abre una ventana popup para el flujo de autenticación OAuth
    // Usa el proxy configurado en Vite (/api -> http://localhost:3002)
    const popup = window.open(
      `${window.location.origin}/api/auth/google`,
      'google-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    return new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        // Verifica que el mensaje provenga del mismo origen por seguridad
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          resolve({
            success: true,
            user: event.data.payload.user,
            token: event.data.payload.token
          });
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', handleMessage);

      // Configura un timeout de 5 minutos para evitar esperas infinitas
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        popup.close();
        reject(new Error('Timeout en autenticación con Google'));
      }, 300000);
    });
  } catch (error) {
    console.error('Error en loginWithGoogle:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Actualiza el token FCM del usuario en el backend.
 * Envía una petición PUT al endpoint de perfil con el nuevo token.
 * Utiliza el token JWT almacenado en localStorage para autenticación.
 */
export const updateUserFCMToken = async (token, userId) => {
  try {
    // Usar el proxy configurado en Vite (/api -> http://localhost:3002)
    const response = await fetch('/api/profile/fcm-token', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
      },
      body: JSON.stringify({ fcm_token: token })
    });

    if (!response.ok) {
      throw new Error('Error al actualizar token FCM');
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating FCM token:', error);
    return { success: false, error: error.message };
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
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Cierra la sesión del usuario actual en Firebase Auth.
 * Elimina la sesión activa y limpia el estado de autenticación.
 */
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Configura un observador para cambios en el estado de autenticación.
 * Ejecuta el callback proporcionado cuando el usuario inicia o cierra sesión.
 */
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};