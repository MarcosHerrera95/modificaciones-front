const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Centro de notificaciones
router.get('/', notificationController.getUserNotifications);
router.post('/mark-read', notificationController.markAsRead);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.get('/unread-count', notificationController.getUnreadCount);

// Preferencias de usuario
router.get('/preferences/:userId', notificationController.getUserPreferences);
router.put('/preferences/:userId', notificationController.updateUserPreferences);

// Sistema interno / eventos (solo admin)
router.post('/dispatch', notificationController.dispatchNotification);
router.post('/bulk', notificationController.bulkDispatch);
router.post('/schedule', notificationController.scheduleNotification);

module.exports = router;