/**
 * Servicio de Auditoría para Panel de Administración
 * Registra todas las acciones críticas de administradores según PRD
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Registrar una acción en el log de auditoría
 */
exports.logAction = async ({
  adminId,
  action,
  targetType,
  targetId,
  details = {},
  ipAddress,
  userAgent
}) => {
  try {
    await prisma.admin_audit_log.create({
      data: {
        admin_id: adminId,
        action,
        target_type: targetType,
        target_id: targetId,
        details: JSON.stringify(details),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
    // No fallar la operación principal por error de logging
  }
};

/**
 * Obtener logs de auditoría con filtros
 */
exports.getAuditLogs = async ({
  adminId,
  action,
  targetType,
  targetId,
  startDate,
  endDate,
  page = 1,
  limit = 50
}) => {
  const where = {};

  if (adminId) where.admin_id = adminId;
  if (action) where.action = action;
  if (targetType) where.target_type = targetType;
  if (targetId) where.target_id = targetId;

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = new Date(startDate);
    if (endDate) where.created_at.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.admin_audit_log.findMany({
      where,
      include: {
        admin: {
          select: { id: true, nombre: true, email: true }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.admin_audit_log.count({ where })
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Acciones comunes predefinidas
 */
exports.AUDIT_ACTIONS = {
  // Usuarios
  USER_BLOCKED: 'user_blocked',
  USER_UNBLOCKED: 'user_unblocked',
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_DELETED: 'user_deleted',

  // Verificaciones
  VERIFICATION_APPROVED: 'verification_approved',
  VERIFICATION_REJECTED: 'verification_rejected',

  // Moderación
  CONTENT_REPORTED: 'content_reported',
  CONTENT_MODERATED: 'content_moderated',
  REVIEW_DELETED: 'review_deleted',

  // Pagos y Disputas
  PAYMENT_RELEASED: 'payment_released',
  PAYMENT_REFUNDED: 'payment_refunded',
  DISPUTE_OPENED: 'dispute_opened',
  DISPUTE_RESOLVED: 'dispute_resolved',

  // Configuración
  COMMISSION_CHANGED: 'commission_changed',
  SETTING_CHANGED: 'setting_changed',

  // Sistema
  ADMIN_LOGIN: 'admin_login',
  ADMIN_LOGOUT: 'admin_logout',
  PERMISSION_CHANGED: 'permission_changed'
};

/**
 * Tipos de objetivos comunes
 */
exports.AUDIT_TARGET_TYPES = {
  USER: 'user',
  VERIFICATION: 'verification',
  REVIEW: 'review',
  SERVICE: 'service',
  PAYMENT: 'payment',
  DISPUTE: 'dispute',
  SETTING: 'setting',
  SYSTEM: 'system'
};