// src/components/GoogleLoginButton.jsx
/**
 * @component GoogleLoginButton - Botón de login con Google
 * @descripción Componente UI para autenticación con Google OAuth usando Firebase Web SDK (REQ-02)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 2: [Frontend] Implementar Login con Google OAuth
 * @impacto Social: Interfaz accesible con navegación por teclado y estados claros
 */

import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

/**
 * @función GoogleLoginButton - Componente de botón Google OAuth
 * @descripción Renderiza botón accesible que usa Firebase Auth para login con Google (REQ-02)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 2: [Frontend] Implementar Login con Google OAuth
 * @impacto Social: Diseño accesible con navegación por teclado y feedback visual claro
 * @param {string} text - Texto del botón (opcional)
 * @param {string} className - Clases CSS adicionales (opcional)
 * @returns {JSX.Element} Botón de login con Google
 */
const GoogleLoginButton = ({ text = "Iniciar sesión con Google", className = "" }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Enviar datos del usuario a backend para crear/actualizar usuario
      const response = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          nombre: user.displayName,
          foto: user.photoURL
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en login con Google');
      }

      const data = await response.json();

      // Guardar token y datos de usuario
      localStorage.setItem('changanet_token', data.token);
      localStorage.setItem('changanet_user', JSON.stringify(data.user));

      // Redirigir al dashboard apropiado
      window.location.href = data.user.rol === 'profesional' ? '/dashboard-profesional' : '/dashboard-cliente';
    } catch (error) {
      console.error('Error en login con Google:', error);
      alert('Error al iniciar sesión con Google: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={loading}
      className={`w-full min-h-[44px] flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 touch-manipulation ${className} ${
        loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      aria-label="Iniciar sesión con Google"
    >
      {loading ? (
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-3"></div>
          <span>Conectando...</span>
        </div>
      ) : (
        <div className="flex items-center">
           <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
             <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
             <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
             <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
             <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
           </svg>
           <span className="font-medium">{text}</span>
        </div>
      )}
    </button>
  );
};

export default GoogleLoginButton;