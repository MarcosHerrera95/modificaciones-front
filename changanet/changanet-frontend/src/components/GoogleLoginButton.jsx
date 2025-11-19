// src/components/GoogleLoginButton.jsx
/**
 * Componente GoogleLoginButton - Maneja login con Google usando Firebase Authentication
 * Integra con backend externo para completar autenticación y obtener token de sesión
 */

import React, { useState } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const GoogleLoginButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003'; // URL del backend externo
  console.log('GoogleLoginButton: Using backend URL:', backendUrl);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    try {
      console.log("Frontend: Iniciando flujo OAuth de Google con backend:", backendUrl);
      // Paso 1: Login con Firebase para obtener credenciales
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const idToken = credential?.idToken; // Token de ID de Firebase

      if (!idToken) {
         throw new Error("No se pudo obtener el ID Token de Firebase.");
      }

      console.log("Frontend: ID Token obtenido, enviando datos del usuario a backend");

      // Paso 2: Enviar datos del usuario al backend para crear/actualizar usuario y obtener token de sesión
      const response = await fetch(`${backendUrl}/api/auth/google-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          nombre: user.displayName || 'Usuario Google',
          foto: user.photoURL,
          rol: 'cliente' // Rol por defecto para nuevos usuarios de Google
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error de red o backend inaccesible' }));
        throw new Error(errorData.error || `Error del backend: ${response.status}`);
      }

      const data = await response.json();
      console.log("Frontend: Respuesta del backend:", data);

      // Suponiendo que el backend devuelve { token: '...', user: {...} }
      if (data.token && data.user) {
        // Almacenar token de sesión en localStorage con la clave correcta
        localStorage.setItem('changanet_token', data.token);
        localStorage.setItem('changanet_user', JSON.stringify(data.user));
        console.log('Login exitoso, token de sesión almacenado.');
        // Redirigir al dashboard correspondiente según el rol
        const dashboardPath = data.user.rol === 'admin' ? '/admin/dashboard' : '/mi-cuenta';
        window.location.href = dashboardPath;
      } else {
        throw new Error("El backend no devolvió un token de sesión válido.");
      }
    } catch (err) {
      console.error('Error en login con Google:', err);
      setError(err.message || 'Ocurrió un error durante el inicio de sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          width: '100%',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 20px',
          border: '1px solid #dadce0',
          borderRadius: '4px',
          backgroundColor: '#fff',
          color: '#3c4043',
          fontSize: '14px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          transition: 'background-color 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#f8f9fa')}
        onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#fff')}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid #dadce0',
                borderTop: '2px solid #4285f4',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginRight: '12px',
              }}
            />
            <span>Conectando...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <svg
              style={{ width: '20px', height: '20px', marginRight: '12px' }}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Iniciar sesión con Google</span>
          </div>
        )}
      </button>
      {error && <p style={{ color: 'red', fontSize: '14px', marginTop: '8px' }}>Error: {error}</p>}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default GoogleLoginButton;