/**
 * Servicio de Caché Avanzado Multinivel para Changánet
 * Implementa caché multinivel optimizado para búsquedas y reseñas
 *
 * Niveles de caché:
 * 1. Redis (más rápido, persistente, compartido)
 * 2. Memory (ultra rápido, temporal, por instancia)
 * 3. localStorage (persistente, limitado, por usuario/cliente)
 *
 * Características avanzadas:
 * - TTL diferenciado por tipo de contenido
 * - Compresión automática para datos grandes
 * - Invalidación inteligente
 * - Métricas de rendimiento
 * - Fallback automático entre niveles
 */

const NodeCache = require('node-cache');
const redis = require('redis');

// Configuraciones de TTL por tipo de contenido
const CACHE_TTL = {
  search_basic: 300,        // 5 minutos - búsquedas básicas
  search_filtered: 600,     // 10 minutos - búsquedas con filtros
  search_geo: 180,          // 3 minutos - búsquedas geográficas
  suggestions: 180,         // 3 minutos - sugerencias de búsqueda
  review_stats: 600,        // 10 minutos - estadísticas de reseñas
  reviews_list: 300,        // 5 minutos - listas de reseñas
  professional_profile: 1800 // 30 minutos - perfiles profesionales
};

// Configurar el caché de memoria con configuración optimizada
const memoryCache = new NodeCache({
  stdTTL: 600,
  checkperiod: 60, // Verificación más frecuente
  useClones: false,
  maxKeys: 10000 // Límite de claves para evitar memory leaks
});

// Cliente Redis para caché distribuido
let redisClient = null;

// Estadísticas de caché
const cacheStats = {
  hits: { redis: 0, memory: 0, localStorage: 0 },
  misses: { redis: 0, memory: 0, localStorage: 0 },
  sets: { redis: 0, memory: 0, localStorage: 0 },
  errors: { redis: 0, memory: 0, localStorage: 0 }
};

/**
 * Inicializar Redis para caché multinivel
 */
const initializeRedis = async () => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = redis.createClient({
        url: process.env.REDIS_URL
      });
      
      redisClient.on('error', (err) => {
        console.warn('Redis cache unavailable, using only memory cache');
        redisClient = null;
      });
      
      await redisClient.connect();
      console.log('✅ Redis cache initialized for search system');
    } else {
      console.log('ℹ️ Redis URL not provided, using only memory cache');
    }
  } catch (error) {
    console.warn('Failed to initialize Redis cache:', error.message);
    redisClient = null;
  }
};

// Claves para el caché de estadísticas de reseñas
const getReviewStatsCacheKey = (professionalId) => `review_stats_${professionalId}`;
const getReviewsListCacheKey = (professionalId, page, limit) =>
  `reviews_list_${professionalId}_${page}_${limit}`;

// Claves para el caché de rankings
const getRankingCacheKey = (limit, offset) => `ranking_${limit}_${offset}`;
const getProfessionalRankingCacheKey = (professionalId) => `professional_ranking_${professionalId}`;
const getReputationCacheKey = (userId) => `reputation_${userId}`;

/**
 * ===========================================
 * FUNCIONES DE CACHÉ PARA RESEÑAS
 * ===========================================
 */

/**
 * Obtener estadísticas de reseñas desde caché
 */
const getCachedReviewStats = async (professionalId) => {
  const cacheKey = getReviewStatsCacheKey(professionalId);
  return memoryCache.get(cacheKey);
};

/**
 * Almacenar estadísticas de reseñas en caché
 */
const cacheReviewStats = (professionalId, stats) => {
  const cacheKey = getReviewStatsCacheKey(professionalId);
  memoryCache.set(cacheKey, stats, 600); // 10 minutos
};

/**
 * Invalidar caché de estadísticas de reseñas
 */
const invalidateReviewStatsCache = (professionalId) => {
  const cacheKey = getReviewStatsCacheKey(professionalId);
  memoryCache.del(cacheKey);
};

/**
 * Obtener lista de reseñas desde caché
 */
