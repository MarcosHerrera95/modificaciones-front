/**
 * CoverageZoneService
 * Servicio para gestión de zonas de cobertura geográfica
 * 
 * Implementa REQ-09: Definir zona de cobertura geográfica
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CoverageZoneService {
  /**
   * Obtiene todas las zonas de cobertura disponibles
   */
  async getAllCoverageZones(includeInactive = false) {
    try {
      const where = includeInactive ? {} : { is_active: true };

      const zones = await prisma.coverage_zones.findMany({
        where,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
          radius_km: true,
          is_active: true,
          created_at: true
        },
        orderBy: [
          { state: 'asc' },
          { city: 'asc' },
          { name: 'asc' }
        ]
      });

      return zones;
    } catch (error) {
      console.error('Error getting all coverage zones:', error);
      throw error;
    }
  }

  /**
   * Busca zonas de cobertura por término de búsqueda
   */
  async searchCoverageZones(searchTerm, limit = 20) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
      }

      const zones = await prisma.coverage_zones.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { city: { contains: searchTerm, mode: 'insensitive' } },
            { state: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
          radius_km: true
        },
        take: limit,
        orderBy: [
          { state: 'asc' },
          { city: 'asc' }
        ]
      });

      return zones;
    } catch (error) {
      console.error('Error searching coverage zones:', error);
      throw error;
    }
  }

  /**
   * Obtiene zonas agrupadas por provincia/estado
   */
  async getCoverageZonesByState() {
    try {
      const zones = await this.getAllCoverageZones();

      // Agrupar por estado
      const groupedZones = zones.reduce((acc, zone) => {
        const state = zone.state;
        if (!acc[state]) {
          acc[state] = [];
        }
        acc[state].push(zone);
        return acc;
      }, {});

      // Ordenar ciudades dentro de cada estado
      Object.keys(groupedZones).forEach(state => {
        groupedZones[state].sort((a, b) => a.city.localeCompare(b.city));
      });

      return groupedZones;
    } catch (error) {
      console.error('Error getting coverage zones by state:', error);
      throw error;
    }
  }

  /**
   * Obtiene una zona específica por ID
   */
  async getCoverageZoneById(zoneId) {
    try {
      const zone = await prisma.coverage_zones.findUnique({
        where: { id: zoneId },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
          radius_km: true,
          is_active: true
        }
      });

      return zone;
    } catch (error) {
      console.error('Error getting coverage zone by ID:', error);
      throw error;
    }
  }

  /**
   * Obtiene las zonas de cobertura de un profesional
   */
  async getProfessionalCoverageZone(professionalId) {
    try {
      const profile = await prisma.perfiles_profesionales.findUnique({
        where: { usuario_id: professionalId },
        include: {
          coverage_zone: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              latitude: true,
              longitude: true,
              radius_km: true
            }
          }
        }
      });

      return profile?.coverage_zone || null;
    } catch (error) {
      console.error('Error getting professional coverage zone:', error);
      throw error;
    }
  }

  /**
   * Actualiza la zona de cobertura de un profesional
   */
  async updateProfessionalCoverageZone(professionalId, zoneData) {
    try {
      const { coverage_zone_id, zona_cobertura, latitud, longitud } = zoneData;

      const updateData = {
        zona_cobertura,
        latitud: latitud ? parseFloat(latitud) : null,
        longitud: longitud ? parseFloat(longitud) : null
      };

      if (coverage_zone_id) {
        // Validar que la zona existe
        const zone = await this.getCoverageZoneById(coverage_zone_id);
        if (!zone) {
          throw new Error('Zona de cobertura no encontrada');
        }
        updateData.coverage_zone_id = coverage_zone_id;
      }

      const updatedProfile = await prisma.perfiles_profesionales.update({
        where: { usuario_id: professionalId },
        data: updateData,
        include: {
          coverage_zone: true
        }
      });

      return {
        success: true,
        profile: updatedProfile,
        message: 'Zona de cobertura actualizada exitosamente'
      };
    } catch (error) {
      console.error('Error updating professional coverage zone:', error);
      throw error;
    }
  }

  /**
   * Busca profesionales dentro de un radio específico
   */
  async findProfessionalsInRadius(centerLat, centerLng, radiusKm, filters = {}) {
    try {
      const {
        specialtyIds = [],
        availableOnly = true,
        minRating = 0,
        limit = 50
      } = filters;

      // Obtener profesionales con sus zonas de cobertura
      const where = {
        rol: 'profesional',
        perfil_profesional: {
          isNot: null,
          ...(availableOnly && { esta_disponible: true }),
          ...(minRating > 0 && { calificacion_promedio: { gte: minRating } }),
          ...(specialtyIds.length > 0 && {
            professional_specialties: {
              some: {
                specialty_id: { in: specialtyIds }
              }
            }
          })
        }
      };

      const professionals = await prisma.usuarios.findMany({
        where,
        include: {
          perfil_profesional: {
            include: {
              coverage_zone: true,
              professional_specialties: {
                include: {
                  specialty: true
                }
              }
            }
          }
        },
        take: limit * 2 // Obtener más para filtrar por distancia
      });

      // Filtrar por distancia usando el radio de cobertura de la zona
      const professionalsInRadius = professionals.filter(prof => {
        const profile = prof.perfil_profesional;
        if (!profile || !profile.coverage_zone) {
          return false;
        }

        const zone = profile.coverage_zone;
        if (!zone.latitude || !zone.longitude) {
          return false;
        }

        const distance = this.calculateDistance(
          centerLat,
          centerLng,
          zone.latitude,
          zone.longitude
        );

        // Verificar si está dentro del radio de la zona O del radio solicitado
        return distance <= Math.max(zone.radius_km, radiusKm);
      }).map(prof => {
        const profile = prof.perfil_profesional;
        const zone = profile.coverage_zone;
        
        return {
          ...prof,
          distance_from_center: this.calculateDistance(
            centerLat,
            centerLng,
            zone.latitude,
            zone.longitude
          ),
          zone_radius: zone.radius_km
        };
      });

      // Ordenar por distancia
      professionalsInRadius.sort((a, b) => a.distance_from_center - b.distance_from_center);

      return professionalsInRadius.slice(0, limit);
    } catch (error) {
      console.error('Error finding professionals in radius:', error);
      throw error;
    }
  }

  /**
   * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Verifica si un punto está dentro de una zona de cobertura
   */
  isPointInZone(pointLat, pointLng, zone) {
    if (!zone.latitude || !zone.longitude) {
      return false;
    }

    const distance = this.calculateDistance(
      pointLat,
      pointLng,
      zone.latitude,
      zone.longitude
    );

    return distance <= zone.radius_km;
  }

  /**
   * Obtiene estadísticas de zonas de cobertura
   */
  async getCoverageZoneStatistics() {
    try {
      // Contar profesionales por zona
      const zoneStats = await prisma.perfiles_profesionales.groupBy({
        by: ['coverage_zone_id'],
        _count: {
          coverage_zone_id: true
        },
        where: {
          coverage_zone_id: { not: null }
        },
        orderBy: {
          _count: {
            coverage_zone_id: 'desc'
          }
        }
      });

      // Obtener detalles de las zonas
      const zoneDetails = await prisma.coverage_zones.findMany({
        where: {
          id: { in: zoneStats.map(s => s.coverage_zone_id) }
        },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          radius_km: true
        }
      });

      // Combinar estadísticas con detalles
      const statistics = zoneStats.map(stat => {
        const detail = zoneDetails.find(d => d.id === stat.coverage_zone_id);
        return {
          zone_id: stat.coverage_zone_id,
          name: detail?.name || 'Desconocida',
          city: detail?.city || 'Sin ciudad',
          state: detail?.state || 'Sin estado',
          radius_km: detail?.radius_km || 0,
          professional_count: stat._count.coverage_zone_id
        };
      });

      return {
        total_zones: zoneStats.length,
        statistics
      };
    } catch (error) {
      console.error('Error getting coverage zone statistics:', error);
      throw error;
    }
  }

  /**
   * Autocompleta direcciones usando las zonas disponibles
   */
  async autocompleteLocation(query) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const zones = await this.searchCoverageZones(query, 10);
      
      return zones.map(zone => ({
        id: zone.id,
        label: `${zone.name}, ${zone.city}, ${zone.state}`,
        city: zone.city,
        state: zone.state,
        latitude: zone.latitude,
        longitude: zone.longitude,
        radius_km: zone.radius_km
      }));
    } catch (error) {
      console.error('Error autocompleting location:', error);
      throw error;
    }
  }

  /**
   * Obtiene las provincias/estados disponibles
   */
  async getAvailableStates() {
    try {
      const states = await prisma.coverage_zones.findMany({
        where: { is_active: true },
        select: { state: true },
        distinct: ['state'],
        orderBy: { state: 'asc' }
      });

      return states.map(s => s.state);
    } catch (error) {
      console.error('Error getting available states:', error);
      throw error;
    }
  }

  /**
   * Obtiene ciudades disponibles en un estado específico
   */
  async getCitiesByState(stateName) {
    try {
      const cities = await prisma.coverage_zones.findMany({
        where: {
          state: stateName,
          is_active: true
        },
        select: {
          id: true,
          name: true,
          city: true,
          latitude: true,
          longitude: true,
          radius_km: true
        },
        orderBy: { city: 'asc' }
      });

      return cities;
    } catch (error) {
      console.error('Error getting cities by state:', error);
      throw error;
    }
  }
}

module.exports = new CoverageZoneService();