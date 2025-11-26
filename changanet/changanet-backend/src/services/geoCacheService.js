/**
 * Servicio de Caché para Optimización de Consultas Geoespaciales
 * Implementa caching inteligente para búsquedas de profesionales cercanos
 * Reduce carga en base de datos y mejora tiempos de respuesta
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class GeoCacheService {
  constructor() {
    this.cache = new Map(); // Cache en memoria
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutos
    this.maxCacheSize = 1000; // Máximo 1000 entradas
  }

  /**
   * Genera clave de caché para consultas geoespaciales
   */
  generateCacheKey(centerLat, centerLng, radiusKm, filters = {}) {
    const key = `geo_${centerLat.toFixed(4)}_${centerLng.toFixed(4)}_${radiusKm}_${JSON.stringify(filters)}`;
    return key;
  }

  /**
   * Verifica si una entrada de caché es válida
   */
  isCacheValid(cacheEntry) {
    return (Date.now() - cacheEntry.timestamp) < this.cacheExpiry;
  }

  /**
   * Obtiene resultados del caché si están disponibles y válidos
   */
  getCachedResults(cacheKey) {
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      console.log(`📍 Cache hit para clave: ${cacheKey}`);
      return cached.data;
    }

    if (cached && !this.isCacheValid(cached)) {
      console.log(`📍 Cache expired para clave: ${cacheKey}`);
      this.cache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Almacena resultados en caché
   */
  setCachedResults(cacheKey, data) {
    // Limpiar caché si está lleno
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldEntries();
    }

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    console.log(`💾 Cache stored para clave: ${cacheKey}`);
  }

  /**
   * Elimina entradas antiguas del caché (LRU simple)
   */
  evictOldEntries() {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Eliminar el 20% más antiguo
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }

    console.log(`🗑️ Evicted ${toRemove} old cache entries`);
  }

  /**
   * Busca profesionales cercanos con caché inteligente
   */
  async findNearbyProfessionals(centerLat, centerLng, radiusKm, filters = {}) {
    const cacheKey = this.generateCacheKey(centerLat, centerLng, radiusKm, filters);

    // Intentar obtener del caché
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    // Calcular bounding box para optimizar consulta
    const latDelta = (radiusKm / 111.32); // 1 grado ≈ 111.32 km
    const lngDelta = (radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180)));

    const minLat = centerLat - latDelta;
    const maxLat = centerLat + latDelta;
    const minLng = centerLng - lngDelta;
    const maxLng = centerLng + lngDelta;

    // Consulta optimizada con bounding box primero
    const nearbyProfessionals = await prisma.perfiles_profesionales.findMany({
      where: {
        esta_disponible: true,
        latitud: {
          gte: minLat,
          lte: maxLat
        },
        longitud: {
          gte: minLng,
          lte: maxLng
        },
        ...filters
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            url_foto_perfil: true,
            fcm_token: true,
            notificaciones_push: true
          }
        }
      }
    });

    // Calcular distancias exactas y filtrar por radio real
    const centerPoint = { lat: centerLat, lng: centerLng };
    const results = nearbyProfessionals
      .map(prof => {
        const profPoint = { lat: prof.latitud, lng: prof.longitud };
        const distance = this.calculateDistance(centerPoint, profPoint);

        return {
          ...prof,
          distance_km: Math.round(distance * 100) / 100
        };
      })
      .filter(prof => prof.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km); // Ordenar por distancia

    // Almacenar en caché
    this.setCachedResults(cacheKey, results);

    return results;
  }

  /**
   * Cálculo de distancia usando fórmula de Haversine
   */
  calculateDistance(point1, point2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Invalida caché cuando cambia la disponibilidad de un profesional
   */
  invalidateProfessionalCache(professionalId) {
    // Buscar y eliminar todas las entradas que podrían incluir a este profesional
    const keysToDelete = [];
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith('geo_') && this.isCacheValid(value)) {
        // Verificar si el profesional está en los resultados
        const hasProfessional = value.data.some(prof => prof.usuario_id === professionalId);
        if (hasProfessional) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`🚫 Invalidated ${keysToDelete.length} cache entries for professional ${professionalId}`);
    }
  }

  /**
   * Invalida todo el caché (útil para mantenimiento)
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cleared entire geo cache (${size} entries)`);
  }

  /**
   * Obtiene estadísticas del caché
   */
  getCacheStats() {
    const totalEntries = this.cache.size;
    const validEntries = Array.from(this.cache.values()).filter(entry =>
      this.isCacheValid(entry)
    ).length;

    const totalSize = Array.from(this.cache.values()).reduce((size, entry) => {
      return size + JSON.stringify(entry.data).length;
    }, 0);

    return {
      totalEntries,
      validEntries,
      expiredEntries: totalEntries - validEntries,
      totalSizeBytes: totalSize,
      hitRate: totalEntries > 0 ? (validEntries / totalEntries * 100).toFixed(1) : 0
    };
  }

  /**
   * Método para pre-cargar áreas comunes (opcional)
   */
  async preloadCommonAreas() {
    const commonAreas = [
      { lat: -34.6118, lng: -58.3960, name: 'Centro Buenos Aires' },
      { lat: -34.5881, lng: -58.4165, name: 'Palermo' },
      { lat: -34.5622, lng: -58.4572, name: 'Belgrano' },
      { lat: -31.4201, lng: -64.1888, name: 'Córdoba' },
      { lat: -32.9442, lng: -60.6505, name: 'Rosario' }
    ];

    console.log('🏙️ Preloading common areas...');

    for (const area of commonAreas) {
      await this.findNearbyProfessionals(area.lat, area.lng, 5);
      await new Promise(resolve => setTimeout(resolve, 100)); // Pequeña pausa
    }

    console.log('✅ Common areas preloaded');
  }
}

module.exports = new GeoCacheService();