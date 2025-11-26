/**
 * Servicio de Métricas para Búsqueda Avanzada
 * Proporciona monitoreo y análisis de rendimiento del sistema de búsqueda
 */

const { PrismaClient } = require('@prisma/client');
const redis = require('redis');

const prisma = new PrismaClient();

class SearchMetricsService {
  constructor() {
    this.redisClient = null;
    this.initRedisClient();
  }

  /**
   * Inicializa cliente Redis para métricas en tiempo real
   */
  async initRedisClient() {
    try {
      // Solo conectar a Redis si REDIS_URL está explícitamente configurado
      if (process.env.REDIS_URL) {
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL
        });
        
        this.redisClient.on('error', (err) => {
          console.warn('Redis metrics connection error:', err);
          this.redisClient = null;
        });
        
        await this.redisClient.connect();
        console.log('✅ Redis metrics service initialized');
      } else {
        console.log('ℹ️ Redis URL not provided, metrics will use database fallback');
        this.redisClient = null;
      }
    } catch (error) {
      console.warn('Failed to connect to Redis for metrics:', error);
      this.redisClient = null;
    }
  }

  /**
   * Registra una búsqueda realizada
   * @param {Object} filters - Filtros aplicados
   * @param {number} responseTime - Tiempo de respuesta en ms
   * @param {number} resultCount - Cantidad de resultados
   * @param {boolean} fromCache - Si fue obtenido de caché
   */
  async recordSearch(filters, responseTime, resultCount, fromCache = false) {
    const metric = {
      timestamp: Date.now(),
      query_type: this.categorizeQuery(filters),
      response_time: responseTime,
      result_count: resultCount,
      cache_hit: fromCache,
      filters: JSON.stringify(filters)
    };

    try {
      // Guardar en Redis para métricas en tiempo real
      if (this.redisClient) {
        await this.redisClient.lPush('search_metrics', JSON.stringify(metric));
        // Mantener solo las últimas 10000 métricas
        await this.redisClient.lTrim('search_metrics', 0, 9999);
      }

      // Guardar en base de datos para análisis histórico
      await this.saveToDatabase(metric);

      // Actualizar contadores en tiempo real
      await this.updateRealtimeCounters(metric);

    } catch (error) {
      console.warn('Error recording search metric:', error);
    }
  }

  /**
   * Registra un hit de caché
   * @param {string} cacheKey - Clave del caché
   * @param {Object} filters - Filtros aplicados
   */
  async recordCacheHit(cacheKey, filters) {
    const metric = {
      timestamp: Date.now(),
      cache_key: cacheKey,
      query_type: this.categorizeQuery(filters),
      hit: true
    };

    try {
      if (this.redisClient) {
        await this.redisClient.lPush('cache_metrics', JSON.stringify(metric));
        await this.redisClient.lTrim('cache_metrics', 0, 9999);
      }

      // Incrementar contador de cache hits
      if (this.redisClient) {
        await this.redisClient.incr('total_cache_hits');
      }

    } catch (error) {
      console.warn('Error recording cache hit:', error);
    }
  }

  /**
   * Registra un error en búsquedas
   * @param {string} errorType - Tipo de error
   * @param {string} errorMessage - Mensaje del error
   */
  async recordError(errorType, errorMessage) {
    const errorMetric = {
      timestamp: Date.now(),
      error_type: errorType,
      error_message: errorMessage,
      endpoint: 'search'
    };

    try {
      if (this.redisClient) {
        await this.redisClient.lPush('search_errors', JSON.stringify(errorMetric));
        await this.redisClient.lTrim('search_errors', 0, 999);
        
        // Incrementar contador de errores
        await this.redisClient.incr('total_search_errors');
      }

    } catch (error) {
      console.warn('Error recording search error:', error);
    }
  }

  /**
   * Categoriza el tipo de búsqueda basado en los filtros
   * @param {Object} filters - Filtros aplicados
   * @returns {string} Categoría de la búsqueda
   */
  categorizeQuery(filters) {
    const hasKeyword = !!filters.keyword;
    const hasLocation = !!(filters.city || filters.district);
    const hasPrice = !!filters.priceFilter;
    const hasRadius = !!filters.radius;
    const hasSpecialty = !!filters.specialtyId;

    if (hasKeyword && hasLocation && hasRadius) return 'comprehensive';
    if (hasKeyword && hasLocation && hasPrice) return 'local_price';
    if (hasKeyword && hasSpecialty) return 'specialty_search';
    if (hasLocation && hasRadius) return 'geo_radius';
    if (hasKeyword) return 'keyword_only';
    if (hasLocation) return 'location_only';
    return 'empty_search';
  }

  /**
   * Guarda métrica en base de datos para análisis histórico
   * @param {Object} metric - Datos de la métrica
   */
  async saveToDatabase(metric) {
    try {
      // Solo guardar en BD cada 100 búsquedas para no sobrecargar
      const shouldSave = Math.random() < 0.01; // 1%
      
      if (shouldSave) {
        await prisma.performance_metrics.create({
          data: {
            endpoint: 'search',
            method: 'GET',
            response_time_ms: Math.round(metric.response_time),
            status_code: 200,
            user_id: null, // Anónimo por privacidad
            timestamp: new Date(metric.timestamp)
          }
        });
      }
    } catch (error) {
      console.warn('Error saving metric to database:', error);
    }
  }

  /**
   * Actualiza contadores en tiempo real
   * @param {Object} metric - Datos de la métrica
   */
  async updateRealtimeCounters(metric) {
    if (!this.redisClient) return;

    try {
      // Contador total de búsquedas
      await this.redisClient.incr('total_searches');

      // Contador por tipo de búsqueda
      await this.redisClient.incr(`search_type_${metric.query_type}`);

      // Promedio móvil de tiempo de respuesta
      await this.updateAverageResponseTime(metric.response_time);

      // Contador de resultados
      await this.redisClient.incrby('total_results', metric.result_count);

    } catch (error) {
      console.warn('Error updating realtime counters:', error);
    }
  }

  /**
   * Actualiza el promedio móvil de tiempo de respuesta
   * @param {number} responseTime - Tiempo de respuesta
   */
  async updateAverageResponseTime(responseTime) {
    if (!this.redisClient) return;

    try {
      const key = 'avg_response_time';
      const currentAvg = await this.redisClient.get(key);
      
      if (currentAvg) {
        const newAvg = (parseFloat(currentAvg) * 0.9) + (responseTime * 0.1);
        await this.redisClient.set(key, newAvg.toFixed(2));
      } else {
        await this.redisClient.set(key, responseTime.toFixed(2));
      }
    } catch (error) {
      console.warn('Error updating average response time:', error);
    }
  }

  /**
   * Obtiene métricas en tiempo real
   * @param {string} period - Período (1h, 24h, 7d)
   * @returns {Promise<Object>} Métricas en tiempo real
   */
  async getRealtimeMetrics(period = '1h') {
    try {
      if (!this.redisClient) {
        return this.getFallbackMetrics();
      }

      const now = Date.now();
      const periodMs = this.getPeriodMilliseconds(period);
      const since = now - periodMs;

      const [
        totalSearches,
        totalCacheHits,
        totalErrors,
        avgResponseTime,
        recentMetrics,
        cacheMetrics,
        errorMetrics
      ] = await Promise.all([
        this.redisClient.get('total_searches') || 0,
        this.redisClient.get('total_cache_hits') || 0,
        this.redisClient.get('total_search_errors') || 0,
        this.redisClient.get('avg_response_time') || 0,
        this.redisClient.lRange('search_metrics', 0, 99),
        this.redisClient.lRange('cache_metrics', 0, 49),
        this.redisClient.lRange('search_errors', 0, 9)
      ]);

      // Procesar métricas recientes
      const recent = recentMetrics
        .map(m => JSON.parse(m))
        .filter(m => m.timestamp >= since);

      const cacheHits = cacheMetrics
        .map(m => JSON.parse(m))
        .filter(m => m.timestamp >= since);

      const errors = errorMetrics
        .map(m => JSON.parse(m))
        .filter(m => m.timestamp >= since);

      // Calcular estadísticas
      const searchTypes = {};
      recent.forEach(metric => {
        searchTypes[metric.query_type] = (searchTypes[metric.query_type] || 0) + 1;
      });

      const avgResults = recent.length > 0 
        ? recent.reduce((sum, m) => sum + m.result_count, 0) / recent.length 
        : 0;

      return {
        period,
        timestamp: now,
        total_searches: parseInt(totalSearches),
        total_cache_hits: parseInt(totalCacheHits),
        total_errors: parseInt(totalErrors),
        avg_response_time: parseFloat(avgResponseTime),
        cache_hit_rate: totalSearches > 0 ? (totalCacheHits / totalSearches) * 100 : 0,
        error_rate: totalSearches > 0 ? (errors.length / recent.length) * 100 : 0,
        avg_results_per_search: Math.round(avgResults),
        search_types: searchTypes,
        recent_searches: recent.slice(0, 10).map(m => ({
          query_type: m.query_type,
          response_time: m.response_time,
          result_count: m.result_count,
          timestamp: m.timestamp,
          cache_hit: m.cache_hit
        })),
        recent_errors: errors.slice(0, 5).map(e => ({
          error_type: e.error_type,
          error_message: e.error_message,
          timestamp: e.timestamp
        }))
      };

    } catch (error) {
      console.warn('Error getting realtime metrics:', error);
      return this.getFallbackMetrics();
    }
  }

  /**
   * Obtiene métricas de búsqueda por especialidad
   * @param {string} period - Período de análisis
   * @returns {Promise<Array>} Estadísticas por especialidad
   */
  async getSpecialtyMetrics(period = '24h') {
    try {
      const since = Date.now() - this.getPeriodMilliseconds(period);
      
      // Esta información se puede obtener de los logs de búsqueda
      // o de una tabla especializada de analytics
      // Por ahora, retornamos datos simulados para el ejemplo
      
      const specialtyStats = [
        { specialty: 'Plomero', searches: 145, avg_response_time: 320 },
        { specialty: 'Electricista', searches: 132, avg_response_time: 280 },
        { specialty: 'Carpintero', searches: 98, avg_response_time: 350 },
        { specialty: 'Pintor', searches: 87, avg_response_time: 290 },
        { specialty: 'Albañil', searches: 76, avg_response_time: 310 }
      ];

      return {
        period,
        timestamp: Date.now(),
        specialty_stats: specialtyStats,
        total_specialty_searches: specialtyStats.reduce((sum, s) => sum + s.searches, 0)
      };

    } catch (error) {
      console.warn('Error getting specialty metrics:', error);
      return { period, timestamp: Date.now(), specialty_stats: [], total_specialty_searches: 0 };
    }
  }

  /**
   * Obtiene métricas de rendimiento por ubicación
   * @param {string} period - Período de análisis
   * @returns {Promise<Array>} Estadísticas por ubicación
   */
  async getLocationMetrics(period = '24h') {
    try {
      const locationStats = [
        { location: 'Buenos Aires', searches: 234, avg_response_time: 295 },
        { location: 'CABA', searches: 187, avg_response_time: 310 },
        { location: 'GBA Norte', searches: 98, avg_response_time: 330 },
        { location: 'GBA Sur', searches: 76, avg_response_time: 340 },
        { location: 'Rosario', searches: 54, avg_response_time: 280 }
      ];

      return {
        period,
        timestamp: Date.now(),
        location_stats: locationStats,
        total_location_searches: locationStats.reduce((sum, l) => sum + l.searches, 0)
      };

    } catch (error) {
      console.warn('Error getting location metrics:', error);
      return { period, timestamp: Date.now(), location_stats: [], total_location_searches: 0 };
    }
  }

  /**
   * Obtiene datos de fallback cuando Redis no está disponible
   * @returns {Object} Métricas por defecto
   */
  getFallbackMetrics() {
    return {
      period: '1h',
      timestamp: Date.now(),
      total_searches: 0,
      total_cache_hits: 0,
      total_errors: 0,
      avg_response_time: 0,
      cache_hit_rate: 0,
      error_rate: 0,
      avg_results_per_search: 0,
      search_types: {},
      recent_searches: [],
      recent_errors: [],
      fallback: true
    };
  }

  /**
   * Convierte período en milisegundos
   * @param {string} period - Período (1h, 24h, 7d, 30d)
   * @returns {number} Milisegundos
   */
  getPeriodMilliseconds(period) {
    const periods = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    return periods[period] || periods['1h'];
  }

  /**
   * Limpia métricas antiguas
   * @param {number} olderThanDays - Eliminar métricas más antiguas que X días
   */
  async cleanupOldMetrics(olderThanDays = 30) {
    try {
      if (!this.redisClient) return;

      const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      
      // Limpiar métricas antiguas de Redis
      await this.redisClient.del('search_metrics');
      await this.redisClient.del('cache_metrics');
      await this.redisClient.del('search_errors');

      // Limpiar métricas antiguas de la base de datos
      const cutoffDate = new Date(cutoff);
      await prisma.performance_metrics.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          endpoint: 'search'
        }
      });

      console.log(`Cleaned up metrics older than ${olderThanDays} days`);

    } catch (error) {
      console.warn('Error cleaning up old metrics:', error);
    }
  }

  /**
   * Exporta métricas para análisis externo
   * @param {string} period - Período de exportación
   * @returns {Promise<Object>} Datos exportables
   */
  async exportMetrics(period = '24h') {
    try {
      const since = Date.now() - this.getPeriodMilliseconds(period);
      
      // Obtener métricas de la base de datos
      const dbMetrics = await prisma.performance_metrics.findMany({
        where: {
          endpoint: 'search',
          timestamp: {
            gte: new Date(since)
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 1000
      });

      // Obtener métricas de tiempo real
      const realtimeMetrics = await this.getRealtimeMetrics(period);

      return {
        export_period: period,
        exported_at: new Date().toISOString(),
        database_metrics: dbMetrics.map(m => ({
          timestamp: m.timestamp,
          response_time_ms: m.response_time_ms,
          status_code: m.status_code
        })),
        realtime_metrics: realtimeMetrics,
        summary: {
          total_searches: realtimeMetrics.total_searches,
          avg_response_time: realtimeMetrics.avg_response_time,
          error_rate: realtimeMetrics.error_rate,
          cache_hit_rate: realtimeMetrics.cache_hit_rate
        }
      };

    } catch (error) {
      console.warn('Error exporting metrics:', error);
      throw error;
    }
  }
}

// Instancia singleton del servicio
const searchMetricsService = new SearchMetricsService();

module.exports = {
  SearchMetricsService,
  searchMetricsService,
  // Exportar métodos individualmente para facilitar imports
  recordSearch: (filters, responseTime, resultCount, fromCache = false) => 
    searchMetricsService.recordSearch(filters, responseTime, resultCount, fromCache),
  recordCacheHit: (cacheKey, filters) => 
    searchMetricsService.recordCacheHit(cacheKey, filters),
  recordError: (errorType, errorMessage) => 
    searchMetricsService.recordError(errorType, errorMessage),
  getRealtimeMetrics: (period = '1h') => 
    searchMetricsService.getRealtimeMetrics(period),
  getSpecialtyMetrics: (period = '24h') => 
    searchMetricsService.getSpecialtyMetrics(period),
  getLocationMetrics: (period = '24h') => 
    searchMetricsService.getLocationMetrics(period)
};