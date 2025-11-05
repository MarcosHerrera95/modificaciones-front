/**
 * Controlador para gestión de verificación de identidad.
 * Maneja solicitudes de verificación, consultas de estado y operaciones administrativas.
 */

const verificationService = require('../services/verificationService');
const { storageService } = require('../services/storageService');

/**
 * Solicita verificación de identidad subiendo un documento
 */
async function requestVerification(req, res) {
  try {
    const userId = req.user.id;

    // Verificar que se haya subido un archivo
    if (!req.file) {
      return res.status(400).json({
        error: 'Se requiere subir un documento de identidad'
      });
    }

    const { buffer, originalname, mimetype } = req.file;

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(mimetype)) {
      return res.status(400).json({
        error: 'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG) y PDF.'
      });
    }

    // Validar tamaño del archivo (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      return res.status(400).json({
        error: 'El archivo es demasiado grande. Máximo 5MB permitido.'
      });
    }

    const verificationRequest = await verificationService.createVerificationRequest(
      userId,
      buffer,
      originalname,
      mimetype
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud de verificación enviada correctamente',
      data: {
        id: verificationRequest.id,
        estado: verificationRequest.estado,
        documento_url: verificationRequest.documento_url,
        creado_en: verificationRequest.creado_en
      }
    });
  } catch (error) {
    console.error('Error en requestVerification:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

/**
 * Obtiene el estado de verificación del usuario actual
 */
async function getVerificationStatus(req, res) {
  try {
    const userId = req.user.id;
    const status = await verificationService.getVerificationStatus(userId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error en getVerificationStatus:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

/**
 * Lista todas las solicitudes de verificación pendientes (solo administradores)
 */
async function getPendingVerifications(req, res) {
  try {
    // Verificar que el usuario sea administrador
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    const requests = await verificationService.getPendingVerifications();

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error en getPendingVerifications:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

/**
 * Aprueba una solicitud de verificación (solo administradores)
 */
async function approveVerification(req, res) {
  try {
    // Verificar que el usuario sea administrador
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    const { id } = req.params;
    const { comentario } = req.body;
    const adminId = req.user.id;

    const result = await verificationService.approveVerification(id, adminId, comentario);

    res.json({
      success: true,
      message: 'Verificación aprobada correctamente',
      data: result
    });
  } catch (error) {
    console.error('Error en approveVerification:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

/**
 * Rechaza una solicitud de verificación (solo administradores)
 */
async function rejectVerification(req, res) {
  try {
    // Verificar que el usuario sea administrador
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    const { id } = req.params;
    const { comentario } = req.body;
    const adminId = req.user.id;

    if (!comentario || comentario.trim() === '') {
      return res.status(400).json({
        error: 'Se requiere un comentario explicando el rechazo'
      });
    }

    const result = await verificationService.rejectVerification(id, adminId, comentario);

    res.json({
      success: true,
      message: 'Verificación rechazada correctamente',
      data: result
    });
  } catch (error) {
    console.error('Error en rejectVerification:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

module.exports = {
  requestVerification,
  getVerificationStatus,
  getPendingVerifications,
  approveVerification,
  rejectVerification
};