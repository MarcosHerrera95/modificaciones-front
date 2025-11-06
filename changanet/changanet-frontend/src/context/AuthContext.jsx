/**
 * Contexto de autenticación para la aplicación Changánet.
 * Gestiona el estado de autenticación del usuario y proporciona métodos de login/logout.
 */
import { createContext, useState, useEffect, useContext } from 'react';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Recupera datos de usuario del sessionStorage al inicializar
    const token = sessionStorage.getItem('changanet_token');
    if (token) {
      try {
        const userData = JSON.parse(sessionStorage.getItem('changanet_user'));
        setUser(userData);
      } catch (error) {
        console.error('Error parsing user data from sessionStorage:', error);
        // Limpiar datos corruptos
        sessionStorage.removeItem('changanet_token');
        sessionStorage.removeItem('changanet_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    sessionStorage.setItem('changanet_token', token);
    sessionStorage.setItem('changanet_user', JSON.stringify(userData));
    setUser(userData);

    // CONFIGURAR CONTEXTO DE USUARIO EN SENTRY (solo si está disponible)
    try {
      const { setUserContext } = require('../config/sentryConfig');
      setUserContext({
        id: userData.id,
        email: userData.email,
        nombre: userData.nombre,
        rol: userData.rol
      });
    } catch (error) {
      console.warn('Sentry no disponible para configurar contexto de usuario');
    }
  };

  // Método para manejar login con Google (puede ser usado por el GoogleLoginButton)
  const loginWithGoogle = (userData, token) => {
    // El login con Google funciona igual que el login regular
    login(userData, token);
  };

  const signup = async (name, email, password, role) => {
    try {
      // Usar el proxy configurado en Vite (/api -> http://localhost:3002)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role })
      });
      const data = await response.json();

      if (response.ok) {
        // Si el registro es exitoso, hacer login automático
        if (data.token && data.user) {
          login(data.user, data.token);

          // Registrar métrica de registro en frontend (solo si Sentry está disponible)
          try {
            const { captureMessage } = require('../config/sentryConfig');
            captureMessage('Usuario registrado desde frontend', 'info', {
              tags: {
                event: 'user_registration_frontend',
                user_role: data.user.role,
                source: 'frontend_signup',
                business_metric: 'user_acquisition'
              },
              extra: {
                user_id: data.user.id,
                email: data.user.email,
                role: data.user.role,
                timestamp: new Date().toISOString(),
                business_impact: 'social_economic_environmental'
              }
            });
          } catch (error) {
            console.warn('Sentry no disponible para registrar métrica');
          }
        }
        return { success: true, message: data.message || 'Usuario creado exitosamente.' };
      } else {
        return { success: false, error: data.error || 'Error al registrar usuario' };
      }
    } catch (error) {
      console.error('Error en signup:', error);
      return { success: false, error: 'Error de conexión. Inténtalo de nuevo.' };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('changanet_token');
    sessionStorage.removeItem('changanet_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, loginWithGoogle, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
