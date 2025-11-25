// src/routes/searchRoutes.js
// Rutas para sistema de búsqueda de profesionales
// Implementa sección 7.3 del PRD: Sistema de Búsqueda y Filtros
//
// PARÁMETROS DE BÚSQUEDA DISPONIBLES:
// - especialidad: Búsqueda por especialidad
// - zona_cobertura: Filtro por zona/barrio
// - precio_min/precio_max: Rango de precios
// - tipo_tarifa: Tipo de tarifa (hora, servicio, convenio)
// - radio_km: Radio geográfico en km (requiere user_lat/user_lng)
// - disponible: Filtro por disponibilidad (true/false)
// - sort_by: Ordenamiento (calificacion_promedio, tarifa_hora, distancia, disponibilidad)
// - page/limit: Paginación
// - user_lat/user_lng: Coordenadas para cálculo de distancia

const express = require('express');
const { searchProfessionals } = require('../controllers/searchController');
const { searchRateLimiter, suggestionsRateLimiter } = require('../middleware/advancedRateLimiting');

const router = express.Router();

// Ruta para buscar profesionales con filtros avanzados y ordenamiento
// REQ-11,12,13,14,15: Implementa búsqueda completa según PRD
// Incluye rate limiting avanzado y sanitización de entrada
router.get('/', searchRateLimiter, searchProfessionals);

// Ruta para obtener sugerencias de búsqueda (autocompletado)
// Endpoint separado con rate limiting específico
router.get('/suggestions', suggestionsRateLimiter, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        suggestions: [],
        query: q || ''
      });
    }

    // TODO: Implementar lógica de sugerencias desde base de datos
    // Por ahora, devolver sugerencias básicas
    const mockSuggestions = [
      { type: 'specialty', value: 'plomero', category: 'servicios' },
      { type: 'specialty', value: 'electricista', category: 'servicios' },
      { type: 'location', value: 'Buenos Aires', category: 'ciudades' },
      { type: 'location', value: 'Palermo', category: 'barrios' }
    ].filter(item =>
      item.value.toLowerCase().includes(q.toLowerCase())
    ).slice(0, parseInt(limit));

    res.json({
      success: true,
      suggestions: mockSuggestions,
      query: q,
      count: mockSuggestions.length
    });

  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener sugerencias de búsqueda'
    });
  }
});

module.exports = router;