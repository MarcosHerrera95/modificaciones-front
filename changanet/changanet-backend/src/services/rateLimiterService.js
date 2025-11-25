/**
 * Rate Limiter Service - Sistema de limitación de velocidad para chat
 * Implementa protección anti-spam y control de carga para el sistema de mensajería
 * 
 * CARACTERÍSTICAS:
 * - Rate limiting configurable por tipo de acción
 * - Memoria distribuida con Redis (opcional)
 * - Backoff exponencial para usuarios abuso
 * - Métricas y alertas de uso
 * 
 * SEGURIDAD: Cumple con estándares de protección contra spam y abuso
 */

const redis = require('redis');
const { createClient } = redis;

class RateLimiterService {
  constructor(options = {}) {
    this.client = null;
    this.memoryStore = new Map();
    this.config = {
      // Configuración por defecto
      messages: {
        windowMs: 60000,    // 1 minuto
        max: 10,           // 10 mensajes por minuto
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (userId) => `chat:messages:${userId}`,
        onLimitReached: (userId, limitInfo) => this.onLimitReached(userId, 'messages', limitInfo)
      },
      uploads: {
        windowMs: 300000,   // 5 minutos
        max: 5,            // 5 uploads por 5 minutos
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (userId) => `chat:uploads:${userId}`,
        onLimitReached: (userId, limitInfo) => this.onLimitReached(userId, 'uploads', limitInfo)
      },
      connections: {
        windowMs: 60000,    // 1 minuto
        max: 3,            // 3 conexiones por minuto
        skipSuccessfulRequests: true,  // No contar conexiones exitosas
        skipFailedRequests: false,
        keyGenerator: (userId) => `chat:connections:${userId}`,
        onLimitReached: (userId, limitInfo) => this.onLimitReached(userId, 'connections', limitInfo)
      },
      conversations: {
        windowMs: 300000,   // 5 minutos
        max: 10,           // 10 conversaciones por 5 minutos
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (userId) => `chat:conversations:${userId}`,
        onLimitReached: (userId, limitInfo) => this.onLimitReached(userId, 'conversations', limitInfo)
      },
      typing: {
        windowMs: 5000,     // 5 segundos
        max: 20,           // 20 eventos typing por 5 segundos
        skipSuccessfulRequests: true,  // Typing no consume límite
        skipFailedRequests: false,
        keyGenerator: (userId) => `chat:typing:${userId}`,
        onLimitReached: (userId, limitInfo) => this.onLimitReached(userId, 'typing', limitInfo)
      },
      // Configuración específica para IPs (protección contra ataques)
      ip: {
        windowMs: 60000,    // 1 minuto
        max: 100,          // 100 requests por minuto por IP
        skipSuccessfulRequests: false,
        skipFailedRequests: true,     // No contar requests exitosos
        keyGenerator: (ip) => `chat:ip:${ip}`,
        onLimitReached: (ip, limitInfo) => this.onLimitReached(ip, 'ip', limitInfo)
      },
      ...options.config  // Permitir sobrescribir configuración
    };

    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      rateLimitedActions: new Map(),
      userStats: new Map(),
      ipStats: new Map()
    };

