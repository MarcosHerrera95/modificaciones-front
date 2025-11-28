import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

// Admin Context
const AdminContext = createContext();

// Admin Provider Component
export const AdminProvider = ({ children }) => {
  const { user } = useAuth();
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    sessionExpiry: null,
    lastActivity: Date.now(),
    loading: true,
    error: null
  });

  // Check if user is admin and session is valid
  const checkAdminAccess = useCallback(() => {
    if (!user || user.rol !== 'admin') {
      setAdminState(prev => ({
        ...prev,
        isAdmin: false,
        loading: false,
        error: 'Acceso denegado: Se requieren permisos de administrador'
      }));
      return false;
    }

    // Check token expiration
    const token = localStorage.getItem('changanet_token');
    if (!token) {
      setAdminState(prev => ({
        ...prev,
        isAdmin: false,
        loading: false,
        error: 'Sesión expirada'
      }));
      return false;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000;
      const currentTime = Date.now();

      if (currentTime >= expiryTime) {
        setAdminState(prev => ({
          ...prev,
          isAdmin: false,
          loading: false,
          error: 'Token expirado'
        }));
        return false;
      }

      setAdminState(prev => ({
        ...prev,
        isAdmin: true,
        sessionExpiry: expiryTime,
        loading: false,
        error: null
      }));
      return true;
    } catch {
      setAdminState(prev => ({
        ...prev,
        isAdmin: false,
        loading: false,
        error: 'Token inválido'
      }));
      return false;
    }
  }, [user]);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    setAdminState(prev => ({
      ...prev,
      lastActivity: Date.now()
    }));
  }, []);

  // Check session timeout (30 minutes of inactivity)
  const checkSessionTimeout = useCallback(() => {
    const { lastActivity } = adminState;
    const timeoutDuration = 30 * 60 * 1000; // 30 minutes
    const currentTime = Date.now();

    if (currentTime - lastActivity > timeoutDuration) {
      setAdminState(prev => ({
        ...prev,
        isAdmin: false,
        error: 'Sesión expirada por inactividad'
      }));
      return false;
    }
    return true;
  }, [adminState.lastActivity]);

  // Refresh admin session
  const refreshAdminSession = useCallback(async () => {
    try {
      const token = localStorage.getItem('changanet_token');
      if (!token) throw new Error('No token available');

      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      const response = await fetch(`${apiBaseUrl}/api/admin/validate-session`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Session validation failed');

      const data = await response.json();
      setAdminState(prev => ({
        ...prev,
        isAdmin: true,
        sessionExpiry: data.expiry,
        lastActivity: Date.now(),
        error: null
      }));

      return { success: true };
    } catch (error) {
      setAdminState(prev => ({
        ...prev,
        isAdmin: false,
        error: error.message
      }));
      return { success: false, error: error.message };
    }
  }, []);

  // Logout admin
  const logoutAdmin = useCallback(() => {
    setAdminState({
      isAdmin: false,
      sessionExpiry: null,
      lastActivity: Date.now(),
      loading: false,
      error: null
    });
  }, []);

  // Activity tracking
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => updateActivity();

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [updateActivity]);

  // Session timeout check
  useEffect(() => {
    const interval = setInterval(() => {
      if (adminState.isAdmin) {
        checkSessionTimeout();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [adminState.isAdmin, checkSessionTimeout]);

  // Check admin access when user changes
  useEffect(() => {
    checkAdminAccess();
  }, [checkAdminAccess]);

  const value = {
    ...adminState,
    checkAdminAccess,
    updateActivity,
    checkSessionTimeout,
    refreshAdminSession,
    logoutAdmin
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};