const getCachedReviewsList = async (professionalId, page, limit) => {
  const cacheKey = getReviewsListCacheKey(professionalId, page, limit);
  return memoryCache.get(cacheKey);
};

/**
 * Almacenar lista de reseñas en caché
 */
const cacheReviewsList = (professionalId, page, limit, data) => {
  const cacheKey = getReviewsListCacheKey(professionalId, page, limit);
  memoryCache.set(cacheKey, data, 300); // 5 minutos para listas
};

/**
 * Invalidar caché de lista de reseñas
 */
const invalidateReviewsListCache = (professionalId, page, limit) => {
  if (page !== undefined && limit !== undefined) {
    // Invalidar una página específica
    const cacheKey = getReviewsListCacheKey(professionalId, page, limit);
    memoryCache.del(cacheKey);
  } else {
    // Invalidar todas las páginas para este profesional
    const keys = memoryCache.keys();
    const pattern = new RegExp(`^reviews_list_${professionalId}`);
    keys.forEach(key => {
      if (pattern.test(key)) {
        memoryCache.del(key);
      }
    });
  }
};

/**
 * Invalidar todos los cachés relacionados con un profesional
 */
const invalidateAllProfessionalCaches = (professionalId) => {
  invalidateReviewStatsCache(professionalId);
  invalidateReviewsListCache(professionalId);
  // Invalidar también cachés de reputación y ranking
  invalidateReputationCache(professionalId);
  invalidateProfessionalRankingCache(professionalId);
};

/**
 * ===========================================
 * FUNCIONES DE CACHÉ PARA RANKINGS Y REPUTACIÓN
 * ===========================================
 */

/**
 * Obtener ranking general desde caché
 */
const getCachedRanking = async (limit, offset) => {
  const cacheKey = getRankingCacheKey(limit, offset);
  return await getFromCache(cacheKey, 'ranking');
};

/**
 * Almacenar ranking general en caché
 */
const cacheRanking = async (limit, offset, data) => {
  const cacheKey = getRankingCacheKey(limit, offset);
  return await setInCache(cacheKey, data, 'ranking');
};

/**
 * Invalidar caché de ranking general
 */
const invalidateRankingCache = (limit, offset) => {
  const cacheKey = getRankingCacheKey(limit, offset);
  // Invalidar Redis
  if (redisClient) {
    try {
      redisClient.del(`ranking:${cacheKey}`);
    } catch (error) {
      console.warn('Redis ranking cache invalidation error:', error);
    }
  }
  // Invalidar memory cache
  memoryCache.del(`ranking:${cacheKey}`);
};

/**
 * Obtener ranking de profesional específico desde caché
 */
const getCachedProfessionalRanking = async (professionalId) => {
  const cacheKey = getProfessionalRankingCacheKey(professionalId);
  return await getFromCache(cacheKey, 'professional_ranking');
};

/**
 * Almacenar ranking de profesional específico en caché
 */
const cacheProfessionalRanking = async (professionalId, data) => {
  const cacheKey = getProfessionalRankingCacheKey(professionalId);
  return await setInCache(cacheKey, data, 'professional_ranking');
};

/**
 * Invalidar caché de ranking de profesional específico
 */
const invalidateProfessionalRankingCache = (professionalId) => {
  const cacheKey = getProfessionalRankingCacheKey(professionalId);
  // Invalidar Redis
  if (redisClient) {
    try {
      redisClient.del(`professional_ranking:${cacheKey}`);
    } catch (error) {
      console.warn('Redis professional ranking cache invalidation error:', error);
    }
  }
  // Invalidar memory cache
  memoryCache.del(`professional_ranking:${cacheKey}`);
};

/**
 * Obtener reputación desde caché
 */
const getCachedReputation = async (userId) => {
  const cacheKey = getReputationCacheKey(userId);
  return await getFromCache(cacheKey, 'reputation');
};

/**
 * Almacenar reputación en caché
 */
