const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';

class NotificationApi {
  constructor() {
    this.baseURL = `${API_BASE_URL}/api/notifications`;
  }

  // Obtener headers de autenticación
  getAuthHeaders() {
    const token = localStorage.getItem('changanet_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Obtener notificaciones del usuario
  async getUserNotifications(page = 1, limit = 20) {
    try {
      const response = await fetch(`${this.baseURL}?page=${page}&limit=${limit}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al obtener notificaciones');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  // Marcar notificación como leída
  async markAsRead(notificationId) {
    try {
      const response = await fetch(`${this.baseURL}/mark-read`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ notificationId })
      });

      if (!response.ok) {
        throw new Error('Error al marcar notificación como leída');
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Marcar todas como leídas
  async markAllAsRead() {
    try {
      const response = await fetch(`${this.baseURL}/mark-all-read`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al marcar todas las notificaciones como leídas');
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Obtener contador de notificaciones no leídas
  async getUnreadCount() {
    try {
      const response = await fetch(`${this.baseURL}/unread-count`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al obtener contador de notificaciones');
      }

      const data = await response.json();
      return data.data.count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  // Obtener preferencias de notificación
  async getUserPreferences(userId) {
    try {
      const response = await fetch(`${this.baseURL}/preferences/${userId}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al obtener preferencias');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting preferences:', error);
      throw error;
    }
  }

  // Actualizar preferencias de notificación
  async updateUserPreferences(userId, preferences) {
    try {
      const response = await fetch(`${this.baseURL}/preferences/${userId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error('Error al actualizar preferencias');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  // Registrar token FCM para push notifications
  async registerFCMToken(token) {
    try {
      const response = await fetch(`${this.baseURL}/register-token`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        throw new Error('Error al registrar token FCM');
      }

      return await response.json();
    } catch (error) {
      console.error('Error registering FCM token:', error);
      throw error;
    }
  }

  // Eliminar token FCM
  async unregisterFCMToken() {
    try {
      const response = await fetch(`${this.baseURL}/unregister-token`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al eliminar token FCM');
      }

      return await response.json();
    } catch (error) {
      console.error('Error unregistering FCM token:', error);
      throw error;
    }
  }

  // Solicitar permisos para notificaciones push
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones push');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // Mostrar notificación local (fallback)
  showLocalNotification(title, body, data = {}) {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        data
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-cerrar después de 5 segundos
      setTimeout(() => notification.close(), 5000);
    }
  }
}

export default new NotificationApi();