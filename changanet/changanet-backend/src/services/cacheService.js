/**
 * Servicio de caché Redis para Changánet
 * Implementa estrategias de caché para búsquedas frecuentes y datos de alto acceso
 */

const redis = require('redis');

// Configuración del cliente Redis
let redisClient = null;

/**
 * Inicializa la conexión a Redis
 */
async function initializeRedis() {
  try {
    // Solo inicializar si Redis está configurado
    if (!process.env.REDIS_HOST && !process.env.REDIS_PORT) {
      console.log('ℹ️ Redis no configurado, funcionando sin caché');
      redisClient = null;
      return;
    }

    redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      // Configuración para evitar timeouts
      socket: {
        connectTimeout: 5000,
        commandTimeout: 3000,
        lazyConnect: true,
      },
      // Reintentar conexiones
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.warn('Redis connection refused, skipping cache');
          return null; // No reintentar
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.warn('Redis retry time exhausted, skipping cache');
          return null; // No reintentar
        }
        if (options.attempt > 3) {
          console.warn('Redis max attempts reached, skipping cache');
          return null; // No reintentar
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      console.warn('Redis Client Error (continuando sin caché):', err.message);
      redisClient = null;
    });

    redisClient.on('connect', () => {
      console.log('✅ Conectado a Redis');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis listo para usar');
    });

    await redisClient.connect();
  } catch (error) {
    console.warn('Redis no disponible, funcionando sin caché:', error.message);
    redisClient = null;
  }
}

/**
 * Obtiene un valor del caché
 * @param {string} key - Clave del caché
 * @returns {Promise<string|null>} Valor almacenado o null si no existe
 */
async function get(key) {
  if (!redisClient) return null;

  try {
    const value = await redisClient.get(key);
    return value;
  } catch (error) {
    console.warn('Error obteniendo de caché:', error.message);
    return null;
  }
}

/**
 * Almacena un valor en el caché con TTL
 * @param {string} key - Clave del caché
 * @param {string} value - Valor a almacenar
 * @param {number} ttlSeconds - Tiempo de vida en segundos (default: 300 = 5 minutos)
 */
async function set(key, value, ttlSeconds = 300) {
  if (!redisClient) return;

  try {
    await redisClient.setEx(key, ttlSeconds, value);
  } catch (error) {
    console.warn('Error almacenando en caché:', error.message);
  }
}

/**
 * Elimina una clave del caché
 * @param {string} key - Clave a eliminar
 */
async function del(key) {
  if (!redisClient) return;

  try {
    await redisClient.del(key);
  } catch (error) {
    console.warn('Error eliminando del caché:', error.message);
  }
}

/**
 * Cache para resultados de búsqueda de profesionales
 * @param {Object} filters - Filtros de búsqueda
 * @param {Array} results - Resultados de la búsqueda
 */
async function cacheProfessionalSearch(filters, results) {
  const cacheKey = `search:professionals:${JSON.stringify(filters)}`;
  await set(cacheKey, JSON.stringify(results), 600); // 10 minutos
}

/**
 * Obtiene resultados de búsqueda cacheados
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Promise<Array|null>} Resultados cacheados o null
 */
async function getCachedProfessionalSearch(filters) {
  const cacheKey = `search:professionals:${JSON.stringify(filters)}`;
  const cached = await get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn('Error parseando caché de búsqueda:', error.message);
      return null;
    }
  }

  return null;
}

/**
 * Cache para perfiles de profesionales
 * @param {string} professionalId - ID del profesional
 * @param {Object} profile - Datos del perfil
 */
async function cacheProfessionalProfile(professionalId, profile) {
  const cacheKey = `profile:professional:${professionalId}`;
  await set(cacheKey, JSON.stringify(profile), 1800); // 30 minutos
}

/**
 * Obtiene perfil de profesional del caché
 * @param {string} professionalId - ID del profesional
 * @returns {Promise<Object|null>} Perfil cacheado o null
 */
async function getCachedProfessionalProfile(professionalId) {
  const cacheKey = `profile:professional:${professionalId}`;
  const cached = await get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn('Error parseando caché de perfil:', error.message);
      return null;
    }
  }

  return null;
}

/**
 * Invalida caché de perfil de profesional
 * @param {string} professionalId - ID del profesional
 */
async function invalidateProfessionalProfile(professionalId) {
  const cacheKey = `profile:professional:${professionalId}`;
  await del(cacheKey);
}

/**
 * Cache para rankings de profesionales
 * @param {Array} rankings - Lista de rankings
 */
async function cacheProfessionalRankings(rankings) {
  const cacheKey = 'rankings:professionals';
  await set(cacheKey, JSON.stringify(rankings), 3600); // 1 hora
}

/**
 * Obtiene rankings cacheados
 * @returns {Promise<Array|null>} Rankings cacheados o null
 */
async function getCachedProfessionalRankings() {
  const cacheKey = 'rankings:professionals';
  const cached = await get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn('Error parseando caché de rankings:', error.message);
      return null;
    }
  }

  return null;
}

/**
 * Invalida todo el caché de búsquedas
 */
async function invalidateSearchCache() {
  if (!redisClient) return;

  try {
    const keys = await redisClient.keys('search:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.warn('Error invalidando caché de búsquedas:', error.message);
  }
}

/**
 * Invalida todo el caché de rankings
 */
async function invalidateRankingsCache() {
  await del('rankings:professionals');
}

/**
 * Obtiene estadísticas del caché
 * @returns {Promise<Object>} Estadísticas de uso del caché
 */
async function getCacheStats() {
  if (!redisClient) {
    return { redis: false, message: 'Redis no disponible' };
  }

  try {
    const info = await redisClient.info();
    const keys = await redisClient.dbsize();

    return {
      redis: true,
      totalKeys: keys,
      info: info.split('\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          acc[key] = value;
        }
        return acc;
      }, {})
    };
  } catch (error) {
    return { redis: false, error: error.message };
  }
}

/**
 * Cierra la conexión a Redis
 */
async function close() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

module.exports = {
  initializeRedis,
  get,
  set,
  del,
  cacheProfessionalSearch,
  getCachedProfessionalSearch,
  cacheProfessionalProfile,
  getCachedProfessionalProfile,
  invalidateProfessionalProfile,
  cacheProfessionalRankings,
  getCachedProfessionalRankings,
  invalidateSearchCache,
  invalidateRankingsCache,
  getCacheStats,
  close
};