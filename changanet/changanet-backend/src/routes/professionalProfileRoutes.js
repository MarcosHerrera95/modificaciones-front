/**
 * ProfessionalProfileRoutes
 * Rutas completas para gestión de perfiles profesionales
 * 
 * Implementa REQ-06 a REQ-10 del PRD:
 * - REQ-06: Subir foto de perfil y portada
 * - REQ-07: Seleccionar especialidades múltiples
 * - REQ-08: Ingresar años de experiencia
 * - REQ-09: Definir zona de cobertura geográfica
 * - REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authenticate');
const multer = require('multer');
const ProfessionalProfileValidation = require('../middleware/professionalProfileValidation');
const ProfessionalProfileController = require('../controllers/professionalProfileController');

const router = express.Router();

// Configuración de multer para subida de imágenes
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
  },
  fileFilter: (req, file, cb) => {
    // Solo permitir imágenes
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// ============================================================================
// RUTAS DE PERFILES PROFESIONALES
// ============================================================================

/**
 * GET /api/professionals/me
 * Obtiene el perfil completo del profesional autenticado
 * Incluye todas las especialidades, zona de cobertura, tarifas y fotos
 */
router.get('/me', 
  ProfessionalProfileValidation.validateUserRole('profesional'),
  ProfessionalProfileController.getMyProfile
);

/**
 * PUT /api/professionals/me
 * Actualiza el perfil completo del profesional
 * Requiere autenticación de profesional
 * Soporta subida de archivos (fotos de perfil y portada)
 */
router.put('/me',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  upload.fields([
    { name: 'foto_perfil', maxCount: 1 },
    { name: 'foto_portada', maxCount: 1 }
  ]),
  ProfessionalProfileValidation.validateProfileUpdate,
  ProfessionalProfileController.updateMyProfile
);

/**
 * GET /api/professionals/:professionalId
 * Obtiene el perfil público de un profesional específico
 * No requiere autenticación (público)
 */
router.get('/:professionalId',
  ProfessionalProfileValidation.validateProfessionalId,
  ProfessionalProfileValidation.validateProfileOwnership,
  ProfessionalProfileController.getPublicProfile
);

// ============================================================================
// RUTAS DE ESPECIALIDADES (REQ-07)
// ============================================================================

/**
 * POST /api/professionals/me/specialties
 * Actualiza las especialidades del profesional
 * Permite seleccionar múltiples especialidades
 */
router.post('/me/specialties',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  ProfessionalProfileValidation.validateProfileUpdate, // Validar specialtyIds
  ProfessionalProfileController.updateSpecialties
);

/**
 * GET /api/specialties
 * Obtiene todas las especialidades disponibles
 * Puede agruparse por categoría
 */
router.get('/../specialties',
  ProfessionalProfileController.getSpecialties
);

/**
 * GET /api/specialties/search
 * Busca especialidades por término de búsqueda
 * Incluye autocompletado
 */
router.get('/../specialties/search',
  ProfessionalProfileValidation.validateSpecialtySearch,
  ProfessionalProfileController.searchSpecialties
);

// ============================================================================
// RUTAS DE ZONAS DE COBERTURA (REQ-09)
// ============================================================================

/**
 * GET /api/professionals/me/coverage-zone
 * Obtiene la zona de cobertura del profesional autenticado
 */
router.get('/me/coverage-zone',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  ProfessionalProfileController.getCoverageZone
);

/**
 * PUT /api/professionals/me/coverage-zone
 * Actualiza la zona de cobertura del profesional
 * Incluye coordenadas GPS y zona geográfica
 */
router.put('/me/coverage-zone',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  ProfessionalProfileValidation.validateProfileUpdate, // Validar zone data
  ProfessionalProfileController.updateCoverageZone
);

/**
 * GET /api/zones
 * Obtiene todas las zonas de cobertura disponibles
 * Puede agruparse por provincia/estado
 */
router.get('/../zones',
  ProfessionalProfileController.getCoverageZones
);

// ============================================================================
// RUTAS DE TARIFAS (REQ-10)
// ============================================================================

/**
 * GET /api/professionals/me/rates
 * Obtiene las tarifas del profesional autenticado
 * Incluye tipo de tarifa y valores correspondientes
 */
router.get('/me/rates',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  ProfessionalProfileController.getRates
);

/**
 * PUT /api/professionals/me/rates
 * Actualiza las tarifas del profesional
 * Soporta hora, servicio y "a convenir"
 */
router.put('/me/rates',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  ProfessionalProfileValidation.validateProfileUpdate, // Validar rate data
  ProfessionalProfileController.updateRates
);

/**
 * GET /api/rate-types
 * Obtiene los tipos de tarifa disponibles
 */
router.get('/../rate-types',
  ProfessionalProfileController.getRateTypes
);

/**
 * GET /api/rate-ranges
 * Obtiene los rangos de tarifas recomendados por categoría
 */
router.get('/../rate-ranges',
  ProfessionalProfileController.getRateRanges
);

