/**
 * Global Rate Limiting Middleware para Changánet
 * Implementa control de tasa global con Redis fallback a memoria
 *
 * Características:
 * - Rate limiting global por IP y usuario
 * - Configurable por endpoint
 * - Headers informativos para clientes
 * - Persistencia opcional en Redis
 * - Modo graceful degradation
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');

// Configuración de Redis (opcional)
let redisClient = null;
try {
  if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.connect().catch(err => {
      console.warn('Redis connection failed, using memory store:', err.message);
      redisClient = null;
    });
  }
} catch (error) {
  console.warn('Redis not available, using memory store');
}

// Configuraciones de rate limiting por tipo de endpoint
const RATE_LIMIT_CONFIGS = {
  // Endpoints públicos (sin autenticación)
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: {
      error: 'Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.',
      retryAfter: '900'
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Endpoints de autenticación
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 5 : 50,
    message: {
      error: 'Demasiados intentos de autenticación. Inténtalo de nuevo en 15 minutos.',
      retryAfter: '900'
    },
    skipSuccessfulRequests: true, // No contar requests exitosos
    skipFailedRequests: false,
  },

  // Endpoints de API general
  api: {
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: process.env.NODE_ENV === 'production' ? 60 : 300,
    message: {
      error: 'Demasiadas solicitudes a la API. Inténtalo de nuevo en 1 minuto.',
      retryAfter: '60'
    },
  },

  // Endpoints de pagos (más restrictivos)
  payments: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: process.env.NODE_ENV === 'production' ? 10 : 50,
    message: {
      error: 'Demasiadas operaciones de pago. Inténtalo de nuevo en 5 minutos.',
      retryAfter: '300'
    },
  },

  // Endpoints de búsqueda
  search: {
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: process.env.NODE_ENV === 'production' ? 30 : 100,
    message: {
      error: 'Demasiadas búsquedas. Inténtalo de nuevo en 1 minuto.',
      retryAfter: '60'
    },
  },

  // Webhooks (muy restrictivos)
  webhooks: {
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 20, // Solo para proveedores externos
    message: {
      error: 'Demasiados webhooks.',
      retryAfter: '60'
    },
  }
};

/**
 * Crear middleware de rate limiting con configuración específica
 */
function createRateLimiter(configType = 'api') {
  const config = RATE_LIMIT_CONFIGS[configType] || RATE_LIMIT_CONFIGS.api;

  // Usar Redis si está disponible
  const store = redisClient ? new RedisStore({
    client: redisClient,
    prefix: `rl:${configType}:`,
  }) : undefined;

  return rateLimit({
    ...config,
    store,
    // Key generator personalizado
    keyGenerator: (req) => {
      // Para usuarios autenticados, usar user ID + IP
      // Para usuarios anónimos, usar solo IP
      const userId = req.user?.id || 'anonymous';
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return `${configType}:${userId}:${ip}`;
    },
    // Handler personalizado para respuestas
    handler: (req, res) => {
      const resetTime = new Date(Date.now() + config.windowMs).toISOString();

      res.status(429).json({
        ...config.message,
        limit: config.max,
        resetTime,
        configType
      });
    },
    // Skip para requests de admin en desarrollo
    skip: (req) => {
      return process.env.NODE_ENV === 'development' &&
             req.user?.rol === 'admin' &&
             req.headers['x-skip-rate-limit'] === 'true';
    }
  });
}

/**
 * Middleware de rate limiting global
 * Aplica rate limiting básico a todas las rutas
 */
const globalRateLimiter = createRateLimiter('public');

/**
 * Rate limiter específico para autenticación
 */
const authRateLimiter = createRateLimiter('auth');

/**
 * Rate limiter específico para pagos
 */
const paymentRateLimiter = createRateLimiter('payments');

/**
 * Rate limiter específico para búsquedas
 */
const searchRateLimiter = createRateLimiter('search');

/**
 * Rate limiter específico para webhooks
 */
const webhookRateLimiter = createRateLimiter('webhooks');

/**
 * Función para obtener estadísticas de rate limiting
 */
async function getRateLimitStats() {
  if (!redisClient) {
    return { redis: false, message: 'Redis not available' };
  }

  try {
    const keys = await redisClient.keys('rl:*:*');
    const stats = {};

    for (const key of keys) {
      const value = await redisClient.get(key);
      if (value) {
        const [, type] = key.split(':');
        if (!stats[type]) stats[type] = 0;
        stats[type]++;
      }
    }

    return {
      redis: true,
      totalKeys: keys.length,
      byType: stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { redis: true, error: error.message };
  }
}

/**
 * Función para resetear rate limits (solo para desarrollo/admin)
 */
async function resetRateLimits(pattern = '*') {
  if (!redisClient) {
    return { success: false, message: 'Redis not available' };
  }

  try {
    const keys = await redisClient.keys(`rl:${pattern}`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    return {
      success: true,
      deletedKeys: keys.length,
      pattern: `rl:${pattern}`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Middleware para logging de rate limits excedidos
 */
function logRateLimitExceeded(req, res, next) {
  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode === 429) {
      console.warn(`Rate limit exceeded: ${req.method} ${req.path} - IP: ${req.ip} - User: ${req.user?.id || 'anonymous'}`);
    }
    return originalJson.call(this, data);
  };
  next();
}

module.exports = {
  createRateLimiter,
  globalRateLimiter,
  authRateLimiter,
  paymentRateLimiter,
  searchRateLimiter,
  webhookRateLimiter,
  getRateLimitStats,
  resetRateLimits,
  logRateLimitExceeded
};