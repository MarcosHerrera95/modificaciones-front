/**
 * Rutas de administración
 * REQ-40: Panel admin para gestión de verificaciones
 */

const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// Middleware para verificar rol de administrador
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado. Se requieren permisos de administrador.'
    });
  }
  next();
};

// Aplicar middleware de admin a todas las rutas
router.use(authenticateToken);
router.use(requireAdmin);

// Gestión de verificaciones
router.get('/verifications/pending', adminController.getPendingVerifications);
router.post('/verifications/:requestId/approve', adminController.approveVerification);
router.post('/verifications/:requestId/reject', adminController.rejectVerification);

// Estadísticas del sistema
router.get('/stats', adminController.getSystemStats);

// Gestión de usuarios
router.get('/users', adminController.getUsersList);

// Gestión manual de pagos
router.post('/payments/:paymentId/release-funds', adminController.manualReleaseFunds);

module.exports = router;