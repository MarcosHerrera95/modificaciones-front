// src/routes/advancedSearchRoutes.js
// Rutas para sistema de búsqueda avanzada de profesionales
// Implementa sección 7.3 del PRD: Sistema de Búsqueda y Filtros
//
// ENDPOINTS DISPONIBLES:
// GET /api/advanced-search - Búsqueda principal con filtros avanzados
// GET /api/search - Búsqueda simple (compatibilidad con frontend)
// GET /api/search/specialties - Búsqueda de especialidades
// GET /api/search/suggestions - Sugerencias de búsqueda
// GET /api/metrics/search - Métricas de rendimiento
//
// PARÁMETROS DE BÚSQUEDA:
// - q: Palabra clave para búsqueda semántica
// - specialty: Especialidad específica
// - city: Ciudad de búsqueda
// - district: Barrio específico
// - minPrice/maxPrice: Rango de precios
// - priceType: Tipo de tarifa (hora, servicio, convenio)
// - sortBy: Ordenamiento (rating, distance, availability, price)
// - user_lat/user_lng: Coordenadas para cálculo de distancia
// - radius: Radio de búsqueda en km
// - page: Página para paginación
// - limit: Resultados por página
// - onlyVerified: Solo profesionales verificados
// - availableOnly: Solo profesionales disponibles

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { 
  advancedSearch, 
  searchProfessionals, 
  searchSpecialties, 
  getSearchSuggestions 
} = require('../controllers/advancedSearchController');
const { 
  getRealtimeMetrics,
  getSpecialtyMetrics,
  getLocationMetrics
} = require('../services/searchMetricsService');
const rateLimit = require('express-rate-limit');

const prisma = new PrismaClient();

// Crear router
const router = express.Router();

// Rate limiting específico para búsquedas
const searchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 búsquedas por IP cada 15 minutos
  message: {
    success: false,
    error: 'Demasiadas solicitudes de búsqueda. Intenta nuevamente en 15 minutos.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip para administradores
  skip: (req) => req.user?.rol === 'admin',
  // Headers personalizados para debugging
  keyGenerator: (req) => {
    return req.ip + (req.user?.id ? `:user:${req.user.id}` : ':anon');
  },
  // Función para personalizar el mensaje de error
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit excedido para búsquedas',
      limit: 100,
      windowMs: 15 * 60 * 1000,
      retryAfter: Math.ceil((15 * 60 * 1000) / 1000)
    });
  }
});

// Rate limiting más estricto para sugerencias (evitar abuso)
const suggestionsRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 sugerencias por IP cada 5 minutos
  message: {
    success: false,
    error: 'Demasiadas solicitudes de sugerencias. Intenta nuevamente en 5 minutos.',
    retryAfter: 300
  }
});

// Rate limiting para métricas (solo administradores)
const metricsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 requests por minuto
  message: {
    success: false,
    error: 'Demasiadas solicitudes de métricas. Intenta nuevamente en 1 minuto.',
    retryAfter: 60
  },
  skip: (req) => req.user?.rol !== 'admin'
});

/**
 * RUTA PRINCIPAL: Búsqueda avanzada con filtros múltiples
 * REQ-11, REQ-12, REQ-13, REQ-14, REQ-15: Implementación completa
 */
router.get('/advanced-search', searchRateLimit, advancedSearch);

/**
 * RUTA DE COMPATIBILIDAD: Mapea parámetros del frontend actual
 * Mantiene compatibilidad con la implementación existente
 */
router.get('/search', searchRateLimit, searchProfessionals);

/**
 * RUTA: Búsqueda de especialidades
 * Permite buscar y filtrar por especialidades disponibles
 */
router.get('/search/specialties', suggestionsRateLimit, searchSpecialties);

/**
 * RUTA: Sugerencias de búsqueda
 * Autocompletado inteligente para mejorar UX
 */
router.get('/search/suggestions', suggestionsRateLimit, getSearchSuggestions);

/**
 * RUTAS DE MÉTRICAS Y MONITOREO (Solo Administradores)
 */
router.get('/metrics/search', metricsRateLimit, async (req, res) => {
  try {
    const { period = '1h' } = req.query;
    
    // Verificar permisos de administrador
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para acceder a las métricas'
      });
    }
    
    const metrics = await getRealtimeMetrics(period);
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Error getting search metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas de búsqueda'
    });
  }
});

/**
 * RUTA: Métricas por especialidad
 */
router.get('/metrics/specialties', metricsRateLimit, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para acceder a las métricas'
      });
    }
    
    const { period = '24h' } = req.query;
    const metrics = await getSpecialtyMetrics(period);
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Error getting specialty metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas por especialidad'
    });
  }
});

/**
 * RUTA: Métricas por ubicación
 */
router.get('/metrics/locations', metricsRateLimit, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para acceder a las métricas'
      });
    }
    
    const { period = '24h' } = req.query;
    const metrics = await getLocationMetrics(period);
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Error getting location metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas por ubicación'
    });
  }
});

