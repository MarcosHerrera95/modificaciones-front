/**
 * ProfessionalProfileValidationMiddleware
 * Middleware de validación para perfiles profesionales
 * 
 * Implementa validaciones robustas para REQ-06 a REQ-10
 */

const { body, param, query, validationResult } = require('express-validator');

class ProfessionalProfileValidationMiddleware {
  /**
   * Middleware para validar errores de validación
   */
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: errors.array().map(err => ({
          field: err.param,
          message: err.msg,
          value: err.value
        }))
      });
    }
    next();
  }

  /**
   * Validaciones para actualización de perfil profesional
   */
  static validateProfileUpdate = [
    // Campos personales (opcionales)
    body('nombre')
      .optional()
      .isLength({ min: 2, max: 100 })
      .trim()
      .escape()
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('El email debe tener un formato válido'),
    
    body('telefono')
      .optional()
      .isMobilePhone('any')
      .withMessage('El teléfono debe tener un formato válido'),

    // REQ-07: Especialidades
    body('specialtyIds')
      .optional()
      .isArray({ min: 1, max: 10 })
      .withMessage('Debe seleccionar entre 1 y 10 especialidades'),
    
    body('specialtyIds.*')
      .optional()
      .isUUID()
      .withMessage('ID de especialidad inválido'),

    // REQ-08: Años de experiencia
    body('anos_experiencia')
      .optional()
      .isInt({ min: 0, max: 50 })
      .withMessage('Los años de experiencia deben ser un número entre 0 y 50'),

    // REQ-09: Zona de cobertura geográfica
    body('zona_cobertura')
      .optional()
      .isLength({ min: 2, max: 200 })
      .trim()
      .escape()
      .withMessage('La zona de cobertura debe tener entre 2 y 200 caracteres'),
    
    body('coverage_zone_id')
      .optional()
      .isUUID()
      .withMessage('ID de zona de cobertura inválido'),
    
    body('latitud')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('La latitud debe estar entre -90 y 90'),
    
    body('longitud')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('La longitud debe estar entre -180 y 180'),

    // REQ-10: Tarifas
    body('tipo_tarifa')
      .optional()
      .isIn(['hora', 'servicio', 'convenio'])
      .withMessage('El tipo de tarifa debe ser: hora, servicio o convenio'),
    
    body('tarifa_hora')
      .optional()
      .isFloat({ min: 0, max: 100000 })
      .withMessage('La tarifa por hora debe ser un número entre 0 y 100,000'),
    
    body('tarifa_servicio')
      .optional()
      .isFloat({ min: 0, max: 500000 })
      .withMessage('La tarifa por servicio debe ser un número entre 0 y 500,000'),
    
    body('tarifa_convenio')
      .optional()
      .isLength({ min: 5, max: 500 })
      .trim()
      .escape()
      .withMessage('La descripción "a convenir" debe tener entre 5 y 500 caracteres'),

    // Campo general
    body('descripcion')
      .optional()
      .isLength({ min: 10, max: 1000 })
      .trim()
      .escape()
      .withMessage('La descripción debe tener entre 10 y 1000 caracteres'),
    
    body('esta_disponible')
      .optional()
      .isBoolean()
      .withMessage('La disponibilidad debe ser un valor booleano'),

    this.handleValidationErrors
  ];

  /**
   * Validaciones para subida de imágenes
   */
  static validateImageUpload = [
    body('foto_tipo')
      .optional()
      .isIn(['perfil', 'portada'])
      .withMessage('El tipo de foto debe ser: perfil o portada'),

    this.handleValidationErrors
  ];

  /**
   * Validaciones para búsqueda de profesionales
   */
  static validateProfessionalSearch = [
    query('specialtyIds')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') {
          // Si viene como string, intentar parsear como JSON
          try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) {
              throw new Error('specialtyIds debe ser un array');
            }
            return parsed.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
          } catch (e) {
            throw new Error('Formato de specialtyIds inválido');
          }
        }
        return true;
      })
      .withMessage('IDs de especialidades inválidos'),
    
    query('location')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (!parsed.lat || !parsed.lng) {
              throw new Error('Ubicación debe contener lat y lng');
            }
            return true;
          } catch (e) {
            throw new Error('Formato de ubicación inválido');
          }
        }
        return true;
      })
      .withMessage('Formato de ubicación inválido'),
    
    query('maxDistance')
      .optional()
      .isFloat({ min: 1, max: 100 })
      .withMessage('La distancia máxima debe estar entre 1 y 100 km'),
    
    query('minRate')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('La tarifa mínima debe ser un número positivo'),
    
    query('maxRate')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('La tarifa máxima debe ser un número positivo'),
    
    query('availableOnly')
      .optional()
      .isBoolean()
      .withMessage('availableOnly debe ser un valor booleano'),
    
    query('sortBy')
      .optional()
      .isIn(['calificacion_promedio', 'tarifa_hora', 'profile_completion_score', 'profile_views_count'])
      .withMessage('sortBy inválido'),
    
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('La página debe ser un número entero positivo'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('El límite debe estar entre 1 y 100'),

    this.handleValidationErrors
  ];

  /**
   * Validaciones para parámetros de ruta
   */
  static validateProfessionalId = [
    param('id')
      .isUUID()
      .withMessage('ID de profesional inválido'),

    this.handleValidationErrors
  ];

  /**
   * Validaciones para búsqueda de especialidades
   */
  static validateSpecialtySearch = [
    query('q')
      .optional()
      .isLength({ min: 2, max: 50 })
      .trim()
      .escape()
      .withMessage('El término de búsqueda debe tener entre 2 y 50 caracteres'),
    
    query('category')
      .optional()
      .isLength({ min: 2, max: 50 })
      .trim()
      .escape()
      .withMessage('La categoría debe tener entre 2 y 50 caracteres'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('El límite debe estar entre 1 y 50'),

    this.handleValidationErrors
  ];

  /**
   * Validaciones para búsqueda de zonas de cobertura
   */
  static validateZoneSearch = [
    query('q')
      .optional()
      .isLength({ min: 2, max: 100 })
      .trim()
      .escape()
      .withMessage('El término de búsqueda debe tener entre 2 y 100 caracteres'),
    
    query('state')
      .optional()
      .isLength({ min: 2, max: 50 })
      .trim()
      .escape()
      .withMessage('El estado debe tener entre 2 y 50 caracteres'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('El límite debe estar entre 1 y 100'),

    this.handleValidationErrors
  ];

  /**
   * Validador personalizado para verificar que al menos un campo está presente
   */
  static atLeastOneField(fields) {
    return body().custom((value, { req }) => {
      const hasAtLeastOne = fields.some(field => {
        return req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '';
      });
      
      if (!hasAtLeastOne) {
        throw new Error(`Al menos uno de los siguientes campos debe estar presente: ${fields.join(', ')}`);
      }
      
      return true;
    });
  }

  /**
   * Validador personalizado para validar coherencia de tarifas
   */
  static validateRateConsistency = body().custom((value, { req }) => {
    const { tipo_tarifa, tarifa_hora, tarifa_servicio, tarifa_convenio } = req.body;
    
    // Validar que al menos una tarifa esté definida según el tipo
    switch (tipo_tarifa) {
      case 'hora':
        if (!tarifa_hora || tarifa_hora <= 0) {
          throw new Error('Para tarifa por hora, debe especificar un valor mayor a 0');
        }
        break;
      case 'servicio':
        if (!tarifa_servicio || tarifa_servicio <= 0) {
          throw new Error('Para tarifa por servicio, debe especificar un valor mayor a 0');
        }
        break;
      case 'convenio':
        if (!tarifa_convenio || tarifa_convenio.trim().length < 5) {
          throw new Error('Para tarifa a convenir, debe proporcionar una descripción (mínimo 5 caracteres)');
        }
        break;
    }
    
    return true;
  });

  /**
   * Validador personalizado para validar coordenadas geográficas
   */
  static validateGeographicConsistency = body().custom((value, { req }) => {
    const { latitud, longitud, coverage_zone_id, zona_cobertura } = req.body;
    
    // Si se proporciona coverage_zone_id, debe existir zona_cobertura
    if (coverage_zone_id && !zona_cobertura) {
      throw new Error('Si se selecciona una zona de cobertura, debe especificar la zona de cobertura');
    }
    
    // Si se proporcionan coordenadas, deben ser válidas
    if (latitud !== undefined && latitud !== null && (latitud < -90 || latitud > 90)) {
      throw new Error('La latitud debe estar entre -90 y 90');
    }
    
    if (longitud !== undefined && longitud !== null && (longitud < -180 || longitud > 180)) {
      throw new Error('La longitud debe estar entre -180 y 180');
    }
    
    // Si se proporcionan coordenadas, debe haber zona_cobertura
    if ((latitud !== undefined && latitud !== null) || (longitud !== undefined && longitud !== null)) {
      if (!zona_cobertura) {
        throw new Error('Si se proporcionan coordenadas GPS, debe especificar la zona de cobertura');
      }
    }
    
    return true;
  });

  /**
   * Middleware para validar el rol del usuario
   */
  static validateUserRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user || req.user.role !== requiredRole) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: `Se requiere rol de ${requiredRole}`
        });
      }
      next();
    };
  }

  /**
   * Middleware para validar propiedad del perfil
   */
  static validateProfileOwnership = (req, res, next) => {
    const { userId } = req.user;
    const { professionalId } = req.params;

    if (userId !== professionalId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo puedes acceder a tu propio perfil'
      });
    }

    next();
  };
}

module.exports = ProfessionalProfileValidationMiddleware;