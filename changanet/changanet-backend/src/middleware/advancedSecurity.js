/**
 * Middleware de Seguridad Avanzada para Changánet
 * Implementa validaciones adicionales, logging de auditoría y rate limiting granular
 * Creado: 2025-11-24
 * Versión: 2.0.0
 */

const { PrismaClient } = require('@prisma/client');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Middleware para logging de auditoría
 * Registra acciones críticas del usuario en la base de datos
 */
const auditLogger = (action, resourceType = null) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Llamar al send original
      originalSend.call(this, data);
      
      // Solo registrar si la respuesta fue exitosa
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAuditEvent(req, res, action, resourceType).catch(console.error);
      }
    };
    
    next();
  };
};

/**
 * Función auxiliar para registrar eventos de auditoría
 */
async function logAuditEvent(req, res, action, resourceType, additionalData = {}) {
  try {
    const userId = req.user?.id || null;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    // Obtener valores anteriores y nuevos si están disponibles
    const oldValues = req.body?.oldValues || null;
    const newValues = req.body?.newValues || req.body || null;
    
    await prisma.audit_logs.create({
      data: {
        user_id: userId,
        action: action,
        resource_type: resourceType,
        resource_id: req.params.id || null,
        old_values: oldValues,
        new_values: newValues,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_id: req.sessionID || null,
        severity: determineSeverity(action, res.statusCode),
        ...additionalData
      }
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

/**
 * Determina la severidad del evento basado en la acción y código de estado
 */
function determineSeverity(action, statusCode) {
  if (statusCode >= 500) return 'ERROR';
  if (statusCode >= 400) return 'WARNING';
  if (action.includes('LOGIN') || action.includes('PASSWORD') || action.includes('SECURITY')) {
    return 'CRITICAL';
  }
  return 'INFO';
}

/**
 * Rate limiting avanzado por usuario y endpoint
 */
const createUserRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      // Combinar user ID y IP para mayor granularidad
      const userId = req.user?.id || req.ip;
      return `${userId}:${req.ip}`;
    },
    message: {
      error: 'Demasiadas solicitudes desde esta cuenta',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      // Log del evento de rate limiting
      logAuditEvent(req, res, 'RATE_LIMIT_EXCEEDED', 'API', {
        severity: 'WARNING'
      }).catch(console.error);
      
      res.status(429).json({
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de solicitudes. Intenta nuevamente más tarde.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

/**
 * Rate limiting específico para autenticación
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos por IP
  keyGenerator: (req) => req.ip,
  message: {
    error: 'Demasiados intentos de autenticación',
    message: 'Has excedido el límite de intentos de login. Intenta nuevamente en 15 minutos.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logAuditEvent(req, res, 'AUTH_RATE_LIMIT_EXCEEDED', 'AUTH', {
      severity: 'CRITICAL'
    }).catch(console.error);
    
    res.status(429).json({
      error: 'Rate limit excedido',
      message: 'Demasiados intentos de autenticación. Acceso temporalmente bloqueado.',
      retryAfter: 900
    });
  }
});

/**
 * Middleware de validación de entrada mejorada
 */
const enhancedInputValidation = (req, res, next) => {
  // Validar Content-Type para requests POST/PUT
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Content-Type inválido',
        message: 'Se requiere Content-Type: application/json'
      });
    }
  }
  
  // Validar tamaño del payload
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({
      error: 'Payload demasiado grande',
      message: 'El contenido excede el tamaño máximo permitido'
    });
  }
  
  // Sanitizar parámetros de ruta
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = req.params[key].trim();
      }
    });
  }
  
  next();
};

/**
 * Middleware de validación de headers de seguridad
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'", "https://www.gstatic.com", "https://www.googleapis.com"],
      connectSrc: ["'self'", "https://www.googleapis.com", "https://firestore.googleapis.com", "wss:"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://www.google.com"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * Middleware de monitoreo de performance
 */
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Solo registrar métricas para endpoints críticos
    if (shouldRecordMetric(req.path)) {
      prisma.performance_metrics.create({
        data: {
          endpoint: req.path,
          method: req.method,
          response_time_ms: duration,
          status_code: res.statusCode,
          user_id: req.user?.id || null,
          request_size_bytes: parseInt(req.headers['content-length'] || 0),
          response_size_bytes: parseInt(res.get('content-length') || 0)
        }
      }).catch(console.error);
    }
  });
  
  next();
};

/**
 * Determina si un endpoint debe ser monitoreado
 */
function shouldRecordMetric(path) {
  const criticalEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/profile',
    '/api/services',
    '/api/payments',
    '/api/messages'
  ];
  
  return criticalEndpoints.some(endpoint => path.startsWith(endpoint));
}

/**
 * Middleware de validación de sesión
 */
const sessionValidator = async (req, res, next) => {
  if (!req.user) {
    return next();
  }
  
  try {
    // Verificar si la sesión ha expirado
    const user = await prisma.usuarios.findUnique({
      where: { id: req.user.id },
      select: { account_lockout_until: true, last_activity_at: true }
    });
    
    if (user?.account_lockout_until && new Date() < user.account_lockout_until) {
      return res.status(423).json({
        error: 'Cuenta bloqueada',
        message: 'Tu cuenta está temporalmente bloqueada. Contacta al soporte.'
      });
    }
    
    // Actualizar última actividad
    await prisma.usuarios.update({
      where: { id: req.user.id },
      data: { last_activity_at: new Date() }
    });
    
    next();
  } catch (error) {
    console.error('Error validating session:', error);
    next();
  }
};

/**
 * Middleware de detección de actividad sospechosa
 */
const suspiciousActivityDetector = (req, res, next) => {
  const suspiciousPatterns = [
    /(<|%3C)script(>|%3E)/i, // XSS attempts
    /union.*select/i, // SQL injection
    /(\.\.\/)|(\.\.\\)/, // Path traversal
    /javascript:/i, // JavaScript protocol
    /on\w+\s*=/i // Event handlers
  ];
  
  const checkString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(checkString));
  
  if (isSuspicious) {
    logAuditEvent(req, res, 'SUSPICIOUS_ACTIVITY', 'SECURITY', {
      severity: 'WARNING',
      new_values: { pattern_detected: true, request_path: req.path }
    }).catch(console.error);
    
    return res.status(400).json({
      error: 'Actividad sospechosa detectada',
      message: 'La solicitud ha sido bloqueada por seguridad'
    });
  }
  
  next();
};

module.exports = {
  auditLogger,
  createUserRateLimiter,
  authRateLimiter,
  enhancedInputValidation,
  securityHeaders,
  performanceMonitor,
  sessionValidator,
  suspiciousActivityDetector,
  logAuditEvent
};