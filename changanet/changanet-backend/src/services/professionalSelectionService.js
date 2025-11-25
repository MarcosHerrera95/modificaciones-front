/**
 * @archivo src/services/professionalSelectionService.js - Servicio de Selección de Profesionales
 * @descripción Servicio para seleccionar profesionales elegibles para solicitudes de presupuesto
 * @versión 1.0 - Sistema de selección inteligente basado en criterios geográficos y de especialidad
 *
 * FUNCIONALIDADES IMPLEMENTADAS:
 * ✅ Selección de profesionales por especialidad y ubicación
 * ✅ Cálculo de distancia geográfica (fórmula de Haversine)
 * ✅ Filtros por calificación, experiencia y disponibilidad
 * ✅ Ordenamiento inteligente por relevancia
 * ✅ Límite configurable de resultados
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Calcular distancia entre dos puntos geográficos usando la fórmula de Haversine
 * @param {Object} point1 - Punto 1 con latitud y longitud
 * @param {Object} point2 - Punto 2 con latitud y longitud
 * @returns {number} Distancia en kilómetros
 */
function calculateDistance(point1, point2) {
  if (!point1 || !point2 || !point1.latitude || !point1.longitude || !point2.latitude || !point2.longitude) {
    return 999; // Distancia máxima si faltan coordenadas
  }

  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) * Math.cos(toRadians(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Redondear a 2 decimales
}

/**
 * Convertir grados a radianes
 * @param {number} degrees - Grados
 * @returns {number} Radianes
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Seleccionar profesionales óptimos para una solicitud de presupuesto
 * @param {Object} criteria - Criterios de selección
 * @param {string} criteria.category - Categoría del servicio
 * @param {Object} criteria.location - Ubicación del cliente (opcional)
 * @param {number} criteria.maxDistance - Distancia máxima en km (default: 25)
 * @param {number} criteria.limit - Límite de resultados (default: 10)
 * @returns {Promise<Array>} Lista de profesionales elegibles
 */
async function selectOptimalProfessionals(criteria) {
  try {
    const {
      category,
      location,
      maxDistance = 25,
      limit = 10
    } = criteria;

    console.log(`Seleccionando profesionales para categoría: ${category}, ubicación:`, location);

    // Construir consulta base
    const whereClause = {
      esta_disponible: true,
      estado_verificacion: 'aprobado',
      // Filtrar por especialidad
      especialidad: {
        equals: category,
        mode: 'insensitive'
      }
    };

    // Agregar filtro de ubicación si está disponible
    if (location && location.latitude && location.longitude) {
      // Para PostgreSQL, usaremos una consulta más compleja con ST_DWithin
      // Por ahora, filtraremos en JavaScript después de obtener los resultados
    }

    // Obtener profesionales candidatos
    const candidates = await prisma.perfiles_profesionales.findMany({
      where: whereClause,
      include: {
        usuarios: {
          select: {
            id: true,
            nombre: true,
            email: true,
            telefono: true,
            url_foto_perfil: true
          }
        },
        coverage_zones: true
      },
      take: limit * 2 // Obtener más candidatos para filtrar por distancia
    });

    console.log(`Encontrados ${candidates.length} candidatos iniciales`);

    // Filtrar y ordenar por distancia si hay ubicación
    let filteredCandidates = candidates;

    if (location && location.latitude && location.longitude) {
      filteredCandidates = candidates
        .map(professional => {
          let distance = 999;

          // Calcular distancia usando zona de cobertura si existe
          if (professional.coverage_zones && professional.coverage_zones.length > 0) {
            // Usar el centro de la zona de cobertura
            const zone = professional.coverage_zones[0];
            if (zone.latitude && zone.longitude) {
              distance = calculateDistance(location, {
                latitude: zone.latitude,
                longitude: zone.longitude
              });
            }
          } else if (professional.latitud && professional.longitud) {
            // Usar coordenadas del perfil profesional
            distance = calculateDistance(location, {
              latitude: professional.latitud,
              longitude: professional.longitud
            });
          }

          return {
            ...professional,
            distance_km: distance
          };
        })
        .filter(professional => professional.distance_km <= maxDistance)
        .sort((a, b) => a.distance_km - b.distance_km);
    }

    // Aplicar criterios adicionales y ordenar por relevancia
    const scoredProfessionals = filteredCandidates
      .map(professional => {
        // Calcular puntuación de relevancia
        let score = 0;

        // Calificación (0-5 puntos)
        const rating = professional.calificacion_promedio || 0;
        score += rating * 1;

        // Experiencia (0-3 puntos)
        const experience = professional.anos_experiencia || 0;
        score += Math.min(experience / 5, 3); // Máximo 3 puntos por experiencia

        // Distancia (0-2 puntos, inversamente proporcional)
        const distance = professional.distance_km || 25;
        score += Math.max(0, 2 - (distance / 12.5)); // Mejor puntuación para distancias menores

        // Verificación (1 punto extra)
        if (professional.estado_verificacion === 'aprobado') {
          score += 1;
        }

        return {
          ...professional,
          relevance_score: Math.round(score * 100) / 100
        };
      })
      .sort((a, b) => b.relevance_score - a.relevance_score) // Ordenar por puntuación descendente
      .slice(0, limit); // Limitar resultados

    console.log(`Seleccionados ${scoredProfessionals.length} profesionales óptimos`);

    // Formatear respuesta
    return scoredProfessionals.map(professional => ({
      professional_id: professional.usuario_id,
      user_id: professional.usuario_id,
      name: professional.usuarios.nombre,
      email: professional.usuarios.email,
      phone: professional.usuarios.telefono,
      specialty: professional.especialidad,
      rating: professional.calificacion_promedio || 0,
      experience_years: professional.anos_experiencia || 0,
      location: professional.zona_cobertura,
      distance_km: professional.distance_km || null,
      relevance_score: professional.relevance_score,
      is_verified: professional.estado_verificacion === 'aprobado',
      profile_photo: professional.usuarios.url_foto_perfil,
      coverage_area: professional.zona_cobertura
    }));

  } catch (error) {
    console.error('Error seleccionando profesionales:', error);
    throw new Error(`Error en selección de profesionales: ${error.message}`);
  }
}

/**
 * Obtener estadísticas de profesionales por categoría
 * @param {string} category - Categoría del servicio
 * @returns {Promise<Object>} Estadísticas de la categoría
 */
async function getProfessionalsStatsByCategory(category) {
  try {
    const stats = await prisma.perfiles_profesionales.groupBy({
      by: ['especialidad'],
      where: {
        especialidad: category,
        esta_disponible: true
      },
      _count: {
        usuario_id: true
      },
      _avg: {
        calificacion_promedio: true,
        anos_experiencia: true
      }
    });

    if (stats.length === 0) {
      return {
        category,
        total_professionals: 0,
        average_rating: 0,
        average_experience: 0
      };
    }

    const categoryStats = stats[0];
    return {
      category: categoryStats.especialidad,
      total_professionals: categoryStats._count.usuario_id,
      average_rating: Math.round((categoryStats._avg.calificacion_promedio || 0) * 10) / 10,
      average_experience: Math.round(categoryStats._avg.anos_experiencia || 0)
    };

  } catch (error) {
    console.error('Error obteniendo estadísticas de profesionales:', error);
    throw error;
  }
}

/**
 * Verificar si un profesional está disponible para una solicitud
 * @param {string} professionalId - ID del profesional
 * @param {string} category - Categoría requerida
 * @returns {Promise<boolean>} Disponibilidad del profesional
 */
async function isProfessionalAvailable(professionalId, category) {
  try {
    const professional = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: professionalId },
      select: {
        esta_disponible: true,
        especialidad: true,
        estado_verificacion: true
      }
    });

    if (!professional) {
      return false;
    }

    return professional.esta_disponible &&
           professional.estado_verificacion === 'aprobado' &&
           professional.especialidad.toLowerCase() === category.toLowerCase();

  } catch (error) {
    console.error('Error verificando disponibilidad del profesional:', error);
    return false;
  }
}

module.exports = {
  calculateDistance,
  selectOptimalProfessionals,
  getProfessionalsStatsByCategory,
  isProfessionalAvailable
};