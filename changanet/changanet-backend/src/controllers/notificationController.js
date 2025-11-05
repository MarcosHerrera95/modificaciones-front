/**
 * @archivo src/controllers/notificationController.js - Controlador de notificaciones
 * @descripción Maneja operaciones CRUD de notificaciones (REQ-19, REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar Controlador de Notificaciones
 * @impacto Social: Gestión segura de notificaciones para todos los usuarios
 */

const notificationService = require('../services/notificationService');

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