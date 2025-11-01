import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "../config/firebaseConfig";

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Registro con email y contraseña
export const registerWithEmail = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(userCredential.user);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Inicio de sesión con email y contraseña
export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Inicio de sesión con Google
export const loginWithGoogle = async () => {
  try {
    // Abrir popup de Google OAuth
    const popup = window.open(
      'http://localhost:3002/api/auth/google',
      'google-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    return new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        // Verificar origen por seguridad
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

      // Timeout después de 5 minutos
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

// Función para actualizar token FCM del usuario
export const updateUserFCMToken = async (token, userId) => {
  try {
    const response = await fetch('http://localhost:3002/api/profile/fcm-token', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
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

// Inicio de sesión con Facebook
export const loginWithFacebook = async () => {
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Recuperación de contraseña
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Cerrar sesión
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Observador de estado de autenticación
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};