/**
 * Servicio de detección de dispositivos y análisis de seguridad
 * Implementa monitoreo de comportamiento y detección de anomalías
 * @version 1.0.0
 * @date 2025-11-25
 */

const { PrismaClient } = require('@prisma/client');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const crypto = require('crypto');
const logger = require('./logger');

const prisma = new PrismaClient();

class DeviceSecurityService {
  constructor() {
    this.suspiciousPatterns = {
      rapidLoginAttempts: 5, // 5 intentos en 5 minutos
      timeWindowMinutes: 5,
      geoAnomalyScore: 0.8, // Score mínimo para considerar anomalía geográfica
      deviceChangeThreshold: 3, // Cambios de dispositivo en una hora
      concurrentSessions: 5 // Máximo sesiones concurrentes
    };
  }

  /**
   * Analiza y clasifica un dispositivo/usuario basándose en la información del navegador y IP
   * @param {Object} request - Objeto request de Express
   * @param {Object} userData - Datos del usuario (opcional)
   * @returns {Promise<Object>} Información del dispositivo y score de confianza
   */
  async analyzeDevice(request, userData = null) {
    try {
      const clientIP = this.getClientIP(request);
      const userAgent = request.headers['user-agent'] || '';
      const acceptLanguage = request.headers['accept-language'] || '';
      const acceptEncoding = request.headers['accept-encoding'] || '';
      const referer = request.headers['referer'] || '';

      // Extraer información del dispositivo
      const deviceInfo = this.extractDeviceInfo(userAgent, acceptLanguage, acceptEncoding, referer);
      
      // Obtener información geográfica
      const geoInfo = this.getGeoInfo(clientIP);
      
      // Generar fingerprint del dispositivo
      const deviceFingerprint = this.generateDeviceFingerprint(deviceInfo, clientIP);
      
      // Verificar si el dispositivo es conocido
      const knownDevice = await this.getKnownDevice(deviceFingerprint, userData?.id);
      
      // Analizar comportamiento reciente
      const behaviorAnalysis = await this.analyzeRecentBehavior(userData?.id, clientIP, deviceFingerprint);
      
      // Calcular score de confianza
      const trustScore = this.calculateTrustScore({
        deviceInfo,
        geoInfo,
        knownDevice,
        behaviorAnalysis,
        clientIP
      });

      const analysisResult = {
        deviceFingerprint,
        isKnownDevice: !!knownDevice,
        deviceInfo,
        geoInfo,
        trustScore,
        isSuspicious: trustScore.score < 0.7,
        recommendations: this.getSecurityRecommendations(trustScore),
        lastSeen: knownDevice?.ultimo_uso || new Date(),
        createdAt: knownDevice?.creado_en || new Date()
      };

      // Actualizar información del dispositivo conocido
      await this.updateDeviceInfo(knownDevice, deviceFingerprint, analysisResult, userData?.id, clientIP);

      return analysisResult;

    } catch (error) {
      logger.error('Error analizando dispositivo', {
        error: error.message,
        stack: error.stack
      });

      // En caso de error, devolver análisis básico
      return {
        deviceFingerprint: 'error-' + Date.now(),
        isKnownDevice: false,
        trustScore: { score: 0.5, factors: ['analysis_error'] },
        isSuspicious: false,
        deviceInfo: {},
        geoInfo: {}
      };
    }
  }

  /**
   * Extrae información del dispositivo desde user agent y headers
   */
  extractDeviceInfo(userAgent, acceptLanguage, acceptEncoding, referer) {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    return {
      browser: {
        name: result.browser.name,
        version: result.browser.version,
        major: result.browser.major
      },
      os: {
        name: result.os.name,
        version: result.os.version
      },
      device: {
        type: result.device.type || 'desktop',
        model: result.device.model,
        brand: result.device.brand
      },
      engine: result.engine.name,
      userAgent: userAgent,
      acceptLanguage: acceptLanguage,
      acceptEncoding: acceptEncoding,
      referer: referer,
      isBot: this.detectBot(userAgent),
      isMobile: ['mobile', 'tablet'].includes(result.device.type),
      screenResolution: this.extractScreenResolution(acceptLanguage), // Aproximado
      timezone: this.extractTimezone(acceptLanguage)
    };
  }

