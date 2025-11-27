import React from 'react';
import { setUserContext } from '../config/sentryConfig';
import { AuthContext } from './AuthContextConstants';

// Disable hot reload for this file to prevent React hooks issues during hot reload
if (import.meta.hot) {
  import.meta.hot.decline();
}

export class AuthProvider extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null,
      loading: true
    };
  }

  componentDidMount() {
    // Recupera datos de usuario del localStorage al inicializar
    const token = localStorage.getItem('changanet_token');
    if (token) {
      try {
        const userData = JSON.parse(localStorage.getItem('changanet_user'));
        console.log('AuthContext - Loaded user from localStorage:', userData);
        console.log('AuthContext - User name:', userData?.nombre || 'NO NAME');
        console.log('AuthContext - User role:', userData?.rol || userData?.role || 'NO ROLE');

        // Validar que el usuario existe en el backend
        this.validateUserToken(userData, token);

        // Configurar renovación automática de tokens
        this.setupTokenAutoRenewal();
      } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
        // Limpiar datos corruptos
        localStorage.removeItem('changanet_token');
        localStorage.removeItem('changanet_user');
        this.setState({ loading: false });
      }
    } else {
      console.log('AuthContext - No token found in localStorage');
      this.setState({ loading: false });
    }
  }

  // Función para validar que el token y usuario son válidos
  validateUserToken = async (userData, token) => {
    try {
      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // Usuario válido, establecer en estado
        this.setState({ user: userData, loading: false });
      } else if (response.status === 401 || response.status === 403) {
        // Token inválido o usuario no encontrado, limpiar storage
        console.warn('AuthContext - Token inválido o usuario no encontrado, limpiando localStorage');
        localStorage.removeItem('changanet_token');
        localStorage.removeItem('changanet_user');
        this.setState({ user: null, loading: false });
      } else {
        // Otro error, mantener usuario por ahora
        console.warn('AuthContext - Error validando token, manteniendo usuario:', response.status);
        this.setState({ user: userData, loading: false });
      }
    } catch (error) {
      console.error('AuthContext - Error validando token:', error);
      // En caso de error de red, mantener usuario
      this.setState({ user: userData, loading: false });
    }
  };

  // Función para obtener datos actualizados del usuario desde el backend
  fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('changanet_token');
      if (!token) return;

      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      console.log("🟡 fetchCurrentUser: Making request to /api/auth/me");
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🟡 AuthContext - Fetched current user:', data.user);
        console.log('🟡 fetchCurrentUser - url_foto_perfil from server:', data.user?.url_foto_perfil);
        this.setState({ user: data.user });
        localStorage.setItem('changanet_user', JSON.stringify(data.user));
        console.log('🟡 Updated localStorage with user data including photo');
      } else {
        console.log('🟡 fetchCurrentUser failed with status:', response.status);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  login = (userData, token, refreshToken = null) => {
    console.log('Login called with userData:', userData);
    console.log('User role:', userData.rol || userData.role);
    console.log('User name:', userData.nombre || userData.name);

    // Asegurar que el nombre esté disponible
    const userWithName = {
      ...userData,
      nombre: userData.nombre || userData.name || 'Usuario'
    };

    localStorage.setItem('changanet_token', token);
    if (refreshToken) {
      localStorage.setItem('changanet_refresh_token', refreshToken);
    }
    localStorage.setItem('changanet_user', JSON.stringify(userWithName));
    this.setState({ user: userWithName });

    // CONFIGURAR CONTEXTO DE USUARIO EN SENTRY (solo si está disponible)
    setUserContext(userWithName);
  };

  // Método para manejar login con Google (puede ser usado por el GoogleLoginButton)
  loginWithGoogle = async (userData, token) => {
    console.log("🟡 loginWithGoogle called with:", userData);
    console.log("🟡 userData.url_foto_perfil:", userData.url_foto_perfil);
    
    // El login con Google funciona igual que el login regular
    this.login(userData, token);

    console.log("🟡 After this.login, fetching current user data...");
    // Después del login, obtener datos actualizados del usuario
    this.fetchCurrentUser();
  };

  loginWithEmail = async (email, password) => {
    try {
      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      console.log('AuthContext - loginWithEmail: Starting fetch to:', `${apiBaseUrl}/api/auth/login`);
      console.log('AuthContext - loginWithEmail: Request body:', { email, password });

      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-cache'
      });

      console.log('AuthContext - loginWithEmail: Response status:', response.status);
      console.log('AuthContext - loginWithEmail: Response ok:', response.ok);

      if (!response.ok) {
        let errorMessage = 'Error al iniciar sesión';
        try {
          const errorData = await response.json();
          console.log('AuthContext - loginWithEmail: Error response data:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.warn('AuthContext - loginWithEmail: No se pudo parsear respuesta de error:', parseError);
        }
        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      console.log('AuthContext - loginWithEmail: Success response data:', data);

      if (data.token && data.user) {
        this.login(data.user, data.token, data.refreshToken);
      }

      return { success: true, user: data.user, token: data.token, refreshToken: data.refreshToken, message: data.message };
    } catch (error) {
      console.error('AuthContext - loginWithEmail: Fetch error:', error);
      console.error('AuthContext - loginWithEmail: Error type:', error.constructor.name);
      console.error('AuthContext - loginWithEmail: Error message:', error.message);

      // Distinguish between network errors and other errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('AuthContext - loginWithEmail: Network error - check if backend server is running');
        return { success: false, error: 'Error de conexión. Verifica que el servidor esté funcionando.' };
      } else {
        console.error('AuthContext - loginWithEmail: Unexpected error');
        return { success: false, error: 'Error inesperado. Inténtalo de nuevo.' };
      }
    }
  };

  signup = async (name, email, password, role) => {
    try {
      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
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
        this.login(data.user, data.token, data.refreshToken);

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
      const errorMessage = error.message || 'No pudimos crear tu cuenta. Inténtalo de nuevo.';
      return { success: false, error: errorMessage };
    }
  };

  // Configurar renovación automática de tokens
  setupTokenAutoRenewal = () => {
    // Verificar token cada 5 minutos
    this.tokenCheckInterval = setInterval(async () => {
      const token = localStorage.getItem('changanet_token');
      if (token && this.isTokenExpiringSoon(token)) {
        console.log('🔄 Token expiring soon, attempting automatic renewal...');
        await this.refreshToken();
      }
    }, 5 * 60 * 1000); // 5 minutos

    // Configurar interceptor para renovar tokens automáticamente en requests fallidos
    this.setupRequestInterceptor();
  };

  // Verificar si el token está próximo a expirar (menos de 10 minutos)
  isTokenExpiringSoon = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convertir a milisegundos
      const currentTime = Date.now();
      const timeUntilExpiry = expirationTime - currentTime;

      // Considerar expirando si quedan menos de 10 minutos
      return timeUntilExpiry < (10 * 60 * 1000);
    } catch (error) {
      console.warn('Error parsing token for expiry check:', error);
      return true; // Si no podemos parsear, asumir que está expirando
    }
  };

  // Configurar interceptor para requests HTTP
  setupRequestInterceptor = () => {
    // Guardar referencia original de fetch solo una vez
    if (!window.originalFetch) {
      window.originalFetch = window.fetch;
    }

    window.fetch = async (...args) => {
      const [url, options = {}] = args;

      // Solo interceptar requests a nuestro backend
      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      if (!url.startsWith(apiBaseUrl)) {
        return window.originalFetch(...args);
      }

      // Agregar token de autorización si existe
      const token = localStorage.getItem('changanet_token');
      if (token && !options.headers?.Authorization) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        };
      }

      let response = await window.originalFetch(url, options);

      // Si obtenemos 401, intentar renovar token automáticamente
      if (response.status === 401) {
        console.log('🚨 401 received, attempting token refresh...');

        const refreshResult = await this.refreshToken();
        if (refreshResult.success) {
          // Reintentar la request con el nuevo token
          const newToken = localStorage.getItem('changanet_token');
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          };

          console.log('🔄 Retrying request with refreshed token...');
          response = await window.originalFetch(url, options);
        }
      }

      return response;
    };
  };

  // Método para refrescar tokens automáticamente con mejor manejo de errores
  refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('changanet_refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      const response = await fetch(`${apiBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Refresh token expired or invalid');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.token && data.refreshToken) {
        // Actualizar tokens en localStorage
        localStorage.setItem('changanet_token', data.token);
        localStorage.setItem('changanet_refresh_token', data.refreshToken);

        // Actualizar estado del usuario si está disponible
        if (data.user) {
          this.setState({ user: data.user });
          localStorage.setItem('changanet_user', JSON.stringify(data.user));
        }

        console.log('✅ Token refreshed successfully');
        return { success: true, token: data.token };
      } else {
        throw new Error('Invalid refresh response format');
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);

      // Si falla el refresh, hacer logout y redirigir a login
      this.logout();

      // Solo mostrar error si no es un problema de red
      if (!error.message.includes('Failed to fetch')) {
        return { success: false, error: 'Sesión expirada. Por favor, inicia sesión nuevamente.' };
      }

      return { success: false, error: 'Error de conexión. Inténtalo nuevamente.' };
    }
  };

  componentWillUnmount() {
    // Limpiar interval de verificación de tokens
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }

    // Restaurar fetch original si fue modificado
    if (window.originalFetch) {
      window.fetch = window.originalFetch;
    }
  }

  logout = async () => {
    try {
      const token = localStorage.getItem('changanet_token');
      if (token) {
        // Llamar al endpoint de logout en el backend para revocar tokens
        const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
        await fetch(`${apiBaseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.warn('Error calling logout endpoint:', error);
    }

    // Limpiar interval de verificación de tokens
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }

    // Limpiar localStorage
    localStorage.removeItem('changanet_token');
    localStorage.removeItem('changanet_refresh_token');
    localStorage.removeItem('changanet_user');
    this.setState({ user: null });
  };

  render() {
    const { user, loading } = this.state;
    return (
      <AuthContext.Provider value={{ user, login: this.login, logout: this.logout, signup: this.signup, loginWithEmail: this.loginWithEmail, loginWithGoogle: this.loginWithGoogle, refreshToken: this.refreshToken, fetchCurrentUser: this.fetchCurrentUser, loading }}>
        {this.props.children}
      </AuthContext.Provider>
    );
  }
}