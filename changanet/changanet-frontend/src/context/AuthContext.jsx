// src/context/AuthContext.jsx
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
    const token = localStorage.getItem('changanet_token');
    if (token) {
      const userData = JSON.parse(localStorage.getItem('changanet_user'));
      setUser(userData);
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('changanet_token', token);
    localStorage.setItem('changanet_user', JSON.stringify(userData));
    setUser(userData);
  };

  // Método para manejar login con Google (puede ser usado por el GoogleLoginButton)
  const loginWithGoogle = (userData, token) => {
    // El login con Google funciona igual que el login regular
    login(userData, token);
  };

  const signup = async (name, email, password, role) => {
    try {
      const response = await fetch('http://localhost:3002/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role })
      });
      const data = await response.json();

      if (response.ok) {
        // Si el registro es exitoso, hacer login automático
        if (data.token && data.user) {
          login(data.user, data.token);
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
    localStorage.removeItem('changanet_token');
    localStorage.removeItem('changanet_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, loginWithGoogle, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