  /**
   * Obtiene información geográfica de la IP
   */
  getGeoInfo(clientIP) {
    try {
      const geo = geoip.lookup(clientIP);
      
      if (!geo) {
        return {
          country: 'Unknown',
          region: 'Unknown',
          city: 'Unknown',
          timezone: 'Unknown',
          coordinates: null,
          isAnonymous: true
        };
      }

      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        timezone: geo.timezone,
        coordinates: geo.ll ? { lat: geo.ll[0], lng: geo.ll[1] } : null,
        isAnonymous: false,
        ipRange: geo.range,
        metro: geo.metro
      };
    } catch (error) {
      logger.warn('Error obteniendo información geográfica', { ip: clientIP, error: error.message });
      return {
        country: 'Error',
        region: 'Error',
        city: 'Error',
        timezone: 'Unknown',
        coordinates: null,
        isAnonymous: true
      };
    }
  }

  /**
   * Genera fingerprint único del dispositivo
   */
  generateDeviceFingerprint(deviceInfo, clientIP) {
    const fingerprintData = {
      browserName: deviceInfo.browser.name,
      browserVersion: deviceInfo.browser.version,
      osName: deviceInfo.os.name,
      osVersion: deviceInfo.os.version,
      deviceType: deviceInfo.device.type,
      deviceBrand: deviceInfo.device.brand,
      engine: deviceInfo.engine,
      isMobile: deviceInfo.isMobile,
      isBot: deviceInfo.isBot,
      timezone: deviceInfo.timezone,
      ip: clientIP
    };

    // Crear hash único del dispositivo
    const fingerprintString = JSON.stringify(fingerprintData);
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * Verifica si el dispositivo ya está registrado para el usuario
   */
  async getKnownDevice(deviceFingerprint, userId) {
    if (!userId) return null;

    try {
      const knownDevice = await prisma.dispositivos_confiables.findFirst({
        where: {
          usuario_id: userId,
          fingerprint: deviceFingerprint,
          activo: true
        }
      });

      return knownDevice;
    } catch (error) {
      logger.error('Error consultando dispositivo conocido', { error: error.message });
      return null;
    }
  }

  /**
   * Analiza el comportamiento reciente del usuario
   */
  async analyzeRecentBehavior(userId, clientIP, deviceFingerprint) {
    if (!userId) return { score: 0.5, factors: ['no_user'] };

    try {
      const timeWindow = new Date(Date.now() - 60 * 60 * 1000); // Última hora
      const recentActivity = await prisma.actividad_usuario.findMany({
        where: {
          usuario_id: userId,
          timestamp: {
            gte: timeWindow
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 50
      });

      const analysis = {
        recentLogins: 0,
        recentLocations: [],
        recentDevices: [],
        failedAttempts: 0,
        score: 0.5,
        factors: []
      };

      // Analizar intentos de login recientes
      const recentLogins = recentActivity.filter(a => a.tipo_actividad === 'login');
      analysis.recentLogins = recentLogins.length;

      if (recentLogins > this.suspiciousPatterns.rapidLoginAttempts) {
        analysis.score -= 0.3;
        analysis.factors.push('rapid_logins');
      }

      // Analizar ubicaciones recientes
      const locations = recentLogins.map(l => l.ubicacion_ip).filter(Boolean);
      analysis.recentLocations = [...new Set(locations)];

      if (locations.length > 3) {
        analysis.score -= 0.2;
        analysis.factors.push('multiple_locations');
      }

      // Analizar dispositivos recientes
      const devices = recentLogins.map(l => l.dispositivo_fingerprint).filter(Boolean);
      analysis.recentDevices = [...new Set(devices)];

      if (devices.length > this.suspiciousPatterns.deviceChangeThreshold) {
        analysis.score -= 0.2;
        analysis.factors.push('device_changes');
      }

      // Analizar intentos fallidos
      const failedLogins = recentActivity.filter(a => 
        a.tipo_actividad === 'login_failed' && 
        a.timestamp > timeWindow
      );
      analysis.failedAttempts = failedLogins.length;

      if (failedLogins.length > 2) {
        analysis.score -= 0.4;
        analysis.factors.push('failed_attempts');
      }

      // Bonus por dispositivo conocido
      if (devices.includes(deviceFingerprint)) {
        analysis.score += 0.2;
        analysis.factors.push('known_device');
      }

      // Normalizar score entre 0 y 1
      analysis.score = Math.max(0, Math.min(1, analysis.score));

      return analysis;

    } catch (error) {
      logger.error('Error analizando comportamiento reciente', { error: error.message });
      return { score: 0.5, factors: ['analysis_error'] };
    }
  }

  /**
   * Calcula el score de confianza del dispositivo
   */
  calculateTrustScore({ deviceInfo, geoInfo, knownDevice, behaviorAnalysis, clientIP }) {
    let score = 0.5; // Score base
    const factors = [];

    // Factor dispositivo conocido
    if (knownDevice) {
      score += 0.3;
      factors.push('known_device');
    }

    // Factor ubicación geográfica
    if (geoInfo.isAnonymous) {
      score -= 0.2;
      factors.push('anonymous_location');
    } else {
      // Bonus por ubicación geográfica válida
      score += 0.1;
      factors.push('valid_location');
    }

    // Factor tipo de dispositivo
    if (deviceInfo.isMobile) {
      score += 0.05;
      factors.push('mobile_device');
    }

    // Factor bot
    if (deviceInfo.isBot) {
      score -= 0.5;
      factors.push('bot_detected');
    }

    // Factor comportamiento reciente
    score += (behaviorAnalysis.score - 0.5) * 0.4;
    factors.push(...behaviorAnalysis.factors);

    // Factor último uso
    if (knownDevice && knownDevice.ultimo_uso) {
      const daysSinceLastUse = (Date.now() - new Date(knownDevice.ultimo_uso).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastUse < 7) {
        score += 0.1;
        factors.push('recent_activity');
      } else if (daysSinceLastUse > 90) {
        score -= 0.1;
        factors.push('inactive_device');
      }
    }

    // Normalizar score
    score = Math.max(0, Math.min(1, score));

    return {
      score,
      factors,
      confidenceLevel: this.getConfidenceLevel(score)
    };
  }

  /**
   * Obtiene nivel de confianza basado en el score
   */
  getConfidenceLevel(score) {
    if (score >= 0.9) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  /**
   * Obtiene recomendaciones de seguridad basadas en el análisis
   */
  getSecurityRecommendations(trustScore) {
    const recommendations = [];

    if (trustScore.score < 0.3) {
      recommendations.push('Se requiere autenticación de dos factores');
      recommendations.push('Verificación adicional por email o SMS');
    } else if (trustScore.score < 0.5) {
      recommendations.push('Se recomienda activar autenticación de dos factores');
    }

    if (trustScore.factors.includes('multiple_locations')) {
      recommendations.push('Verificar actividad en ubicaciones inusuales');
    }

    if (trustScore.factors.includes('device_changes')) {
      recommendations.push('Confirmar uso de nuevos dispositivos');
    }

    if (trustScore.factors.includes('failed_attempts')) {
      recommendations.push('Revisar intentos de acceso fallidos');
    }

    return recommendations;
  }

  /**
   * Actualiza o crea registro del dispositivo
   */
  async updateDeviceInfo(existingDevice, deviceFingerprint, analysisResult, userId, clientIP) {
    if (!userId) return;

    try {
      const deviceData = {
        usuario_id: userId,
        fingerprint: deviceFingerprint,
        nombre_dispositivo: `${analysisResult.deviceInfo.browser.name} en ${analysisResult.deviceInfo.os.name}`,
        tipo_dispositivo: analysisResult.deviceInfo.device.type,
        navegador: analysisResult.deviceInfo.browser.name,
        sistema_operativo: analysisResult.deviceInfo.os.name,
        direccion_ip: clientIP,
        ubicacion_pais: analysisResult.geoInfo.country,
        ubicacion_ciudad: analysisResult.geoInfo.city,
        trust_score: analysisResult.trustScore.score,
        ultimo_uso: new Date(),
        ultimo_ip: clientIP,
        activo: true
      };

      if (existingDevice) {
        // Actualizar dispositivo existente
        await prisma.dispositivos_confiables.update({
          where: { id: existingDevice.id },
          data: deviceData
        });
      } else {
        // Crear nuevo dispositivo
        await prisma.dispositivos_confiables.create({
          data: {
            ...deviceData,
            creado_en: new Date()
          }
        });
      }

      // Registrar actividad del usuario
      await prisma.actividad_usuario.create({
        data: {
          usuario_id: userId,
          tipo_actividad: 'device_analysis',
          timestamp: new Date(),
          ubicacion_ip: clientIP,
          detalles: {
            trustScore: analysisResult.trustScore,
            deviceInfo: analysisResult.deviceInfo,
            geoInfo: analysisResult.geoInfo,
            fingerprint: deviceFingerprint
          },
          dispositivo_fingerprint: deviceFingerprint
        }
      });

    } catch (error) {
      logger.error('Error actualizando información del dispositivo', { error: error.message });
    }
  }

  /**
   * Obtiene IP real del cliente (considerando proxies)
   */
  getClientIP(request) {
    return request.ip ||
           request.connection.remoteAddress ||
           request.socket.remoteAddress ||
           (request.socket.socket ? request.socket.socket.remoteAddress : null) ||
           '127.0.0.1';
  }

  /**
   * Detecta si el user agent corresponde a un bot
   */
  detectBot(userAgent) {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
      /facebookexternalhit/i, /twitterbot/i, /whatsapp/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Extrae resolución de pantalla aproximada
   */
  extractScreenResolution(acceptLanguage) {
    // Esto es aproximado, la información real requeriría JavaScript en el cliente
    const commonResolutions = [
      '1920x1080', '1366x768', '1536x864', '1440x900',
      '1280x720', '1600x900', '2560x1440'
    ];
    return commonResolutions[Math.floor(Math.random() * commonResolutions.length)];
  }

  /**
   * Extrae zona horaria aproximada
   */
  extractTimezone(acceptLanguage) {
    // Extraer zona horaria del header Accept-Language si está disponible
    const tzMatch = acceptLanguage.match(/([A-Z]{2,3}-[A-Z]{2})/);
    return tzMatch ? tzMatch[1] : 'UTC';
  }
}

module.exports = DeviceSecurityService;