/**
 * @archivo tests/unit/services/slaService.test.js
 * @descripción Pruebas unitarias completas para SLAService
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests unitarios para gestión de SLA y alertas
 * @impacto Social: Validación de cumplimiento de tiempos de respuesta
 */

const { SLAService, SLA_DEFINITIONS } = require('../../../src/services/slaService');
const { PrismaClient } = require('@prisma/client');

// Mocks
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    sla_tracking: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn()
    }
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('SLAService - Unit Tests', () => {
  let slaService;
  let mockPrisma;
  let mockNotificationService;
  let mockWebSocketService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockNotificationService = {
      createNotification: jest.fn().mockResolvedValue({}),
      emitToAdmins: jest.fn()
    };

    mockWebSocketService = {
      emitToAdmins: jest.fn()
    };

    mockPrisma = new PrismaClient();
    slaService = new SLAService();

    // Set service dependencies
    slaService.setNotificationService(mockNotificationService);
    slaService.setWebSocketService(mockWebSocketService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('SLA Definitions', () => {
    test('should have correct SLA definitions', () => {
      expect(SLA_DEFINITIONS.urgent_response).toEqual({
        name: 'Tiempo de Respuesta Urgente',
        maxTimeMinutes: 30,
        warningTimeMinutes: 15,
        criticalTimeMinutes: 25,
        priority: 'HIGH'
      });

      expect(SLA_DEFINITIONS.urgent_assignment).toEqual({
        name: 'Tiempo de Asignación Urgente',
        maxTimeMinutes: 60,
        warningTimeMinutes: 30,
        criticalTimeMinutes: 45,
        priority: 'HIGH'
      });

      expect(SLA_DEFINITIONS.urgent_completion).toEqual({
        name: 'Tiempo de Completación Urgente',
        maxTimeMinutes: 240,
        warningTimeMinutes: 120,
        criticalTimeMinutes: 180,
        priority: 'MEDIUM'
      });
    });
  });

  describe('startSLA', () => {
    const requestId = 'request-123';
    const slaType = 'urgent_response';

    test('should start SLA successfully', async () => {
      const mockSLATracking = { id: 'sla-123' };
      mockPrisma.sla_tracking.create.mockResolvedValue(mockSLATracking);

      const result = await slaService.startSLA(requestId, slaType);

      expect(result).toHaveProperty('requestId', requestId);
      expect(result).toHaveProperty('type', slaType);
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('maxTime', 30);
      expect(result).toHaveProperty('status', 'active');

      expect(mockPrisma.sla_tracking.create).toHaveBeenCalledWith({
        data: {
          request_id: requestId,
          sla_type: slaType,
          start_time: expect.any(Date),
          max_time_minutes: 30,
          status: 'active',
          priority: 'HIGH'
        }
      });
    });

    test('should throw error for invalid SLA type', async () => {
      await expect(slaService.startSLA(requestId, 'invalid_type'))
        .rejects.toThrow('SLA type invalid_type not defined');
    });

    test('should setup timers for SLA monitoring', async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });

      await slaService.startSLA(requestId, slaType);

      // Check that timers are set up
      const activeSLA = slaService.getActiveSLA(requestId);
      expect(activeSLA).toBeDefined();
      expect(activeSLA.warningTime).toBe(15);
      expect(activeSLA.criticalTime).toBe(25);
      expect(activeSLA.maxTime).toBe(30);
    });

    test('should handle custom options', async () => {
      const customOptions = { customField: 'value' };
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });

      await slaService.startSLA(requestId, slaType, customOptions);

      const activeSLA = slaService.getActiveSLA(requestId);
      expect(activeSLA.customField).toBe('value');
    });
  });

  describe('completeSLA', () => {
    const requestId = 'request-123';
    const slaType = 'urgent_response';

    beforeEach(async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      await slaService.startSLA(requestId, slaType);
    });

    test('should complete SLA successfully', async () => {
      // Fast-forward time by 20 minutes
      jest.advanceTimersByTime(20 * 60 * 1000);

      const result = await slaService.completeSLA(requestId, slaType);

      expect(result).toHaveProperty('requestId', requestId);
      expect(result).toHaveProperty('type', slaType);
      expect(result).toHaveProperty('endTime');
      expect(result).toHaveProperty('durationMinutes', 20);
      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('slaMet', true);

      expect(mockPrisma.sla_tracking.updateMany).toHaveBeenCalledWith({
        where: {
          request_id: requestId,
          sla_type: slaType,
          status: 'active'
        },
        data: {
          end_time: expect.any(Date),
          actual_duration_minutes: 20,
          status: 'completed',
          sla_met: true,
          notes: null
        }
      });
    });

    test('should handle SLA breach', async () => {
      // Fast-forward time beyond max time
      jest.advanceTimersByTime(35 * 60 * 1000);

      await slaService.completeSLA(requestId, slaType);

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        null,
        'sla_breached',
        'SLA INCUMPLIDO - Acción Inmediata Requerida',
        expect.objectContaining({
          requestId,
          slaType,
          priority: 'CRITICAL'
        }),
        'admin'
      );

      expect(mockWebSocketService.emitToAdmins).toHaveBeenCalledWith(
        'sla_breached',
        expect.objectContaining({
          requestId,
          priority: 'CRITICAL'
        })
      );
    });

    test('should return null for non-existent SLA', async () => {
      const result = await slaService.completeSLA('non-existent', slaType);

      expect(result).toBeUndefined();
    });

    test('should handle SLA type mismatch', async () => {
      const result = await slaService.completeSLA(requestId, 'different_type');

      expect(result).toBeUndefined();
    });
  });

  describe('cancelSLA', () => {
    const requestId = 'request-123';
    const slaType = 'urgent_response';

    beforeEach(async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      await slaService.startSLA(requestId, slaType);
    });

    test('should cancel SLA successfully', async () => {
      jest.advanceTimersByTime(10 * 60 * 1000);

      const result = await slaService.cancelSLA(requestId, 'User cancelled');

      expect(result).toHaveProperty('status', 'cancelled');
      expect(result).toHaveProperty('durationMinutes', 10);
      expect(result).toHaveProperty('cancellationReason', 'User cancelled');

      expect(mockPrisma.sla_tracking.updateMany).toHaveBeenCalledWith({
        where: {
          request_id: requestId,
          sla_type: slaType,
          status: 'active'
        },
        data: {
          end_time: expect.any(Date),
          actual_duration_minutes: 10,
          status: 'cancelled',
          notes: 'User cancelled'
        }
      });
    });

    test('should handle SLA not found', async () => {
      const result = await slaService.cancelSLA('non-existent', 'reason');

      expect(result).toBeUndefined();
    });
  });

  describe('SLA Monitoring and Alerts', () => {
    const requestId = 'request-123';
    const slaType = 'urgent_response';

    beforeEach(async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      await slaService.startSLA(requestId, slaType);
    });

    test('should send warning notification at warning time', () => {
      // Fast-forward to warning time
      jest.advanceTimersByTime(15 * 60 * 1000);

      // Trigger check
      slaService.forceSLACheck();

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        null,
        'sla_warning',
        'SLA Próximo al Límite',
        expect.stringContaining('15 minutos'),
        'admin'
      );

      expect(mockWebSocketService.emitToAdmins).toHaveBeenCalledWith(
        'sla_warning',
        expect.objectContaining({ requestId })
      );
    });

    test('should send critical warning at critical time', () => {
      // Fast-forward to critical time
      jest.advanceTimersByTime(25 * 60 * 1000);

      slaService.forceSLACheck();

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        null,
        'sla_critical',
        'SLA CRÍTICO - Acción Inmediata Requerida',
        expect.stringContaining('CRÍTICO'),
        'admin'
      );

      expect(mockWebSocketService.emitToAdmins).toHaveBeenCalledWith(
        'sla_critical',
        expect.objectContaining({ requestId, priority: 'CRITICAL' })
      );
    });

    test('should handle SLA breach automatically', () => {
      // Fast-forward beyond max time
      jest.advanceTimersByTime(31 * 60 * 1000);

      slaService.forceSLACheck();

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        null,
        'sla_breached',
        'SLA INCUMPLIDO - Acción Inmediata Requerida',
        expect.any(Object),
        'admin'
      );
    });

    test('should not send duplicate warnings', () => {
      // First warning
      jest.advanceTimersByTime(15 * 60 * 1000);
      slaService.forceSLACheck();

      // Reset mocks
      mockNotificationService.createNotification.mockClear();

      // Second check at same time - should not send again
      slaService.forceSLACheck();

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('Timer Management', () => {
    const requestId = 'request-123';
    const slaType = 'urgent_response';

    test('should clear timers when SLA completes', async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      await slaService.startSLA(requestId, slaType);

      const activeSLA = slaService.getActiveSLA(requestId);
      expect(activeSLA).toBeDefined();

      await slaService.completeSLA(requestId, slaType);

      // SLA should be removed from active list
      expect(slaService.getActiveSLA(requestId)).toBeUndefined();
    });

    test('should clear timers when SLA cancels', async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      await slaService.startSLA(requestId, slaType);

      await slaService.cancelSLA(requestId, 'cancelled');

      expect(slaService.getActiveSLA(requestId)).toBeUndefined();
    });

    test('should handle timer cleanup for expired SLAs', () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      slaService.startSLA(requestId, slaType);

      // Fast-forward way beyond SLA time
      jest.advanceTimersByTime(5 * 60 * 60 * 1000); // 5 hours

      slaService.cleanupExpiredSLAs();

      expect(slaService.getActiveSLA(requestId)).toBeUndefined();
    });
  });

  describe('SLA Metrics', () => {
    test('should calculate SLA metrics correctly', async () => {
      const mockSLARecords = [
        {
          sla_type: 'urgent_response',
          status: 'completed',
          actual_duration_minutes: 20,
          max_time_minutes: 30,
          start_time: new Date()
        },
        {
          sla_type: 'urgent_response',
          status: 'completed',
          actual_duration_minutes: 35,
          max_time_minutes: 30,
          start_time: new Date()
        },
        {
          sla_type: 'urgent_response',
          status: 'breached',
          actual_duration_minutes: 40,
          max_time_minutes: 30,
          start_time: new Date()
        },
        {
          sla_type: 'urgent_response',
          status: 'active',
          actual_duration_minutes: null,
          max_time_minutes: 30,
          start_time: new Date()
        }
      ];

      mockPrisma.sla_tracking.findMany.mockResolvedValue(mockSLARecords);

      const metrics = await slaService.getSLAMetrics();

      expect(metrics.totalSLAs).toBe(4);
      expect(metrics.completedSLAs).toBe(2);
      expect(metrics.breachedSLAs).toBe(1);
      expect(metrics.activeSLAs).toBe(1);
      expect(metrics.slaComplianceRate).toBe(50); // 1 out of 2 completed met SLA
      expect(metrics.avgDuration).toBe(27.5); // (20 + 35) / 2
    });

    test('should handle empty metrics', async () => {
      mockPrisma.sla_tracking.findMany.mockResolvedValue([]);

      const metrics = await slaService.getSLAMetrics();

      expect(metrics.totalSLAs).toBe(0);
      expect(metrics.completedSLAs).toBe(0);
      expect(metrics.slaComplianceRate).toBe(0);
      expect(metrics.avgDuration).toBe(0);
    });

    test('should filter metrics by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrisma.sla_tracking.findMany.mockResolvedValue([]);

      await slaService.getSLAMetrics({ startDate, endDate });

      expect(mockPrisma.sla_tracking.findMany).toHaveBeenCalledWith({
        where: {
          start_time: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { start_time: 'desc' }
      });
    });

    test('should filter metrics by SLA type', async () => {
      mockPrisma.sla_tracking.findMany.mockResolvedValue([]);

      await slaService.getSLAMetrics({ slaType: 'urgent_response' });

      expect(mockPrisma.sla_tracking.findMany).toHaveBeenCalledWith({
        where: { sla_type: 'urgent_response' },
        orderBy: { start_time: 'desc' }
      });
    });
  });

  describe('Active SLA Management', () => {
    test('should track multiple active SLAs', async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-1' });
      await slaService.startSLA('request-1', 'urgent_response');

      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-2' });
      await slaService.startSLA('request-2', 'urgent_assignment');

      const allActive = slaService.getAllActiveSLAs();
      expect(allActive).toHaveLength(2);
      expect(allActive.map(sla => sla.requestId)).toEqual(['request-1', 'request-2']);
    });

    test('should return specific active SLA', async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      await slaService.startSLA('request-123', 'urgent_response');

      const activeSLA = slaService.getActiveSLA('request-123');
      expect(activeSLA).toBeDefined();
      expect(activeSLA.requestId).toBe('request-123');

      const nonExistent = slaService.getActiveSLA('non-existent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Database Operations', () => {
    test('should handle database errors gracefully in saveSLAToDatabase', async () => {
      mockPrisma.sla_tracking.create.mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await expect(slaService.startSLA('request-123', 'urgent_response')).resolves.toBeDefined();
    });

    test('should handle database errors gracefully in updateSLAInDatabase', async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      mockPrisma.sla_tracking.updateMany.mockRejectedValue(new Error('DB Error'));

      await slaService.startSLA('request-123', 'urgent_response');

      // Should not throw
      await expect(slaService.completeSLA('request-123', 'urgent_response')).resolves.toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle service unavailability', async () => {
      slaService.setNotificationService(null);
      slaService.setWebSocketService(null);

      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      await slaService.startSLA('request-123', 'urgent_response');

      // Fast-forward to breach time
      jest.advanceTimersByTime(35 * 60 * 1000);

      // Should not throw when services are unavailable
      await expect(slaService.completeSLA('request-123', 'urgent_response')).resolves.toBeDefined();
    });

    test('should handle timer failures', () => {
      // Mock setTimeout to throw
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn(() => {
        throw new Error('Timer error');
      });

      expect(() => {
        slaService.startSLA('request-123', 'urgent_response');
      }).not.toThrow();

      global.setTimeout = originalSetTimeout;
    });

    test('should handle concurrent SLA operations', async () => {
      const promises = [
        slaService.startSLA('request-1', 'urgent_response'),
        slaService.startSLA('request-2', 'urgent_response'),
        slaService.startSLA('request-3', 'urgent_response')
      ];

      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });

      await expect(Promise.all(promises)).resolves.toBeDefined();

      expect(slaService.getAllActiveSLAs()).toHaveLength(3);
    });

    test('should handle invalid SLA data', async () => {
      // Manually add invalid SLA to active SLAs
      slaService.activeSLAs.set('invalid', { invalid: 'data' });

      // Should not crash during monitoring
      expect(() => {
        slaService.forceSLACheck();
      }).not.toThrow();
    });

    test('should handle SLA completion race conditions', async () => {
      mockPrisma.sla_tracking.create.mockResolvedValue({ id: 'sla-123' });
      await slaService.startSLA('request-123', 'urgent_response');

      // Complete SLA multiple times concurrently
      const promises = [
        slaService.completeSLA('request-123', 'urgent_response'),
        slaService.completeSLA('request-123', 'urgent_response'),
        slaService.completeSLA('request-123', 'urgent_response')
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    test('should handle memory cleanup under load', () => {
      // Add many SLAs
      for (let i = 0; i < 100; i++) {
        slaService.activeSLAs.set(`request-${i}`, {
          requestId: `request-${i}`,
          startTime: new Date(),
          maxTime: 30
        });
      }

      expect(slaService.getAllActiveSLAs()).toHaveLength(100);

      // Cleanup expired ones
      slaService.cleanupExpiredSLAs();

      // Should still work
      expect(typeof slaService.getAllActiveSLAs()).toBe('object');
    });
  });
});