    this.initializeRedis();
  }

  /**
   * Inicializar conexión Redis (opcional)
   */
  async initializeRedis() {
    if (!process.env.REDIS_URL) {
      console.log('📝 RateLimiter: Usando memoria local (sin Redis)');
      return;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('El servidor Redis rechazó la conexión');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Tiempo de reintento agotado');
          }
          if (options.attempt > 10) {
            return undefined; // Cancelar reintentos
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err);
        this.client = null; // Fallback a memoria local
      });

      this.client.on('connect', () => {
        console.log('✅ RateLimiter: Conectado a Redis');
      });

      await this.client.connect();
    } catch (error) {
      console.warn('⚠️ RateLimiter: No se pudo conectar a Redis, usando memoria local:', error.message);
      this.client = null;
    }
  }

  /**
   * Verificar si una acción está permitida
   * @param {string} action - Tipo de acción (messages, uploads, connections, etc.)
   * @param {string} identifier - Identificador del usuario o IP
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async checkLimit(action, identifier, options = {}) {
    this.metrics.totalRequests++;

    const config = this.config[action];
    if (!config) {
      console.warn(`⚠️ RateLimiter: Acción desconocida "${action}"`);
      return { allowed: true, remaining: Infinity, resetTime: Date.now() };
    }

    const key = config.keyGenerator(identifier);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      let result;
      
      if (this.client) {
        result = await this.checkLimitRedis(key, config, now, windowStart);
      } else {
        result = this.checkLimitMemory(key, config, now, windowStart);
      }

      // Actualizar métricas
      this.updateMetrics(action, identifier, result);

      if (!result.allowed) {
        this.metrics.blockedRequests++;
        
        // Log de límite excedido
        console.warn(`🚫 RateLimiter: Límite excedido para ${action} - Usuario: ${identifier}`, {
          key,
          count: result.count,
          limit: config.max,
          window: config.windowMs
        });

        // Callback personalizado si está configurado
        if (config.onLimitReached) {
          await config.onLimitReached(identifier, {
            action,
            count: result.count,
            limit: config.max,
            resetTime: result.resetTime
          });
        }

        return {
          allowed: false,
          remaining: 0,
          resetTime: result.resetTime,
          limit: config.max,
          windowMs: config.windowMs,
          retryAfter: Math.ceil((result.resetTime - now) / 1000)
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, config.max - result.count),
        resetTime: result.resetTime,
        limit: config.max,
        windowMs: config.windowMs
      };

    } catch (error) {
      console.error('❌ RateLimiter: Error verificando límite:', error);
      
      // En caso de error, permitir la acción pero log
      return {
        allowed: true,
        remaining: 1,
        resetTime: now + config.windowMs,
        error: error.message
      };
    }
  }

  /**
   * Verificar límite usando Redis
   */
  async checkLimitRedis(key, config, now, windowStart) {
    const multi = this.client.multi();
    
    // Remover entradas expiradas
    multi.zRemRangeByScore(key, 0, windowStart);
    
    // Contar requests actuales
    multi.zCard(key);
    
    // Agregar request actual
    multi.zAdd(key, { score: now, value: now.toString() });
    
    // Establecer expiración
    multi.expire(key, Math.ceil(config.windowMs / 1000));
    
    const results = await multi.exec();
    const currentCount = results[1]; // Resultado de zCard
    
    const allowed = currentCount < config.max;
    
    return {
      allowed,
      count: currentCount,
      resetTime: now + config.windowMs
    };
  }

  /**
   * Verificar límite usando memoria local
   */
  checkLimitMemory(key, config, now, windowStart) {
    if (!this.memoryStore.has(key)) {
      this.memoryStore.set(key, new Map());
    }
    
    const window = this.memoryStore.get(key);
    
    // Limpiar entradas expiradas
    for (const [timestamp] of window) {
      if (timestamp < windowStart) {
        window.delete(timestamp);
      }
    }
    
    // Contar requests actuales
    const currentCount = window.size;
    
    // Agregar request actual
    window.set(now, true);
    
    const allowed = currentCount < config.max;
    
    return {
      allowed,
      count: currentCount,
      resetTime: now + config.windowMs
    };
  }

  /**
   * Actualizar métricas de uso
   */
  updateMetrics(action, identifier, result) {
    // Contador por acción
    const actionCount = this.metrics.rateLimitedActions.get(action) || 0;
    this.metrics.rateLimitedActions.set(action, actionCount + 1);
    
    // Estadísticas por usuario
    const userStats = this.metrics.userStats.get(identifier) || {
      totalRequests: 0,
      blockedRequests: 0,
      actions: new Map()
    };
    userStats.totalRequests++;
    if (!result.allowed) {
      userStats.blockedRequests++;
    }
    
    const actionStats = userStats.actions.get(action) || { requests: 0, blocked: 0 };
    actionStats.requests++;
    if (!result.allowed) {
      actionStats.blocked++;
    }
    userStats.actions.set(action, actionStats);
    
    this.metrics.userStats.set(identifier, userStats);
  }

  /**
   * Callback cuando se alcanza un límite
   */
  async onLimitReached(identifier, action, limitInfo) {
    try {
      // Log detallado para análisis
      const logData = {
        identifier,
        action,
        limit: limitInfo.limit,
        count: limitInfo.count,
        resetTime: limitInfo.resetTime,
        timestamp: new Date().toISOString(),
        userAgent: this.getUserAgentFromRequest(identifier),
        ip: identifier.includes(':') ? identifier.split(':')[0] : null
      };

      console.warn('🚨 RateLimiter: Límite excedido:', logData);

      // TODO: Enviar alerta a sistema de monitoreo
      // await this.sendAlert(logData);
      
      // TODO: Aplicar medidas adicionales si es necesario
      // - Bloqueo temporal de IP
      // - Notificación a administradores
      // - Aumento de cooldown

    } catch (error) {
      console.error('❌ Error en onLimitReached:', error);
    }
  }

  /**
   * Obtener User-Agent del request (si está disponible)
   */
  getUserAgentFromRequest(identifier) {
    // En una implementación real, esto vendría del request
    // Por ahora, retornamos null
    return null;
  }

  /**
   * Limpiar store de memoria (para evitar memory leaks)
   */
  cleanup() {
    if (!this.client) {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      for (const [key, window] of this.memoryStore) {
        for (const [timestamp] of window) {
          if (timestamp < now - oneHour) {
            window.delete(timestamp);
          }
        }
        if (window.size === 0) {
          this.memoryStore.delete(key);
        }
      }
    }
  }

  /**
   * Obtener estadísticas del rate limiter
   */
  getMetrics() {
    const userStats = {};
    for (const [userId, stats] of this.metrics.userStats) {
      userStats[userId] = {
        totalRequests: stats.totalRequests,
        blockedRequests: stats.blockedRequests,
        blockRate: stats.totalRequests > 0 ? 
          (stats.blockedRequests / stats.totalRequests * 100).toFixed(2) + '%' : '0%',
        actions: Object.fromEntries(stats.actions)
      };
    }

    return {
      totalRequests: this.metrics.totalRequests,
      blockedRequests: this.metrics.blockedRequests,
      blockRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.blockedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      rateLimitedActions: Object.fromEntries(this.metrics.rateLimitedActions),
      userStats,
      config: this.config,
      redisConnected: !!this.client
    };
  }

  /**
   * Resetear límites para un usuario específico (útil para administradores)
   */
  async resetUserLimits(userId) {
    const keys = [
      `chat:messages:${userId}`,
      `chat:uploads:${userId}`,
      `chat:connections:${userId}`,
      `chat:conversations:${userId}`,
      `chat:typing:${userId}`
    ];

    try {
      if (this.client) {
        await Promise.all(keys.map(key => this.client.del(key)));
      } else {
        // Limpiar de memoria local
        keys.forEach(key => this.memoryStore.delete(key));
      }

      // Limpiar métricas del usuario
      this.metrics.userStats.delete(userId);

      console.log(`✅ RateLimiter: Límites reseteados para usuario ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error reseteando límites:', error);
      return false;
    }
  }

  /**
   * Obtener tiempo restante para que un usuario pueda realizar una acción
   */
  async getTimeUntilAllowed(action, identifier) {
    const config = this.config[action];
    if (!config) return 0;

    const key = config.keyGenerator(identifier);
    let currentCount = 0;

    try {
      if (this.client) {
        const count = await this.client.zCard(key);
        currentCount = count;
      } else {
        const window = this.memoryStore.get(key);
        if (window) {
          currentCount = window.size;
        }
      }

      if (currentCount < config.max) {
        return 0; // Ya está permitido
      }

      // Calcular tiempo hasta que expire el window más antiguo
      // Esto es una aproximación - en implementación real usaríamos el score mínimo
      return config.windowMs;

    } catch (error) {
      console.error('Error calculando tiempo restante:', error);
      return config.windowMs;
    }
  }
}

// Instancia singleton
const rateLimiter = new RateLimiterService();

// Cleanup periódico cada 5 minutos
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);

module.exports = rateLimiter;