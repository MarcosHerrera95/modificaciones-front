// src/routes/budgetRoutes.js
/**
 * @archivo src/routes/budgetRoutes.js - Rutas del Sistema de Solicitud de Presupuestos
 * @descripción Define endpoints REST para el módulo de solicitud de presupuestos (REQ-31 a REQ-35)
 * @versión Versión 2.0 - Sistema robusto con PostgreSQL
 * 
 * FUNCIONALIDADES IMPLEMENTADAS:
 * ✅ REQ-31: Cliente crea solicitud con descripción y fotos
 * ✅ REQ-32: Sistema envía solicitud a profesionales preseleccionados
 * ✅ REQ-33: Profesionales responden con precio y comentarios
 * ✅ REQ-34: Cliente compara ofertas en vista única
 * ✅ REQ-35: Sistema notifica al cliente cuando recibe ofertas
 * 
 * ENDPOINTS IMPLEMENTADOS:
 * 
 * CLIENTE (Creación y Gestión):
 * POST /api/budget-requests - Crear solicitud de presupuesto (REQ-31)
 * GET /api/budget-requests/:clientId - Listar solicitudes propias
 * GET /api/budget-requests/:id/offers - Vista comparativa (REQ-34)
 * PUT /api/budget-requests/:id - Actualizar solicitud (borrador)
 * DELETE /api/budget-requests/:id - Cancelar solicitud
 * 
 * PROFESIONAL (Respuestas):
 * GET /api/budget-requests/inbox/:professionalId - Solicitudes recibidas (REQ-32)
 * POST /api/budget-requests/:id/offers - Enviar presupuesto (REQ-33)
 * PUT /api/budget-offers/:id - Modificar oferta enviada
 * DELETE /api/budget-offers/:id - Retirar oferta
 * 
 * SISTEMA (Utilidades):
 * POST /api/budget-requests/upload-photo - Presigned URL para fotos
 * GET /api/budget-requests/:id/status - Estado de la solicitud
 * POST /api/budget-requests/:id/distribute - Distribuir solicitud
 * PUT /api/budget-requests/:id/select-offer - Seleccionar oferta ganadora
 * 
 * CONFIGURACIÓN DE SEGURIDAD:
 * - Todas las rutas requieren autenticación JWT
 * - Validación de roles (cliente/profesional)
 * - Rate limiting para prevenir spam
 * - Sanitización de inputs
 */

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const {
  createBudgetRequest,
  getClientBudgetRequests,
  getBudgetRequestWithOffers,
  updateBudgetRequest,
  cancelBudgetRequest,
  getProfessionalInbox,
  respondToBudgetRequest,
  updateBudgetOffer,
  withdrawBudgetOffer,
  uploadBudgetPhoto,
  getBudgetRequestStatus,
  distributeBudgetRequest,
  selectWinningOffer,
  getBudgetAnalytics
} = require('../controllers/budgetController');
const { authenticateToken } = require('../middleware/authenticate');
const { validateRequest, handleValidationErrors } = require('../middleware/validation');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const { sendBudgetNotifications } = require('../services/notificationService');

// Configuración de multer para fotos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // Máximo 5 fotos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Rate limiting específico para el sistema de presupuestos
const budgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Aplicar autenticación y rate limiting a todas las rutas
router.use(authenticateToken);
router.use(budgetLimiter);

/**
 * ==================================================
 * RUTAS DEL CLIENTE (REQ-31)
 * ==================================================
 */

/**
 * @route POST /api/budget-requests
 * @descripción Crear nueva solicitud de presupuesto (REQ-31)
 * @acceso Cliente autenticado
 */
router.post('/',
  // Validaciones
  [
    body('title')
      .trim()
      .isLength({ min: 10, max: 255 })
      .withMessage('El título debe tener entre 10 y 255 caracteres'),
    body('description')
      .trim()
      .isLength({ min: 50, max: 2000 })
      .withMessage('La descripción debe tener entre 50 y 2000 caracteres'),
    body('category')
      .trim()
      .isIn(['plomeria', 'electricidad', 'albañileria', 'pintura', 'jardineria', 'limpieza', 'gasista', 'cerrajeria', 'otros'])
      .withMessage('Categoría no válida'),
    body('budgetRangeMin')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Presupuesto mínimo debe ser un número positivo'),
    body('budgetRangeMax')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Presupuesto máximo debe ser un número positivo'),
    body('preferredDate')
      .optional()
      .isISO8601()
      .withMessage('Fecha preferida debe tener formato válido')
  ],
  handleValidationErrors,
  upload.array('photos', 5),
  uploadToCloudinary,
  createBudgetRequest
);

/**
 * @route GET /api/budget-requests/:clientId
 * @descripción Listar solicitudes de presupuesto del cliente
 * @acceso Cliente (solo sus propias solicitudes)
 */
router.get('/client/:clientId', getClientBudgetRequests);

