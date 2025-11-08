/**
 * Rutas para el sistema de verificación de identidad.
 * Define endpoints para solicitudes de verificación y gestión administrativa.
 */

const express = require('express');
const verificationController = require('../controllers/verificationController');
const { authenticateToken } = require('../middleware/authenticate');
const { uploadVerificationDocument } = require('../services/storageService');

// Configurar multer para subida de archivos
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(), // Almacenar en memoria para procesar con Cloudinary
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Validar tipos de archivo permitidos
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG) y PDF.'), false);
    }
  }
});

const router = express.Router();

// POST /api/verification/request
// Solicitar verificación de identidad (solo profesionales)
router.post('/request',
  authenticateToken,
  upload.single('document'),
  verificationController.requestVerification
);

// GET /api/verification/status
// Obtener estado de verificación del usuario actual
router.get('/status', authenticateToken, verificationController.getVerificationStatus);

// GET /api/admin/verification-requests
// Listar solicitudes pendientes (solo administradores)
router.get('/admin/verification-requests', authenticateToken, verificationController.getPendingVerifications);

// PUT /api/admin/verification/:id/approve
// Aprobar solicitud de verificación (solo administradores)
router.put('/admin/verification/:id/approve', authenticateToken, verificationController.approveVerification);

// PUT /api/admin/verification/:id/reject
// Rechazar solicitud de verificación (solo administradores)
router.put('/admin/verification/:id/reject', authenticateToken, verificationController.rejectVerification);

// GET /api/verification/:requestId/document
// Obtener URL firmada para acceder al documento (usuario propietario o admin)
router.get('/:requestId/document', authenticateToken, verificationController.getDocumentUrl);

module.exports = router;