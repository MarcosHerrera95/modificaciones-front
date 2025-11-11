/**
 * @archivo src/controllers/notificationController.js - Controlador de notificaciones
 * @descripción Maneja operaciones CRUD de notificaciones (REQ-19, REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar Controlador de Notificaciones
 * @impacto Social: Gestión segura de notificaciones para todos los usuarios
 */

const notificationService = require('../services/notificationService');
const pushNotificationService = require('../services/pushNotificationService');

/**
 * Obtener notificaciones del usuario autenticado
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { filter } = req.query; // 'all', 'unread', 'read'

    const result = await notificationService.getUserNotifications(userId, filter);

    res.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount
    });
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Marcar una notificación como leída
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: notificationId } = req.params;

    // Verificar que la notificación pertenece al usuario
    const notification = await notificationService.getNotificationById(notificationId);
    if (!notification || notification.usuario_id !== userId) {
      return res.status(404).json({
        error: 'Notificación no encontrada'
      });
    }

    await notificationService.markAsRead(notificationId);

    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    });
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Marcar todas las notificaciones del usuario como leídas
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'Todas las notificaciones marcadas como leídas'
    });
  } catch (error) {
    console.error('Error marcando todas las notificaciones como leídas:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Eliminar una notificación
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: notificationId } = req.params;

    // Verificar que la notificación pertenece al usuario
    const notification = await notificationService.getNotificationById(notificationId);
    if (!notification || notification.usuario_id !== userId) {
      return res.status(404).json({
        error: 'Notificación no encontrada'
      });
    }

    await notificationService.deleteNotification(notificationId);

    res.json({
      success: true,
      message: 'Notificación eliminada'
    });
  } catch (error) {
    console.error('Error eliminando notificación:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Registrar token FCM para notificaciones push
 */
exports.registerFCMToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token FCM es requerido'
      });
    }

    await pushNotificationService.registerFCMToken(userId, token);

    res.json({
      success: true,
      message: 'Token FCM registrado correctamente'
    });
  } catch (error) {
    console.error('Error registrando token FCM:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Eliminar token FCM (logout/dispositivo removido)
 */
exports.unregisterFCMToken = async (req, res) => {
  try {
    const userId = req.user.id;

    await pushNotificationService.unregisterFCMToken(userId);

    res.json({
      success: true,
      message: 'Token FCM eliminado correctamente'
    });
  } catch (error) {
    console.error('Error eliminando token FCM:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Enviar notificación push de prueba
 */
exports.sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id;

    await pushNotificationService.sendPushNotification(
      userId,
      'Notificación de Prueba',
      'Esta es una notificación de prueba de Changánet',
      { type: 'test', timestamp: new Date().toISOString() }
    );

    res.json({
      success: true,
      message: 'Notificación de prueba enviada'
    });
  } catch (error) {
    console.error('Error enviando notificación de prueba:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
};