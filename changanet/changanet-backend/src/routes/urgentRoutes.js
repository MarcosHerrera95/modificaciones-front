/**
 * @archivo src/routes/urgentRoutes.js - Rutas de Servicios Urgentes
 * @descripción Define endpoints REST para gestión completa de servicios urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Sistema de atención inmediata para emergencias
 */

const express = require('express');
const {
  createUrgentRequest,
  getUrgentRequestStatus,
  cancelUrgentRequest,
  getNearbyUrgentRequests,
  acceptUrgentRequest,
  rejectUrgentRequest,
  autoDispatchUrgentRequest,
  geoScanUrgentRequests,
  notifyProfessionals,
  getUrgentPricingRules,
  updateUrgentPricingRules
} = require('../controllers/urgentController');
const {
  getMatchingStats,
  testMatchingAlgorithm,
  optimizeMatchingAlgorithm,
  getGeospatialStats,
  getMatchingPerformance,
  clearGeolocationCache,
  debugProfessionalLocations
} = require('../controllers/matchingController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ==================================================
// ENDPOINTS PARA CLIENTES
// ==================================================

/**
 * @ruta POST /api/urgent-requests - Crear solicitud urgente
 * @descripción Permite a clientes crear solicitudes de servicios urgentes con geolocalización
 * @acceso Clientes autenticados
 * @body {description: string, location: {lat: number, lng: number}, radiusKm: number, serviceCategory?: string}
 */
router.post('/urgent-requests', createUrgentRequest);

/**
 * @ruta GET /api/urgent-requests/:id/status - Obtener estado de solicitud urgente
 * @descripción Permite a clientes ver el estado y progreso de su solicitud urgente
 * @acceso Solo el cliente propietario
 */
router.get('/urgent-requests/:id/status', getUrgentRequestStatus);

/**
 * @ruta POST /api/urgent-requests/:id/cancel - Cancelar solicitud urgente
 * @descripción Permite a clientes cancelar solicitudes urgentes activas
 * @acceso Solo el cliente propietario
 */
router.post('/urgent-requests/:id/cancel', cancelUrgentRequest);

// ==================================================
// ENDPOINTS PARA PROFESIONALES
// ==================================================

/**
 * @ruta GET /api/urgent/nearby - Obtener solicitudes urgentes cercanas
 * @descripción Permite a profesionales ver solicitudes urgentes en su área
 * @acceso Profesionales autenticados
 * @query {lat: number, lng: number, serviceCategory?: string}
 */
router.get('/urgent/nearby', getNearbyUrgentRequests);

/**
 * @ruta POST /api/urgent/:id/accept - Aceptar solicitud urgente
 * @descripción Permite a profesionales aceptar solicitudes urgentes asignadas
 * @acceso Profesionales candidatos
 */
router.post('/urgent/:id/accept', acceptUrgentRequest);

/**
 * @ruta POST /api/urgent/:id/reject - Rechazar solicitud urgente
 * @descripción Permite a profesionales rechazar solicitudes urgentes asignadas
 * @acceso Profesionales candidatos
 */
router.post('/urgent/:id/reject', rejectUrgentRequest);

// ==================================================
// ENDPOINTS PARA SISTEMA (Internos)
// ==================================================

/**
 * @ruta POST /api/urgent/autodispatch - Asignación automática
 * @descripción Endpoint interno para activar asignación automática de solicitudes urgentes
 * @acceso Sistema interno
 * @body {urgentRequestId: string}
 */
router.post('/urgent/autodispatch', autoDispatchUrgentRequest);

/**
 * @ruta POST /api/urgent/geoscan - Escaneo geográfico
 * @descripción Endpoint interno para escanear áreas geográficas en busca de profesionales
 * @acceso Sistema interno
 */
router.post('/urgent/geoscan', geoScanUrgentRequests);

/**
 * @ruta POST /api/urgent/notify-professionals - Notificar profesionales
 * @descripción Endpoint interno para reenviar notificaciones a profesionales
 * @acceso Sistema interno
 */
router.post('/urgent/notify-professionals', notifyProfessionals);

// ==================================================
// ENDPOINTS PARA ADMINISTRADORES
// ==================================================

/**
 * @ruta GET /api/urgent/pricing - Obtener reglas de precios urgentes
 * @descripción Permite a administradores ver las reglas de precios dinámicos
 * @acceso Administradores
 */
router.get('/urgent/pricing', getUrgentPricingRules);

/**
 * @ruta POST /api/urgent/pricing/update - Actualizar reglas de precios
 * @descripción Permite a administradores modificar las reglas de precios dinámicos
 * @acceso Administradores
 * @body {rules: Array<{service_category: string, base_multiplier: number, min_price: number}>}
 */
router.post('/urgent/pricing/update', updateUrgentPricingRules);

// ==================================================
// ENDPOINTS PARA GESTIÓN DE MATCHING (Admin)
// ==================================================

/**
 * @ruta GET /api/matching/stats - Obtener estadísticas de matching
 * @descripción Permite a administradores ver métricas de rendimiento del sistema de matching
 * @acceso Administradores
 * @query {startDate?: string, endDate?: string, serviceCategory?: string}
 */
router.get('/matching/stats', getMatchingStats);

/**
 * @ruta GET /api/matching/test - Probar algoritmo de matching
 * @descripción Endpoint para testing y debugging del algoritmo de matching
 * @acceso Administradores
 * @query {lat?: number, lng?: number, radiusKm?: number, serviceCategory?: string, isRetry?: boolean, maxCandidates?: number}
 */
router.get('/matching/test', testMatchingAlgorithm);

/**
 * @ruta POST /api/matching/optimize - Optimizar algoritmo de matching
 * @descripción Ejecuta análisis de datos históricos para optimizar el algoritmo
 * @acceso Administradores
 */
router.post('/matching/optimize', optimizeMatchingAlgorithm);

/**
 * @ruta GET /api/matching/geostats - Obtener estadísticas geoespaciales
 * @descripción Estadísticas sobre distribución geográfica de servicios urgentes
 * @acceso Administradores
 * @query {startDate?: string, endDate?: string, serviceCategory?: string}
 */
router.get('/matching/geostats', getGeospatialStats);

/**
 * @ruta GET /api/matching/performance - Obtener métricas de rendimiento
 * @descripción Métricas detalladas de rendimiento del sistema de matching
 * @acceso Administradores
 * @query {period?: string}
 */
router.get('/matching/performance', getMatchingPerformance);

/**
 * @ruta POST /api/matching/cache/clear - Limpiar cache de geolocalización
 * @descripción Endpoint para mantenimiento del sistema
 * @acceso Administradores
 */
router.post('/matching/cache/clear', clearGeolocationCache);

/**
 * @ruta GET /api/matching/debug/locations - Debug de ubicación de profesionales
 * @descripción Endpoint para debugging de ubicaciones
 * @acceso Administradores
 * @query {professionalId?: string}
 */
router.get('/matching/debug/locations', debugProfessionalLocations);

module.exports = router;