/**
 * Contexto de autenticación para la aplicación Changánet.
 * Gestiona el estado de autenticación del usuario y proporciona métodos de login/logout.
 */
import { createContext, useState, useEffect, useContext } from 'react';
import { setUserContext } from '../config/sentryConfig';

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
    // Recupera datos de usuario del localStorage al inicializar
    const token = localStorage.getItem('changanet_token');
    if (token) {
      try {
        const userData = JSON.parse(localStorage.getItem('changanet_user'));
        console.log('AuthContext - Loaded user from localStorage:', userData);
        console.log('AuthContext - User name:', userData?.nombre || 'NO NAME');
        console.log('AuthContext - User role:', userData?.rol || userData?.role || 'NO ROLE');
        setUser(userData);
      } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
        // Limpiar datos corruptos
        localStorage.removeItem('changanet_token');
        localStorage.removeItem('changanet_user');
      }
    } else {
      console.log('AuthContext - No token found in localStorage');
    }
    setLoading(false);
  }, []);

  // Función para obtener datos actualizados del usuario desde el backend
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('changanet_token');
      if (!token) return;

      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('AuthContext - Fetched current user:', data.user);
        setUser(data.user);
        localStorage.setItem('changanet_user', JSON.stringify(data.user));
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const login = (userData, token) => {
    console.log('Login called with userData:', userData);
    console.log('User role:', userData.rol || userData.role);
    console.log('User name:', userData.nombre || userData.name);

    // Asegurar que el nombre esté disponible
    const userWithName = {
      ...userData,
      nombre: userData.nombre || userData.name || 'Usuario'
    };

    localStorage.setItem('changanet_token', token);
    localStorage.setItem('changanet_user', JSON.stringify(userWithName));
    setUser(userWithName);

    // CONFIGURAR CONTEXTO DE USUARIO EN SENTRY (solo si está disponible)
    setUserContext(userWithName);
  };

  // Método para manejar login con Google (puede ser usado por el GoogleLoginButton)
  const loginWithGoogle = async (userData, token) => {
    // El login con Google funciona igual que el login regular
    login(userData, token);

    // Después del login, obtener datos actualizados del usuario
    setTimeout(() => {
      fetchCurrentUser();
    }, 100);
  };

  const loginWithEmail = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        let errorMessage = 'Error al iniciar sesión';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.warn('No se pudo parsear respuesta de error:', parseError);
        }
        return { success: false, error: errorMessage };
      }

      const data = await response.json();

      if (data.token && data.user) {
        login(data.user, data.token);
      }

      return { success: true, user: data.user, token: data.token, message: data.message };
    } catch (error) {
      console.error('Error en loginWithEmail:', error);
      return { success: false, error: 'Error de conexión. Inténtalo de nuevo.' };
    }
  };

  const signup = async (name, email, password, role) => {
    try {
      // Usar el proxy configurado en Vite (/api -> backend)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, rol: role })
      });

      // Verificar que la respuesta sea válida antes de parsear JSON
      if (!response.ok) {
        let errorMessage = 'Error al registrar usuario';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // Si no se puede parsear el JSON, usar mensaje genérico
          console.warn('No se pudo parsear respuesta de error:', parseError);
        }
        return { success: false, error: errorMessage };
      }

      // Solo parsear JSON si la respuesta es exitosa
      const data = await response.json();

      // Si el registro es exitoso, hacer login automático
      if (data.token && data.user) {
        login(data.user, data.token);

        // Registrar métrica de registro en frontend (solo si Sentry está disponible)
        try {
          // Verificar si Sentry está disponible antes de intentar usarlo
          if (typeof window !== 'undefined' && window.Sentry && window.Sentry.captureMessage) {
            window.Sentry.captureMessage('Usuario registrado desde frontend', 'info', {
              tags: {
                event: 'user_registration_frontend',
                user_role: data.user.rol,
                source: 'frontend_signup',
                business_metric: 'user_acquisition'
              },
              extra: {
                user_id: data.user.id,
                email: data.user.email,
                role: data.user.rol,
                timestamp: new Date().toISOString(),
                business_impact: 'social_economic_environmental'
              }
            });
          }
        } catch (error) {
          // Sentry no está disponible, continuar sin problemas
        }
      }
      return { success: true, message: data.message || 'Usuario creado exitosamente.' };
    } catch (error) {
      console.error('Error en signup:', error);
      return { success: false, error: 'No pudimos crear tu cuenta. Inténtalo de nuevo.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('changanet_token');
    localStorage.removeItem('changanet_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, loginWithEmail, loginWithGoogle, fetchCurrentUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
