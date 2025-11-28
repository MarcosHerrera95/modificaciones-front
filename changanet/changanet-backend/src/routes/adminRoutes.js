/**
 * Rutas de administración
 * REQ-40: Panel admin para gestión de verificaciones
 */

const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateAdminToken, requireAdminPermission, requireAdminRole } = require('../middleware/adminJwtAuth');
const { csrfProtection } = require('../middleware/csrfProtection');

const router = express.Router();

// Aplicar middleware de autenticación de admin a todas las rutas
router.use(authenticateAdminToken);

// Ruta para obtener token CSRF (antes de la protección CSRF)
router.get('/csrf-token', (req, res) => {
  const token = req.cookies['csrf-token'] || req.headers['x-csrf-token'];
  if (token) {
    res.json({ success: true, token });
  } else {
    res.status(404).json({ success: false, error: 'Token CSRF no encontrado' });
  }
});

// Aplicar protección CSRF a rutas que modifican estado
router.use('/users/:userId/status', csrfProtection);
router.use('/verifications/:requestId/approve', csrfProtection);
router.use('/verifications/:requestId/reject', csrfProtection);
router.use('/users/:userId/block', csrfProtection);
router.use('/users/:userId/role', csrfProtection);
router.use('/payments/:paymentId/release-funds', csrfProtection);
router.use('/services/:serviceId/status', csrfProtection);
router.use('/moderation/reports/:reportId/assign', csrfProtection);
router.use('/moderation/reports/:reportId/resolve', csrfProtection);
router.use('/reviews/:reviewId', csrfProtection);
router.use('/disputes/:disputeId/resolve', csrfProtection);
router.use('/disputes/:disputeId/refund', csrfProtection);
router.use('/settings', csrfProtection);
router.use('/commissions/update', csrfProtection);
router.use('/admins', csrfProtection);
router.use('/admins/:adminId/role', csrfProtection);
router.use('/admins/:adminId/status', csrfProtection);

// Gestión de verificaciones
router.get('/verifications/pending', adminController.getPendingVerifications);
router.post('/verifications/:requestId/approve', adminController.approveVerification);
router.post('/verifications/:requestId/reject', adminController.rejectVerification);

// Estadísticas del sistema
router.get('/stats', adminController.getSystemStats);

// Gestión de usuarios
router.get('/users', adminController.getUsersList);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/block', adminController.toggleUserBlock);
router.put('/users/:userId/role', adminController.changeUserRole);
router.patch('/users/:userId/status', adminController.updateUserStatus);

// Gestión manual de pagos
router.post('/payments/:paymentId/release-funds', adminController.manualReleaseFunds);

// Gestión de servicios
router.get('/services', adminController.getServicesList);
router.put('/services/:serviceId/status', adminController.updateServiceStatus);

// Moderación de contenido
router.get('/moderation/reports', requireAdminPermission('moderation.view'), adminController.getModerationReports);
router.post('/moderation/reports/:reportId/assign', requireAdminPermission('moderation.manage'), adminController.assignModerationReport);
router.post('/moderation/reports/:reportId/resolve', requireAdminPermission('moderation.manage'), adminController.resolveModerationReport);
router.delete('/reviews/:reviewId', requireAdminPermission('moderation.delete'), adminController.deleteReview);

// Gestión de disputas
router.get('/disputes', requireAdminPermission('disputes.view'), adminController.getDisputes);
router.get('/disputes/:disputeId', requireAdminPermission('disputes.view'), adminController.getDisputeDetails);
router.post('/disputes/:disputeId/resolve', requireAdminPermission('disputes.resolve'), adminController.resolveDispute);
router.post('/disputes/:disputeId/refund', requireAdminPermission('disputes.refund'), adminController.processRefund);

// Configuración y comisiones
router.get('/settings', requireAdminPermission('settings.view'), adminController.getSettings);
router.put('/settings', requireAdminPermission('settings.edit'), adminController.updateSettings);
router.get('/commissions/history', requireAdminPermission('commissions.view'), adminController.getCommissionHistory);
router.put('/commissions/update', requireAdminPermission('commissions.edit'), adminController.updateCommissionSettings);

// Logs de auditoría
router.get('/audit-logs', requireAdminPermission('audit.view'), adminController.getAuditLogs);

// Métricas avanzadas
router.get('/metrics/detailed', requireAdminPermission('reports.view'), adminController.getDetailedMetrics);
router.get('/metrics/export', requireAdminPermission('reports.export'), adminController.exportMetrics);

// Gestión de administradores (solo superadmin)
router.get('/admins', requireAdminRole('superadmin'), adminController.getAdmins);
router.post('/admins', requireAdminRole('superadmin'), adminController.createAdmin);
router.put('/admins/:adminId/role', requireAdminRole('superadmin'), adminController.updateAdminRole);
router.put('/admins/:adminId/status', requireAdminRole('superadmin'), adminController.toggleAdminStatus);

// Reportes y exportación
router.get('/reports/users', requireAdminPermission('reports.view'), adminController.generateUserReport);
router.get('/reports/services', requireAdminPermission('reports.view'), adminController.generateServiceReport);
router.get('/reports/financial', requireAdminPermission('reports.view'), adminController.generateFinancialReport);

module.exports = router;