/**
 * Servicio de caché Redis para Changánet
 * Implementa estrategias de caché para búsquedas frecuentes y datos de alto acceso
 * Mejora rendimiento de queries repetitivas y reduce carga en base de datos
 */

const redis = require('redis'); // Librería cliente Redis para Node.js

// Variable global para almacenar instancia del cliente Redis
let redisClient = null;

/**
 * Inicializa la conexión a Redis con configuración robusta
 * Maneja fallos gracefully permitiendo funcionamiento sin caché
 */
async function initializeRedis() {
  try {
    // Verificar si Redis está configurado en variables de entorno
    if (!process.env.REDIS_HOST && !process.env.REDIS_PORT) {
      console.log('ℹ️ Redis no configurado, funcionando sin caché'); // Log informativo
      redisClient = null; // Deshabilitar caché explícitamente
      return; // Salir temprano sin error
    }

    // Crear cliente Redis con configuración completa y tolerante a fallos
    redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost', // Host desde env o default
      port: process.env.REDIS_PORT || 6379,        // Puerto desde env o default 6379
      password: process.env.REDIS_PASSWORD || undefined, // Password si está configurado
      // Configuración de socket para estabilidad de conexión
      socket: {
        connectTimeout: 5000,    // Timeout de conexión inicial: 5 segundos
        commandTimeout: 3000,    // Timeout por comando: 3 segundos
        lazyConnect: true,       // Conectar solo cuando se necesite
      },
      // Estrategia de reintento para manejar fallos temporales
      retry_strategy: (options) => {
        // Si conexión es rechazada, no reintentar (problema de configuración)
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.warn('Redis connection refused, skipping cache');
          return null; // No reintentar
        }
        // Si tiempo total de reintento supera 1 hora, desistir
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.warn('Redis retry time exhausted, skipping cache');
          return null; // No reintentar
        }
        // Si se superan 3 intentos, desistir
        if (options.attempt > 3) {
          console.warn('Redis max attempts reached, skipping cache');
          return null; // No reintentar
        }
        // Calcular delay exponencial con máximo de 3 segundos
        return Math.min(options.attempt * 100, 3000);
      }
    });

    // Configurar manejadores de eventos para monitoreo de conexión
    redisClient.on('error', (err) => {
      console.warn('Redis Client Error (continuando sin caché):', err.message);
      redisClient = null; // Deshabilitar caché ante errores
    });

    redisClient.on('connect', () => {
      console.log('✅ Conectado a Redis'); // Log de conexión exitosa
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis listo para usar'); // Log cuando Redis está operativo
    });

    // Establecer conexión inicial
    await redisClient.connect();
  } catch (error) {
    // Capturar cualquier error durante inicialización
    console.warn('Redis no disponible, funcionando sin caché:', error.message);
    redisClient = null; // Asegurar que caché esté deshabilitado
  }
}

/**
 * Obtiene un valor del caché Redis
 * @param {string} key - Clave del caché a buscar
 * @returns {Promise<string|null>} Valor almacenado o null si no existe/clave expiró
 */
async function get(key) {
  // Verificar si Redis está disponible antes de intentar operación
  if (!redisClient) return null;

  try {
    // Ejecutar comando GET de Redis para obtener valor
    const value = await redisClient.get(key);
    return value; // Retornar valor encontrado o null si no existe
  } catch (error) {
    // Log de error pero no fallar - caché es opcional
    console.warn('Error obteniendo de caché:', error.message);
    return null; // Retornar null para indicar fallo
  }
}

/**
 * Almacena un valor en el caché con tiempo de expiración
 * @param {string} key - Clave única para el valor
 * @param {string} value - Valor a almacenar (debe ser string)
 * @param {number} ttlSeconds - Tiempo de vida en segundos (default: 300 = 5 minutos)
 */
async function set(key, value, ttlSeconds = 300) {
  // Si no hay Redis disponible, salir silenciosamente
  if (!redisClient) return;

  try {
    // Usar setEx para almacenar con TTL automático
    await redisClient.setEx(key, ttlSeconds, value);
  } catch (error) {
    // Log de error pero continuar - caché es opcional
    console.warn('Error almacenando en caché:', error.message);
  }
}

/**
 * Elimina una clave específica del caché
 * @param {string} key - Clave a eliminar del caché
 */
async function del(key) {
  // Si no hay Redis disponible, salir silenciosamente
  if (!redisClient) return;

  try {
    // Ejecutar comando DEL de Redis
    await redisClient.del(key);
  } catch (error) {
    // Log de error pero continuar - operación no crítica
    console.warn('Error eliminando del caché:', error.message);
  }
}

/**
 * Almacena resultados de búsqueda de profesionales en caché
 * @param {Object} filters - Objeto con filtros aplicados (especialidad, zona, precio, etc.)
 * @param {Array} results - Resultados paginados de la búsqueda con metadata
 */
async function cacheProfessionalSearch(filters, results) {
  // Generar clave única basada en filtros para evitar colisiones
  const cacheKey = `search:professionals:${JSON.stringify(filters)}`;
  // Almacenar por 10 minutos (búsquedas cambian frecuentemente)
  await set(cacheKey, JSON.stringify(results), 600);
}

/**
 * Recupera resultados de búsqueda de profesionales desde caché
 * @param {Object} filters - Filtros de búsqueda para generar clave de caché
 * @returns {Promise<Array|null>} Resultados cacheados o null si no existen/expiraron
 */
async function getCachedProfessionalSearch(filters) {
  // Generar misma clave que en cacheProfessionalSearch
  const cacheKey = `search:professionals:${JSON.stringify(filters)}`;
  // Intentar obtener valor del caché
  const cached = await get(cacheKey);

  if (cached) {
    try {
      // Parsear JSON almacenado de vuelta a objeto
      return JSON.parse(cached);
    } catch (error) {
      // Log si hay corrupción de datos en caché
      console.warn('Error parseando caché de búsqueda:', error.message);
      return null; // Retornar null para forzar nueva consulta
    }
  }

  return null; // No encontrado en caché
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