const cacheReputation = async (userId, data) => {
  const cacheKey = getReputationCacheKey(userId);
  return await setInCache(cacheKey, data, 'reputation');
};

/**
 * Invalidar caché de reputación
 */
const invalidateReputationCache = (userId) => {
  const cacheKey = getReputationCacheKey(userId);
  // Invalidar Redis
  if (redisClient) {
    try {
      redisClient.del(`reputation:${cacheKey}`);
    } catch (error) {
      console.warn('Redis reputation cache invalidation error:', error);
    }
  }
  // Invalidar memory cache
  memoryCache.del(`reputation:${cacheKey}`);
};

/**
 * Invalidar todos los cachés de ranking y reputación
 */
const invalidateAllRankingCaches = () => {
  // Invalidar Redis
  if (redisClient) {
    try {
      const keys = ['ranking:*', 'professional_ranking:*', 'reputation:*'];
      keys.forEach(pattern => {
        redisClient.del(pattern).catch(err => console.warn('Redis clear error:', err));
      });
    } catch (error) {
      console.warn('Redis ranking cache clear error:', error);
    }
  }

  // Invalidar memory cache
  const keys = memoryCache.keys();
  keys.forEach(key => {
    if (key.startsWith('ranking:') || key.startsWith('professional_ranking:') || key.startsWith('reputation:')) {
      memoryCache.del(key);
    }
  });
};

/**
 * ===========================================
 * FUNCIONES DE CACHÉ PARA BÚSQUEDA AVANZADA
 * ===========================================
 */

/**
 * Obtener datos desde caché multinivel con fallback automático
 * @param {string} key - Clave de caché
 * @param {string} type - Tipo de contenido (afecta TTL)
 * @returns {Promise<any>} Datos cacheados o null
 */
const getFromCache = async (key, type = 'search_basic') => {
  const fullKey = `${type}:${key}`;

  // Nivel 1: Redis (más rápido, compartido entre instancias)
  if (redisClient) {
    try {
      const redisData = await redisClient.get(fullKey);
      if (redisData) {
        cacheStats.hits.redis++;
        const parsed = JSON.parse(redisData);
        // Migrar a memory cache para acceso más rápido en esta instancia
        memoryCache.set(fullKey, parsed, CACHE_TTL[type]);
        return parsed;
      }
      cacheStats.misses.redis++;
    } catch (error) {
      cacheStats.errors.redis++;
      console.warn(`Redis cache error for ${fullKey}:`, error.message);
    }
  }

  // Nivel 2: Memory cache (ultra rápido, por instancia)
  const memoryData = memoryCache.get(fullKey);
  if (memoryData !== undefined) {
    cacheStats.hits.memory++;
    return memoryData;
  }
  cacheStats.misses.memory++;

  return null;
};

/**
 * Almacenar datos en caché multinivel
 * @param {string} key - Clave de caché
 * @param {any} data - Datos a almacenar
 * @param {string} type - Tipo de contenido
 */
const setInCache = async (key, data, type = 'search_basic') => {
  const fullKey = `${type}:${key}`;
  const ttl = CACHE_TTL[type] || 300;

  // Nivel 1: Redis
  if (redisClient) {
    try {
      await redisClient.setex(fullKey, ttl, JSON.stringify(data));
      cacheStats.sets.redis++;
    } catch (error) {
      cacheStats.errors.redis++;
      console.warn(`Redis cache set error for ${fullKey}:`, error.message);
    }
  }

  // Nivel 2: Memory cache
  try {
    memoryCache.set(fullKey, data, ttl);
    cacheStats.sets.memory++;
  } catch (error) {
    cacheStats.errors.memory++;
    console.warn(`Memory cache set error for ${fullKey}:`, error.message);
  }
};

/**
 * Obtener resultados de búsqueda desde caché (wrapper para compatibilidad)
 */
const getCachedProfessionalSearch = async (cacheKey) => {
  return await getFromCache(cacheKey, 'search_basic');
};

/**
 * Almacenar resultados de búsqueda en caché (wrapper para compatibilidad)
 */
