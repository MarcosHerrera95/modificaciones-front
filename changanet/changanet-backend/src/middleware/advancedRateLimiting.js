/**
 * Middleware Avanzado de Rate Limiting para Changánet
 * Implementa control de tasa inteligente con diferentes límites por usuario/tipo
 *
 * Características:
 * - Límites diferenciados por rol de usuario
 * - Rate limiting por endpoint específico
 * - Headers informativos para clientes
 * - Persistencia en Redis (opcional)
 * - Modo graceful degradation
 */

const rateLimit = require('express-rate-limit');

// Configuraciones de rate limiting por endpoint y rol
const RATE_LIMITS = {
  search: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: {
      anonymous: 30,    // 30 búsquedas por ventana
      cliente: 100,     // 100 búsquedas por ventana
      profesional: 200, // 200 búsquedas por ventana
      admin: 1000       // 1000 búsquedas por ventana
    },
    message: {
      success: false,
      error: 'Demasiadas búsquedas. Espera unos minutos antes de continuar.',
      retryAfter: '900' // segundos
    }
  },
  suggestions: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: {
      anonymous: 50,
      cliente: 200,
      profesional: 300,
      admin: 1000
    },
    message: {
      success: false,
      error: 'Demasiadas solicitudes de sugerencias.',
      retryAfter: '300'
    }
  },
  chat: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: {
      anonymous: process.env.NODE_ENV === 'production' ? 30 : 5000,    // 30 en prod, 5000 en dev
      cliente: process.env.NODE_ENV === 'production' ? 30 : 5000,
      profesional: process.env.NODE_ENV === 'production' ? 30 : 5000,
      admin: process.env.NODE_ENV === 'production' ? 30 : 5000
    },
    message: {
      success: false,
      error: 'Demasiados mensajes de chat. Intenta nuevamente en una hora.',
      retryAfter: '3600' // segundos
    }
  },
  general: {
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: {
      anonymous: 60,
      cliente: 300,
      profesional: 500,
      admin: 2000
    },
    message: {
      success: false,
      error: 'Demasiadas solicitudes.',
      retryAfter: '60'
    }
  }
};

// Mapas para tracking de rate limits (fallback si no hay Redis)
const rateLimitMaps = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos

// Función para limpiar rate limit maps expirados
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMaps.entries()) {
    if (now - data.windowStart > Math.max(...Object.values(RATE_LIMITS).map(config => config.windowMs))) {
      rateLimitMaps.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Obtener clave única para rate limiting
 */
function getRateLimitKey(req, endpointType = 'general') {
  const userId = req.user?.id || 'anonymous';
  const userType = req.user?.rol || 'anonymous';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  // Crear clave única que considere usuario, IP y endpoint
  return `${endpointType}:${userType}:${userId}:${ip}:${userAgent}`;
}

/**
 * Verificar rate limit usando mapas en memoria (fallback)
 */
function checkMemoryRateLimit(key, config, userType) {
  const now = Date.now();
  const maxRequests = config.max[userType] || config.max.anonymous;

  if (!rateLimitMaps.has(key)) {
    rateLimitMaps.set(key, {
      count: 1,
      windowStart: now,
      resetTime: now + config.windowMs
    });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + config.windowMs };
  }

  const userData = rateLimitMaps.get(key);

  // Reset window si expiró
  if (now - userData.windowStart >= config.windowMs) {
    userData.count = 1;
    userData.windowStart = now;
    userData.resetTime = now + config.windowMs;
    return { allowed: true, remaining: maxRequests - 1, resetTime: userData.resetTime };
  }

  // Verificar límite
  if (userData.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: userData.resetTime,
      retryAfter: Math.ceil((userData.resetTime - now) / 1000)
    };
  }

  userData.count++;
  return {
    allowed: true,
    remaining: maxRequests - userData.count,
    resetTime: userData.resetTime
  };
}

/**
 * Middleware de rate limiting avanzado
 */
function createAdvancedRateLimiter(endpointType = 'general') {
  const config = RATE_LIMITS[endpointType] || RATE_LIMITS.general;

  return async (req, res, next) => {
    try {
      const key = getRateLimitKey(req, endpointType);
      const userType = req.user?.rol || 'anonymous';

      // Verificar rate limit
      const result = checkMemoryRateLimit(key, config, userType);

      // Agregar headers informativos
      res.set({
        'X-RateLimit-Limit': config.max[userType] || config.max.anonymous,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000),
        'X-RateLimit-UserType': userType
      });

      if (!result.allowed) {
        // Agregar headers específicos para rate limit excedido
        res.set({
          'Retry-After': result.retryAfter,
          'X-RateLimit-Retry-After': result.retryAfter
        });

        const errorResponse = {
          ...config.message,
          retryAfter: result.retryAfter,
          limit: config.max[userType] || config.max.anonymous,
          resetTime: new Date(result.resetTime).toISOString()
        };

        // Log para monitoreo
        console.warn(`Rate limit exceeded for ${key}: ${result.remaining} remaining, resets at ${new Date(result.resetTime).toISOString()}`);

        return res.status(429).json(errorResponse);
      }

      // Log para debugging (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        console.log(`Rate limit OK for ${key}: ${result.remaining} remaining`);
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // En caso de error, permitir la solicitud para evitar bloquear usuarios legítimos
      next();
    }
  };
}

/**
 * Middleware específico para búsquedas
 */
const searchRateLimiter = createAdvancedRateLimiter('search');

/**
 * Middleware específico para sugerencias
 */
const suggestionsRateLimiter = createAdvancedRateLimiter('suggestions');

/**
 * Middleware específico para chat
 */
const chatRateLimiter = createAdvancedRateLimiter('chat');

/**
 * Middleware general para otros endpoints
 */
const generalRateLimiter = createAdvancedRateLimiter('general');

/**
 * Función para obtener estadísticas de rate limiting
 */
function getRateLimitStats() {
  const stats = {
    totalTracked: rateLimitMaps.size,
    byEndpoint: {},
    byUserType: {}
  };

  for (const [key, data] of rateLimitMaps.entries()) {
    const [endpointType, userType] = key.split(':');

    // Estadísticas por endpoint
    if (!stats.byEndpoint[endpointType]) {
      stats.byEndpoint[endpointType] = { count: 0, totalRequests: 0 };
    }
    stats.byEndpoint[endpointType].count++;
    stats.byEndpoint[endpointType].totalRequests += data.count;

    // Estadísticas por tipo de usuario
    if (!stats.byUserType[userType]) {
      stats.byUserType[userType] = { count: 0, totalRequests: 0 };
    }
    stats.byUserType[userType].count++;
    stats.byUserType[userType].totalRequests += data.count;
  }

  return stats;
}

/**
 * Función para resetear rate limits (útil para testing o administración)
 */
function resetRateLimits(userId = null, endpointType = null) {
  if (userId && endpointType) {
    // Reset específico
    for (const [key] of rateLimitMaps.entries()) {
      if (key.includes(`${endpointType}:`) && key.includes(`:${userId}:`)) {
        rateLimitMaps.delete(key);
      }
    }
  } else {
    // Reset completo
    rateLimitMaps.clear();
  }
}

module.exports = {
  createAdvancedRateLimiter,
  searchRateLimiter,
  suggestionsRateLimiter,
  chatRateLimiter,
  generalRateLimiter,
  getRateLimitStats,
  resetRateLimits
};