/**
 * POST /api/professionals/me/rates/suggest
 * Calcula tarifas sugeridas basadas en experiencia y especialidad
 */
router.post('/me/rates/suggest',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  ProfessionalProfileController.getSuggestedRates
);

// ============================================================================
// RUTAS DE BÚSQUEDA AVANZADA
// ============================================================================

/**
 * GET /api/professionals/search
 * Búsqueda avanzada de profesionales con filtros
 * Filtros: especialidades, ubicación, tarifas, disponibilidad
 */
router.get('/search',
  ProfessionalProfileValidation.validateProfessionalSearch,
  ProfessionalProfileController.searchProfessionals
);

// ============================================================================
// RUTAS DE UTILIDADES
// ============================================================================

/**
 * GET /api/professionals/me/completion
 * Obtiene el score de completitud del perfil
 * Útil para mostrar progreso al usuario
 */
router.get('/me/completion', 
  ProfessionalProfileValidation.validateUserRole('profesional'),
  async (req, res) => {
    try {
      const { userId } = req.user;
      const profile = await ProfessionalProfileController.getMyProfile(req, res);
      
      // Calcular score de completitud basado en campos llenados
      const completionFields = [
        'especialidad',
        'anos_experiencia', 
        'zona_cobertura',
        'tipo_tarifa',
        'tarifa_hora',
        'descripcion',
        'url_foto_perfil'
      ];
      
      const filledFields = completionFields.filter(field => 
        profile.profile && profile.profile[field] !== null && 
        profile.profile[field] !== undefined && 
        profile.profile[field] !== ''
      );
      
      const completionScore = Math.round((filledFields.length / completionFields.length) * 100);
      
      res.json({
        success: true,
        completion: {
          score: completionScore,
          filled_fields: filledFields.length,
          total_fields: completionFields.length,
          missing_fields: completionFields.filter(field => 
            !filledFields.includes(field)
          )
        },
        message: 'Score de completitud calculado'
      });
    } catch (error) {
      console.error('Error calculating completion score:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al calcular completitud del perfil'
      });
    }
  }
);

/**
 * GET /api/professionals/me/statistics
 * Obtiene estadísticas del perfil profesional
 * Incluye visualizaciones, ranking, etc.
 */
router.get('/me/statistics',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  async (req, res) => {
    try {
      const { userId } = req.user;
      
      // Aquí se pueden calcular estadísticas como:
      // - Número de visualizaciones del perfil
      // - Posición en rankings
      // - Estadísticas de servicios completados
      // - Promedio de calificaciones
      // - etc.
      
      const profile = await ProfessionalProfileController.getMyProfile(req, res);
      
      res.json({
        success: true,
        statistics: {
          profile_views: profile.profile?.profile_views_count || 0,
          profile_completion: profile.profile?.profile_completion_score || 0,
          average_rating: profile.profile?.calificacion_promedio || 0,
          verification_status: profile.profile?.estado_verificacion || 'pendiente',
          last_update: profile.profile?.last_profile_update
        },
        message: 'Estadísticas obtenidas exitosamente'
      });
    } catch (error) {
      console.error('Error getting profile statistics:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener estadísticas del perfil'
      });
    }
  }
);

// ============================================================================
// RUTAS DE VALIDACIÓN Y TESTING
// ============================================================================

/**
 * POST /api/professionals/me/validate
 * Valida los datos del perfil sin guardarlos
 * Útil para validación en tiempo real en el frontend
 */
router.post('/me/validate',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  ProfessionalProfileValidation.validateProfileUpdate,
  (req, res) => {
    res.json({
      success: true,
      valid: true,
      message: 'Datos del perfil son válidos'
    });
  }
);

/**
 * GET /api/professionals/me/validate-photo
 * Valida una foto antes de subirla
 * Retorna información sobre el archivo sin guardarlo
 */
router.get('/me/validate-photo',
  ProfessionalProfileValidation.validateUserRole('profesional'),
  upload.single('foto'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo',
        message: 'Debe seleccionar una imagen para validar'
      });
    }
    
    const fileInfo = {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      dimensions: null // Se podría calcular si se procesa la imagen
    };
    
    res.json({
      success: true,
      fileInfo,
      valid: true,
      message: 'Archivo válido para subida'
    });
  }
);

// ============================================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================================================================

// Middleware para manejar errores de multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Archivo demasiado grande',
        message: 'El archivo no puede exceder los 5MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Campo de archivo inválido',
        message: 'Los campos válidos son: foto_perfil, foto_portada'
      });
    }
  }
  
  if (error.message === 'Solo se permiten archivos de imagen') {
    return res.status(400).json({
      success: false,
      error: 'Tipo de archivo inválido',
      message: 'Solo se permiten archivos de imagen (JPEG, PNG, WebP)'
    });
  }
  
  next(error);
});

// Middleware general de manejo de errores
router.use((error, req, res, next) => {
  console.error('ProfessionalProfileRoutes error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: 'Ocurrió un error inesperado en el sistema'
  });
});

module.exports = router;