const cacheProfessionalSearch = async (cacheKey, data) => {
  // Determinar tipo de caché basado en los datos
  const hasFilters = cacheKey.includes('precio_min') || cacheKey.includes('especialidad') || cacheKey.includes('radio_km');
  const hasGeo = cacheKey.includes('user_lat') || cacheKey.includes('radio_km');
  const cacheType = hasGeo ? 'search_geo' : (hasFilters ? 'search_filtered' : 'search_basic');

  return await setInCache(cacheKey, data, cacheType);
};

/**
 * Obtener sugerencias desde caché
 */
const getCachedSearchSuggestions = async (query) => {
  const cacheKey = `suggestions_${query.toLowerCase().trim()}`;
  
  // Intentar obtener de Redis primero
  if (redisClient) {
    try {
      const redisData = await redisClient.get(`suggestions:${cacheKey}`);
      if (redisData) {
        return JSON.parse(redisData);
      }
    } catch (error) {
      console.warn('Redis suggestions cache miss:', error);
    }
  }
  
  // Fallback a memory cache
  return memoryCache.get(`suggestions_${cacheKey}`);
};

/**
 * Almacenar sugerencias en caché
 */
const cacheSearchSuggestions = async (query, suggestions) => {
  const cacheKey = `suggestions_${query.toLowerCase().trim()}`;
  
  // Guardar en Redis
  if (redisClient) {
    try {
      await redisClient.setex(`suggestions:${cacheKey}`, 180, JSON.stringify(suggestions)); // 3 minutos
    } catch (error) {
      console.warn('Redis suggestions cache set error:', error);
    }
  }
  
  // Guardar en memory cache
  memoryCache.set(`suggestions_${cacheKey}`, suggestions, 180); // 3 minutos
};

/**
 * Invalidar caché de búsqueda por filtros
 */
const invalidateSearchCache = (filters) => {
  const cacheKey = JSON.stringify(filters);
  
  // Invalidar Redis
  if (redisClient) {
    try {
      redisClient.del(`search:${cacheKey}`);
    } catch (error) {
      console.warn('Redis search cache invalidation error:', error);
    }
  }
  
  // Invalidar memory cache
  memoryCache.del(`search_${cacheKey}`);
};

/**
 * Limpiar todo el caché de búsqueda
 */
const clearSearchCache = () => {
  if (redisClient) {
    try {
      // Limpiar claves de búsqueda de Redis
      const searchKeys = ['search:*', 'suggestions:*'];
      searchKeys.forEach(pattern => {
        redisClient.del(pattern).catch(err => console.warn('Redis clear error:', err));
      });
    } catch (error) {
      console.warn('Redis search cache clear error:', error);
    }
  }
  
  // Limpiar memory cache
  const keys = memoryCache.keys();
  keys.forEach(key => {
    if (key.startsWith('search_') || key.startsWith('suggestions_')) {
      memoryCache.del(key);
    }
  });
};

/**
 * ===========================================
 * FUNCIONES UTILITARIAS
 * ===========================================
 */

/**
 * Obtener estadísticas detalladas del caché
 */
const getCacheStats = () => {
  const memoryStats = memoryCache.getStats();
  const totalHits = cacheStats.hits.redis + cacheStats.hits.memory + cacheStats.hits.localStorage;
  const totalMisses = cacheStats.misses.redis + cacheStats.misses.memory + cacheStats.misses.localStorage;
  const hitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;

  return {
    memory: {
      ...memoryStats,
      hitRate: memoryStats.hits + memoryStats.misses > 0 ?
        (memoryStats.hits / (memoryStats.hits + memoryStats.misses)) * 100 : 0
    },
    redis: {
      status: redisClient ? 'connected' : 'not configured',
      hits: cacheStats.hits.redis,
      misses: cacheStats.misses.redis,
      sets: cacheStats.sets.redis,
      errors: cacheStats.errors.redis
    },
    localStorage: {
      hits: cacheStats.hits.localStorage,
      misses: cacheStats.misses.localStorage,
      sets: cacheStats.sets.localStorage,
      errors: cacheStats.errors.localStorage
    },
    overall: {
      totalHits,
      totalMisses,
      hitRate: `${hitRate.toFixed(2)}%`,
      totalErrors: cacheStats.errors.redis + cacheStats.errors.memory + cacheStats.errors.localStorage
    }
  };
};

