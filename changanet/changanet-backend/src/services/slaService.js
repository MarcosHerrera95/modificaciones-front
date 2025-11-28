/**
 * @archivo src/services/slaService.js - Servicio de Gestión de SLA para Servicios Urgentes
 * @descripción Seguimiento y gestión de acuerdos de nivel de servicio para urgencias
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación de SLA para garantizar tiempos de respuesta en emergencias
 * @impacto Social: Garantía de respuesta oportuna en situaciones críticas
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Referencias a otros servicios
let notificationService = null;
let webSocketService = null;

function setNotificationService(service) {
  notificationService = service;
}

function setWebSocketService(service) {
  webSocketService = service;
}

// Definición de SLA por tipo de servicio urgente
const SLA_DEFINITIONS = {
  urgent_response: {
    name: 'Tiempo de Respuesta Urgente',
    maxTimeMinutes: 30, // 30 minutos para primera respuesta
    warningTimeMinutes: 15, // Advertencia a los 15 minutos
    criticalTimeMinutes: 25, // Crítico a los 25 minutos
    priority: 'HIGH'
  },
  urgent_assignment: {
    name: 'Tiempo de Asignación Urgente',
    maxTimeMinutes: 60, // 1 hora para asignación completa
    warningTimeMinutes: 30,
    criticalTimeMinutes: 45,
    priority: 'HIGH'
  },
  urgent_completion: {
    name: 'Tiempo de Completación Urgente',
    maxTimeMinutes: 240, // 4 horas para completación
    warningTimeMinutes: 120,
    criticalTimeMinutes: 180,
    priority: 'MEDIUM'
  }
};

class SLAService {
  constructor() {
    this.activeSLAs = new Map(); // requestId -> SLA data
    this.slaTimers = new Map(); // requestId -> timer IDs
    this.initializeSLAMonitoring();
  }

  /**
   * Inicializar monitoreo de SLA
   */
  initializeSLAMonitoring() {
    // Verificar SLA cada minuto
    setInterval(() => {
      this.checkActiveSLAs();
    }, 60 * 1000);

    console.log('⏱️ SLA Monitoring initialized');
  }

  /**
   * Iniciar SLA para una solicitud urgente
   * @param {string} requestId - ID de la solicitud
   * @param {string} slaType - Tipo de SLA
   * @param {Object} options - Opciones adicionales
   */
  async startSLA(requestId, slaType, options = {}) {
    try {
      const slaDefinition = SLA_DEFINITIONS[slaType];
      if (!slaDefinition) {
        console.error(`SLA type ${slaType} not defined`);
        return;
      }

      const startTime = new Date();
      const slaData = {
        requestId,
        type: slaType,
        startTime,
        maxTime: slaDefinition.maxTimeMinutes,
        warningTime: slaDefinition.warningTimeMinutes,
        criticalTime: slaDefinition.criticalTimeMinutes,
        status: 'active',
        priority: slaDefinition.priority,
        ...options
      };

      // Guardar en base de datos
      await this.saveSLAToDatabase(slaData);

      // Guardar en memoria
      this.activeSLAs.set(requestId, slaData);

      // Configurar timers para advertencias
      this.setupSLATimers(requestId, slaData);

      console.log(`⏱️ SLA started for request ${requestId}: ${slaDefinition.name} (${slaDefinition.maxTimeMinutes}min)`);

      return slaData;

    } catch (error) {
      console.error('Error starting SLA:', error);
      throw error;
    }
  }

  /**
   * Completar SLA
   * @param {string} requestId - ID de la solicitud
   * @param {string} slaType - Tipo de SLA
   * @param {Object} completionData - Datos de completación
   */
  async completeSLA(requestId, slaType, completionData = {}) {
    try {
      const slaData = this.activeSLAs.get(requestId);
      if (!slaData || slaData.type !== slaType) {
        return;
      }

      const endTime = new Date();
      const durationMinutes = (endTime - slaData.startTime) / (1000 * 60);
      const slaMet = durationMinutes <= slaData.maxTime;

      // Actualizar SLA
      const updatedSLA = {
        ...slaData,
        endTime,
        durationMinutes: Math.round(durationMinutes * 100) / 100,
        status: 'completed',
        slaMet,
        ...completionData
      };

      // Guardar en base de datos
      await this.updateSLAInDatabase(updatedSLA);

      // Limpiar timers y memoria
      this.clearSLATimers(requestId);
      this.activeSLAs.delete(requestId);

      // Notificar si SLA no se cumplió
      if (!slaMet) {
        await this.notifySLABreach(updatedSLA);
      }

      console.log(`✅ SLA completed for request ${requestId}: ${slaMet ? 'MET' : 'BREACHED'} (${durationMinutes.toFixed(1)}min)`);

      return updatedSLA;

    } catch (error) {
      console.error('Error completing SLA:', error);
      throw error;
    }
  }

  /**
   * Cancelar SLA
   * @param {string} requestId - ID de la solicitud
   * @param {string} reason - Razón de cancelación
   */
  async cancelSLA(requestId, reason = 'Request cancelled') {
    try {
      const slaData = this.activeSLAs.get(requestId);
      if (!slaData) {
        return;
      }

      const endTime = new Date();
      const durationMinutes = (endTime - slaData.startTime) / (1000 * 60);

      const cancelledSLA = {
        ...slaData,
        endTime,
        durationMinutes: Math.round(durationMinutes * 100) / 100,
        status: 'cancelled',
        cancellationReason: reason
      };

      // Guardar en base de datos
      await this.updateSLAInDatabase(cancelledSLA);

      // Limpiar timers y memoria
      this.clearSLATimers(requestId);
      this.activeSLAs.delete(requestId);

      console.log(`❌ SLA cancelled for request ${requestId}: ${reason}`);

      return cancelledSLA;

    } catch (error) {
      console.error('Error cancelling SLA:', error);
      throw error;
    }
  }

  /**
   * Verificar SLA activos y enviar advertencias
   */
  async checkActiveSLAs() {
    try {
      const now = new Date();

      for (const [requestId, slaData] of this.activeSLAs) {
        const elapsedMinutes = (now - slaData.startTime) / (1000 * 60);

        // Verificar si está cerca del límite
        if (elapsedMinutes >= slaData.criticalTime && !slaData.criticalWarningSent) {
          await this.sendCriticalSLAWarning(slaData);
          slaData.criticalWarningSent = true;
        } else if (elapsedMinutes >= slaData.warningTime && !slaData.warningSent) {
          await this.sendSLAWarning(slaData);
          slaData.warningSent = true;
        }

        // Verificar si excedió el tiempo máximo
        if (elapsedMinutes > slaData.maxTime && slaData.status === 'active') {
          await this.handleSLABreach(slaData);
        }
      }
    } catch (error) {
      console.error('Error checking active SLAs:', error);
    }
  }

  /**
   * Configurar timers para SLA
   * @param {string} requestId - ID de la solicitud
   * @param {Object} slaData - Datos del SLA
   */
  setupSLATimers(requestId, slaData) {
    const timers = {};

    // Timer para advertencia
    if (slaData.warningTime) {
      timers.warning = setTimeout(async () => {
        await this.sendSLAWarning(slaData);
        slaData.warningSent = true;
      }, slaData.warningTime * 60 * 1000);
    }

    // Timer para advertencia crítica
    if (slaData.criticalTime) {
      timers.critical = setTimeout(async () => {
        await this.sendCriticalSLAWarning(slaData);
        slaData.criticalWarningSent = true;
      }, slaData.criticalTime * 60 * 1000);
    }

    // Timer para breach
    if (slaData.maxTime) {
      timers.breach = setTimeout(async () => {
        await this.handleSLABreach(slaData);
      }, slaData.maxTime * 60 * 1000);
    }

    this.slaTimers.set(requestId, timers);
  }

  /**
   * Limpiar timers de SLA
   * @param {string} requestId - ID de la solicitud
   */
  clearSLATimers(requestId) {
    const timers = this.slaTimers.get(requestId);
    if (timers) {
      Object.values(timers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      this.slaTimers.delete(requestId);
    }
  }

  /**
   * Enviar advertencia de SLA
   * @param {Object} slaData - Datos del SLA
   */
  async sendSLAWarning(slaData) {
    try {
      console.warn(`⚠️ SLA WARNING: ${slaData.type} for request ${slaData.requestId} approaching limit`);

      // Notificar administradores
      if (notificationService) {
        await notificationService.createNotification(
          null, // Broadcast to admins
          'sla_warning',
          `SLA Próximo al Límite`,
          `El SLA de ${SLA_DEFINITIONS[slaData.type].name} para la solicitud ${slaData.requestId} está próximo a vencerse.`,
          {
            requestId: slaData.requestId,
            slaType: slaData.type,
            elapsedMinutes: Math.round((new Date() - slaData.startTime) / (1000 * 60)),
            maxTime: slaData.maxTime
          },
          'admin' // Solo para administradores
        );
      }

      // WebSocket para admins conectados
      if (webSocketService) {
        webSocketService.emitToAdmins('sla_warning', {
          requestId: slaData.requestId,
          slaType: slaData.type,
          message: `SLA approaching limit: ${slaData.maxTime - Math.round((new Date() - slaData.startTime) / (1000 * 60))} minutes remaining`
        });
      }

    } catch (error) {
      console.error('Error sending SLA warning:', error);
    }
  }

  /**
   * Enviar advertencia crítica de SLA
   * @param {Object} slaData - Datos del SLA
   */
  async sendCriticalSLAWarning(slaData) {
    try {
      console.error(`🚨 SLA CRITICAL WARNING: ${slaData.type} for request ${slaData.requestId} critically close to breach`);

      // Notificar administradores con mayor urgencia
      if (notificationService) {
        await notificationService.createNotification(
          null,
          'sla_critical',
          `SLA CRÍTICO - Acción Inmediata Requerida`,
          `¡CRÍTICO! El SLA de ${SLA_DEFINITIONS[slaData.type].name} para la solicitud ${slaData.requestId} está a punto de vencerse.`,
          {
            requestId: slaData.requestId,
            slaType: slaData.type,
            elapsedMinutes: Math.round((new Date() - slaData.startTime) / (1000 * 60)),
            maxTime: slaData.maxTime,
            priority: 'CRITICAL'
          },
          'admin'
        );
      }

      // WebSocket con mayor énfasis
      if (webSocketService) {
        webSocketService.emitToAdmins('sla_critical', {
          requestId: slaData.requestId,
          slaType: slaData.type,
          message: `CRITICAL: SLA breach imminent - ${slaData.maxTime - Math.round((new Date() - slaData.startTime) / (1000 * 60))} minutes remaining`,
          priority: 'CRITICAL'
        });
      }

    } catch (error) {
      console.error('Error sending critical SLA warning:', error);
    }
  }

  /**
   * Manejar breach de SLA
   * @param {Object} slaData - Datos del SLA
   */
  async handleSLABreach(slaData) {
    try {
      console.error(`💥 SLA BREACH: ${slaData.type} for request ${slaData.requestId} has been breached`);

      const breachData = {
        ...slaData,
        breachTime: new Date(),
        breachDuration: Math.round((new Date() - slaData.startTime) / (1000 * 60)),
        status: 'breached'
      };

      // Actualizar en base de datos
      await this.updateSLAInDatabase(breachData);

      // Notificar breach
      await this.notifySLABreach(breachData);

      // Marcar como breached en memoria
      slaData.status = 'breached';

    } catch (error) {
      console.error('Error handling SLA breach:', error);
    }
  }

  /**
   * Notificar breach de SLA
   * @param {Object} slaData - Datos del SLA
   */
  async notifySLABreach(slaData) {
    try {
      // Notificar administradores
      if (notificationService) {
        await notificationService.createNotification(
          null,
          'sla_breached',
          `SLA INCUMPLIDO - Acción Inmediata Requerida`,
          `¡INCUMPLIMIENTO! El SLA de ${SLA_DEFINITIONS[slaData.type].name} para la solicitud ${slaData.requestId} ha sido violado.`,
          {
            requestId: slaData.requestId,
            slaType: slaData.type,
            breachDuration: slaData.breachDuration || slaData.durationMinutes,
            maxTime: slaData.maxTime,
            priority: 'CRITICAL'
          },
          'admin'
        );
      }

      // WebSocket
      if (webSocketService) {
        webSocketService.emitToAdmins('sla_breached', {
          requestId: slaData.requestId,
          slaType: slaData.type,
          message: `SLA BREACHED: ${slaData.breachDuration || slaData.durationMinutes} minutes over limit`,
          priority: 'CRITICAL'
        });
      }

      // Podría implementar acciones automáticas como:
      // - Escalada automática
      // - Bonificaciones al cliente
      // - Penalizaciones al profesional
      // - Reasignación automática

    } catch (error) {
      console.error('Error notifying SLA breach:', error);
    }
  }

  /**
   * Guardar SLA en base de datos
   * @param {Object} slaData - Datos del SLA
   */
  async saveSLAToDatabase(slaData) {
    try {
      // Crear tabla sla_tracking si no existe, o usar una tabla existente
      // Por ahora, usaremos una tabla genérica o logs
      await prisma.sla_tracking.create({
        data: {
          request_id: slaData.requestId,
          sla_type: slaData.type,
          start_time: slaData.startTime,
          max_time_minutes: slaData.maxTime,
          status: slaData.status,
          priority: slaData.priority
        }
      });
    } catch (error) {
      // Si la tabla no existe, loggear pero continuar
      console.warn('SLA tracking table not available:', error.message);
    }
  }

  /**
   * Actualizar SLA en base de datos
   * @param {Object} slaData - Datos del SLA
   */
  async updateSLAInDatabase(slaData) {
    try {
      await prisma.sla_tracking.updateMany({
        where: {
          request_id: slaData.requestId,
          sla_type: slaData.slaType || slaData.type,
          status: 'active'
        },
        data: {
          end_time: slaData.endTime,
          actual_duration_minutes: slaData.durationMinutes,
          status: slaData.status,
          sla_met: slaData.slaMet,
          notes: slaData.cancellationReason || null
        }
      });
    } catch (error) {
      console.warn('Error updating SLA in database:', error.message);
    }
  }

  /**
   * Obtener métricas de SLA
   * @param {Object} filters - Filtros
   * @returns {Object} Métricas de SLA
   */
  async getSLAMetrics(filters = {}) {
    const { startDate, endDate, slaType } = filters;

    try {
      const where = {};
      if (startDate || endDate) {
        where.start_time = {};
        if (startDate) where.start_time.gte = new Date(startDate);
        if (endDate) where.start_time.lte = new Date(endDate);
      }
      if (slaType) where.sla_type = slaType;

      const slaRecords = await prisma.sla_tracking.findMany({
        where,
        orderBy: { start_time: 'desc' }
      });

      const metrics = {
        totalSLAs: slaRecords.length,
        completedSLAs: 0,
        breachedSLAs: 0,
        activeSLAs: 0,
        avgDuration: 0,
        slaComplianceRate: 0,
        byType: {}
      };

      let totalDuration = 0;
      let metSLAs = 0;

      for (const record of slaRecords) {
        if (record.status === 'completed') {
          metrics.completedSLAs++;
          if (record.actual_duration_minutes <= record.max_time_minutes) {
            metSLAs++;
          }
        } else if (record.status === 'breached') {
          metrics.breachedSLAs++;
        } else if (record.status === 'active') {
          metrics.activeSLAs++;
        }

        if (record.actual_duration_minutes) {
          totalDuration += record.actual_duration_minutes;
        }

        // Métricas por tipo
        if (!metrics.byType[record.sla_type]) {
          metrics.byType[record.sla_type] = {
            total: 0,
            met: 0,
            breached: 0,
            avgDuration: 0
          };
        }

        metrics.byType[record.sla_type].total++;
        if (record.status === 'completed' && record.actual_duration_minutes <= record.max_time_minutes) {
          metrics.byType[record.sla_type].met++;
        } else if (record.status === 'breached') {
          metrics.byType[record.sla_type].breached++;
        }
      }

      metrics.slaComplianceRate = metrics.completedSLAs > 0 ? (metSLAs / metrics.completedSLAs) * 100 : 0;
      metrics.avgDuration = metrics.completedSLAs > 0 ? totalDuration / metrics.completedSLAs : 0;

      return metrics;

    } catch (error) {
      console.error('Error getting SLA metrics:', error);
      return {};
    }
  }

  /**
   * Obtener SLA activo para una solicitud
   * @param {string} requestId - ID de la solicitud
   * @returns {Object} Datos del SLA activo
   */
  getActiveSLA(requestId) {
    return this.activeSLAs.get(requestId);
  }

  /**
   * Obtener todos los SLA activos
   * @returns {Array} Lista de SLA activos
   */
  getAllActiveSLAs() {
    return Array.from(this.activeSLAs.values());
  }

  /**
   * Forzar verificación inmediata de SLA
   */
  forceSLACheck() {
    this.checkActiveSLAs();
  }

  /**
   * Limpiar SLA expirados o completados
   */
  cleanupExpiredSLAs() {
    const now = new Date();
    const expiredIds = [];

    for (const [requestId, slaData] of this.activeSLAs) {
      const elapsedMinutes = (now - slaData.startTime) / (1000 * 60);

      // Considerar expirado si lleva más de 2 veces el tiempo máximo
      if (elapsedMinutes > slaData.maxTime * 2) {
        expiredIds.push(requestId);
      }
    }

    expiredIds.forEach(requestId => {
      this.clearSLATimers(requestId);
      this.activeSLAs.delete(requestId);
    });

    if (expiredIds.length > 0) {
      console.log(`🧹 Cleaned up ${expiredIds.length} expired SLAs`);
    }
  }
}

module.exports = {
  SLAService,
  SLA_DEFINITIONS,
  setNotificationService,
  setWebSocketService
};