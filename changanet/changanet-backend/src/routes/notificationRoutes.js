/**
 * @archivo src/routes/notificationRoutes.js - Rutas completas de notificaciones y alertas
 * @descripción Implementación completa del módulo Notificaciones y Alertas según PRD
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar API de Notificaciones
 * @impacto Social: Sistema completo de notificaciones in-app, push y email
 */

const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Centro de notificaciones
// GET /api/notifications - Obtener notificaciones del usuario con paginación
router.get('/', notificationController.getUserNotifications.bind(notificationController));

// GET /api/notifications/filtered - Obtener notificaciones con filtros avanzados
router.get('/filtered', notificationController.getFilteredNotifications.bind(notificationController));

// POST /api/notifications/mark-read - Marcar notificación como leída
router.post('/mark-read', notificationController.markAsRead.bind(notificationController));

// POST /api/notifications/mark-all-read - Marcar todas como leídas
router.post('/mark-all-read', notificationController.markAllAsRead.bind(notificationController));

// POST /api/notifications/mark-type-read - Marcar notificaciones por tipo como leídas
router.post('/mark-type-read', notificationController.markTypeAsRead.bind(notificationController));

// GET /api/notifications/unread-count - Contador de notificaciones no leídas
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

// GET /api/notifications/stats - Estadísticas de notificaciones
router.get('/stats', notificationController.getNotificationStats.bind(notificationController));

// Preferencias de usuario
// GET /api/notifications/preferences/:userId - Obtener preferencias
router.get('/preferences/:userId', notificationController.getUserPreferences.bind(notificationController));

// PUT /api/notifications/preferences/:userId - Actualizar preferencias
router.put('/preferences/:userId', notificationController.updateUserPreferences.bind(notificationController));

// Sistema interno / eventos (solo admin)
// POST /api/notifications/dispatch - Enviar notificación manual
router.post('/dispatch', notificationController.dispatchNotification.bind(notificationController));

// POST /api/notifications/bulk - Enviar notificaciones masivas
router.post('/bulk', notificationController.bulkDispatch.bind(notificationController));

// POST /api/notifications/schedule - Programar notificación
router.post('/schedule', notificationController.scheduleNotification.bind(notificationController));

// FCM Token Management (compatibilidad con implementación existente)
// POST /api/notifications/register-token - Registrar token FCM
router.post('/register-token', notificationController.registerFCMToken.bind(notificationController));

// DELETE /api/notifications/unregister-token - Eliminar token FCM
router.delete('/unregister-token', notificationController.unregisterFCMToken.bind(notificationController));

// Rutas de desarrollo para testing
if (process.env.NODE_ENV !== 'production') {
  // POST /api/notifications/test - Enviar notificación de prueba básica
  router.post('/test', notificationController.sendTestNotification.bind(notificationController));

  // POST /api/notifications/test-advanced - Enviar notificación de prueba avanzada
  router.post('/test-advanced', notificationController.sendAdvancedTestNotification.bind(notificationController));

  // POST /api/notifications/test-fcm - Enviar notificación FCM de prueba
  router.post('/test-fcm', async (req, res) => {
    try {
      const { title, body } = req.body;
      const userId = req.user.id;

      // Enviar notificación FCM de prueba
      const { sendPushNotification } = require('../services/pushNotificationService');
      const result = await sendPushNotification(
        userId,
        title || 'Notificación de Prueba FCM',
        body || 'Esta es una notificación de prueba desde Changánet',
        {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      );

      res.status(200).json({
        success: true,
        message: 'Notificación FCM enviada exitosamente',
        data: result
      });
    } catch (error) {
      console.error('Error enviando notificación FCM de prueba:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  });
}

// Rutas legacy para compatibilidad (marcadas como deprecated)
router.put('/:id/read', (req, res) => {
  req.body.notificationId = req.params.id;
  notificationController.markAsRead.bind(notificationController)(req, res);
});

router.put('/read-all', notificationController.markAllAsRead.bind(notificationController));

router.delete('/:id', notificationController.deleteNotification.bind(notificationController));

module.exports = router;