import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.leida).length);
      } else {
        console.error('Error al obtener notificaciones');
        // Fallback a datos mock para desarrollo
        const mockNotifications = [
          {
            id: '1',
            titulo: 'Bienvenido a Changánet',
            mensaje: '¡Completa tu perfil para comenzar a recibir trabajos!',
            fecha_creacion: new Date().toISOString(),
            leida: false,
            tipo: 'bienvenida'
          },
          {
            id: '2',
            titulo: 'Nueva cotización',
            mensaje: 'Tienes una nueva solicitud de cotización pendiente.',
            fecha_creacion: new Date(Date.now() - 86400000).toISOString(),
            leida: true,
            tipo: 'cotizacion'
          }
        ];
        setNotifications(mockNotifications);
        setUnreadCount(mockNotifications.filter(n => !n.leida).length);
      }
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    }
  }, [user]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, leida: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        console.error('Error al marcar notificación como leída');
      }
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
        setUnreadCount(0);
      } else {
        console.error('Error al marcar todas las notificaciones como leídas');
      }
    } catch (error) {
      console.error('Error al marcar todas las notificaciones como leídas:', error);
    }
  }, [user]);

  const deleteNotification = useCallback(async (notificationId) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const wasUnread = notifications.find(n => n.id === notificationId)?.leida === false;
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } else {
        console.error('Error al eliminar notificación');
      }
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  }, [user, notifications]);

  const addNotification = useCallback((newNotification) => {
    setNotifications(prev => [newNotification, ...prev]);
    if (!newNotification.leida) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification
  };
};