/**
 * RUTA DE HEALTH CHECK para el sistema de búsqueda
 * Verifica que todos los servicios estén funcionando
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        cache: 'unknown',
        metrics: 'unknown'
      }
    };
    
    // Verificar conexión a base de datos
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthStatus.services.database = 'healthy';
    } catch (error) {
      healthStatus.services.database = 'unhealthy';
      healthStatus.status = 'degraded';
    }
    
    // Verificar Redis (opcional)
    try {
      const redisClient = require('redis').createClient();
      await redisClient.ping();
      healthStatus.services.cache = 'healthy';
    } catch (error) {
      healthStatus.services.cache = 'unavailable';
    }
    
    // Verificar servicio de métricas
    try {
      const { SearchMetricsService } = require('../services/searchMetricsService');
      await SearchMetricsService.getRealtimeMetrics('1h');
      healthStatus.services.metrics = 'healthy';
    } catch (error) {
      healthStatus.services.metrics = 'unhealthy';
      healthStatus.status = 'degraded';
    }
    
    // Determinar código de respuesta
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: healthStatus
    });
    
  } catch (error) {
    console.error('Error in search health check:', error);
    res.status(503).json({
      success: false,
      error: 'Sistema de búsqueda no disponible',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * RUTA DE DOCUMENTACIÓN INTERNA
 * Proporciona información sobre parámetros y ejemplos de uso
 */
router.get('/docs', (req, res) => {
  const documentation = {
    title: 'API de Búsqueda Avanzada - Changánet',
    version: '1.0',
    description: 'Sistema de búsqueda y filtros para profesionales',
    endpoints: {
      'GET /api/advanced-search': {
        description: 'Búsqueda principal con filtros avanzados',
        parameters: {
          q: {
            type: 'string',
            description: 'Palabra clave para búsqueda semántica',
            example: 'plomero',
            required: false
          },
          specialty: {
            type: 'string',
            description: 'Especialidad específica',
            example: 'Plomería',
            required: false
          },
          city: {
            type: 'string',
            description: 'Ciudad de búsqueda',
            example: 'Buenos Aires',
            required: false
          },
          district: {
            type: 'string',
            description: 'Barrio específico',
            example: 'Palermo',
            required: false
          },
          minPrice: {
            type: 'number',
            description: 'Precio mínimo por hora',
            example: 2000,
            required: false
          },
          maxPrice: {
            type: 'number',
            description: 'Precio máximo por hora',
            example: 5000,
            required: false
          },
          sortBy: {
            type: 'string',
            description: 'Ordenamiento',
            enum: ['rating', 'distance', 'availability', 'price'],
            default: 'rating',
            required: false
          },
          user_lat: {
            type: 'number',
            description: 'Latitud del usuario',
            example: -34.6037,
            required: false
          },
          user_lng: {
            type: 'number',
            description: 'Longitud del usuario',
            example: -58.3816,
            required: false
          },
          radius: {
            type: 'number',
            description: 'Radio de búsqueda en km',
            example: 10,
            required: false
          },
          page: {
            type: 'number',
            description: 'Página para paginación',
            default: 1,
            required: false
          },
          limit: {
            type: 'number',
            description: 'Resultados por página (máximo 100)',
            default: 20,
            required: false
          }
        },
        examples: {
          'Búsqueda básica': '/api/advanced-search?q=plomero',
          'Búsqueda con filtros': '/api/advanced-search?q=electricista&city=Buenos Aires&minPrice=3000&maxPrice=6000',
          'Búsqueda por radio': '/api/advanced-search?specialty=Plomero&user_lat=-34.6037&user_lng=-58.3816&radius=15',
          'Ordenamiento': '/api/advanced-search?q=carpintero&sortBy=distance'
        }
      },
      'GET /api/search': {
        description: 'Búsqueda simple (compatibilidad)',
        note: 'Mapea automáticamente a advanced-search'
      },
      'GET /api/search/specialties': {
        description: 'Búsqueda de especialidades',
        parameters: {
          q: {
            type: 'string',
            description: 'Búsqueda por nombre de especialidad',
            example: 'electric',
            required: true
          }
        }
      },
      'GET /api/search/suggestions': {
        description: 'Sugerencias de búsqueda inteligente',
        parameters: {
          q: {
            type: 'string',
            description: 'Texto de búsqueda para autocompletado',
            example: 'plom',
            required: true
          }
        }
      }
    },
    rateLimiting: {
      'advanced-search': '100 requests per 15 minutes per IP',
      'search': '100 requests per 15 minutes per IP',
      'suggestions': '20 requests per 5 minutes per IP',
      'specialties': '20 requests per 5 minutes per IP'
    },
    authentication: {
      required: false,
      note: 'La búsqueda es pública, pero el rate limiting es más estricto para usuarios anónimos'
    },
    responseFormat: {
      success: true/false,
      data: {
        professionals: 'Array de profesionales',
        total: 'Total de resultados',
        page: 'Página actual',
        totalPages: 'Total de páginas'
      },
      meta: {
        searchTime: 'Tiempo de búsqueda en ms',
        cached: 'Si el resultado fue del caché',
        filters: 'Filtros aplicados'
      }
    }
  };
  
  res.json({
    success: true,
    data: documentation
  });
});

module.exports = router;