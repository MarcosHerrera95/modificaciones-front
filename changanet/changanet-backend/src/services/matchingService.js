/**
 * @archivo src/services/matchingService.js - Servicio de Matching para Servicios Urgentes
 * @descripción Algoritmos de matching entre solicitudes urgentes y profesionales disponibles
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación de algoritmos de matching geoespacial y por especialidad
 * @impacto Social: Conexión eficiente entre clientes y profesionales en situaciones de emergencia
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Referencia al servicio de geolocalización
let geolocationService = null;

function setGeolocationService(service) {
  geolocationService = service;
}

class MatchingService {
  /**
   * Encontrar profesionales que coincidan con una solicitud urgente
   * @param {number} lat - Latitud de la solicitud
   * @param {number} lng - Longitud de la solicitud
   * @param {number} radiusKm - Radio de búsqueda en km
   * @param {Object} options - Opciones adicionales de matching
   * @returns {Array} Lista de profesionales candidatos ordenados por prioridad
   */
  async findMatchingProfessionals(lat, lng, radiusKm, options = {}) {
    const {
      serviceCategory,
      isRetry = false,
      minRating = 0,
      maxCandidates = 10,
      prioritizeDistance = true
    } = options;

    try {
      // Buscar profesionales disponibles en el área usando geolocalización
      const nearbyProfessionals = await this.findNearbyAvailableProfessionals(
        lat, lng, radiusKm, serviceCategory
      );

      if (nearbyProfessionals.length === 0) {
        console.log(`No se encontraron profesionales disponibles en ${radiusKm}km de ${lat}, ${lng}`);
        return [];
      }

      // Calcular puntuación de matching para cada profesional
      const candidates = await this.calculateMatchingScores(
        nearbyProfessionals, lat, lng, {
          serviceCategory,
          minRating,
          isRetry
        }
      );

      // Ordenar candidatos por puntuación de matching
      candidates.sort((a, b) => {
        // Priorizar distancia si está habilitado
        if (prioritizeDistance && Math.abs(a.distance - b.distance) > 0.1) {
          return a.distance - b.distance;
        }
        // Luego por puntuación total
        return b.totalScore - a.totalScore;
      });

      // Limitar número de candidatos
      const topCandidates = candidates.slice(0, maxCandidates);

      console.log(`Encontrados ${topCandidates.length} candidatos para solicitud en ${lat}, ${lng}`);

      return topCandidates;

    } catch (error) {
      console.error('Error finding matching professionals:', error);
      return [];
    }
  }

  /**
   * Encontrar profesionales disponibles cercanos usando geolocalización
   * @param {number} lat - Latitud
   * @param {number} lng - Longitud
   * @param {number} radiusKm - Radio en km
   * @param {string} serviceCategory - Categoría de servicio
   * @returns {Array} Profesionales cercanos
   */
  async findNearbyAvailableProfessionals(lat, lng, radiusKm, serviceCategory) {
    try {
      // Usar servicio de geolocalización si está disponible
      if (geolocationService) {
        return await geolocationService.findNearbyProfessionals(lat, lng, radiusKm, {
          esta_disponible: true,
          serviceCategory,
          latitud: { not: null },
          longitud: { not: null }
        });
      }

      // Fallback: búsqueda directa en base de datos
      const professionals = await prisma.perfiles_profesionales.findMany({
        where: {
          latitud: { not: null },
          longitud: { not: null },
          usuario: {
            esta_disponible: true,
            rol: 'profesional'
          }
        },
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              calificacion_promedio: true,
              total_resenas: true,
              esta_disponible: true,
              fcm_token: true,
              notificaciones_push: true
            }
          },
          especialidades: {
            include: {
              especialidad: true
            }
          }
        }
      });

      // Filtrar por distancia y categoría
      const nearbyProfessionals = [];

      for (const profile of professionals) {
        const distance = this.calculateDistance(
          lat, lng,
          profile.latitud, profile.longitud
        );

        if (distance <= radiusKm) {
          // Verificar coincidencia de categoría si se especifica
          let categoryMatch = true;
          if (serviceCategory) {
            categoryMatch = profile.especialidades.some(
              esp => esp.especialidad.nombre.toLowerCase().includes(serviceCategory.toLowerCase()) ||
                     esp.especialidad.categoria.toLowerCase().includes(serviceCategory.toLowerCase())
            );
          }

          if (categoryMatch) {
            nearbyProfessionals.push({
              ...profile,
              distance_km: distance
            });
          }
        }
      }

      return nearbyProfessionals;

    } catch (error) {
      console.error('Error finding nearby professionals:', error);
      return [];
    }
  }

  /**
   * Calcular puntuaciones de matching para candidatos
   * @param {Array} professionals - Lista de profesionales
   * @param {number} requestLat - Latitud de la solicitud
   * @param {number} requestLng - Longitud de la solicitud
   * @param {Object} options - Opciones de matching
   * @returns {Array} Candidatos con puntuaciones calculadas
   */
  async calculateMatchingScores(professionals, requestLat, requestLng, options = {}) {
    const { serviceCategory, minRating, isRetry } = options;

    const candidates = [];

    for (const professional of professionals) {
      const scores = {
        distance: 0,
        rating: 0,
        experience: 0,
        availability: 0,
        categoryMatch: 0
      };

      // Puntuación por distancia (inversa: más cerca = más puntos)
      const maxDistance = 50; // km
      scores.distance = Math.max(0, (maxDistance - professional.distance_km) / maxDistance) * 100;

      // Puntuación por calificación
      const rating = professional.usuario.calificacion_promedio || 0;
      scores.rating = Math.min(rating * 20, 100); // Máximo 100 puntos

      // Puntuación por experiencia (basado en reseñas totales)
      const reviews = professional.usuario.total_resenas || 0;
      scores.experience = Math.min(reviews * 2, 50); // Máximo 50 puntos

      // Puntuación por disponibilidad (siempre 100 si está disponible)
      scores.availability = professional.usuario.esta_disponible ? 100 : 0;

      // Puntuación por coincidencia de categoría
      if (serviceCategory) {
        const hasMatchingSpecialty = professional.especialidades.some(
          esp => esp.especialidad.nombre.toLowerCase().includes(serviceCategory.toLowerCase()) ||
                 esp.especialidad.categoria.toLowerCase().includes(serviceCategory.toLowerCase())
        );
        scores.categoryMatch = hasMatchingSpecialty ? 100 : 0;
      } else {
        scores.categoryMatch = 50; // Puntuación neutral si no hay categoría específica
      }

      // Calcular puntuación total con pesos
      const weights = {
        distance: 0.3,
        rating: 0.25,
        experience: 0.15,
        availability: 0.15,
        categoryMatch: 0.15
      };

      const totalScore = Math.round(
        scores.distance * weights.distance +
        scores.rating * weights.rating +
        scores.experience * weights.experience +
        scores.availability * weights.availability +
        scores.categoryMatch * weights.categoryMatch
      );

      // Aplicar penalización por reintentos
      const finalScore = isRetry ? totalScore * 0.8 : totalScore;

      // Filtrar por calificación mínima
      if (rating >= minRating) {
        candidates.push({
          professionalId: professional.usuario.id,
          distance: professional.distance_km,
          rating: rating,
          totalScore: finalScore,
          scores: scores,
          profile: {
            nombre: professional.usuario.nombre,
            calificacion_promedio: rating,
            total_resenas: reviews,
            especialidades: professional.especialidades.map(e => e.especialidad.nombre)
          }
        });
      }
    }

    return candidates;
  }

  /**
   * Obtener reglas de precios dinámicos para servicios urgentes
   * @param {string} serviceCategory - Categoría del servicio
   * @returns {Object} Reglas de precios
   */
  async getUrgentPricing(serviceCategory) {
    try {
      const rule = await prisma.urgent_pricing_rules.findFirst({
        where: { service_category: serviceCategory }
      });

      if (rule) {
        return {
          multiplier: rule.base_multiplier,
          minPrice: rule.min_price,
          category: rule.service_category
        };
      }

      // Valores por defecto si no hay regla específica
      return {
        multiplier: 1.5,
        minPrice: 0,
        category: 'general'
      };
    } catch (error) {
      console.error('Error getting urgent pricing:', error);
      return { multiplier: 1.5, minPrice: 0, category: 'general' };
    }
  }

  /**
   * Actualizar reglas de precios urgentes (Admin)
   * @param {Array} rules - Nuevas reglas de precios
   * @returns {Array} Reglas actualizadas
   */
  async updateUrgentPricingRules(rules) {
    try {
      const updatedRules = [];

      for (const rule of rules) {
        const updated = await prisma.urgent_pricing_rules.upsert({
          where: { service_category: rule.service_category },
          update: {
            base_multiplier: rule.base_multiplier,
            min_price: rule.min_price,
            updated_at: new Date()
          },
          create: {
            service_category: rule.service_category,
            base_multiplier: rule.base_multiplier,
            min_price: rule.min_price
          }
        });
        updatedRules.push(updated);
      }

      console.log(`💰 Reglas de precios urgentes actualizadas: ${updatedRules.length} reglas`);
      return updatedRules;

    } catch (error) {
      console.error('Error updating urgent pricing rules:', error);
      throw error;
    }
  }

  /**
   * Obtener reglas de precios urgentes (Admin)
   * @returns {Array} Lista de reglas
   */
  async getUrgentPricingRules() {
    try {
      return await prisma.urgent_pricing_rules.findMany({
        orderBy: { service_category: 'asc' }
      });
    } catch (error) {
      console.error('Error getting urgent pricing rules:', error);
      return [];
    }
  }

  /**
   * Calcular distancia entre dos puntos usando fórmula de Haversine
   * @param {number} lat1 - Latitud punto 1
   * @param {number} lng1 - Longitud punto 1
   * @param {number} lat2 - Latitud punto 2
   * @param {number} lng2 - Longitud punto 2
   * @returns {number} Distancia en kilómetros
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Obtener estadísticas de matching
   * @param {Object} filters - Filtros para estadísticas
   * @returns {Object} Estadísticas de matching
   */
  async getMatchingStats(filters = {}) {
    const { startDate, endDate, serviceCategory } = filters;

    const where = {};
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }
    if (serviceCategory) {
      where.service = {
        categoria: serviceCategory
      };
    }

    const [
      totalRequests,
      matchedRequests,
      avgCandidatesPerRequest,
      avgMatchingTime,
      successRateByCategory
    ] = await Promise.all([
      prisma.urgent_requests.count({ where }),
      prisma.urgent_requests.count({
        where: { ...where, status: { in: ['assigned', 'completed'] } }
      }),
      this.getAverageCandidatesPerRequest(where),
      this.getAverageMatchingTime(where),
      this.getSuccessRateByCategory(where)
    ]);

    return {
      totalRequests,
      matchedRequests,
      matchingRate: totalRequests > 0 ? (matchedRequests / totalRequests) * 100 : 0,
      avgCandidatesPerRequest,
      avgMatchingTime,
      successRateByCategory
    };
  }

  /**
   * Calcular promedio de candidatos por solicitud
   * @param {Object} where - Filtros
   * @returns {number} Promedio de candidatos
   */
  async getAverageCandidatesPerRequest(where) {
    const requests = await prisma.urgent_requests.findMany({
      where,
      include: {
        _count: {
          select: { candidates: true }
        }
      }
    });

    if (requests.length === 0) return 0;

    const totalCandidates = requests.reduce((sum, req) => sum + req._count.candidates, 0);
    return Math.round((totalCandidates / requests.length) * 100) / 100;
  }

  /**
   * Calcular tiempo promedio de matching
   * @param {Object} where - Filtros
   * @returns {number} Tiempo promedio en minutos
   */
  async getAverageMatchingTime(where) {
    const assignedRequests = await prisma.urgent_requests.findMany({
      where: { ...where, status: { in: ['assigned', 'completed'] } },
      include: {
        assignments: {
          select: { assigned_at: true }
        }
      }
    });

    if (assignedRequests.length === 0) return 0;

    const totalTime = assignedRequests.reduce((sum, req) => {
      if (req.assignments.length > 0) {
        const assignmentTime = new Date(req.assignments[0].assigned_at);
        const requestTime = new Date(req.created_at);
        return sum + (assignmentTime - requestTime);
      }
      return sum;
    }, 0);

    return Math.round((totalTime / assignedRequests.length) / (1000 * 60)); // Minutos
  }

  /**
   * Obtener tasa de éxito por categoría
   * @param {Object} where - Filtros
   * @returns {Object} Tasa de éxito por categoría
   */
  async getSuccessRateByCategory(where) {
    const categories = await prisma.servicios.findMany({
      select: { categoria: true },
      distinct: ['categoria']
    });

    const successRates = {};

    for (const category of categories) {
      const categoryWhere = {
        ...where,
        service: { categoria: category.categoria }
      };

      const [total, successful] = await Promise.all([
        prisma.urgent_requests.count({ where: categoryWhere }),
        prisma.urgent_requests.count({
          where: { ...categoryWhere, status: { in: ['assigned', 'completed'] } }
        })
      ]);

      successRates[category.categoria] = total > 0 ? (successful / total) * 100 : 0;
    }

    return successRates;
  }

  /**
   * Optimizar algoritmo de matching basado en datos históricos
   * @returns {Object} Resultados de optimización
   */
  async optimizeMatchingAlgorithm() {
    try {
      // Analizar patrones de éxito
      const successfulMatches = await prisma.urgent_assignments.findMany({
        include: {
          urgent_request: {
            include: {
              candidates: {
                include: {
                  professional: {
                    select: { calificacion_promedio: true }
                  }
                }
              }
            }
          },
          professional: {
            select: {
              calificacion_promedio: true,
              total_resenas: true
            }
          }
        }
      });

      // Calcular factores de éxito
      const successFactors = {
        avgRating: 0,
        avgExperience: 0,
        avgDistance: 0,
        totalMatches: successfulMatches.length
      };

      if (successfulMatches.length > 0) {
        successFactors.avgRating = successfulMatches.reduce(
          (sum, match) => sum + (match.professional.calificacion_promedio || 0), 0
        ) / successfulMatches.length;

        successFactors.avgExperience = successfulMatches.reduce(
          (sum, match) => sum + (match.professional.total_resenas || 0), 0
        ) / successfulMatches.length;

        successFactors.avgDistance = successfulMatches.reduce(
          (sum, match) => sum + (match.urgent_request.candidates.find(
            c => c.professional_id === match.professional_id
          )?.distance_km || 0), 0
        ) / successfulMatches.length;
      }

      console.log('🔍 Factores de éxito de matching calculados:', successFactors);

      return successFactors;

    } catch (error) {
      console.error('Error optimizing matching algorithm:', error);
      return null;
    }
  }
}

module.exports = {
  MatchingService,
  setGeolocationService
};