/**
 * @route GET /api/budget-requests/:id/offers
 * @descripción Obtener vista comparativa de ofertas (REQ-34)
 * @acceso Cliente (solo de sus solicitudes)
 */
router.get('/:id/offers', getBudgetRequestWithOffers);

/**
 * @route PUT /api/budget-requests/:id
 * @descripción Actualizar solicitud (solo en estado borrador)
 * @acceso Cliente
 */
router.put('/:id',
  [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 10, max: 255 })
      .withMessage('El título debe tener entre 10 y 255 caracteres'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 50, max: 2000 })
      .withMessage('La descripción debe tener entre 50 y 2000 caracteres'),
    body('category')
      .optional()
      .trim()
      .isIn(['plomeria', 'electricidad', 'albañileria', 'pintura', 'jardineria', 'limpieza', 'gasista', 'cerrajeria', 'otros'])
      .withMessage('Categoría no válida')
  ],
  handleValidationErrors,
  updateBudgetRequest
);

/**
 * @route DELETE /api/budget-requests/:id
 * @descripción Cancelar/eliminar solicitud
 * @acceso Cliente
 */
router.delete('/:id', cancelBudgetRequest);

/**
 * @route POST /api/budget-requests/:id/distribute
 * @descripción Enviar solicitud a profesionales (REQ-32)
 * @acceso Cliente
 */
router.post('/:id/distribute', distributeBudgetRequest);

/**
 * @route PUT /api/budget-requests/:id/select-offer
 * @descripción Seleccionar oferta ganadora
 * @acceso Cliente
 */
router.put('/:id/select-offer',
  [
    body('offerId').isUUID().withMessage('ID de oferta inválido')
  ],
  handleValidationErrors,
  selectWinningOffer
);

/**
 * ==================================================
 * RUTAS DEL PROFESIONAL (REQ-32, REQ-33)
 * ==================================================
 */

/**
 * @route GET /api/budget-requests/inbox/:professionalId
 * @descripción Obtener bandeja de entrada de solicitudes (REQ-32)
 * @acceso Profesional (solo sus solicitudes)
 */
router.get('/inbox/:professionalId', getProfessionalInbox);

/**
 * @route POST /api/budget-requests/:id/offers
 * @descripción Responder a solicitud de presupuesto (REQ-33)
 * @acceso Profesional
 */
router.post('/:id/offers',
  [
    body('price')
      .isFloat({ min: 1 })
      .withMessage('El precio debe ser un número mayor a 0'),
    body('estimatedDays')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Los días estimados deben estar entre 1 y 365'),
    body('comments')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Los comentarios no pueden exceder 500 caracteres'),
    body('availabilityDetails')
      .optional()
      .trim()
      .isLength({ max: 300 })
      .withMessage('Los detalles de disponibilidad no pueden exceder 300 caracteres')
  ],
  handleValidationErrors,
  upload.array('photos', 3),
  uploadToCloudinary,
  respondToBudgetRequest
);

/**
 * @route PUT /api/budget-offers/:id
 * @descripción Modificar oferta enviada (solo si aún no ha sido respondida)
 * @acceso Profesional
 */
router.put('/offers/:id',
  [
    body('price')
      .optional()
      .isFloat({ min: 1 })
      .withMessage('El precio debe ser un número mayor a 0'),
    body('estimatedDays')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Los días estimados deben estar entre 1 y 365'),
    body('comments')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Los comentarios no pueden exceder 500 caracteres')
  ],
  handleValidationErrors,
  updateBudgetOffer
);

/**
 * @route DELETE /api/budget-offers/:id
 * @descripción Retirar oferta enviada
 * @acceso Profesional
 */
router.delete('/offers/:id', withdrawBudgetOffer);

/**
 * ==================================================
 * RUTAS UTILITARIAS
 * ==================================================
 */

/**
 * @route POST /api/budget-requests/upload-photo
 * @descripción Subir foto para solicitud de presupuesto
 * @acceso Cliente/Profesional
 */
router.post('/upload-photo',
  upload.single('photo'),
  uploadToCloudinary,
  uploadBudgetPhoto
);

/**
 * @route GET /api/budget-requests/:id/status
 * @descripción Obtener estado detallado de una solicitud
 * @acceso Cliente/Profesional involucrados
 */
router.get('/:id/status', getBudgetRequestStatus);

/**
 * @route GET /api/budget-requests/analytics/summary
 * @descripción Obtener estadísticas del sistema de presupuestos
 * @acceso Admin solamente
 */
router.get('/analytics/summary', getBudgetAnalytics);

// Middleware para manejar errores específicos del módulo
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Una o más fotos exceden el tamaño máximo de 5MB',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Máximo 5 fotos permitidas por solicitud',
        code: 'TOO_MANY_FILES'
      });
    }
  }
  
  console.error('Error en budgetRoutes:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR'
  });
});

module.exports = router;