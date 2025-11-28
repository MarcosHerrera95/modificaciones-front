/**
 * @archivo src/services/geolocationService.js - Servicio de Geolocalización para Servicios Urgentes
 * @descripción Operaciones geoespaciales avanzadas para matching y búsqueda de profesionales
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación de algoritmos geoespaciales eficientes
 * @impacto Social: Conexión precisa entre clientes y profesionales por ubicación
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Cache de geolocalización para optimizar búsquedas
const geoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

class GeolocationService {
  /**
   * Encontrar profesionales cercanos usando algoritmos geoespaciales optimizados
   * @param {number} lat - Latitud del punto de referencia
   * @param {number} lng - Longitud del punto de referencia
   * @param {number} radiusKm - Radio de búsqueda en km
   * @param {Object} filters - Filtros adicionales
   * @returns {Array} Profesionales ordenados por distancia
   */
  async findNearbyProfessionals(lat, lng, radiusKm, filters = {}) {
    try {
      // Crear clave de cache
      const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${radiusKm}_${JSON.stringify(filters)}`;

      // Verificar cache
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Consulta optimizada con filtros geoespaciales
      const professionals = await this.performGeospatialQuery(lat, lng, radiusKm, filters);

      // Calcular distancias precisas y ordenar
      const professionalsWithDistance = professionals.map(prof => ({
        ...prof,
        distance_km: this.calculateDistance(lat, lng, prof.latitud, prof.longitud)
      })).sort((a, b) => a.distance_km - b.distance_km);

      // Filtrar por radio exacto
      const nearbyProfessionals = professionalsWithDistance.filter(
        prof => prof.distance_km <= radiusKm
      );

      // Cachear resultado
      this.setCache(cacheKey, nearbyProfessionals);

      console.log(`📍 Encontrados ${nearbyProfessionals.length} profesionales en ${radiusKm}km de ${lat}, ${lng}`);

      return nearbyProfessionals;

    } catch (error) {
      console.error('Error finding nearby professionals:', error);
      return [];
    }
  }

  /**
   * Realizar consulta geoespacial optimizada
   * @param {number} lat - Latitud
   * @param {number} lng - Longitud
   * @param {number} radiusKm - Radio
   * @param {Object} filters - Filtros
   * @returns {Array} Resultados de la consulta
   */
  async performGeospatialQuery(lat, lng, radiusKm, filters) {
    try {
      // Bounding box aproximado para filtrado inicial (más eficiente que calcular distancia para todos)
      const boundingBox = this.calculateBoundingBox(lat, lng, radiusKm);

      const where = {
        latitud: {
          gte: boundingBox.minLat,
          lte: boundingBox.maxLat
        },
        longitud: {
          gte: boundingBox.minLng,
          lte: boundingBox.maxLng
        },
        usuario: {
          esta_disponible: true,
          rol: 'profesional',
          esta_verificado: true // Solo profesionales verificados
        }
      };

      // Aplicar filtros adicionales
      if (filters.esta_disponible !== undefined) {
        where.usuario.esta_disponible = filters.esta_disponible;
      }

      if (filters.minRating) {
        where.usuario.calificacion_promedio = {
          gte: filters.minRating
        };
      }

      if (filters.serviceCategory) {
        where.especialidades = {
          some: {
            especialidad: {
              OR: [
                { nombre: { contains: filters.serviceCategory, mode: 'insensitive' } },
                { categoria: { contains: filters.serviceCategory, mode: 'insensitive' } }
              ]
            }
          }
        };
      }

      // Consulta optimizada
      const professionals = await prisma.perfiles_profesionales.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
              url_foto_perfil: true,
              calificacion_promedio: true,
              total_resenas: true,
              esta_disponible: true,
              esta_verificado: true,
              fcm_token: true,
              notificaciones_push: true,
              fecha_registro: true
            }
          },
          especialidades: {
            include: {
              especialidad: true
            }
          }
        },
        orderBy: [
          { usuario: { calificacion_promedio: 'desc' } },
          { usuario: { total_resenas: 'desc' } }
        ]
      });

      return professionals;

    } catch (error) {
      console.error('Error performing geospatial query:', error);
      return [];
    }
  }

  /**
   * Calcular bounding box para filtrado inicial
   * @param {number} lat - Latitud centro
   * @param {number} lng - Longitud centro
   * @param {number} radiusKm - Radio en km
   * @returns {Object} Bounding box
   */
  calculateBoundingBox(lat, lng, radiusKm) {
    // Aproximación: 1 grado ≈ 111 km
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta
    };
  }

  /**
   * Calcular distancia usando fórmula de Haversine (más precisa)
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
   * Calcular distancia usando aproximación euclidiana (más rápida para grandes datasets)
   * @param {number} lat1 - Latitud punto 1
   * @param {number} lng1 - Longitud punto 1
   * @param {number} lat2 - Latitud punto 2
   * @param {number} lng2 - Longitud punto 2
   * @returns {number} Distancia aproximada en kilómetros
   */
  calculateApproximateDistance(lat1, lng1, lat2, lng2) {
    const dLat = (lat2 - lat1) * 111; // 1 grado ≈ 111 km
    const dLng = (lng2 - lng1) * 111 * Math.cos(lat1 * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  /**
   * Encontrar solicitudes urgentes cercanas a un profesional
   * @param {number} professionalLat - Latitud del profesional
   * @param {number} professionalLng - Longitud del profesional
   * @param {number} radiusKm - Radio de búsqueda
   * @param {Object} filters - Filtros adicionales
   * @returns {Array} Solicitudes urgentes cercanas
   */
  async findNearbyUrgentRequests(professionalLat, professionalLng, radiusKm, filters = {}) {
    try {
      const cacheKey = `urgent_requests_${professionalLat.toFixed(4)}_${professionalLng.toFixed(4)}_${radiusKm}`;

      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Bounding box para filtrado inicial
      const boundingBox = this.calculateBoundingBox(professionalLat, professionalLng, radiusKm);

      const where = {
        status: 'pending',
        latitude: {
          gte: boundingBox.minLat,
          lte: boundingBox.maxLat
        },
        longitude: {
          gte: boundingBox.minLng,
          lte: boundingBox.maxLng
        }
      };

      // Aplicar filtros adicionales
      if (filters.serviceId) {
        where.service_id = filters.serviceId;
      }

      if (filters.minPrice) {
        where.price_estimate = { gte: filters.minPrice };
      }

      const urgentRequests = await prisma.urgent_requests.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              nombre: true,
              url_foto_perfil: true,
              telefono: true
            }
          },
          service: {
            select: {
              id: true,
              nombre: true,
              categoria: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      // Calcular distancias y filtrar
      const nearbyRequests = urgentRequests
        .map(request => ({
          ...request,
          distance_km: this.calculateDistance(
            professionalLat, professionalLng,
            request.latitude, request.longitude
          )
        }))
        .filter(request => request.distance_km <= radiusKm)
        .sort((a, b) => a.distance_km - b.distance_km);

      this.setCache(cacheKey, nearbyRequests);

      return nearbyRequests;

    } catch (error) {
      console.error('Error finding nearby urgent requests:', error);
      return [];
    }
  }

  /**
   * Actualizar ubicación de un profesional
   * @param {string} professionalId - ID del profesional
   * @param {number} lat - Nueva latitud
   * @param {number} lng - Nueva longitud
   * @returns {Object} Resultado de la actualización
   */
  async updateProfessionalLocation(professionalId, lat, lng) {
    try {
      // Validar coordenadas
      if (!this.validateCoordinates(lat, lng)) {
        throw new Error('Coordenadas inválidas');
      }

      const updatedProfile = await prisma.perfiles_profesionales.updateMany({
        where: { usuario_id: professionalId },
        data: {
          latitud: lat,
          longitud: lng,
          last_location_update: new Date()
        }
      });

      // Invalidar cache relacionado
      this.invalidateLocationCache(professionalId);

      console.log(`📍 Ubicación actualizada para profesional ${professionalId}: ${lat}, ${lng}`);

      return {
        success: true,
        message: 'Ubicación actualizada exitosamente',
        coordinates: { lat, lng },
        updatedAt: new Date()
      };

    } catch (error) {
      console.error('Error updating professional location:', error);
      throw error;
    }
  }

  /**
   * Validar coordenadas geográficas
   * @param {number} lat - Latitud
   * @param {number} lng - Longitud
   * @returns {boolean} True si son válidas
   */
  validateCoordinates(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !isNaN(lat) && !isNaN(lng)
    );
  }

  /**
   * Obtener ubicación actual de un profesional
   * @param {string} professionalId - ID del profesional
   * @returns {Object} Ubicación del profesional
   */
  async getProfessionalLocation(professionalId) {
    try {
      const profile = await prisma.perfiles_profesionales.findFirst({
        where: { usuario_id: professionalId },
        select: {
          latitud: true,
          longitud: true,
          last_location_update: true
        }
      });

      if (!profile || !profile.latitud || !profile.longitud) {
        throw new Error('Ubicación no disponible');
      }

      return {
        lat: profile.latitud,
        lng: profile.longitud,
        lastUpdate: profile.last_location_update
      };

    } catch (error) {
      console.error('Error getting professional location:', error);
      throw error;
    }
  }

  /**
   * Calcular ruta óptima entre múltiples puntos (para planificación de rutas)
   * @param {Array} points - Array de puntos {lat, lng}
   * @param {Object} startPoint - Punto de inicio
   * @returns {Array} Puntos ordenados óptimamente
   */
  calculateOptimalRoute(points, startPoint) {
    try {
      if (points.length <= 1) return points;

      // Algoritmo del vecino más cercano (simple pero efectivo)
      const route = [startPoint];
      const remaining = [...points];

      while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        remaining.forEach((point, index) => {
          const distance = this.calculateApproximateDistance(
            route[route.length - 1].lat, route[route.length - 1].lng,
            point.lat, point.lng
          );

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });

        route.push(remaining[nearestIndex]);
        remaining.splice(nearestIndex, 1);
      }

      return route;

    } catch (error) {
      console.error('Error calculating optimal route:', error);
      return points;
    }
  }

  /**
   * Obtener estadísticas geoespaciales
   * @param {Object} filters - Filtros para estadísticas
   * @returns {Object} Estadísticas geoespaciales
   */
  async getGeospatialStats(filters = {}) {
    try {
      const { startDate, endDate, serviceCategory } = filters;

      const where = {};
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }
      if (serviceCategory) {
        where.service = { categoria: serviceCategory };
      }

      const requests = await prisma.urgent_requests.findMany({
        where,
        select: {
          latitude: true,
          longitude: true,
          radius_km: true,
          assignments: {
            select: {
              professional: {
                select: {
                  perfiles_profesionales: {
                    select: {
                      latitud: true,
                      longitud: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      const stats = {
        totalRequests: requests.length,
        avgRadius: 0,
        avgMatchingDistance: 0,
        coverageArea: 0,
        locationDistribution: {}
      };

      let totalRadius = 0;
      let totalMatchingDistance = 0;
      let matchedRequests = 0;

      for (const request of requests) {
        if (request.radius_km) {
          totalRadius += request.radius_km;
        }

        // Calcular distancia de matching si hay asignación
        if (request.assignments.length > 0) {
          const assignment = request.assignments[0];
          if (assignment.professional?.perfiles_profesionales?.[0]) {
            const profLocation = assignment.professional.perfiles_profesionales[0];
            if (profLocation.latitud && profLocation.longitud) {
              const distance = this.calculateDistance(
                request.latitude, request.longitude,
                profLocation.latitud, profLocation.longitud
              );
              totalMatchingDistance += distance;
              matchedRequests++;
            }
          }
        }

        // Distribución por ubicación (grid de 1 grado)
        if (request.latitude && request.longitude) {
          const gridLat = Math.floor(request.latitude);
          const gridLng = Math.floor(request.longitude);
          const gridKey = `${gridLat},${gridLng}`;

          if (!stats.locationDistribution[gridKey]) {
            stats.locationDistribution[gridKey] = 0;
          }
          stats.locationDistribution[gridKey]++;
        }
      }

      stats.avgRadius = requests.length > 0 ? totalRadius / requests.length : 0;
      stats.avgMatchingDistance = matchedRequests > 0 ? totalMatchingDistance / matchedRequests : 0;
      stats.coverageArea = requests.length > 0 ? Math.PI * Math.pow(stats.avgRadius, 2) : 0;

      return stats;

    } catch (error) {
      console.error('Error getting geospatial stats:', error);
      return {};
    }
  }

  /**
   * Invalidar cache de ubicación para un profesional
   * @param {string} professionalId - ID del profesional
   */
  invalidateLocationCache(professionalId) {
    // Remover entradas de cache que contengan el ID del profesional
    for (const [key, value] of geoCache) {
      if (key.includes(professionalId)) {
        geoCache.delete(key);
      }
    }
  }

  /**
   * Obtener dato del cache
   * @param {string} key - Clave del cache
   * @returns {*} Valor cacheado o null
   */
  getFromCache(key) {
    const cached = geoCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    if (cached) {
      geoCache.delete(key); // Eliminar entrada expirada
    }
    return null;
  }

  /**
   * Establecer dato en cache
   * @param {string} key - Clave del cache
   * @param {*} data - Datos a cachear
   */
  setCache(key, data) {
    geoCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Limpiar cache expirado
   */
  cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, value] of geoCache) {
      if (now - value.timestamp > CACHE_TTL) {
        geoCache.delete(key);
      }
    }
  }

  /**
   * Obtener tamaño del cache
   * @returns {number} Número de entradas en cache
   */
  getCacheSize() {
    return geoCache.size;
  }

  /**
   * Limpiar todo el cache
   */
  clearCache() {
    geoCache.clear();
    console.log('🧹 Geolocation cache cleared');
  }
}

module.exports = {
  GeolocationService
};