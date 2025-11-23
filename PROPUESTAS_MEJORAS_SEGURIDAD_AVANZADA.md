# PROPUESTAS DE MEJORAS - FASE 2: SEGURIDAD AVANZADA

## Mejoras para Implementar en el Siguiente Sprint

**Fecha:** 23 de noviembre de 2025  
**Objetivo:** Fortalecer la seguridad del sistema de autenticación  
**Tiempo estimado:** 3-5 días de desarrollo

---

## 1. IMPLEMENTACIÓN DE REFRESH TOKENS

### 1.1 Backend - Nuevo Middleware de Refresh Token

**Archivo a crear:** `changanet-backend/src/middleware/refreshToken.js`

```javascript
/**
 * Middleware para manejar refresh tokens
 * Mejora UX al evitar logout automático por expiración de token
 */

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.refreshTokenMiddleware = async (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ 
      error: 'Refresh token requerido' 
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const user = await prisma.usuarios.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        esta_verificado: true,
        bloqueado: true
      }
    });

    if (!user || user.bloqueado) {
      return res.status(401).json({ 
        error: 'Usuario no válido o bloqueado' 
      });
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    req.user = user;
    req.newAccessToken = newAccessToken;
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Refresh token inválido o expirado' 
    });
  }
};
```

### 1.2 Backend - Endpoint de Refresh Token

**Agregar a:** `changanet-backend/src/routes/authRoutes.js`

```javascript
// POST /auth/refresh - Generar nuevo access token
router.post('/refresh', refreshTokenMiddleware, (req, res) => {
  res.json({
    accessToken: req.newAccessToken,
    user: req.user
  });
});
```

### 1.3 Frontend - Hook para Auto-refresh

**Archivo a crear:** `changanet-frontend/src/hooks/useAutoRefresh.js`

```javascript
import { useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const useAutoRefresh = () => {
  const { user } = useAuth();

  const refreshToken = useCallback(async () => {
    try {
      const currentRefreshToken = localStorage.getItem('changanet_refresh_token');
      
      if (!currentRefreshToken || !user) return;

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('changanet_token', data.accessToken);
        localStorage.setItem('changanet_user', JSON.stringify(data.user));
        
        console.log('Token refrescado exitosamente');
      }
    } catch (error) {
      console.error('Error refrescando token:', error);
      // Si falla el refresh, hacer logout
      localStorage.removeItem('changanet_token');
      localStorage.removeItem('changanet_refresh_token');
      localStorage.removeItem('changanet_user');
      window.location.href = '/';
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Refresh cada 14 minutos (antes de que expire el token de 15min)
    const interval = setInterval(refreshToken, 14 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, refreshToken]);

  return { refreshToken };
};
```

### 1.4 Modificar AuthProvider para usar refresh tokens

**Modificar:** `changanet-frontend/src/context/AuthProvider.jsx`

```javascript
// Añadir al login normal
login = (userData, token) => {
  // ... código existente ...
  
  // Generar refresh token
  const refreshToken = jwt.sign(
    { userId: userData.id },
    process.env.REACT_APP_JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  localStorage.setItem('changanet_refresh_token', refreshToken);
};
```

---

## 2. VALIDACIÓN AVANZADA DE EMAILS

### 2.1 Backend - Servicio de Validación de Email

**Archivo a crear:** `changanet-backend/src/services/emailValidationService.js`

