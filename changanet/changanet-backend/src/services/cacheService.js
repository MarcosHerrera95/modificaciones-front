/**
 * Servicio de caché para el Sistema de Búsqueda y Reseñas
 * Gestiona el almacenamiento temporal de datos frecuentes para mejorar el rendimiento
 * Incluye caché multinivel: Memory (NodeCache) + Redis (para producción)
 */

const NodeCache = require('node-cache');
const redis = require('redis');

// Configurar el caché con TTL de 10 minutos (600 segundos)
const memoryCache = new NodeCache({ 
  stdTTL: 600, // Tiempo de vida por defecto
  checkperiod: 120, // Verificación cada 2 minutos
  useClones: false // Mejora el rendimiento
});

// Cliente Redis para caché en producción
let redisClient = null;

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
};

/**
 * ===========================================
 * FUNCIONES DE CACHÉ PARA BÚSQUEDA AVANZADA
 * ===========================================
 */

/**
 * Obtener resultados de búsqueda desde caché
 */
const getCachedProfessionalSearch = async (cacheKey) => {
  // Intentar obtener de Redis primero (más rápido)
  if (redisClient) {
    try {
      const redisData = await redisClient.get(`search:${cacheKey}`);
      if (redisData) {
        return JSON.parse(redisData);
      }
    } catch (error) {
      console.warn('Redis search cache miss:', error);
    }
  }
  
  // Fallback a memory cache
  return memoryCache.get(`search_${cacheKey}`);
};

/**
 * Almacenar resultados de búsqueda en caché
 */
const cacheProfessionalSearch = async (cacheKey, data) => {
  const memoryCacheKey = `search_${cacheKey}`;
  
  // Guardar en Redis (más rápido para búsquedas frecuentes)
  if (redisClient) {
    try {
      await redisClient.setex(`search:${cacheKey}`, 300, JSON.stringify(data)); // 5 minutos en Redis
    } catch (error) {
      console.warn('Redis search cache set error:', error);
    }
  }
  
  // Guardar en memory cache
  memoryCache.set(memoryCacheKey, data, 300); // 5 minutos en memoria
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
 * Obtener estadísticas del caché
 */
const getCacheStats = () => {
  const memoryStats = memoryCache.getStats();
  return {
    memory: memoryStats,
    redis: redisClient ? 'connected' : 'not configured'
  };
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
  
  // Utilidades
  getCacheStats,
  clearCache,
  refreshStatsCacheMiddleware
};