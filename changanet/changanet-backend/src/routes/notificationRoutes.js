const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticate');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  updateFCMToken
} = require('../controllers/notificationController');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Obtener notificaciones del usuario
router.get('/', getNotifications);

// Marcar notificación específica como leída
router.put('/:id/read', markAsRead);

// Marcar todas las notificaciones como leídas
router.put('/read-all', markAllAsRead);

// Eliminar notificación
router.delete('/:id', deleteNotification);

// Actualizar token FCM del usuario
router.put('/fcm-token', updateFCMToken);

module.exports = router;