/**
 * @archivo src/controllers/matchingController.js - Controlador de Matching para Servicios Urgentes
 * @descripción Endpoints para gestión de algoritmos de matching y estadísticas
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación de endpoints para monitoreo y gestión de matching
 * @impacto Social: Transparencia y optimización del sistema de matching
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Referencias a servicios (se establecen desde el servidor)
let matchingService = null;
let geolocationService = null;

function setMatchingService(service) {
  matchingService = service;
}

function setGeolocationService(service) {
  geolocationService = service;
}

/**
 * GET /api/matching/stats - Obtener estadísticas de matching
 * Permite a administradores ver métricas de rendimiento del sistema de matching
 */
exports.getMatchingStats = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver estadísticas de matching.' });
    }

    const { startDate, endDate, serviceCategory } = req.query;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (serviceCategory) filters.serviceCategory = serviceCategory;

    if (!matchingService) {
      return res.status(500).json({ error: 'Servicio de matching no disponible.' });
    }

    const stats = await matchingService.getMatchingStats(filters);

    res.status(200).json({
      success: true,
      data: stats,
      filters
    });

  } catch (error) {
    console.error('Error getting matching stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de matching.' });
  }
};

/**
 * GET /api/matching/test - Probar algoritmo de matching
 * Endpoint para testing y debugging del algoritmo de matching
 */
exports.testMatchingAlgorithm = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden probar el algoritmo de matching.' });
    }

    const {
      lat = -34.6118,
      lng = -58.3960,
      radiusKm = 5,
      serviceCategory,
      isRetry = false,
      maxCandidates = 5
    } = req.query;

    if (!matchingService) {
      return res.status(500).json({ error: 'Servicio de matching no disponible.' });
    }

    const candidates = await matchingService.findMatchingProfessionals(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radiusKm),
      {
        serviceCategory,
        isRetry: isRetry === 'true',
        maxCandidates: parseInt(maxCandidates)
      }
    );

    res.status(200).json({
      success: true,
      test: {
        location: { lat: parseFloat(lat), lng: parseFloat(lng) },
        radiusKm: parseFloat(radiusKm),
        serviceCategory,
        isRetry: isRetry === 'true'
      },
      candidates: candidates.map(c => ({
        professionalId: c.professionalId,
        distance: c.distance,
        rating: c.rating,
        totalScore: c.totalScore,
        profile: c.profile
      })),
      totalFound: candidates.length
    });

  } catch (error) {
    console.error('Error testing matching algorithm:', error);
    res.status(500).json({ error: 'Error al probar algoritmo de matching.' });
  }
};

/**
 * POST /api/matching/optimize - Optimizar algoritmo de matching
 * Ejecuta análisis de datos históricos para optimizar el algoritmo
 */
exports.optimizeMatchingAlgorithm = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden optimizar el algoritmo.' });
    }

    if (!matchingService) {
      return res.status(500).json({ error: 'Servicio de matching no disponible.' });
    }

    const optimizationResults = await matchingService.optimizeMatchingAlgorithm();

    if (!optimizationResults) {
      return res.status(404).json({ error: 'No hay suficientes datos históricos para optimización.' });
    }

    res.status(200).json({
      success: true,
      message: 'Optimización completada',
      optimizationResults
    });

  } catch (error) {
    console.error('Error optimizing matching algorithm:', error);
    res.status(500).json({ error: 'Error al optimizar algoritmo de matching.' });
  }
};

/**
 * GET /api/matching/pricing - Obtener reglas de precios urgentes
 * Permite ver las reglas de precios dinámicos actuales
 */
exports.getUrgentPricingRules = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver reglas de precios.' });
    }

    if (!matchingService) {
      return res.status(500).json({ error: 'Servicio de matching no disponible.' });
    }

    const rules = await matchingService.getUrgentPricingRules();

    res.status(200).json({
      success: true,
      rules
    });

  } catch (error) {
    console.error('Error getting urgent pricing rules:', error);
    res.status(500).json({ error: 'Error al obtener reglas de precios.' });
  }
};

/**
 * POST /api/matching/pricing/update - Actualizar reglas de precios urgentes
 * Permite actualizar las reglas de precios dinámicos
 */
