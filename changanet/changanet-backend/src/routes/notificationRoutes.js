/**
 * @archivo src/routes/notificationRoutes.js - Rutas de notificaciones
 * @descripción Define endpoints REST para gestión de notificaciones (REQ-19, REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar API de Notificaciones
 * @impacto Social: Endpoints seguros para gestión de notificaciones accesibles
 */

const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// GET /api/notifications - Obtener notificaciones del usuario
router.get('/', authenticateToken, notificationController.getNotifications);

// PUT /api/notifications/:id/read - Marcar notificación como leída
router.put('/:id/read', authenticateToken, notificationController.markAsRead);

// PUT /api/notifications/read-all - Marcar todas como leídas
router.put('/read-all', authenticateToken, notificationController.markAllAsRead);

// DELETE /api/notifications/:id - Eliminar notificación
router.delete('/:id', authenticateToken, notificationController.deleteNotification);

module.exports = router;