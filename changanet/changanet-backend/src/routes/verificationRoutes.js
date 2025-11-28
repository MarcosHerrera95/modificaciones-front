/**
 * Rutas para el sistema de verificación de identidad.
 * Implementa REQ-36: Verificación de Identidad
 * Define endpoints para solicitudes de verificación y gestión administrativa.
 */

const express = require('express');
const identityVerificationController = require('../controllers/identityVerificationController');
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

// POST /api/verification/upload
// Generar URL presignada para subida de documento
router.post('/upload', authenticateToken, identityVerificationController.generateUploadUrl);

// POST /api/verification
// Crear solicitud de verificación con URLs de documentos
router.post('/', authenticateToken, identityVerificationController.createVerification);

// GET /api/verification/status
// Obtener estado de verificación del usuario actual
router.get('/status', authenticateToken, identityVerificationController.getVerificationStatus);

// PUT /api/verification/:id/approve
// Aprobar solicitud de verificación (solo administradores)
router.put('/:id/approve', authenticateToken, identityVerificationController.approveVerification);

// PUT /api/verification/:id/reject
// Rechazar solicitud de verificación (solo administradores)
router.put('/:id/reject', authenticateToken, identityVerificationController.rejectVerification);

// GET /api/verification/:requestId/document
// Obtener URL firmada para acceder al documento (usuario propietario o admin)
router.get('/:requestId/document', authenticateToken, identityVerificationController.getDocumentUrl);

// POST /api/verification/:id/process-biometric
// Procesar verificación biométrica (admin)
router.post('/:id/process-biometric', authenticateToken, identityVerificationController.processBiometricVerification);

module.exports = router;