exports.updateUrgentPricingRules = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden actualizar reglas de precios.' });
    }

    const { rules } = req.body;

    if (!Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ error: 'Se requieren reglas de precios válidas.' });
    }

    // Validar estructura de reglas
    for (const rule of rules) {
      if (!rule.service_category || typeof rule.base_multiplier !== 'number' || typeof rule.min_price !== 'number') {
        return res.status(400).json({
          error: 'Cada regla debe tener service_category, base_multiplier y min_price válidos.'
        });
      }
    }

    if (!matchingService) {
      return res.status(500).json({ error: 'Servicio de matching no disponible.' });
    }

    const updatedRules = await matchingService.updateUrgentPricingRules(rules);

    console.log(`💰 Reglas de precios urgentes actualizadas por admin ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: 'Reglas de precios actualizadas exitosamente',
      rules: updatedRules
    });

  } catch (error) {
    console.error('Error updating urgent pricing rules:', error);
    res.status(500).json({ error: 'Error al actualizar reglas de precios.' });
  }
};

/**
 * GET /api/matching/geostats - Obtener estadísticas geoespaciales
 * Estadísticas sobre distribución geográfica de servicios urgentes
 */
exports.getGeospatialStats = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver estadísticas geoespaciales.' });
    }

    const { startDate, endDate, serviceCategory } = req.query;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (serviceCategory) filters.serviceCategory = serviceCategory;

    if (!geolocationService) {
      return res.status(500).json({ error: 'Servicio de geolocalización no disponible.' });
    }

    const stats = await geolocationService.getGeospatialStats(filters);

    res.status(200).json({
      success: true,
      data: stats,
      filters
    });

  } catch (error) {
    console.error('Error getting geospatial stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas geoespaciales.' });
  }
};

/**
 * GET /api/matching/performance - Obtener métricas de rendimiento
 * Métricas detalladas de rendimiento del sistema de matching
 */
exports.getMatchingPerformance = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver métricas de rendimiento.' });
    }

    const { period = '24h' } = req.query;

    // Calcular fechas según período
    const now = new Date();
    let startDate;

    switch (period) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Obtener métricas de matching
    const matchingStats = await matchingService?.getMatchingStats({
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    }) || {};

    // Obtener métricas geoespaciales
    const geoStats = await geolocationService?.getGeospatialStats({
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    }) || {};

    // Obtener métricas de cache
    const cacheStats = geolocationService ? {
      cacheSize: geolocationService.getCacheSize(),
      cacheHitRatio: 'N/A' // Podría implementarse en el futuro
    } : {};

    // Calcular métricas de rendimiento
    const performance = {
      period,
      timestamp: now.toISOString(),
      matching: {
        totalRequests: matchingStats.totalRequests || 0,
        matchedRequests: matchingStats.matchedRequests || 0,
        matchingRate: matchingStats.matchingRate || 0,
        avgCandidatesPerRequest: matchingStats.avgCandidatesPerRequest || 0,
        avgMatchingTime: matchingStats.avgMatchingTime || 0
      },
      geospatial: {
        avgRadius: geoStats.avgRadius || 0,
        avgMatchingDistance: geoStats.avgMatchingDistance || 0,
        coverageArea: geoStats.coverageArea || 0
      },
      cache: cacheStats,
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    };

    res.status(200).json({
      success: true,
      performance
    });

  } catch (error) {
    console.error('Error getting matching performance:', error);
    res.status(500).json({ error: 'Error al obtener métricas de rendimiento.' });
  }
};

/**
 * POST /api/matching/cache/clear - Limpiar cache de geolocalización
 * Endpoint para mantenimiento del sistema
 */
exports.clearGeolocationCache = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden limpiar el cache.' });
    }

    if (!geolocationService) {
      return res.status(500).json({ error: 'Servicio de geolocalización no disponible.' });
    }

    const cacheSizeBefore = geolocationService.getCacheSize();
    geolocationService.clearCache();
    const cacheSizeAfter = geolocationService.getCacheSize();

    console.log(`🧹 Cache de geolocalización limpiado por admin ${req.user.id}: ${cacheSizeBefore} → ${cacheSizeAfter} entradas`);

    res.status(200).json({
      success: true,
      message: 'Cache de geolocalización limpiado exitosamente',
      cacheCleared: cacheSizeBefore - cacheSizeAfter
    });

  } catch (error) {
    console.error('Error clearing geolocation cache:', error);
    res.status(500).json({ error: 'Error al limpiar cache de geolocalización.' });
  }
};

/**
 * GET /api/matching/debug/location - Debug de ubicación de profesionales
 * Endpoint para debugging de ubicaciones
 */
exports.debugProfessionalLocations = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden acceder al debug de ubicaciones.' });
    }

    const { professionalId } = req.query;

    const where = professionalId ? { usuario_id: professionalId } : {};

    const locations = await prisma.perfiles_profesionales.findMany({
      where,
      select: {
        usuario_id: true,
        latitud: true,
        longitud: true,
        last_location_update: true,
        usuario: {
          select: {
            nombre: true,
            esta_disponible: true
          }
        }
      }
    });

    const debugInfo = locations.map(loc => ({
      professionalId: loc.usuario_id,
      name: loc.usuario.nombre,
      available: loc.usuario.esta_disponible,
      location: {
        lat: loc.latitud,
        lng: loc.longitud,
        lastUpdate: loc.last_location_update
      },
      hasValidLocation: loc.latitud !== null && loc.longitud !== null &&
                       geolocationService?.validateCoordinates(loc.latitud, loc.longitud)
    }));

    res.status(200).json({
      success: true,
      debug: {
        total: debugInfo.length,
        withValidLocation: debugInfo.filter(d => d.hasValidLocation).length,
        withoutLocation: debugInfo.filter(d => !d.hasValidLocation).length
      },
      locations: debugInfo
    });

  } catch (error) {
    console.error('Error debugging professional locations:', error);
    res.status(500).json({ error: 'Error en debug de ubicaciones.' });
  }
};

module.exports = {
  setMatchingService,
  setGeolocationService,
  getMatchingStats: exports.getMatchingStats,
  testMatchingAlgorithm: exports.testMatchingAlgorithm,
  optimizeMatchingAlgorithm: exports.optimizeMatchingAlgorithm,
  getUrgentPricingRules: exports.getUrgentPricingRules,
  updateUrgentPricingRules: exports.updateUrgentPricingRules,
  getGeospatialStats: exports.getGeospatialStats,
  getMatchingPerformance: exports.getMatchingPerformance,
  clearGeolocationCache: exports.clearGeolocationCache,
  debugProfessionalLocations: exports.debugProfessionalLocations
};