```javascript
/**
 * Servicio para validación avanzada de emails
 * Detecta dominios temporales, emails de bots, etc.
 */

const dns = require('dns').promises;

// Dominios de emails temporales conocidos
const TEMPORARY_EMAIL_DOMAINS = [
  'tempmail.org', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'yopmail.com', 'throwaway.email',
  'temp-mail.org', 'getnada.com', 'sharklasers.com'
];

// Dominios de bots conocidos
const BOT_EMAIL_DOMAINS = [
  'bot.com', 'crawler.com', 'spider.com'
];

exports.validateEmail = async (email) => {
  const validation = {
    isValid: true,
    isTemporary: false,
    isBot: false,
    domain: null,
    issues: []
  };

  // Extraer dominio
  const domain = email.split('@')[1]?.toLowerCase();
  validation.domain = domain;

  // Verificar dominio temporal
  if (TEMPORARY_EMAIL_DOMAINS.includes(domain)) {
    validation.isTemporary = true;
    validation.isValid = false;
    validation.issues.push('Dominio de email temporal no permitido');
  }

  // Verificar dominio de bot
  if (BOT_EMAIL_DOMAINS.includes(domain)) {
    validation.isBot = true;
    validation.isValid = false;
    validation.issues.push('Email de bot detectado');
  }

  // Verificar MX record (solo si es un dominio real)
  if (!validation.isTemporary && !validation.isBot) {
    try {
      await dns.resolveMx(domain);
    } catch (error) {
      validation.issues.push('Dominio de email no válido (sin MX record)');
      validation.isValid = false;
    }
  }

  // Verificar longitud y formato básico
  if (email.length > 254) {
    validation.issues.push('Email demasiado largo');
    validation.isValid = false;
  }

  const localPart = email.split('@')[0];
  if (localPart.length > 64) {
    validation.issues.push('Parte local del email demasiado larga');
    validation.isValid = false;
  }

  return validation;
};

// Lista de palabras suspectas en emails
const SUSPICIOUS_KEYWORDS = ['bot', 'crawler', 'spider', 'scraper', 'test'];

exports.checkSuspiciousPatterns = (email) => {
  const issues = [];
  const emailLower = email.toLowerCase();
  
  SUSPICIOUS_KEYWORDS.forEach(keyword => {
    if (emailLower.includes(keyword)) {
      issues.push(`Email contiene palabra sospechosa: ${keyword}`);
    }
  });

  // Verificar números excesivos
  const numbers = (emailLower.match(/\d/g) || []).length;
  if (numbers > emailLower.length * 0.5) {
    issues.push('Email contiene demasiados números');
  }

  return issues;
};
```

### 2.2 Integrar validación en authController

**Modificar:** `changanet-backend/src/controllers/authController.js`

```javascript
const { validateEmail, checkSuspiciousPatterns } = require('../services/emailValidationService');

// En la función register, después de validar formato básico
try {
  // Validación avanzada de email
  const emailValidation = await validateEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({ 
      error: 'Email no válido',
      details: emailValidation.issues
    });
  }

  // Verificar patrones sospechosos
  const suspiciousPatterns = checkSuspiciousPatterns(email);
  if (suspiciousPatterns.length > 0) {
    logger.warn('Registration attempt with suspicious email patterns', {
      service: 'auth',
      email,
      patterns: suspiciousPatterns,
      ip: req.ip
    });
    
    // Permitir registro pero marcar para revisión manual
    // o denegar completamente dependiendo de la política
  }
} catch (validationError) {
  logger.warn('Email validation failed', {
    service: 'auth',
    email,
    error: validationError.message
  });
  // Continuar sin validación avanzada si falla
}
```

---

## 3. DETECCIÓN BÁSICA DE BOTS

### 3.1 Middleware de Detección de Bots

**Archivo a crear:** `changanet-backend/src/middleware/botDetection.js`

