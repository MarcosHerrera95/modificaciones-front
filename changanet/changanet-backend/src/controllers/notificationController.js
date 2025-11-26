const { NotificationService } = require('../services/notificationService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
  }

  // GET /api/notifications - Obtener notificaciones del usuario
  async getUserNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const result = await this.notificationService.getUserNotifications(
        userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener notificaciones'
      });
    }
  }

  // POST /api/notifications/mark-read - Marcar notificación como leída
  async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.body;

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'ID de notificación requerido'
        });
      }

      const notification = await this.notificationService.markAsRead(notificationId, userId);

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar notificación como leída'
      });
    }
  }

  // POST /api/notifications/mark-all-read - Marcar todas como leídas
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      const result = await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        data: {
          modifiedCount: result.count
        }
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar todas las notificaciones como leídas'
      });
    }
  }

  // GET /api/notifications/unread-count - Contador de no leídas
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;

      const count = await this.notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener contador de notificaciones'
      });
    }
  }

  // GET /api/notifications/preferences/:userId - Obtener preferencias
  async getUserPreferences(req, res) {
    try {
      const { userId } = req.params;

      // Verificar permisos (solo el propio usuario o admin)
      if (req.user.id !== userId && req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const preferences = await this.notificationService.getUserPreferences(userId);

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error getting preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener preferencias'
      });
    }
  }

  // PUT /api/notifications/preferences/:userId - Actualizar preferencias
  async updateUserPreferences(req, res) {
    try {
      const { userId } = req.params;
      const preferences = req.body;

      // Verificar permisos
      if (req.user.id !== userId && req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      // Validar estructura de preferencias
      const validTypes = ['system', 'message', 'payment', 'urgent', 'review', 'admin'];
      for (const [type, prefs] of Object.entries(preferences)) {
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            success: false,
            message: `Tipo de notificación inválido: ${type}`
          });
        }
        if (typeof prefs.inapp !== 'boolean' || typeof prefs.push !== 'boolean' || typeof prefs.email !== 'boolean') {
          return res.status(400).json({
            success: false,
            message: 'Preferencias deben ser booleanas'
          });
        }
      }

      await this.notificationService.updateUserPreferences(userId, preferences);

      res.json({
        success: true,
        message: 'Preferencias actualizadas correctamente'
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar preferencias'
      });
    }
  }

  // POST /api/notifications/dispatch - Enviar notificación manual (admin/sistema)
  async dispatchNotification(req, res) {
    try {
      const { userId, type, title, message, data, channel } = req.body;

      // Solo admin puede enviar notificaciones manuales
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      if (!userId || !type || !title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos: userId, type, title, message'
        });
      }

      const notification = await this.notificationService.createNotification(
        userId,
        type,
        title,
        message,
        data || {},
        channel || 'inapp'
      );

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Error dispatching notification:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar notificación'
      });
    }
  }

  // POST /api/notifications/bulk - Enviar notificaciones masivas
  async bulkDispatch(req, res) {
    try {
      const { userIds, type, title, message, data, channel } = req.body;

      // Solo admin puede enviar notificaciones masivas
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      if (!Array.isArray(userIds) || !type || !title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos: userIds (array), type, title, message'
        });
      }

      const notifications = [];
      for (const userId of userIds) {
        const notification = await this.notificationService.createNotification(
          userId,
          type,
          title,
          message,
          data || {},
          channel || 'inapp'
        );
        notifications.push(notification);
      }

      res.json({
        success: true,
        data: {
          sent: notifications.length,
          notifications
        }
      });
    } catch (error) {
      console.error('Error bulk dispatching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar notificaciones masivas'
      });
    }
  }

  // POST /api/notifications/schedule - Programar notificación
  async scheduleNotification(req, res) {
    try {
      const { userId, type, title, message, data, channel, scheduledAt } = req.body;

      // Solo admin puede programar notificaciones
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      if (!userId || !type || !title || !message || !scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos: userId, type, title, message, scheduledAt'
        });
      }

      // Aquí iría la lógica para programar en cola
      // Por simplicidad, crear inmediatamente
      const notification = await this.notificationService.createNotification(
        userId,
        type,
        title,
        message,
        data || {},
        channel || 'inapp'
      );

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
      res.status(500).json({
        success: false,
        message: 'Error al programar notificación'
      });
    }
  }

  // Métodos legacy para compatibilidad con rutas existentes
  async getNotifications(req, res) {
    return this.getUserNotifications(req, res);
  }

  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Soft delete - marcar como eliminada cambiando el estado
      await this.notificationService.updateNotificationStatus(id, 'deleted');

      res.json({
        success: true,
        message: 'Notificación eliminada'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar notificación'
      });
    }
  }

  async registerFCMToken(req, res) {
    try {
      const userId = req.user.id;
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token FCM requerido'
        });
      }

      // Actualizar token FCM en la tabla usuarios
      await prisma.usuarios.update({
        where: { id: userId },
        data: { fcm_token: token }
      });

      res.json({
        success: true,
        message: 'Token FCM registrado correctamente'
      });
    } catch (error) {
      console.error('Error registering FCM token:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar token FCM'
      });
    }
  }

  async unregisterFCMToken(req, res) {
    try {
      const userId = req.user.id;

      await prisma.usuarios.update({
        where: { id: userId },
        data: { fcm_token: null }
      });

      res.json({
        success: true,
        message: 'Token FCM eliminado correctamente'
      });
    } catch (error) {
      console.error('Error unregistering FCM token:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar token FCM'
      });
    }
  }

  async sendTestNotification(req, res) {
    try {
      const userId = req.user.id;

      const notification = await this.notificationService.createNotification(
        userId,
        'system',
        'Notificación de Prueba',
        'Esta es una notificación de prueba del sistema Changánet',
        { test: true }
      );

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar notificación de prueba'
      });
    }
  }

  async getNotificationPreferences(req, res) {
    return this.getUserPreferences(req, res);
  }

  async updateNotificationPreferences(req, res) {
    return this.updateUserPreferences(req, res);
  }
}

module.exports = new NotificationController();