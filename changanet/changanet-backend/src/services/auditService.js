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
 * Funciones específicas de auditoría para verificación de identidad
 */
exports.logVerificationSubmitted = async (userId, verificationId, documentType, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: userId,
        action: 'verification_submitted',
        resource: 'identity_verification',
        resource_id: verificationId,
        details: JSON.stringify({ document_type: documentType }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging verification submitted:', error);
  }
};

exports.logVerificationApproved = async (adminId, verificationId, userId, reviewNotes, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'verification_approved',
        resource: 'identity_verification',
        resource_id: verificationId,
        details: JSON.stringify({ target_user_id: userId, review_notes: reviewNotes }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging verification approved:', error);
  }
};

exports.logVerificationRejected = async (adminId, verificationId, userId, reviewNotes, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'verification_rejected',
        resource: 'identity_verification',
        resource_id: verificationId,
        details: JSON.stringify({ target_user_id: userId, review_notes: reviewNotes }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging verification rejected:', error);
  }
};

exports.logVerificationDocumentViewed = async (userId, verificationId, documentType, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: userId,
        action: 'verification_document_viewed',
        resource: 'identity_verification',
        resource_id: verificationId,
        details: JSON.stringify({ document_type: documentType }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging document viewed:', error);
  }
};

/**
 * Funciones específicas de auditoría para reputación
 */
exports.logReputationUpdated = async (userId, changes, updateType, adminId = null) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: adminId || userId,
        action: 'reputation_updated',
        resource: 'professional_reputation',
        resource_id: userId,
        details: JSON.stringify({ changes, update_type: updateType }),
        ip_address: null,
        user_agent: null
      }
    });
  } catch (error) {
    console.error('Error logging reputation updated:', error);
  }
};

exports.logMedalAwarded = async (userId, medalType, reason, adminId) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'medal_awarded',
        resource: 'professional_reputation',
        resource_id: userId,
        details: JSON.stringify({ medal_type: medalType, reason }),
        ip_address: null,
        user_agent: null
      }
    });
  } catch (error) {
    console.error('Error logging medal awarded:', error);
  }
};

/**
 * Funciones específicas de auditoría para pagos y comisiones
 */
exports.logPaymentCreated = async (userId, paymentId, serviceId, amount, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: userId,
        action: 'payment_created',
        resource: 'payment',
        resource_id: paymentId,
        details: JSON.stringify({
          service_id: serviceId,
          amount,
          payment_type: 'service_payment'
        }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging payment created:', error);
  }
};

exports.logPaymentStatusChanged = async (paymentId, oldStatus, newStatus, changedBy, reason = null, ipAddress = null, userAgent = null) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: changedBy,
        action: 'payment_status_changed',
        resource: 'payment',
        resource_id: paymentId,
        details: JSON.stringify({
          old_status: oldStatus,
          new_status: newStatus,
          reason,
          change_type: 'status_update'
        }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging payment status changed:', error);
  }
};

exports.logFundsReleased = async (adminId, paymentId, professionalId, amount, commission, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'funds_released',
        resource: 'payment',
        resource_id: paymentId,
        details: JSON.stringify({
          professional_id: professionalId,
          amount_released: amount,
          commission_deducted: commission,
          release_type: 'manual'
        }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging funds released:', error);
  }
};

exports.logCommissionApplied = async (paymentId, serviceId, commissionType, amount, percentage, appliedBy = null) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: appliedBy,
        action: 'commission_applied',
        resource: 'commission',
        resource_id: paymentId,
        details: JSON.stringify({
          service_id: serviceId,
          commission_type: commissionType,
          amount,
          percentage,
          application_type: 'automatic'
        }),
        ip_address: null,
        user_agent: null
      }
    });
  } catch (error) {
    console.error('Error logging commission applied:', error);
  }
};

exports.logCommissionSettingsChanged = async (adminId, settingId, oldValue, newValue, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'commission_settings_changed',
        resource: 'commission_settings',
        resource_id: settingId,
        details: JSON.stringify({
          old_value: oldValue,
          new_value: newValue,
          change_type: 'settings_update'
        }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging commission settings changed:', error);
  }
};