```javascript
/**
 * Middleware para detección básica de bots
 * Analiza headers HTTP para identificar patrones sospechosos
 */

const rateLimiter = require('rate-limiter-flexible');

exports.botDetectionMiddleware = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const referer = req.headers['referer'] || '';
  
  let botScore = 0;
  const indicators = [];

  // 1. User-Agent sospechoso
  const suspiciousUserAgents = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /java/i
  ];

  suspiciousUserAgents.forEach(pattern => {
    if (pattern.test(userAgent)) {
      botScore += 3;
      indicators.push('User-Agent sospechoso');
    }
  });

  // 2. Headers mínimos (usuarios reales tienen más headers)
  const essentialHeaders = ['user-agent', 'accept', 'accept-language'];
  const providedHeaders = Object.keys(req.headers).map(h => h.toLowerCase());
  const missingHeaders = essentialHeaders.filter(h => !providedHeaders.includes(h));
  
  if (missingHeaders.length >= 2) {
    botScore += 2;
    indicators.push('Headers insuficientes');
  }

  // 3. Accept-Language con bot patterns
  if (/bot|crawler|spider/i.test(acceptLanguage)) {
    botScore += 2;
    indicators.push('Accept-Language de bot');
  }

  // 4. Screen resolution en mobile (solo para web)
  const screenResolution = req.headers['x-screen-resolution'];
  if (!screenResolution && req.headers['sec-ch-ua-mobile'] !== '?1') {
    botScore += 1;
    indicators.push('Sin información de pantalla');
  }

  // 5. Timing entre requests (Rate limiting agresivo)
  const now = Date.now();
  const lastRequest = req.headers['x-last-request-time'];
  if (lastRequest && (now - parseInt(lastRequest)) < 1000) {
    botScore += 2;
    indicators.push('Requests muy rápidos');
  }

  // 6. Falta de headers de navegador
  const browserHeaders = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'];
  const missingBrowserHeaders = browserHeaders.filter(h => !providedHeaders.includes(h));
  
  if (missingBrowserHeaders.length >= 2) {
    botScore += 1;
    indicators.push('Faltan headers de navegador');
  }

  // Añadir timestamp para siguiente request
  res.setHeader('X-Last-Request-Time', now.toString());

  // Decidir acción basada en score
  if (botScore >= 6) {
    // Alto score - probablemente bot
    logger.warn('Probable bot detected', {
      service: 'security',
      ip: req.ip,
      userAgent,
      botScore,
      indicators,
      url: req.originalUrl,
      method: req.method
    });
    
    // Opción 1: Denegar acceso
    // return res.status(403).json({ error: 'Acceso denegado' });
    
    // Opción 2: Rate limiting muy agresivo
    return res.status(429).json({
      error: 'Demasiados requests. Intenta más tarde.',
      retryAfter: 300
    });
  } else if (botScore >= 3) {
    // Score medio - marcar para monitoreo
    logger.info('Potencial bot activity', {
      service: 'security',
      ip: req.ip,
      userAgent,
      botScore,
      indicators,
      url: req.originalUrl
    });
  }

  // Añadir score a request para uso posterior
  req.botScore = botScore;
  req.botIndicators = indicators;
  
  next();
};
```

### 3.2 Integrar detección en rutas de autenticación

**Modificar:** `changanet-backend/src/routes/authRoutes.js`

```javascript
const { botDetectionMiddleware } = require('../middleware/botDetection');

// Aplicar detección de bots a rutas sensibles
router.post('/register', botDetectionMiddleware, rateLimitMiddleware(registerLimiter), register);
router.post('/login', botDetectionMiddleware, rateLimitMiddleware(loginLimiter), login);
router.post('/google-login', botDetectionMiddleware, rateLimitMiddleware(loginLimiter), googleLogin);
router.post('/forgot-password', botDetectionMiddleware, rateLimitMiddleware(forgotPasswordLimiter), forgotPassword);
```

---

## 4. LOGGING MEJORADO DE EVENTOS DE SEGURIDAD

### 4.1 Servicio de Seguridad

**Archivo a crear:** `changanet-backend/src/services/securityLogger.js`

