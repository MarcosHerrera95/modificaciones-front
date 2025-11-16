// src/routes/adminRoutes.js
const express = require('express');
const { authenticateToken } = require('../middleware/authenticate');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Middleware para verificar rol de admin
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({
      error: 'Acceso denegado. Se requieren permisos de administrador.'
    });
  }
  next();
};

// Aplicar middleware de admin a todas las rutas
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/users
// Lista usuarios con filtros
router.get('/users', adminController.getUsers);

// PUT /api/admin/users/:userId/toggle-block
// Bloquea o desbloquea un usuario
router.put('/users/:userId/toggle-block', adminController.toggleUserBlock);

// GET /api/admin/stats
// Estadísticas generales de la plataforma
router.get('/stats', adminController.getPlatformStats);

// GET /api/admin/disputes
// Lista disputas entre usuarios
router.get('/disputes', adminController.getDisputes);

module.exports = router;