exports.logWithdrawalRequested = async (userId, withdrawalId, amount, accountId, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: userId,
        action: 'withdrawal_requested',
        resource: 'withdrawal',
        resource_id: withdrawalId,
        details: JSON.stringify({
          amount,
          account_id: accountId,
          request_type: 'professional_withdrawal'
        }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging withdrawal requested:', error);
  }
};

exports.logWithdrawalProcessed = async (adminId, withdrawalId, userId, status, amount, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'withdrawal_processed',
        resource: 'withdrawal',
        resource_id: withdrawalId,
        details: JSON.stringify({
          target_user_id: userId,
          status,
          amount,
          processing_type: 'manual'
        }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging withdrawal processed:', error);
  }
};

exports.logDisputeCreated = async (userId, disputeId, paymentId, reason, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: userId,
        action: 'dispute_created',
        resource: 'dispute',
        resource_id: disputeId,
        details: JSON.stringify({
          payment_id: paymentId,
          reason,
          dispute_type: 'payment_dispute'
        }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging dispute created:', error);
  }
};

exports.logDisputeResolved = async (adminId, disputeId, resolution, refundAmount = null, ipAddress, userAgent) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'dispute_resolved',
        resource: 'dispute',
        resource_id: disputeId,
        details: JSON.stringify({
          resolution,
          refund_amount: refundAmount,
          resolution_type: 'admin_decision'
        }),
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Error logging dispute resolved:', error);
  }
};

/**
 * Obtener logs de auditoría de pagos con filtros avanzados
 */
exports.getPaymentAuditLogs = async ({
  paymentId,
  userId,
  action,
  startDate,
  endDate,
  page = 1,
  limit = 50
}) => {
  const where = {
    resource: 'payment'
  };

  if (paymentId) where.resource_id = paymentId;
  if (userId) where.user_id = userId;
  if (action) where.action = action;

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = new Date(startDate);
    if (endDate) where.created_at.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.audit_log.findMany({
      where,
      include: {
        user: {
          select: { id: true, nombre: true, email: true, rol: true }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.audit_log.count({ where })
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
 * Obtener estadísticas de auditoría
 */
exports.getAuditStats = async (dateRange = null) => {
  const whereClause = dateRange ? {
    created_at: {
      gte: dateRange.start,
      lte: dateRange.end
    }
  } : {};

  const stats = await prisma.audit_log.groupBy({
    by: ['action', 'resource'],
    where: whereClause,
    _count: {
      id: true
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    }
  });

  return stats;
};

/**
 * Limpiar logs antiguos (para mantenimiento)
 */
exports.cleanupOldLogs = async (daysToKeep = 365) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  try {
    const deletedCount = await prisma.audit_log.deleteMany({
      where: {
        created_at: {
          lt: cutoffDate
        }
      }
    });

    console.log(`Cleaned up ${deletedCount.count} old audit logs`);
    return { success: true, deletedCount: deletedCount.count };
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
    return { success: false, error: error.message };
  }
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
  COMMISSION: 'commission',
  WITHDRAWAL: 'withdrawal',
  DISPUTE: 'dispute',
  SETTING: 'setting',
  SYSTEM: 'system'
};

/**
 * Acciones de auditoría adicionales
 */
exports.AUDIT_ACTIONS = {
  // ... existing actions ...

  // Pagos y Comisiones
  PAYMENT_CREATED: 'payment_created',
  PAYMENT_STATUS_CHANGED: 'payment_status_changed',
  FUNDS_RELEASED: 'funds_released',
  COMMISSION_APPLIED: 'commission_applied',
  COMMISSION_SETTINGS_CHANGED: 'commission_settings_changed',
  WITHDRAWAL_REQUESTED: 'withdrawal_requested',
  WITHDRAWAL_PROCESSED: 'withdrawal_processed',
  DISPUTE_CREATED: 'dispute_created',
  DISPUTE_RESOLVED: 'dispute_resolved',

  // ... existing actions ...
};