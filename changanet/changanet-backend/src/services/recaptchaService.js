/**
 * Servicio de verificación reCAPTCHA v3
 * Implementa protección avanzada contra bots y spam
 * @version 1.0.0
 * @date 2025-11-25
 */

const axios = require('axios');
const logger = require('./logger');

class RecaptchaService {
  constructor() {
    this.secretKey = process.env.RECAPTCHA_SECRET_KEY;
    this.siteKey = process.env.RECAPTCHA_SITE_KEY;
    this.verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    
    // Configuración de umbrales de seguridad
    this.thresholds = {
      login: 0.5,
      register: 0.7,
      contact: 0.6,
      default: 0.5
    };
  }

  /**
   * Verifica un token reCAPTCHA v3
   * @param {string} recaptchaToken - Token proporcionado por el frontend
   * @param {string} action - Acción realizada (login, register, etc.)
   * @param {string} userAgent - User agent del navegador
   * @param {string} ip - Dirección IP del usuario
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async verifyRecaptcha(recaptchaToken, action, userAgent = null, ip = null) {
    try {
      if (!recaptchaToken) {
        throw new Error('Token reCAPTCHA requerido');
      }

      if (!this.secretKey) {
        logger.warn('RECAPTCHA_SECRET_KEY no configurado', { 
          action, 
          ip: ip || 'unknown' 
        });
        // En desarrollo, permitir bypass si no está configurado
        if (process.env.NODE_ENV === 'development') {
          return { success: true, score: 1.0, action: action || 'unknown' };
        }
        throw new Error('Servicio reCAPTCHA no configurado');
      }

      // Datos para la verificación
      const verificationData = new URLSearchParams({
        secret: this.secretKey,
        response: recaptchaToken,
        remoteip: ip || '',
      });

      // Realizar verificación con Google
      const response = await axios.post(this.verifyUrl, verificationData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000, // 10 segundos timeout
      });

      const data = response.data;

      // Log del resultado para auditoría
      logger.info('reCAPTCHA verification result', {
        success: data.success,
        score: data.score,
        action: data.action,
        challenge_ts: data.challenge_ts,
        hostname: data.hostname,
        ip: ip || 'unknown',
        userAgent: userAgent || 'unknown',
        actionRequested: action
      });

      if (!data.success) {
        logger.warn('reCAPTCHA verification failed', {
          'error-codes': data['error-codes'] || [],
          action: action || 'unknown',
          ip: ip || 'unknown'
        });
        
        return {
          success: false,
          error: 'Verificación reCAPTCHA fallida',
          errorCodes: data['error-codes'] || [],
          action: action || 'unknown'
        };
      }

      // Verificar que la acción coincida
      if (data.action && action && data.action !== action) {
        logger.warn('reCAPTCHA action mismatch', {
          expected: action,
          received: data.action,
          ip: ip || 'unknown'
        });
        
        return {
          success: false,
          error: 'Acción reCAPTCHA inválida',
          expectedAction: action,
          receivedAction: data.action
        };
      }

      // Verificar el score mínimo para la acción
      const threshold = this.thresholds[action] || this.thresholds.default;
      if (data.score < threshold) {
        logger.warn('reCAPTCHA score too low', {
          score: data.score,
          threshold: threshold,
          action: action || 'unknown',
          ip: ip || 'unknown'
        });

        return {
          success: false,
          error: `Score de verificación insuficiente (${data.score}/${threshold})`,
          score: data.score,
          threshold: threshold,
          action: action || 'unknown'
        };
      }

      // Verificar timestamp del challenge (opcional)
      if (data.challenge_ts) {
        const challengeTime = new Date(data.challenge_ts);
        const now = new Date();
        const timeDiff = now.getTime() - challengeTime.getTime();
        
        // Si el challenge es muy antiguo (más de 2 minutos), rechazarlo
        if (timeDiff > 2 * 60 * 1000) {
          logger.warn('reCAPTCHA challenge too old', {
            challengeTime: data.challenge_ts,
            timeDiff: timeDiff,
            ip: ip || 'unknown'
          });

          return {
            success: false,
            error: 'Verificación expirada',
            challengeTime: data.challenge_ts
          };
        }
      }

      // Verificar hostname si está disponible
      if (data.hostname) {
        const allowedHosts = this.getAllowedHosts();
        if (allowedHosts.length > 0 && !allowedHosts.includes(data.hostname)) {
          logger.warn('reCAPTCHA hostname not allowed', {
            hostname: data.hostname,
            allowedHosts: allowedHosts,
            ip: ip || 'unknown'
          });

          return {
            success: false,
            error: 'Host no autorizado',
            hostname: data.hostname
          };
        }
      }

      return {
        success: true,
        score: data.score,
        action: data.action || action || 'unknown',
        challenge_ts: data.challenge_ts,
        hostname: data.hostname
      };

    } catch (error) {
      logger.error('Error verificando reCAPTCHA', {
        error: error.message,
        stack: error.stack,
        action: action || 'unknown',
        ip: ip || 'unknown'
      });

      return {
        success: false,
        error: 'Error en verificación reCAPTCHA',
        message: error.message
      };
    }
  }

  /**
   * Middleware para verificar reCAPTCHA
   * @param {string} action - Acción que se está realizando
   * @returns {Function} Middleware function
   */
  static verifyMiddleware(action) {
    return async (req, res, next) => {
      try {
        const recaptchaToken = req.body.recaptchaToken || req.headers['x-recaptcha-token'];
        const userAgent = req.headers['user-agent'];
        const ip = req.ip || req.connection.remoteAddress;

        if (!recaptchaToken) {
          logger.warn('reCAPTCHA token missing', {
            action,
            ip,
            userAgent
          });

          return res.status(400).json({
            error: 'Token de verificación requerido',
            code: 'RECAPTCHA_TOKEN_MISSING'
          });
        }

        const recaptchaService = new RecaptchaService();
        const result = await recaptchaService.verifyRecaptcha(recaptchaToken, action, userAgent, ip);

        if (!result.success) {
          return res.status(429).json({
            error: result.error,
            code: 'RECAPTCHA_VERIFICATION_FAILED',
            score: result.score || 0,
            threshold: recaptchaService.thresholds[action] || recaptchaService.thresholds.default
          });
        }

        // Agregar información de verificación al request
        req.recaptchaVerified = true;
        req.recaptchaScore = result.score;
        req.recaptchaAction = result.action;

        next();

      } catch (error) {
        logger.error('Error en middleware reCAPTCHA', {
          error: error.message,
          action: action || 'unknown'
        });

        return res.status(500).json({
          error: 'Error en verificación de seguridad',
          code: 'RECAPTCHA_ERROR'
        });
      }
    };
  }

