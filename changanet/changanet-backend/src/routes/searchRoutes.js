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

const router = express.Router();

// Ruta para buscar profesionales con filtros avanzados y ordenamiento
// REQ-11,12,13,14,15: Implementa búsqueda completa según PRD
router.get('/', searchProfessionals);

module.exports = router;