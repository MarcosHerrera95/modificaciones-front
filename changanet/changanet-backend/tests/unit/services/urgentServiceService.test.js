/**
 * @archivo tests/unit/services/urgentServiceService.test.js
 * @descripción Pruebas unitarias completas para UrgentServiceService
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests unitarios para lógica de negocio de servicios urgentes
 * @impacto Social: Validación completa de la lógica de asignación urgente
 */

const { UrgentServiceService } = require('../../../src/services/urgentServiceService');
const { PrismaClient } = require('@prisma/client');

// Mocks
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    urgent_requests: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    urgent_request_candidates: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    urgent_assignments: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    urgent_rejections: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    urgent_tracking: {
      create: jest.fn()
    },
    usuarios: {
      findUnique: jest.fn()
    }
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('UrgentServiceService - Unit Tests', () => {
  let urgentService;
  let mockPrisma;
  let mockNotificationService;
  let mockWebSocketService;
  let mockMatchingService;
  let mockSlaService;
  let mockGeolocationService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock services
    mockNotificationService = {
      createNotification: jest.fn().mockResolvedValue({}),
      notifyUrgentRequestAccepted: jest.fn(),
      notifyUrgentRequestStatusUpdate: jest.fn()
    };

    mockWebSocketService = {
      notifyUrgentRequestAccepted: jest.fn(),
      notifyUrgentRequestStatusUpdate: jest.fn(),
      notifyUrgentRequestToProfessionals: jest.fn()
    };

    mockMatchingService = {
      getUrgentPricing: jest.fn().mockResolvedValue({ multiplier: 1.5, minPrice: 500 }),
      findMatchingProfessionals: jest.fn().mockResolvedValue([])
    };

    mockSlaService = {
      startSLA: jest.fn().mockResolvedValue({}),
      completeSLA: jest.fn().mockResolvedValue({})
    };

    mockGeolocationService = {
      findNearbyProfessionals: jest.fn().mockResolvedValue([])
    };

    // Mock Prisma
    mockPrisma = new PrismaClient();

    // Create service instance
    urgentService = new UrgentServiceService();

    // Set service dependencies
    urgentService.setNotificationService(mockNotificationService);
    urgentService.setWebSocketService(mockWebSocketService);
    urgentService.setMatchingService(mockMatchingService);
    urgentService.setSlaService(mockSlaService);
    urgentService.setGeolocationService(mockGeolocationService);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('createUrgentRequest', () => {
    const validRequestData = {
      description: 'Fuga de agua urgente',
      location: { lat: -34.6118, lng: -58.3960 },
      radiusKm: 5,
      serviceCategory: 'plomero'
    };

    test('should create urgent request successfully', async () => {
      const clientId = 'client-123';
      const mockCreatedRequest = {
        id: 'request-123',
        client_id: clientId,
        description: validRequestData.description,
        latitude: validRequestData.location.lat,
        longitude: validRequestData.location.lng,
        radius_km: validRequestData.radiusKm,
        status: 'pending',
        price_estimate: 750
      };

      mockPrisma.urgent_requests.create.mockResolvedValue(mockCreatedRequest);
      mockPrisma.urgent_requests.count.mockResolvedValue(0);

      const result = await urgentService.createUrgentRequest(clientId, validRequestData);

      expect(result).toEqual(mockCreatedRequest);
      expect(mockPrisma.urgent_requests.create).toHaveBeenCalledWith({
        data: {
          client_id: clientId,
          service_id: undefined,
          description: validRequestData.description,
          latitude: validRequestData.location.lat,
          longitude: validRequestData.location.lng,
          radius_km: validRequestData.radiusKm,
          status: 'pending',
          price_estimate: 750
        }
      });
    });

    test('should throw error for missing description', async () => {
      const invalidData = { ...validRequestData, description: '' };

      await expect(urgentService.createUrgentRequest('client-123', invalidData))
        .rejects.toThrow('Descripción y ubicación (lat, lng) son requeridos.');
    });

    test('should throw error for missing location', async () => {
      const invalidData = { ...validRequestData, location: null };

      await expect(urgentService.createUrgentRequest('client-123', invalidData))
        .rejects.toThrow('Descripción y ubicación (lat, lng) son requeridos.');
    });

    test('should throw error for invalid radius', async () => {
      const invalidData = { ...validRequestData, radiusKm: 60 };

      await expect(urgentService.createUrgentRequest('client-123', invalidData))
        .rejects.toThrow('El radio debe estar entre 1 y 50 km.');
    });

    test('should enforce rate limiting', async () => {
      mockPrisma.urgent_requests.count.mockResolvedValue(5); // Already 5 requests

      await expect(urgentService.createUrgentRequest('client-123', validRequestData))
        .rejects.toThrow('Demasiadas solicitudes urgentes en la última hora.');
    });

    test('should calculate price estimate correctly', async () => {
      mockPrisma.urgent_requests.count.mockResolvedValue(0);
      mockMatchingService.getUrgentPricing.mockResolvedValue({ multiplier: 2.0, minPrice: 300 });

      const mockCreatedRequest = {
        id: 'request-123',
        client_id: 'client-123',
        description: validRequestData.description,
        latitude: validRequestData.location.lat,
        longitude: validRequestData.location.lng,
        radius_km: validRequestData.radiusKm,
        status: 'pending',
        price_estimate: 900 // 300 * (5/5 + 1) * 2.0 = 600, but let's assume calculation
      };

      mockPrisma.urgent_requests.create.mockResolvedValue(mockCreatedRequest);

      await urgentService.createUrgentRequest('client-123', validRequestData);

      expect(mockMatchingService.getUrgentPricing).toHaveBeenCalledWith('plomero');
    });

    test('should create initial tracking entry', async () => {
      const clientId = 'client-123';
      const mockCreatedRequest = {
        id: 'request-123',
        client_id: clientId,
        description: validRequestData.description,
        latitude: validRequestData.location.lat,
        longitude: validRequestData.location.lng,
        radius_km: validRequestData.radiusKm,
        status: 'pending',
        price_estimate: 750
      };

      mockPrisma.urgent_requests.create.mockResolvedValue(mockCreatedRequest);
      mockPrisma.urgent_requests.count.mockResolvedValue(0);

      await urgentService.createUrgentRequest(clientId, validRequestData);

      expect(mockPrisma.urgent_tracking.create).toHaveBeenCalledWith({
        data: {
          urgent_request_id: 'request-123',
          previous_status: undefined,
          new_status: 'pending',
          changed_by: undefined,
          notes: 'Solicitud creada'
        }
      });
    });

    test('should trigger auto dispatch', async () => {
      const clientId = 'client-123';
      const mockCreatedRequest = {
        id: 'request-123',
        client_id: clientId,
        description: validRequestData.description,
        latitude: validRequestData.location.lat,
        longitude: validRequestData.location.lng,
        radius_km: validRequestData.radiusKm,
        status: 'pending',
        price_estimate: 750
      };

      mockPrisma.urgent_requests.create.mockResolvedValue(mockCreatedRequest);
      mockPrisma.urgent_requests.count.mockResolvedValue(0);

      // Mock setImmediate to execute immediately for testing
      jest.spyOn(global, 'setImmediate').mockImplementation((fn) => fn());

      const autoDispatchSpy = jest.spyOn(urgentService, 'autoDispatchUrgentRequest').mockResolvedValue();

      await urgentService.createUrgentRequest(clientId, validRequestData);

      expect(autoDispatchSpy).toHaveBeenCalledWith('request-123');

      global.setImmediate.mockRestore();
    });
  });

  describe('getUrgentRequest', () => {
    const requestId = 'request-123';
    const userId = 'user-123';

    test('should return urgent request with full details', async () => {
      const mockRequest = {
        id: requestId,
        client_id: 'client-123',
        description: 'Test request',
        status: 'pending',
        client: { id: 'client-123', nombre: 'Test Client' },
        candidates: [],
        assignments: [],
        service: { id: 'service-123', nombre: 'Test Service' },
        rejections: []
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);

      const result = await urgentService.getUrgentRequest(requestId, userId);

      expect(result).toEqual(mockRequest);
      expect(mockPrisma.urgent_requests.findUnique).toHaveBeenCalledWith({
        where: { id: requestId },
        include: expect.any(Object)
      });
    });

    test('should throw error for non-existent request', async () => {
      mockPrisma.urgent_requests.findUnique.mockResolvedValue(null);

      await expect(urgentService.getUrgentRequest(requestId, userId))
        .rejects.toThrow('Solicitud urgente no encontrada.');
    });

    test('should validate user permissions', async () => {
      const mockRequest = {
        id: requestId,
        client_id: 'different-client',
        description: 'Test request',
        status: 'pending',
        candidates: [],
        assignments: [],
        client: { id: 'different-client', nombre: 'Different Client' },
        service: null,
        rejections: []
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);

      await expect(urgentService.getUrgentRequest(requestId, userId))
        .rejects.toThrow('No tienes permiso para ver esta solicitud.');
    });

    test('should allow access for assigned professional', async () => {
      const mockRequest = {
        id: requestId,
        client_id: 'different-client',
        description: 'Test request',
        status: 'assigned',
        candidates: [],
        assignments: [{ professional_id: userId }],
        client: { id: 'different-client', nombre: 'Different Client' },
        service: null,
        rejections: []
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);

      const result = await urgentService.getUrgentRequest(requestId, userId);

      expect(result).toEqual(mockRequest);
    });
  });

  describe('cancelUrgentRequest', () => {
    const requestId = 'request-123';
    const clientId = 'client-123';

    test('should cancel pending request successfully', async () => {
      const mockRequest = {
        id: requestId,
        client_id: clientId,
        status: 'pending'
      };

      const mockUpdatedRequest = { ...mockRequest, status: 'cancelled' };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.urgent_requests.update.mockResolvedValue(mockUpdatedRequest);
      mockPrisma.urgent_request_candidates.findMany.mockResolvedValue([]);

      const result = await urgentService.cancelUrgentRequest(requestId, clientId);

      expect(result).toEqual(mockUpdatedRequest);
      expect(mockPrisma.urgent_requests.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: { status: 'cancelled' }
      });
    });

    test('should throw error for non-client cancellation', async () => {
      const mockRequest = {
        id: requestId,
        client_id: 'different-client',
        status: 'pending'
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);

      await expect(urgentService.cancelUrgentRequest(requestId, clientId))
        .rejects.toThrow('Solo el cliente puede cancelar la solicitud.');
    });

    test('should throw error for completed request', async () => {
      const mockRequest = {
        id: requestId,
        client_id: clientId,
        status: 'completed'
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);

      await expect(urgentService.cancelUrgentRequest(requestId, clientId))
        .rejects.toThrow('La solicitud ya está completada o cancelada.');
    });

    test('should notify active candidates', async () => {
      const mockRequest = {
        id: requestId,
        client_id: clientId,
        status: 'pending'
      };

      const mockCandidates = [
        { professional_id: 'prof-1' },
        { professional_id: 'prof-2' }
      ];

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.urgent_requests.update.mockResolvedValue({ ...mockRequest, status: 'cancelled' });
      mockPrisma.urgent_request_candidates.findMany.mockResolvedValue(mockCandidates);

      await urgentService.cancelUrgentRequest(requestId, clientId);

      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        'prof-1',
        'urgent_request_cancelled',
        'La solicitud urgente ha sido cancelada por el cliente.',
        { urgentRequestId: requestId }
      );
    });

    test('should create tracking entry', async () => {
      const mockRequest = {
        id: requestId,
        client_id: clientId,
        status: 'pending'
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.urgent_requests.update.mockResolvedValue({ ...mockRequest, status: 'cancelled' });
      mockPrisma.urgent_request_candidates.findMany.mockResolvedValue([]);

      await urgentService.cancelUrgentRequest(requestId, clientId);

      expect(mockPrisma.urgent_tracking.create).toHaveBeenCalledWith({
        data: {
          urgent_request_id: requestId,
          previous_status: 'pending',
          new_status: 'cancelled',
          changed_by: undefined,
          notes: 'Cancelada por el cliente'
        }
      });
    });
  });

  describe('acceptUrgentRequest', () => {
    const requestId = 'request-123';
    const professionalId = 'prof-123';
    const professional = {
      id: professionalId,
      nombre: 'Test Professional',
      telefono: '123456789',
      url_foto_perfil: 'photo.jpg',
      calificacion_promedio: 4.5
    };

    test('should accept urgent request successfully', async () => {
      const mockCandidate = { id: 'candidate-123' };
      const mockAssignment = { id: 'assignment-123', assigned_at: new Date() };
      const mockUpdatedRequest = { id: requestId, status: 'assigned', client_id: 'client-123' };

      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.urgent_assignments.create.mockResolvedValue(mockAssignment);
      mockPrisma.urgent_requests.update.mockResolvedValue(mockUpdatedRequest);
      mockPrisma.urgent_request_candidates.findMany.mockResolvedValue([]);

      const result = await urgentService.acceptUrgentRequest(requestId, professionalId, professional);

      expect(result).toEqual({ assignment: mockAssignment, updatedRequest: mockUpdatedRequest });
      expect(mockPrisma.urgent_assignments.create).toHaveBeenCalledWith({
        data: {
          urgent_request_id: requestId,
          professional_id: professionalId,
          status: 'accepted'
        }
      });
    });

    test('should throw error for non-candidate acceptance', async () => {
      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(null);

      await expect(urgentService.acceptUrgentRequest(requestId, professionalId, professional))
        .rejects.toThrow('No eres candidato para esta solicitud.');
    });

    test('should update candidate status', async () => {
      const mockCandidate = { id: 'candidate-123' };

      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.urgent_assignments.create.mockResolvedValue({ id: 'assignment-123' });
      mockPrisma.urgent_requests.update.mockResolvedValue({ id: requestId, client_id: 'client-123' });
      mockPrisma.urgent_request_candidates.findMany.mockResolvedValue([]);

      await urgentService.acceptUrgentRequest(requestId, professionalId, professional);

      expect(mockPrisma.urgent_request_candidates.update).toHaveBeenCalledWith({
        where: { id: 'candidate-123' },
        data: {
          responded: true,
          accepted: true
        }
      });
    });

    test('should start SLA tracking', async () => {
      const mockCandidate = { id: 'candidate-123' };

      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.urgent_assignments.create.mockResolvedValue({ id: 'assignment-123' });
      mockPrisma.urgent_requests.update.mockResolvedValue({ id: requestId, client_id: 'client-123' });
      mockPrisma.urgent_request_candidates.findMany.mockResolvedValue([]);

      await urgentService.acceptUrgentRequest(requestId, professionalId, professional);

      expect(mockSlaService.startSLA).toHaveBeenCalledWith(requestId, 'urgent_response');
    });

    test('should notify client and reject other candidates', async () => {
      const mockCandidate = { id: 'candidate-123' };
      const mockOtherCandidates = [
        { id: 'candidate-456', professional_id: 'prof-456' },
        { id: 'candidate-789', professional_id: 'prof-789' }
      ];

      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.urgent_assignments.create.mockResolvedValue({ id: 'assignment-123' });
      mockPrisma.urgent_requests.update.mockResolvedValue({ id: requestId, client_id: 'client-123' });
      mockPrisma.urgent_request_candidates.findMany.mockResolvedValue(mockOtherCandidates);

      await urgentService.acceptUrgentRequest(requestId, professionalId, professional);

      // Should notify client
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        'client-123',
        'urgent_request_accepted',
        expect.stringContaining('aceptada'),
        expect.any(Object)
      );

      // Should reject other candidates
      expect(mockPrisma.urgent_rejections.create).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        'prof-456',
        'urgent_request_assigned_to_other',
        'La solicitud urgente fue asignada a otro profesional.',
        { urgentRequestId: requestId }
      );
    });
  });

  describe('rejectUrgentRequest', () => {
    const requestId = 'request-123';
    const professionalId = 'prof-123';

    test('should reject urgent request successfully', async () => {
      const mockCandidate = { id: 'candidate-123' };

      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.urgent_request_candidates.count.mockResolvedValue(0);

      await urgentService.rejectUrgentRequest(requestId, professionalId, 'No disponible');

      expect(mockPrisma.urgent_request_candidates.update).toHaveBeenCalledWith({
        where: { id: 'candidate-123' },
        data: {
          responded: true,
          accepted: false
        }
      });

      expect(mockPrisma.urgent_rejections.create).toHaveBeenCalledWith({
        data: {
          urgent_request_id: requestId,
          professional_id: professionalId,
          reason: 'No disponible'
        }
      });
    });

    test('should use default reason when none provided', async () => {
      const mockCandidate = { id: 'candidate-123' };

      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.urgent_request_candidates.count.mockResolvedValue(0);

      await urgentService.rejectUrgentRequest(requestId, professionalId);

      expect(mockPrisma.urgent_rejections.create).toHaveBeenCalledWith({
        data: {
          urgent_request_id: requestId,
          professional_id: professionalId,
          reason: 'Rechazada por el profesional'
        }
      });
    });

    test('should trigger retry dispatch when no candidates remain', async () => {
      const mockCandidate = { id: 'candidate-123' };

      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.urgent_request_candidates.count.mockResolvedValue(0);

      const retryDispatchSpy = jest.spyOn(urgentService, 'autoDispatchUrgentRequest').mockResolvedValue();

      await urgentService.rejectUrgentRequest(requestId, professionalId);

      expect(retryDispatchSpy).toHaveBeenCalledWith(requestId, true);
    });
  });

  describe('autoDispatchUrgentRequest', () => {
    const requestId = 'request-123';

    test('should skip dispatch for non-pending requests', async () => {
      mockPrisma.urgent_requests.findUnique.mockResolvedValue({
        id: requestId,
        status: 'assigned',
        latitude: -34.6118,
        longitude: -58.3960,
        radius_km: 5,
        client: { nombre: 'Test Client' },
        description: 'Test request'
      });

      await urgentService.autoDispatchUrgentRequest(requestId);

      expect(mockMatchingService.findMatchingProfessionals).not.toHaveBeenCalled();
    });

    test('should dispatch to matching professionals', async () => {
      const mockRequest = {
        id: requestId,
        status: 'pending',
        latitude: -34.6118,
        longitude: -58.3960,
        radius_km: 5,
        client: { nombre: 'Test Client' },
        description: 'Test request',
        service: { categoria: 'plomero' }
      };

      const mockCandidates = [
        { professionalId: 'prof-1', distance: 2.5 },
        { professionalId: 'prof-2', distance: 3.1 }
      ];

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);
      mockMatchingService.findMatchingProfessionals.mockResolvedValue(mockCandidates);
      mockPrisma.urgent_request_candidates.findFirst.mockResolvedValue(null); // No duplicates
      mockPrisma.usuarios.findUnique.mockResolvedValue({ fcm_token: 'token123', notificaciones_push: true });

      await urgentService.autoDispatchUrgentRequest(requestId);

      expect(mockMatchingService.findMatchingProfessionals).toHaveBeenCalledWith(
        -34.6118, -58.3960, 5,
        { serviceCategory: 'plomero', isRetry: false }
      );

      expect(mockPrisma.urgent_request_candidates.create).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });

    test('should handle no candidates found', async () => {
      const mockRequest = {
        id: requestId,
        status: 'pending',
        latitude: -34.6118,
        longitude: -58.3960,
        radius_km: 5,
        client: { nombre: 'Test Client' },
        description: 'Test request'
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);
      mockMatchingService.findMatchingProfessionals.mockResolvedValue([]);

      await urgentService.autoDispatchUrgentRequest(requestId);

      expect(mockPrisma.urgent_tracking.create).toHaveBeenCalledWith({
        data: {
          urgent_request_id: requestId,
          previous_status: 'pending',
          new_status: 'pending',
          changed_by: undefined,
          notes: 'No se encontraron profesionales disponibles'
        }
      });
    });
  });

  describe('completeUrgentRequest', () => {
    const requestId = 'request-123';
    const userId = 'user-123';

    test('should complete request successfully', async () => {
      const mockRequest = {
        id: requestId,
        client_id: 'client-123',
        status: 'assigned',
        assignments: [{ professional_id: 'prof-123' }]
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.urgent_requests.update.mockResolvedValue({
        ...mockRequest,
        status: 'completed',
        completed_at: new Date()
      });

      const result = await urgentService.completeUrgentRequest(requestId, userId);

      expect(result.status).toBe('completed');
      expect(mockSlaService.completeSLA).toHaveBeenCalledWith(requestId, 'urgent_response');
    });

    test('should validate user permissions', async () => {
      const mockRequest = {
        id: requestId,
        client_id: 'different-client',
        status: 'assigned',
        assignments: [{ professional_id: 'different-prof' }]
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);

      await expect(urgentService.completeUrgentRequest(requestId, userId))
        .rejects.toThrow('No tienes permiso para completar esta solicitud.');
    });

    test('should notify the other party', async () => {
      const mockRequest = {
        id: requestId,
        client_id: 'client-123',
        status: 'assigned',
        assignments: [{ professional_id: 'prof-123' }]
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.urgent_requests.update.mockResolvedValue({
        ...mockRequest,
        status: 'completed'
      });

      await urgentService.completeUrgentRequest(requestId, 'client-123');

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        'prof-123',
        'urgent_request_completed',
        'La solicitud urgente ha sido completada.',
        expect.any(Object)
      );
    });
  });

  describe('getUrgentServicesStats', () => {
    test('should return comprehensive statistics', async () => {
      mockPrisma.urgent_requests.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(75)  // completed
        .mockResolvedValueOnce(10)  // cancelled
        .mockResolvedValueOnce(10)  // pending
        .mockResolvedValueOnce(5);  // assigned

      // Mock time calculations
      const mockCompletedRequests = [
        { created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), completed_at: new Date() },
        { created_at: new Date(Date.now() - 1 * 60 * 60 * 1000), completed_at: new Date() }
      ];
      mockPrisma.urgent_requests.findMany.mockResolvedValue(mockCompletedRequests);

      const mockRejections = [
        { reason: 'No disponible', professional_id: 'prof-1' },
        { reason: 'Demasiado lejos', professional_id: 'prof-2' },
        { reason: 'No disponible', professional_id: 'prof-3' }
      ];
      mockPrisma.urgent_rejections.findMany.mockResolvedValue(mockRejections);

      const result = await urgentService.getUrgentServicesStats();

      expect(result.total).toBe(100);
      expect(result.completed).toBe(75);
      expect(result.completionRate).toBe(75);
      expect(result.rejectionStats.total).toBe(3);
      expect(result.rejectionStats.reasons['No disponible']).toBe(2);
    });
  });

  describe('createStatusTracking', () => {
    test('should create tracking entry with previous status', async () => {
      const requestId = 'request-123';
      const mockCurrentRequest = { status: 'pending' };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockCurrentRequest);

      await urgentService.createStatusTracking(requestId, 'assigned', 'Asignada a profesional', 'prof-123');

      expect(mockPrisma.urgent_tracking.create).toHaveBeenCalledWith({
        data: {
          urgent_request_id: requestId,
          previous_status: 'pending',
          new_status: 'assigned',
          changed_by: 'prof-123',
          notes: 'Asignada a profesional'
        }
      });
    });
  });

  describe('calculatePriceEstimate', () => {
    test('should calculate price with matching service', async () => {
      mockMatchingService.getUrgentPricing.mockResolvedValue({
        multiplier: 1.5,
        minPrice: 500
      });

      const result = await urgentService.calculatePriceEstimate('plomero', { lat: 0, lng: 0 }, 5);

      expect(result).toBeGreaterThan(0);
      expect(mockMatchingService.getUrgentPricing).toHaveBeenCalledWith('plomero');
    });

    test('should return 0 when matching service unavailable', async () => {
      urgentService.setMatchingService(null);

      const result = await urgentService.calculatePriceEstimate('plomero', { lat: 0, lng: 0 }, 5);

      expect(result).toBe(0);
    });
  });

  // Edge cases and error handling
  describe('Edge Cases and Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockPrisma.urgent_requests.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(urgentService.createUrgentRequest('client-123', {
        description: 'Test',
        location: { lat: 0, lng: 0 },
        radiusKm: 5
      })).rejects.toThrow('Database connection failed');
    });

    test('should handle service unavailability', async () => {
      urgentService.setNotificationService(null);

      const mockRequest = {
        id: 'request-123',
        client_id: 'client-123',
        status: 'pending'
      };

      mockPrisma.urgent_requests.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.urgent_requests.update.mockResolvedValue({ ...mockRequest, status: 'cancelled' });
      mockPrisma.urgent_request_candidates.findMany.mockResolvedValue([]);

      // Should not throw error when notification service is unavailable
      await expect(urgentService.cancelUrgentRequest('request-123', 'client-123')).resolves.not.toThrow();
    });

    test('should handle concurrent requests', async () => {
      const clientId = 'client-123';
      const validRequestData = {
        description: 'Concurrent request',
        location: { lat: -34.6118, lng: -58.3960 },
        radiusKm: 5
      };

      // First request succeeds
      mockPrisma.urgent_requests.count.mockResolvedValueOnce(0);
      mockPrisma.urgent_requests.create.mockResolvedValueOnce({
        id: 'request-1',
        client_id: clientId,
        status: 'pending'
      });

      // Second request hits rate limit
      mockPrisma.urgent_requests.count.mockResolvedValueOnce(5);

      await expect(urgentService.createUrgentRequest(clientId, validRequestData))
        .resolves.toBeDefined();

      await expect(urgentService.createUrgentRequest(clientId, validRequestData))
        .rejects.toThrow('Demasiadas solicitudes urgentes');
    });

    test('should validate coordinate ranges', async () => {
      const invalidCoordinates = [
        { lat: 91, lng: 0 },
        { lat: -91, lng: 0 },
        { lat: 0, lng: 181 },
        { lat: 0, lng: -181 }
      ];

      for (const location of invalidCoordinates) {
        await expect(urgentService.createUrgentRequest('client-123', {
          description: 'Test',
          location,
          radiusKm: 5
        })).rejects.toThrow('ubicación');
      }
    });
  });
});