```javascript
/**
 * Servicio centralizado para logging de eventos de seguridad
 * Implementa métricas y alertas automáticas
 */

const winston = require('winston');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configurar logger específico para seguridad
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/security.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/security-error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

// Métricas en tiempo real
const securityMetrics = {
  loginAttempts: new Map(),
  registrationAttempts: new Map(),
  suspiciousIPs: new Set()
};

exports.logSecurityEvent = async (eventType, data) => {
  const timestamp = new Date();
  const logData = {
    eventType,
    timestamp,
    ...data
  };

  // Log a archivo
  securityLogger.info('Security event', logData);

  // Actualizar métricas
  await updateSecurityMetrics(eventType, data);
  
  // Verificar alertas automáticas
  await checkSecurityAlerts(eventType, data);
};

async function updateSecurityMetrics(eventType, data) {
  const { ip, email, userAgent } = data;
  
  switch (eventType) {
    case 'login_attempt':
      const loginCount = securityMetrics.loginAttempts.get(ip) || 0;
      securityMetrics.loginAttempts.set(ip, loginCount + 1);
      break;
      
    case 'registration_attempt':
      const regCount = securityMetrics.registrationAttempts.get(ip) || 0;
      securityMetrics.registrationAttempts.set(ip, regCount + 1);
      break;
  }
}

async function checkSecurityAlerts(eventType, data) {
  const { ip } = data;
  
  // Alerta: Muchos intentos de login desde la misma IP
  if (eventType === 'login_attempt') {
    const attempts = securityMetrics.loginAttempts.get(ip) || 0;
    if (attempts > 20) {
      await securityLogger.warn('Multiple login attempts detected', {
        eventType: 'security_alert',
        alertType: 'brute_force',
        ip,
        attempts,
        threshold: 20
      });
      
      // Bloquear IP temporalmente (implementar lógica de bloqueo)
      securityMetrics.suspiciousIPs.add(ip);
    }
  }
  
  // Alerta: Registro masivo desde la misma IP
  if (eventType === 'registration_attempt') {
    const attempts = securityMetrics.registrationAttempts.get(ip) || 0;
    if (attempts > 10) {
      await securityLogger.warn('Multiple registration attempts detected', {
        eventType: 'security_alert',
        alertType: 'mass_registration',
        ip,
        attempts,
        threshold: 10
      });
    }
  }
}

// Función para obtener estadísticas de seguridad
exports.getSecurityStats = () => {
  return {
    activeLoginAttempts: securityMetrics.loginAttempts.size,
    activeRegistrationAttempts: securityMetrics.registrationAttempts.size,
    suspiciousIPs: securityMetrics.suspiciousIPs.size,
    timestamp: new Date()
  };
};
```

### 4.2 Integrar logging en authController

**Modificar:** `changanet-backend/src/controllers/authController.js`

```javascript
const { logSecurityEvent } = require('../services/securityLogger');

// En la función login, después de validar credenciales
if (!user) {
  await logSecurityEvent('login_attempt_failed', {
    ip: req.ip,
    email,
    userAgent: req.headers['user-agent'],
    reason: 'user_not_found'
  });
  return res.status(401).json({ error: 'Credenciales inválidas.' });
}

if (!isValidPassword) {
  await logSecurityEvent('login_attempt_failed', {
    ip: req.ip,
    email,
    userId: user.id,
    userAgent: req.headers['user-agent'],
    reason: 'invalid_password'
  });
  return res.status(401).json({ error: 'Credenciales inválidas.' });
}

// Login exitoso
await logSecurityEvent('login_success', {
  ip: req.ip,
  userId: user.id,
  email: user.email,
  rol: user.rol,
  userAgent: req.headers['user-agent']
});
```

---

## 5. MÉTRICAS Y MONITOREO

### 5.1 Endpoint de Métricas de Seguridad

**Agregar a:** `changanet-backend/src/routes/adminRoutes.js`

```javascript
const { getSecurityStats } = require('../services/securityLogger');
const { authenticateToken } = require('../middleware/authenticate');

// GET /admin/security-metrics - Solo para administradores
router.get('/security-metrics', authenticateToken, (req, res) => {
  // Verificar que es administrador
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  const stats = getSecurityStats();
  res.json(stats);
});
```

