/**
 * Rutas de administración
 * REQ-40: Panel admin para gestión de verificaciones
 */

const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authenticate');
const { requireAdmin, requirePermission, requireRole } = require('../middleware/rbac');

const router = express.Router();

// Aplicar middleware de autenticación y RBAC a todas las rutas
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
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/block', adminController.toggleUserBlock);
router.put('/users/:userId/role', adminController.changeUserRole);

// Gestión manual de pagos
router.post('/payments/:paymentId/release-funds', adminController.manualReleaseFunds);

// Gestión de servicios
router.get('/services', adminController.getServicesList);
router.put('/services/:serviceId/status', adminController.updateServiceStatus);

// Moderación de contenido
router.get('/moderation/reports', requirePermission('moderation.view'), adminController.getModerationReports);
router.post('/moderation/reports/:reportId/assign', requirePermission('moderation.manage'), adminController.assignModerationReport);
router.post('/moderation/reports/:reportId/resolve', requirePermission('moderation.manage'), adminController.resolveModerationReport);
router.delete('/reviews/:reviewId', requirePermission('moderation.delete'), adminController.deleteReview);

// Gestión de disputas
router.get('/disputes', requirePermission('disputes.view'), adminController.getDisputes);
router.get('/disputes/:disputeId', requirePermission('disputes.view'), adminController.getDisputeDetails);
router.post('/disputes/:disputeId/resolve', requirePermission('disputes.resolve'), adminController.resolveDispute);
router.post('/disputes/:disputeId/refund', requirePermission('disputes.refund'), adminController.processRefund);

// Configuración y comisiones
router.get('/settings', requirePermission('settings.view'), adminController.getSettings);
router.put('/settings', requirePermission('settings.edit'), adminController.updateSettings);
router.get('/commissions/history', requirePermission('commissions.view'), adminController.getCommissionHistory);
router.put('/commissions/update', requirePermission('commissions.edit'), adminController.updateCommissionSettings);

// Logs de auditoría
router.get('/audit-logs', requirePermission('audit.view'), adminController.getAuditLogs);

// Métricas avanzadas
router.get('/metrics/detailed', requirePermission('reports.view'), adminController.getDetailedMetrics);
router.get('/metrics/export', requirePermission('reports.export'), adminController.exportMetrics);

// Gestión de administradores (solo superadmin)
router.get('/admins', requireRole('superadmin'), adminController.getAdmins);
router.post('/admins', requireRole('superadmin'), adminController.createAdmin);
router.put('/admins/:adminId/role', requireRole('superadmin'), adminController.updateAdminRole);
router.put('/admins/:adminId/status', requireRole('superadmin'), adminController.toggleAdminStatus);

// Reportes y exportación
router.get('/reports/users', requirePermission('reports.view'), adminController.generateUserReport);
router.get('/reports/services', requirePermission('reports.view'), adminController.generateServiceReport);
router.get('/reports/financial', requirePermission('reports.view'), adminController.generateFinancialReport);

module.exports = router;