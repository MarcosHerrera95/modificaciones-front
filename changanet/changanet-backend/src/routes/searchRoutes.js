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
const { PrismaClient } = require('@prisma/client');
const { searchProfessionals } = require('../controllers/searchController');
const { searchRateLimiter, suggestionsRateLimiter } = require('../middleware/advancedRateLimiting');

const prisma = new PrismaClient();

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

    const searchTerm = q.trim().toLowerCase();
    const maxLimit = Math.min(parseInt(limit) || 10, 20); // Máximo 20 sugerencias

    // Buscar especialidades que coincidan
    const specialtySuggestions = await prisma.perfiles_profesionales.findMany({
      where: {
        especialidad: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      select: {
        especialidad: true
      },
      distinct: ['especialidad'],
      take: Math.ceil(maxLimit / 2) // Mitad para especialidades
    });

    // Buscar zonas/barrios que coincidan
    const locationSuggestions = await prisma.perfiles_profesionales.findMany({
      where: {
        zona_cobertura: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      select: {
        zona_cobertura: true
      },
      distinct: ['zona_cobertura'],
      take: Math.ceil(maxLimit / 2) // Mitad para ubicaciones
    });

    // Formatear sugerencias de especialidades
    const specialtyResults = specialtySuggestions.map(item => ({
      type: 'specialty',
      value: item.especialidad,
      category: 'servicios',
      matchType: 'contains'
    }));

    // Formatear sugerencias de ubicaciones
    const locationResults = locationSuggestions.map(item => ({
      type: 'location',
      value: item.zona_cobertura,
      category: 'ubicaciones',
      matchType: 'contains'
    }));

    // Combinar y limitar resultados
    const allSuggestions = [...specialtyResults, ...locationResults].slice(0, maxLimit);

    // Si no hay resultados exactos, buscar coincidencias parciales más amplias
    if (allSuggestions.length === 0) {
      const broadSpecialtySuggestions = await prisma.perfiles_profesionales.findMany({
        where: {
          OR: [
            { especialidad: { contains: searchTerm, mode: 'insensitive' } },
            { zona_cobertura: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        select: {
          especialidad: true,
          zona_cobertura: true
        },
        distinct: ['especialidad', 'zona_cobertura'],
        take: maxLimit
      });

      const broadResults = broadSpecialtySuggestions.flatMap(item => [
        {
          type: 'specialty',
          value: item.especialidad,
          category: 'servicios',
          matchType: 'broad'
        },
        {
          type: 'location',
          value: item.zona_cobertura,
          category: 'ubicaciones',
          matchType: 'broad'
        }
      ]).filter((item, index, self) =>
        index === self.findIndex(s => s.value === item.value && s.type === item.type)
      );

      allSuggestions.push(...broadResults.slice(0, maxLimit));
    }

    res.json({
      success: true,
      suggestions: allSuggestions,
      query: q,
      count: allSuggestions.length
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