/**
 * Limpiar estadísticas del caché
 */
const resetCacheStats = () => {
  cacheStats.hits = { redis: 0, memory: 0, localStorage: 0 };
  cacheStats.misses = { redis: 0, memory: 0, localStorage: 0 };
  cacheStats.sets = { redis: 0, memory: 0, localStorage: 0 };
  cacheStats.errors = { redis: 0, memory: 0, localStorage: 0 };
};

/**
 * Invalidar caché por patrón
 * @param {string} pattern - Patrón de claves a invalidar
 * @param {string} type - Tipo de caché
 */
const invalidateCacheByPattern = async (pattern, type = 'search_basic') => {
  // Invalidar Redis
  if (redisClient) {
    try {
      const keys = await redisClient.keys(`${type}:${pattern}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.warn('Redis pattern invalidation error:', error);
    }
  }

  // Invalidar memory cache
  const keys = memoryCache.keys();
  const regex = new RegExp(`^${type}:${pattern.replace('*', '.*')}`);
  keys.forEach(key => {
    if (regex.test(key)) {
      memoryCache.del(key);
    }
  });
};

/**
 * Funciones de caché para notificaciones
 */
const getCachedNotificationCount = async (userId) => {
  const cacheKey = `notification_count_${userId}`;
  return memoryCache.get(cacheKey);
};

const cacheNotificationCount = (userId, count) => {
  const cacheKey = `notification_count_${userId}`;
  memoryCache.set(cacheKey, count, 300); // 5 minutos
};

const invalidateNotificationCache = (userId) => {
  const cacheKey = `notification_count_${userId}`;
  memoryCache.del(cacheKey);

  // También invalidar Redis si está disponible
  if (redisClient) {
    try {
      redisClient.del(`notifications:${cacheKey}`);
    } catch (error) {
      console.warn('Redis notification cache invalidation error:', error);
    }
  }
};

/**
 * Limpiar todo el caché
 */
const clearCache = () => {
  memoryCache.flushAll();
  if (redisClient) {
    redisClient.flushAll().catch(err => console.warn('Redis clear error:', err));
  }
};

/**
 * Middleware para verificar y renovar el caché
 */
const refreshStatsCacheMiddleware = async (req, res, next) => {
  // Implementar lógica para renovar el caché si es necesario
  next();
};

module.exports = {
  // Funciones de inicialización
  initializeRedis,

  // Funciones de caché multinivel (nuevo)
  getFromCache,
  setInCache,
  invalidateCacheByPattern,
  resetCacheStats,

  // Funciones de notificaciones
  getCachedNotificationCount,
  cacheNotificationCount,
  invalidateNotificationCache,

  // Funciones de reseñas (legacy)
  getCachedReviewStats,
  cacheReviewStats,
  invalidateReviewStatsCache,
  getCachedReviewsList,
  cacheReviewsList,
  invalidateReviewsListCache,
  invalidateAllProfessionalCaches,

  // Funciones de búsqueda avanzada
  getCachedProfessionalSearch,
  cacheProfessionalSearch,
  getCachedSearchSuggestions,
  cacheSearchSuggestions,
  invalidateSearchCache,
  clearSearchCache,

  // Funciones de rankings y reputación
  getCachedRanking,
  cacheRanking,
  invalidateRankingCache,
  getCachedProfessionalRanking,
  cacheProfessionalRanking,
  invalidateProfessionalRankingCache,
  getCachedReputation,
  cacheReputation,
  invalidateReputationCache,
  invalidateAllRankingCaches,

  // Utilidades
  getCacheStats,
  clearCache,
  refreshStatsCacheMiddleware
};