/**
 * Rutas para el sistema de verificación de identidad.
 * Define endpoints para solicitudes de verificación y gestión administrativa.
 */

const express = require('express');
const verificationController = require('../controllers/verificationController');
const { authenticateToken } = require('../middleware/authenticate');

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

// GET /api/verification/pending
// Listar solicitudes pendientes (solo administradores)
router.get('/pending', authenticateToken, verificationController.getPendingVerifications);

// PUT /api/verification/:id/approve
// Aprobar solicitud de verificación (solo administradores)
router.put('/:id/approve', authenticateToken, verificationController.approveVerification);

// PUT /api/verification/:id/reject
// Rechazar solicitud de verificación (solo administradores)
router.put('/:id/reject', authenticateToken, verificationController.rejectVerification);

module.exports = router;