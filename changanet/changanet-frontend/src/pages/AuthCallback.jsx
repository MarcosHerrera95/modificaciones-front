// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Si estamos en una ventana popup, redirigir al backend para iniciar OAuth
    if (window.opener) {
      // Redirigir al backend para iniciar el flujo de OAuth
      window.location.href = '/api/auth/google';
    } else {
      // Si no estamos en popup, redirigir a home
      navigate('/');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-turquoise-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Redirigiendo a Google...</h2>
        <p className="text-gray-600">Por favor espera mientras te conectamos con Google.</p>
      </div>
    </div>
  );
};

export default AuthCallback;