  /**
   * Obtiene los hosts permitidos para reCAPTCHA
   * @returns {Array} Lista de hosts permitidos
   */
  getAllowedHosts() {
    const allowedHosts = [];
    
    // Host del frontend
    if (process.env.FRONTEND_URL) {
      try {
        const frontendUrl = new URL(process.env.FRONTEND_URL);
        allowedHosts.push(frontendUrl.hostname);
      } catch (error) {
        logger.warn('FRONTEND_URL malformado', { url: process.env.FRONTEND_URL });
      }
    }

    // Agregar localhost para desarrollo
    if (process.env.NODE_ENV === 'development') {
      allowedHosts.push('localhost');
      allowedHosts.push('127.0.0.1');
    }

    // Hosts adicionales desde variables de entorno
    if (process.env.RECAPTCHA_ALLOWED_HOSTS) {
      const additionalHosts = process.env.RECAPTCHA_ALLOWED_HOSTS.split(',').map(host => host.trim());
      allowedHosts.push(...additionalHosts);
    }

    return [...new Set(allowedHosts)]; // Eliminar duplicados
  }

  /**
   * Genera configuración para el frontend
   * @returns {Object} Configuración reCAPTCHA
   */
  getFrontendConfig() {
    return {
      enabled: !!this.siteKey,
      siteKey: this.siteKey,
      version: 'v3',
      action: {
        login: 'login',
        register: 'register',
        contact: 'contact',
        forgotPassword: 'forgot_password'
      },
      thresholds: this.thresholds
    };
  }
}

module.exports = RecaptchaService;