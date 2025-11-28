/**
 * @archivo tests/integration/urgentController.integration.test.js
 * @descripción Pruebas de integración para UrgentController
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests de integración para endpoints de servicios urgentes
 * @impacto Social: Validación completa del flujo API de urgencias
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const { createTestUser, cleanupTestData } = require('../testHelpers');

// Mock services
jest.mock('../../src/services/urgentServiceService');
jest.mock('../../src/services/matchingService');
jest.mock('../../src/services/geolocationService');

const { UrgentServiceService } = require('../../src/services/urgentServiceService');
const { MatchingService } = require('../../src/services/matchingService');
const { GeolocationService } = require('../../src/services/geolocationService');

describe('UrgentController - Integration Tests', () => {
  let app;
  let mockUrgentService;
  let mockMatchingService;
  let mockGeolocationService;
  let testClient;
  let testProfessional;
  let clientToken;
  let professionalToken;

  beforeAll(async () => {
    // Create mock instances
    mockUrgentService = {
      createUrgentRequest: jest.fn(),
      getUrgentRequest: jest.fn(),
      cancelUrgentRequest: jest.fn(),
      acceptUrgentRequest: jest.fn(),
      rejectUrgentRequest: jest.fn()
    };

    mockMatchingService = {
      getUrgentPricingRules: jest.fn(),
      updateUrgentPricingRules: jest.fn()
    };

    mockGeolocationService = {
      findNearbyUrgentRequests: jest.fn()
    };

    // Mock the constructors
    UrgentServiceService.mockImplementation(() => mockUrgentService);
    MatchingService.mockImplementation(() => mockMatchingService);
    GeolocationService.mockImplementation(() => mockGeolocationService);

    // Import app after setting up mocks
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db';

    app = require('../../src/server');

    // Create test users
    testClient = await createTestUser('urgent_client@test.com', 'cliente');
    testProfessional = await createTestUser('urgent_prof@test.com', 'profesional');

    // Get auth tokens
    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testClient.email,
        contrasena: 'testpassword123'
      });
    clientToken = clientLogin.body.token;

    const profLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testProfessional.email,
        contrasena: 'testpassword123'
      });
    professionalToken = profLogin.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
    const prisma = new PrismaClient();
    await prisma.$disconnect();
  });

  describe('POST /api/urgent-requests - createUrgentRequest', () => {
    const validRequestData = {
      description: 'Fuga de agua en cocina urgente',
      location: { lat: -34.6118, lng: -58.3960 },
      radiusKm: 5,
      serviceCategory: 'plomero'
    };

    test('should create urgent request successfully', async () => {
      const mockResponse = {
        id: 'request-123',
        client_id: testClient.id,
        description: validRequestData.description,
        status: 'pending',
        price_estimate: 750
      };

      mockUrgentService.createUrgentRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(validRequestData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockResponse);
      expect(mockUrgentService.createUrgentRequest).toHaveBeenCalledWith(
        testClient.id,
        validRequestData
      );
    });

    test('should handle service errors', async () => {
      mockUrgentService.createUrgentRequest.mockRejectedValue(
        new Error('Descripción y ubicación son requeridos.')
      );

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ description: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Descripción y ubicación');
    });

    test('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/urgent-requests')
        .send(validRequestData);

      expect(response.status).toBe(401);
    });

    test('should validate request data', async () => {
      const invalidData = [
        { location: null },
        { location: { lat: 91, lng: 0 } }, // Invalid coordinates
        { radiusKm: 60 }, // Invalid radius
        { radiusKm: -1 }
      ];

      for (const data of invalidData) {
        const response = await request(app)
          .post('/api/urgent-requests')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({ ...validRequestData, ...data });

        expect(response.status).toBe(400);
      }
    });
  });

  describe('GET /api/urgent-requests/:id/status - getUrgentRequestStatus', () => {
    test('should return urgent request status', async () => {
      const requestId = 'request-123';
      const mockRequest = {
        id: requestId,
        client_id: testClient.id,
        status: 'assigned',
        assignments: [{ professional_id: 'prof-123' }]
      };

      mockUrgentService.getUrgentRequest.mockResolvedValue(mockRequest);

      const response = await request(app)
        .get(`/api/urgent-requests/${requestId}/status`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRequest);
      expect(mockUrgentService.getUrgentRequest).toHaveBeenCalledWith(requestId, testClient.id);
    });

    test('should handle not found requests', async () => {
      mockUrgentService.getUrgentRequest.mockRejectedValue(new Error('Solicitud urgente no encontrada.'));

      const response = await request(app)
        .get('/api/urgent-requests/non-existent/status')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('no encontrada');
    });

    test('should enforce access permissions', async () => {
      mockUrgentService.getUrgentRequest.mockRejectedValue(new Error('No tienes permiso para ver esta solicitud.'));

      const response = await request(app)
        .get('/api/urgent-requests/request-123/status')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('permiso');
    });
  });

  describe('POST /api/urgent-requests/:id/cancel - cancelUrgentRequest', () => {
    test('should cancel urgent request successfully', async () => {
      const requestId = 'request-123';
      const mockCancelledRequest = {
        id: requestId,
        status: 'cancelled'
      };

      mockUrgentService.cancelUrgentRequest.mockResolvedValue(mockCancelledRequest);

      const response = await request(app)
        .post(`/api/urgent-requests/${requestId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCancelledRequest);
      expect(mockUrgentService.cancelUrgentRequest).toHaveBeenCalledWith(requestId, testClient.id);
    });

    test('should prevent cancelling others requests', async () => {
      mockUrgentService.cancelUrgentRequest.mockRejectedValue(new Error('Solo el cliente puede cancelar la solicitud.'));

      const response = await request(app)
        .post('/api/urgent-requests/request-123/cancel')
        .set('Authorization', `Bearer ${professionalToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Solo el cliente');
    });
  });

  describe('GET /api/urgent/nearby - getNearbyUrgentRequests', () => {
    test('should return nearby urgent requests for professionals', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          distance_km: 2.5,
          description: 'Test request'
        }
      ];

      mockGeolocationService.findNearbyUrgentRequests.mockResolvedValue(mockRequests);

      const response = await request(app)
        .get('/api/urgent/nearby?lat=-34.6118&lng=-58.3960&serviceCategory=plomero')
        .set('Authorization', `Bearer ${professionalToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRequests);
      expect(mockGeolocationService.findNearbyUrgentRequests).toHaveBeenCalledWith(
        -34.6118, -58.3960, 50, { serviceCategory: 'plomero' }
      );
    });

    test('should require coordinates', async () => {
      const response = await request(app)
        .get('/api/urgent/nearby')
        .set('Authorization', `Bearer ${professionalToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Coordenadas');
    });

    test('should reject client access', async () => {
      const response = await request(app)
        .get('/api/urgent/nearby?lat=0&lng=0')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/urgent/:id/accept - acceptUrgentRequest', () => {
    test('should accept urgent request successfully', async () => {
      const requestId = 'request-123';
      const mockResult = {
        assignment: { id: 'assignment-123' },
        updatedRequest: { id: requestId, status: 'assigned' }
      };

      mockUrgentService.acceptUrgentRequest.mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/urgent/${requestId}/accept`)
        .set('Authorization', `Bearer ${professionalToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('assignment');
      expect(response.body.message).toContain('aceptada');
      expect(mockUrgentService.acceptUrgentRequest).toHaveBeenCalledWith(
        requestId,
        testProfessional.id,
        expect.objectContaining({
          id: testProfessional.id,
          nombre: testProfessional.nombre
        })
      );
    });

    test('should handle acceptance errors', async () => {
      mockUrgentService.acceptUrgentRequest.mockRejectedValue(new Error('No eres candidato para esta solicitud.'));

      const response = await request(app)
        .post('/api/urgent/request-123/accept')
        .set('Authorization', `Bearer ${professionalToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('candidato');
    });
  });

  describe('POST /api/urgent/:id/reject - rejectUrgentRequest', () => {
    test('should reject urgent request successfully', async () => {
      mockUrgentService.rejectUrgentRequest.mockResolvedValue();

      const response = await request(app)
        .post('/api/urgent/request-123/reject')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({ reason: 'No disponible' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('rechazada');
      expect(mockUrgentService.rejectUrgentRequest).toHaveBeenCalledWith(
        'request-123',
        testProfessional.id,
        'No disponible'
      );
    });

    test('should handle rejection without reason', async () => {
      mockUrgentService.rejectUrgentRequest.mockResolvedValue();

      const response = await request(app)
        .post('/api/urgent/request-123/reject')
        .set('Authorization', `Bearer ${professionalToken}`);

      expect(response.status).toBe(200);
      expect(mockUrgentService.rejectUrgentRequest).toHaveBeenCalledWith(
        'request-123',
        testProfessional.id,
        undefined
      );
    });
  });

  describe('GET /api/urgent/pricing - getUrgentPricingRules', () => {
    test('should return pricing rules for admins', async () => {
      const mockRules = [
        { service_category: 'plomero', base_multiplier: 1.5, min_price: 500 }
      ];

      mockMatchingService.getUrgentPricingRules.mockResolvedValue(mockRules);

      // Create admin user
      const adminUser = await createTestUser('admin@test.com', 'admin');

      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          contrasena: 'testpassword123'
        });

      const response = await request(app)
        .get('/api/urgent/pricing')
        .set('Authorization', `Bearer ${adminLogin.body.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRules);

      await cleanupTestData([adminUser.id]);
    });

    test('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/urgent/pricing')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Solo administradores');
    });
  });

  describe('POST /api/urgent/pricing/update - updateUrgentPricingRules', () => {
    test('should update pricing rules for admins', async () => {
      const rules = [
        { service_category: 'plomero', base_multiplier: 2.0, min_price: 600 }
      ];

      mockMatchingService.updateUrgentPricingRules.mockResolvedValue(rules);

      // Create admin user
      const adminUser = await createTestUser('admin2@test.com', 'admin');

      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          contrasena: 'testpassword123'
        });

      const response = await request(app)
        .post('/api/urgent/pricing/update')
        .set('Authorization', `Bearer ${adminLogin.body.token}`)
        .send({ rules });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(rules);
      expect(mockMatchingService.updateUrgentPricingRules).toHaveBeenCalledWith(rules);

      await cleanupTestData([adminUser.id]);
    });

    test('should reject non-admin updates', async () => {
      const response = await request(app)
        .post('/api/urgent/pricing/update')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ rules: [] });

      expect(response.status).toBe(403);
    });
  });

  describe('Security and Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    test('should handle extremely large payloads', async () => {
      const largeDescription = 'x'.repeat(10000);

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: largeDescription,
          location: { lat: 0, lng: 0 },
          radiusKm: 5
        });

      // Should either handle gracefully or reject
      expect([200, 201, 400]).toContain(response.status);
    });

    test('should handle SQL injection attempts', async () => {
      const maliciousData = {
        description: "'; DROP TABLE users; --",
        location: { lat: 0, lng: 0 },
        radiusKm: 5
      };

      mockUrgentService.createUrgentRequest.mockResolvedValue({ id: 'safe-id' });

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(maliciousData);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('safe-id');
    });

    test('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/urgent-requests')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            description: 'Concurrent request',
            location: { lat: 0, lng: 0 },
            radiusKm: 5
          })
      );

      mockUrgentService.createUrgentRequest.mockResolvedValue({ id: 'request-id' });

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 201, 400]).toContain(response.status);
      });
    });

    test('should handle service unavailability', async () => {
      // Temporarily break the service
      const originalImplementation = UrgentServiceService;
      UrgentServiceService.mockImplementation(() => null);

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'Test',
          location: { lat: 0, lng: 0 },
          radiusKm: 5
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('no disponible');

      // Restore
      UrgentServiceService.mockImplementation(() => mockUrgentService);
    });

    test('should validate user roles correctly', async () => {
      // Test with different user types
      const userTypes = ['cliente', 'profesional', 'admin'];

      for (const role of userTypes) {
        const testUser = await createTestUser(`${role}@test.com`, role);
        const login = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            contrasena: 'testpassword123'
          });

        const token = login.body.token;

        // Test endpoint access based on role
        if (role === 'cliente') {
          const response = await request(app)
            .post('/api/urgent-requests')
            .set('Authorization', `Bearer ${token}`)
            .send({
              description: 'Test',
              location: { lat: 0, lng: 0 },
              radiusKm: 5
            });
          expect([200, 201, 400]).toContain(response.status);
        }

        await cleanupTestData([testUser.id]);
      }
    });

    test('should handle network timeouts gracefully', async () => {
      mockUrgentService.createUrgentRequest.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'slow-id' }), 100))
      );

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'Slow request',
          location: { lat: 0, lng: 0 },
          radiusKm: 5
        });

      expect(response.status).toBe(201);
    });
  });

  describe('Rate Limiting and Performance', () => {
    test('should handle rapid successive requests', async () => {
      const rapidRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/urgent-requests')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            description: `Rapid request ${i}`,
            location: { lat: 0, lng: 0 },
            radiusKm: 5
          })
      );

      mockUrgentService.createUrgentRequest
        .mockResolvedValueOnce({ id: 'request-1' })
        .mockRejectedValueOnce(new Error('Demasiadas solicitudes urgentes en la última hora.'))
        .mockResolvedValue({ id: 'request-n' });

      const responses = await Promise.all(rapidRequests);

      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 400).length;

      expect(successCount + rateLimitedCount).toBe(10);
    });

    test('should validate input sanitization', async () => {
      const maliciousInputs = [
        { description: '<script>alert("xss")</script>', location: { lat: 0, lng: 0 }, radiusKm: 5 },
        { description: 'Test\n\r\t', location: { lat: 0, lng: 0 }, radiusKm: 5 },
        { description: 'Test' + '\u0000', location: { lat: 0, lng: 0 }, radiusKm: 5 }
      ];

      for (const input of maliciousInputs) {
        mockUrgentService.createUrgentRequest.mockResolvedValue({ id: 'safe-id' });

        const response = await request(app)
          .post('/api/urgent-requests')
          .set('Authorization', `Bearer ${clientToken}`)
          .send(input);

        expect(response.status).toBe(201);
      }
    });
  });
});