/**
 * Servicio de Auditoría
 * Centraliza el registro de todas las acciones importantes del sistema
 * Implementa trazabilidad completa para cumplimiento normativo
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Registrar una acción en el log de auditoría
 * @param {Object} params - Parámetros de la acción
 * @param {string} params.userId - ID del usuario que realizó la acción (opcional)
 * @param {string} params.action - Acción realizada
 * @param {string} params.resource - Recurso afectado
 * @param {string} params.resourceId - ID del recurso afectado (opcional)
 * @param {Object} params.details - Detalles adicionales (opcional)
 * @param {string} params.ipAddress - Dirección IP (opcional)
 * @param {string} params.userAgent - User Agent (opcional)
 */
const logAction = async ({
  userId = null,
  action,
  resource,
  resourceId = null,
  details = {},
  ipAddress = null,
  userAgent = null
}) => {
  try {
    // Validar campos requeridos
    if (!action || !resource) {
      throw new Error('action y resource son requeridos para auditoría');
    }

    // Sanitizar y validar inputs
    const sanitizedAction = action.toLowerCase().replace(/[^a-z_]/g, '_').substring(0, 50);
    const sanitizedResource = resource.toLowerCase().replace(/[^a-z_]/g, '_').substring(0, 50);
    const sanitizedResourceId = resourceId ? resourceId.substring(0, 100) : null;
    const sanitizedDetails = JSON.stringify(details).substring(0, 2000); // Limitar tamaño
    const sanitizedIp = ipAddress ? ipAddress.substring(0, 45) : null;
    const sanitizedUserAgent = userAgent ? userAgent.substring(0, 500) : null;

    await prisma.audit_log.create({
      data: {
        user_id: userId,
        action: sanitizedAction,
        resource: sanitizedResource,
        resource_id: sanitizedResourceId,
        details: sanitizedDetails,
        ip_address: sanitizedIp,
        user_agent: sanitizedUserAgent
      }
    });

    // Log en consola para monitoreo inmediato
    console.log(`AUDIT: ${action} - User: ${userId || 'SYSTEM'} - Resource: ${resource} - ID: ${resourceId || 'N/A'}`);

  } catch (error) {
    console.error('Error logging audit action:', error);
    // No fallar la operación principal por error de auditoría
  }
};

/**
 * Funciones específicas para acciones comunes del sistema de verificación y reputación
 */

// Verificación de Identidad
const logVerificationSubmitted = (userId, requestId, documentType, ipAddress = null, userAgent = null) => {
  return logAction({
    userId,
    action: 'verification_submitted',
    resource: 'identity_verification',
    resourceId: requestId,
    details: { document_type: documentType },
    ipAddress,
    userAgent
  });
};

const logVerificationApproved = (adminId, requestId, userId, reviewNotes = null, ipAddress = null, userAgent = null) => {
  return logAction({
    userId: adminId,
    action: 'verification_approved',
    resource: 'identity_verification',
    resourceId: requestId,
    details: { target_user_id: userId, review_notes: reviewNotes },
    ipAddress,
    userAgent
  });
};

const logVerificationRejected = (adminId, requestId, userId, reviewNotes, ipAddress = null, userAgent = null) => {
  return logAction({
    userId: adminId,
    action: 'verification_rejected',
    resource: 'identity_verification',
    resourceId: requestId,
    details: { target_user_id: userId, review_notes: reviewNotes },
    ipAddress,
    userAgent
  });
};

const logVerificationDocumentViewed = (userId, requestId, documentType, ipAddress = null, userAgent = null) => {
  return logAction({
    userId,
    action: 'verification_document_viewed',
    resource: 'identity_verification',
    resourceId: requestId,
    details: { document_type: documentType },
    ipAddress,
    userAgent
  });
};

// Reputación y Medallas
const logReputationUpdated = (userId, changes, trigger = 'automatic', ipAddress = null, userAgent = null) => {
  return logAction({
    userId,
    action: 'reputation_updated',
    resource: 'professional_reputation',
    resourceId: userId,
    details: { changes, trigger },
    ipAddress,
    userAgent
  });
};

const logMedalAwarded = (userId, medalType, reason = 'automatic', awardedBy = null, ipAddress = null, userAgent = null) => {
  return logAction({
    userId: awardedBy,
    action: 'medal_awarded',
    resource: 'professional_reputation',
    resourceId: userId,
    details: { target_user_id: userId, medal_type: medalType, reason },
    ipAddress,
    userAgent
  });
};

// Servicios y Reseñas
const logServiceCompleted = (professionalId, clientId, serviceId, ipAddress = null, userAgent = null) => {
  return logAction({
    userId: professionalId,
    action: 'service_completed',
    resource: 'service',
    resourceId: serviceId,
    details: { client_id: clientId },
    ipAddress,
    userAgent
  });
};

const logReviewCreated = (clientId, professionalId, serviceId, rating, ipAddress = null, userAgent = null) => {
  return logAction({
    userId: clientId,
    action: 'review_created',
    resource: 'review',
    resourceId: serviceId,
    details: { professional_id: professionalId, rating },
    ipAddress,
    userAgent
  });
};

// Sistema
const logAdminAction = (adminId, action, resource, resourceId = null, details = {}, ipAddress = null, userAgent = null) => {
  return logAction({
    userId: adminId,
    action: `admin_${action}`,
    resource,
    resourceId,
    details: { ...details, admin_action: true },
    ipAddress,
    userAgent
  });
};

module.exports = {
  logAction,
  logVerificationSubmitted,
  logVerificationApproved,
  logVerificationRejected,
  logVerificationDocumentViewed,
  logReputationUpdated,
  logMedalAwarded,
  logServiceCompleted,
  logReviewCreated,
  logAdminAction
};