### 5.2 Dashboard de Seguridad (Frontend)

**Archivo a crear:** `changanet-frontend/src/components/SecurityDashboard.jsx`

```javascript
import React, { useState, useEffect } from 'react';

const SecurityDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityMetrics();
    const interval = setInterval(fetchSecurityMetrics, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchSecurityMetrics = async () => {
    try {
      const token = localStorage.getItem('changanet_token');
      const response = await fetch('/api/admin/security-metrics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching security metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando métricas de seguridad...</div>;
  if (!metrics) return <div>Error cargando métricas</div>;

  return (
    <div className="security-dashboard">
      <h2>Métricas de Seguridad</h2>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Intentos de Login Activos</h3>
          <p className="metric-value">{metrics.activeLoginAttempts}</p>
        </div>
        
        <div className="metric-card">
          <h3>Intentos de Registro Activos</h3>
          <p className="metric-value">{metrics.activeRegistrationAttempts}</p>
        </div>
        
        <div className="metric-card">
          <h3>IPs Sospechosas</h3>
          <p className="metric-value">{metrics.suspiciousIPs}</p>
        </div>
        
        <div className="metric-card">
          <h3>Última Actualización</h3>
          <p className="metric-value">
            {new Date(metrics.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
```

---

## 6. PLAN DE IMPLEMENTACIÓN DETALLADO

### Semana 1: Implementación Base

**Día 1-2: Refresh Tokens**
- [ ] Crear middleware de refresh token
- [ ] Implementar endpoint de refresh
- [ ] Modificar AuthProvider para usar refresh tokens

**Día 3: Validación de Emails**
- [ ] Crear servicio de validación de emails
- [ ] Integrar validación en authController
- [ ] Testing de casos edge

**Día 4: Detección de Bots**
- [ ] Crear middleware de detección de bots
- [ ] Integrar en rutas de autenticación
- [ ] Testing con diferentes user-agents

**Día 5: Logging y Testing**
- [ ] Implementar servicio de logging de seguridad
- [ ] Testing integral de todas las mejoras
- [ ] Deploy a ambiente de staging

### Semana 2: Validación y Deploy

**Día 1-2: Testing en Staging**
- [ ] Testing E2E de todos los flujos
- [ ] Validación de métricas y monitoreo
- [ ] Corrección de bugs encontrados

**Día 3: Preparación para Producción**
- [ ] Documentación actualizada
- [ ] Capacitación del equipo de soporte
- [ ] Plan de rollback preparado

**Día 4-5: Deploy a Producción**
- [ ] Deploy en horario de baja actividad
- [ ] Monitoreo intensivo post-deploy
- [ ] Documentación de lecciones aprendidas

---

## 7. RIESGOS Y MITIGACIONES

### 7.1 Riesgos Identificados

1. **Falsos positivos en detección de bots**
   - **Riesgo:** Usuarios legítimos bloqueados
   - **Mitigación:** Configuración conservadora de thresholds, whitelist de IPs

2. **Impacto en performance por validación de emails**
   - **Riesgo:** Slowdown en registro de usuarios
   - **Mitigación:** Cache de validaciones, async no-blocking

3. **Complejidad adicional del sistema**
   - **Riesgo:** Mayor dificultad de debugging
   - **Mitigación:** Logging detallado, métricas claras

### 7.2 Plan de Rollback

En caso de problemas críticos:

1. **Desactivar detección de bots** (comentar middleware)
2. **Desactivar validación avanzada** (bypass en authController)
3. **Mantener refresh tokens** (mejoran UX, no afectan seguridad)

---

**Documento preparado por:** Sistema de Análisis Kilo Code  
**Fecha:** 23 de noviembre de 2025  
**Versión:** 1.0  
**Estado:** 📋 LISTO PARA IMPLEMENTACIÓN
