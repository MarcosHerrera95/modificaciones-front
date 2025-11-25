/**
 * Rutas para gestión de comisiones
 * Solo accesibles para administradores
 */

const express = require('express');
const commissionController = require('../controllers/commissionController');
const { authenticateToken } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();

// Todas las rutas requieren autenticación de admin
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/commissions/active
// Obtiene configuración de comisión activa
router.get('/active', commissionController.getActiveCommissionSettings);

// PUT /api/admin/commissions/update
// Actualiza configuración de comisión
router.put('/update', commissionController.updateCommissionSettings);

// GET /api/admin/commissions/history
// Obtiene historial de configuraciones
router.get('/history', commissionController.getCommissionHistory);

// POST /api/admin/commissions/calculate
// Calcula comisión para testing
router.post('/calculate', commissionController.calculateCommission);

module.exports = router;