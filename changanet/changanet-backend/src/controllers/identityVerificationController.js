/**
 * Controlador de verificación de identidad
 * REQ-36: Sistema de verificación de identidad
 */

const { PrismaClient } = require('@prisma/client');
const { getSignedUrl, uploadVerificationDocument } = require('../services/storageService');
const {
  logVerificationSubmitted,
  logVerificationApproved,
  logVerificationRejected,
  logVerificationDocumentViewed
} = require('../services/auditService');
const prisma = new PrismaClient();

/**
 * Generar URL presignada para subida de documento
 */
exports.generateUploadUrl = async (req, res) => {
  try {
    const { documentType, fileName, fileType } = req.body;
    const userId = req.user.id;

    // Validar campos requeridos
    if (!documentType || !fileName || !fileType) {
      return res.status(400).json({
        success: false,
        error: 'documentType, fileName y fileType son requeridos'
      });
    }

    // Sanitizar y validar inputs
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 100);
    if (sanitizedFileName !== fileName) {
      return res.status(400).json({
        success: false,
        error: 'Nombre de archivo contiene caracteres no permitidos'
      });
    }

    // Validar tipo de documento
    const allowedTypes = ['dni', 'pasaporte', 'id'];
    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de documento no válido'
      });
    }

    // Validar tipo MIME permitido
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedMimeTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG) y PDF.'
      });
    }

    // Verificar que el usuario sea profesional
    const userProfile = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: userId }
    });

    if (!userProfile) {
      return res.status(403).json({
        success: false,
        error: 'Solo los profesionales pueden subir documentos de verificación'
      });
    }

    // Verificar límite de tasa (máximo 5 solicitudes por hora por usuario)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await prisma.identity_verification.count({
      where: {
        user_id: userId,
        created_at: { gte: oneHourAgo }
      }
    });

    if (recentRequests >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Demasiadas solicitudes. Inténtalo de nuevo en una hora.'
      });
    }

    // Generar URL presignada (60-120 segundos)
    const expiresIn = 120;
    const key = `verification-documents/${userId}/${Date.now()}-${sanitizedFileName}`;

    const uploadUrl = await getSignedUrl('putObject', key, fileType, expiresIn);

    res.json({
      success: true,
      data: {
        uploadUrl,
        key,
        expiresIn
      }
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Crear solicitud de verificación
 */
exports.createVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentType, documentFrontUrl, documentBackUrl } = req.body;

    // Validar campos requeridos
    if (!documentType || !documentFrontUrl) {
      return res.status(400).json({
        success: false,
        error: 'documentType y documentFrontUrl son requeridos'
      });
    }

    // Sanitizar inputs
    const sanitizedDocumentType = documentType.toLowerCase().trim();
    const sanitizedFrontUrl = documentFrontUrl.trim();
    const sanitizedBackUrl = documentBackUrl ? documentBackUrl.trim() : null;

    // Validar tipo de documento
    const allowedTypes = ['dni', 'pasaporte', 'id'];
    if (!allowedTypes.includes(sanitizedDocumentType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de documento no válido'
      });
    }

    // Validar formato de URLs (deben ser URLs de nuestro bucket)
    const urlRegex = /^https:\/\/.*\/verification-documents\/.*$/;
    if (!urlRegex.test(sanitizedFrontUrl)) {
      return res.status(400).json({
        success: false,
        error: 'URL de documento frontal no válida'
      });
    }

    if (sanitizedBackUrl && !urlRegex.test(sanitizedBackUrl)) {
      return res.status(400).json({
        success: false,
        error: 'URL de documento posterior no válida'
      });
    }

    // Verificar que el usuario sea profesional
    const userProfile = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: userId }
    });

    if (!userProfile) {
      return res.status(403).json({
        success: false,
        error: 'Solo los profesionales pueden solicitar verificación de identidad'
      });
    }

    // Verificar que no tenga una solicitud pendiente o aprobada
    const existingRequest = await prisma.identity_verification.findFirst({
      where: {
        user_id: userId,
        status: { in: ['pending', 'approved'] }
      }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: 'Ya tienes una solicitud de verificación pendiente o aprobada'
      });
    }

    // Verificar límite de solicitudes rechazadas recientes (máximo 3 por semana)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRejections = await prisma.identity_verification.count({
      where: {
        user_id: userId,
        status: 'rejected',
        created_at: { gte: oneWeekAgo }
      }
    });

    if (recentRejections >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Demasiadas solicitudes rechazadas recientemente. Revisa los comentarios de las solicitudes anteriores.'
      });
    }

    // Crear solicitud de verificación
    const verificationRequest = await prisma.identity_verification.create({
      data: {
        user_id: userId,
        document_type: sanitizedDocumentType,
        document_front_url: sanitizedFrontUrl,
        document_back_url: sanitizedBackUrl,
        status: 'pending'
      }
    });

    // Registrar en auditoría
    await logVerificationSubmitted(
      userId,
      verificationRequest.id,
      sanitizedDocumentType,
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({
      success: true,
      data: verificationRequest
    });
  } catch (error) {
    console.error('Error creating verification:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener estado de verificación del usuario actual
 */
exports.getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const request = await prisma.identity_verification.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    if (!request) {
      return res.json({
        success: true,
        data: {
          status: 'not_requested',
          message: 'No se ha solicitado verificación'
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: request.id,
        status: request.status,
        document_type: request.document_type,
        created_at: request.created_at,
        updated_at: request.updated_at,
        admin_review_notes: request.admin_review_notes
      }
    });
  } catch (error) {
    console.error('Error getting verification status:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Aprobar solicitud de verificación (admin)
 */
exports.approveVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { reviewNotes } = req.body;

    // Verificar permisos de administrador
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Se requieren permisos de administrador'
      });
    }

    // Sanitizar notas de revisión
    const sanitizedNotes = reviewNotes ? reviewNotes.trim().substring(0, 500) : null;

    const request = await prisma.identity_verification.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'La solicitud ya fue procesada'
      });
    }

    // Verificar que el usuario sea profesional
    const userProfile = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: request.user_id }
    });

    if (!userProfile) {
      return res.status(400).json({
        success: false,
        error: 'El usuario no es un profesional registrado'
      });
    }

    // Actualizar solicitud
    const updatedRequest = await prisma.identity_verification.update({
      where: { id },
      data: {
        status: 'approved',
        reviewed_by: adminId,
        admin_review_notes: sanitizedNotes,
        updated_at: new Date()
      }
    });

    // Actualizar estado de verificación del usuario
    await prisma.usuarios.update({
      where: { id: request.user_id },
      data: { esta_verificado: true }
    });

    // Actualizar reputación
    const { updateProfessionalReputation } = require('./reputationController');
    await updateProfessionalReputation(request.user_id);

    // Registrar en auditoría
    await logVerificationApproved(
      adminId,
      id,
      request.user_id,
      sanitizedNotes,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error approving verification:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Rechazar solicitud de verificación (admin)
 */
exports.rejectVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { reviewNotes } = req.body;

    // Verificar permisos de administrador
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Se requieren permisos de administrador'
      });
    }

    // Validar y sanitizar notas de revisión
    if (!reviewNotes || reviewNotes.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren notas explicando el rechazo'
      });
    }

    const sanitizedNotes = reviewNotes.trim().substring(0, 500);
    if (sanitizedNotes.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Las notas de rechazo deben tener al menos 10 caracteres'
      });
    }

    const request = await prisma.identity_verification.findUnique({
      where: { id }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'La solicitud ya fue procesada'
      });
    }

    // Actualizar solicitud
    const updatedRequest = await prisma.identity_verification.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewed_by: adminId,
        admin_review_notes: sanitizedNotes,
        updated_at: new Date()
      }
    });

    // Registrar en auditoría
    await logVerificationRejected(
      adminId,
      id,
      request.user_id,
      sanitizedNotes,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error rejecting verification:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener URL firmada para acceder al documento
 */
exports.getDocumentUrl = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await prisma.identity_verification.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada'
      });
    }

    // Verificar permisos (usuario propietario o admin)
    if (request.user_id !== userId && req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para acceder a este documento'
      });
    }

    // Generar URLs firmadas para los documentos
    const urls = {};

    if (request.document_front_url) {
      urls.front = await getSignedUrl('getObject', request.document_front_url, null, 3600); // 1 hora
    }

    if (request.document_back_url) {
      urls.back = await getSignedUrl('getObject', request.document_back_url, null, 3600);
    }

    // Registrar acceso a documentos en auditoría
    await logVerificationDocumentViewed(
      userId,
      requestId,
      request.document_type,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      data: urls
    });
  } catch (error) {
    console.error('Error getting document URL:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};