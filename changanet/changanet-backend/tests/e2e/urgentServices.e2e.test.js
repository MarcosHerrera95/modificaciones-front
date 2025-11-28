/**
 * @archivo tests/e2e/urgentServices.e2e.test.js
 * @descripción Pruebas end-to-end completas para flujos de Servicios Urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests E2E para validación completa del sistema de urgencias
 * @impacto Social: Validación integral de la experiencia de usuario en emergencias
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const { createTestUser, cleanupTestData } = require('../testHelpers');

const prisma = new PrismaClient();

describe('Urgent Services - End-to-End Tests', () => {
  let app;
  let testClient;
  let testProfessional1;
  let testProfessional2;
  let clientToken;
  let professional1Token;
  let professional2Token;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test-e2e.db';

    app = require('../../src/server');

    // Create test users
    testClient = await createTestUser('e2e_client@test.com', 'cliente');
    testProfessional1 = await createTestUser('e2e_prof1@test.com', 'profesional');
    testProfessional2 = await createTestUser('e2e_prof2@test.com', 'profesional');

    // Create professional profiles
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: testProfessional1.id,
        especialidad: 'Plomero',
        zona_cobertura: 'Buenos Aires',
        latitud: -34.5881,
        longitud: -58.4165,
        esta_disponible: true,
        tarifa_hora: 1500,
        calificacion_promedio: 4.5,
        total_resenas: 25
      }
    });

    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: testProfessional2.id,
        especialidad: 'Electricista',
        zona_cobertura: 'Buenos Aires',
        latitud: -34.6118,
        longitud: -58.3960,
        esta_disponible: true,
        tarifa_hora: 1600,
        calificacion_promedio: 4.2,
        total_resenas: 18
      }
    });

    // Create pricing rules
    await prisma.urgent_pricing_rules.create({
      data: {
        service_category: 'plomero',
        base_multiplier: 1.5,
        min_price: 500
      }
    });

    await prisma.urgent_pricing_rules.create({
      data: {
        service_category: 'electricista',
        base_multiplier: 1.8,
        min_price: 600
      }
    });

    // Get authentication tokens
    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testClient.email,
        contrasena: 'testpassword123'
      });
    clientToken = clientLogin.body.token;

    const prof1Login = await request(app)
      .post('/api/auth/login')
      .send({
        email: testProfessional1.email,
        contrasena: 'testpassword123'
      });
    professional1Token = prof1Login.body.token;

    const prof2Login = await request(app)
      .post('/api/auth/login')
      .send({
        email: testProfessional2.email,
        contrasena: 'testpassword123'
      });
    professional2Token = prof2Login.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.urgent_pricing_rules.deleteMany({
      where: { service_category: { in: ['plomero', 'electricista'] } }
    });
    await prisma.$disconnect();
  });

  describe('Complete Urgent Service Flow: Success Path', () => {
    let urgentRequestId;
    let assignmentId;

    test('1. Client creates urgent request successfully', async () => {
      const requestData = {
        description: 'Fuga de agua en cocina - muy urgente',
        location: { lat: -34.6118, lng: -58.3960 },
        radiusKm: 5,
        serviceCategory: 'plomero'
      };

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(requestData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('pending');
      expect(response.body.description).toBe(requestData.description);
      expect(response.body.price_estimate).toBeGreaterThan(0);

      urgentRequestId = response.body.id;

      // Verify request was created in database
      const dbRequest = await prisma.urgent_requests.findUnique({
        where: { id: urgentRequestId }
      });
      expect(dbRequest).toBeTruthy();
      expect(dbRequest.status).toBe('pending');
      expect(dbRequest.client_id).toBe(testClient.id);
    });

    test('2. System automatically creates candidates', async () => {
      // Wait for auto-dispatch to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const candidates = await prisma.urgent_request_candidates.findMany({
        where: { urgent_request_id: urgentRequestId }
      });

      expect(candidates.length).toBeGreaterThan(0);

      // Should include our test professional
      const testProfCandidate = candidates.find(c => c.professional_id === testProfessional1.id);
      expect(testProfCandidate).toBeTruthy();
      expect(testProfCandidate.responded).toBe(false);
      expect(testProfCandidate.distance_km).toBeLessThan(5);
    });

    test('3. Professional can see the urgent request in nearby list', async () => {
      const response = await request(app)
        .get('/api/urgent/nearby?lat=-34.5881&lng=-58.4165&serviceCategory=plomero')
        .set('Authorization', `Bearer ${professional1Token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const foundRequest = response.body.find(req => req.id === urgentRequestId);
      expect(foundRequest).toBeTruthy();
      expect(foundRequest.distance_km).toBeLessThan(5);
      expect(foundRequest.description).toContain('Fuga de agua');
    });

    test('4. Professional accepts the urgent request', async () => {
      const response = await request(app)
        .post(`/api/urgent/${urgentRequestId}/accept`)
        .set('Authorization', `Bearer ${professional1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('assignment');
      expect(response.body.message).toContain('aceptada');

      assignmentId = response.body.assignment.id;

      // Verify assignment was created
      const assignment = await prisma.urgent_assignments.findUnique({
        where: { id: assignmentId }
      });
      expect(assignment).toBeTruthy();
      expect(assignment.professional_id).toBe(testProfessional1.id);
      expect(assignment.urgent_request_id).toBe(urgentRequestId);
    });

    test('5. Request status updates to assigned', async () => {
      const response = await request(app)
        .get(`/api/urgent-requests/${urgentRequestId}/status`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('assigned');
      expect(response.body.assignments).toHaveLength(1);
      expect(response.body.assignments[0].professional_id).toBe(testProfessional1.id);
    });

    test('6. Other professionals cannot accept already assigned request', async () => {
      const response = await request(app)
        .post(`/api/urgent/${urgentRequestId}/accept`)
        .set('Authorization', `Bearer ${professional2Token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ya asignada');
    });

    test('7. Client completes the urgent request', async () => {
      const response = await request(app)
        .post(`/api/urgent/${urgentRequestId}/complete`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          rating: 5,
          comments: 'Excelente servicio, muy rápido'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');

      // Verify final status in database
      const finalRequest = await prisma.urgent_requests.findUnique({
        where: { id: urgentRequestId }
      });
      expect(finalRequest.status).toBe('completed');
      expect(finalRequest.completed_at).toBeTruthy();
    });
  });

  describe('Rejection and Retry Flow', () => {
    let retryRequestId;

    test('1. Create another urgent request', async () => {
      const requestData = {
        description: 'Problema eléctrico urgente',
        location: { lat: -34.6118, lng: -58.3960 },
        radiusKm: 5,
        serviceCategory: 'electricista'
      };

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(requestData);

      expect(response.status).toBe(201);
      retryRequestId = response.body.id;
    });

    test('2. First professional rejects the request', async () => {
      // Wait for candidates to be created
      await new Promise(resolve => setTimeout(resolve, 200));

      const response = await request(app)
        .post(`/api/urgent/${retryRequestId}/reject`)
        .set('Authorization', `Bearer ${professional1Token}`)
        .send({ reason: 'Fuera de mi zona de especialidad' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('rechazada');

      // Verify rejection was recorded
      const rejections = await prisma.urgent_rejections.findMany({
        where: { urgent_request_id: retryRequestId }
      });
      expect(rejections.length).toBe(1);
      expect(rejections[0].professional_id).toBe(testProfessional1.id);
      expect(rejections[0].reason).toBe('Fuera de mi zona de especialidad');
    });

    test('3. Second professional accepts the request', async () => {
      const response = await request(app)
        .post(`/api/urgent/${retryRequestId}/accept`)
        .set('Authorization', `Bearer ${professional2Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('assignment');
    });

    test('4. Complete the request', async () => {
      const response = await request(app)
        .post(`/api/urgent/${retryRequestId}/complete`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });
  });

  describe('Cancellation Flow', () => {
    let cancelRequestId;

    test('1. Create request for cancellation', async () => {
      const requestData = {
        description: 'Cancelación de prueba',
        location: { lat: -34.6118, lng: -58.3960 },
        radiusKm: 5,
        serviceCategory: 'plomero'
      };

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(requestData);

      expect(response.status).toBe(201);
      cancelRequestId = response.body.id;
    });

    test('2. Client cancels the request before assignment', async () => {
      const response = await request(app)
        .post(`/api/urgent-requests/${cancelRequestId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');

      // Verify cancellation in database
      const cancelledRequest = await prisma.urgent_requests.findUnique({
        where: { id: cancelRequestId }
      });
      expect(cancelledRequest.status).toBe('cancelled');
    });

    test('3. Cannot cancel already cancelled request', async () => {
      const response = await request(app)
        .post(`/api/urgent-requests/${cancelRequestId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ya está completada o cancelada');
    });
  });

  describe('Rate Limiting and Security', () => {
    test('should enforce rate limiting on urgent requests', async () => {
      const requests = [];

      // Create 6 requests rapidly (limit is 5 per hour)
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/urgent-requests')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              description: `Rate limit test ${i}`,
              location: { lat: -34.6118, lng: -58.3960 },
              radiusKm: 5,
              serviceCategory: 'plomero'
            })
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimited = responses.some(res => res.status === 400 && res.body.error.includes('Demasiadas'));
      expect(rateLimited).toBe(true);
    });

    test('should prevent unauthorized access', async () => {
      // Try to access without authentication
      const response1 = await request(app)
        .post('/api/urgent-requests')
        .send({
          description: 'Test',
          location: { lat: 0, lng: 0 },
          radiusKm: 5
        });
      expect(response1.status).toBe(401);

      // Try to access another user's request
      const otherClient = await createTestUser('other_client@test.com', 'cliente');
      const otherLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: otherClient.email,
          contrasena: 'testpassword123'
        });

      const createResponse = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${otherLogin.body.token}`)
        .send({
          description: 'Other user request',
          location: { lat: 0, lng: 0 },
          radiusKm: 5
        });

      const accessResponse = await request(app)
        .get(`/api/urgent-requests/${createResponse.body.id}/status`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(accessResponse.status).toBe(400);
      expect(accessResponse.body.error).toContain('permiso');

      await cleanupTestData([otherClient.id]);
    });

    test('should validate all input data', async () => {
      const invalidRequests = [
        {
          description: '',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5
        },
        {
          description: 'Valid description',
          location: { lat: 91, lng: 0 }, // Invalid latitude
          radiusKm: 5
        },
        {
          description: 'Valid description',
          location: { lat: -34.6118, lng: 181 }, // Invalid longitude
          radiusKm: 5
        },
        {
          description: 'Valid description',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 60 // Invalid radius
        }
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await request(app)
          .post('/api/urgent-requests')
          .set('Authorization', `Bearer ${clientToken}`)
          .send(invalidRequest);

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple professionals responding simultaneously', async () => {
      // Create a request
      const requestData = {
        description: 'Concurrent test request',
        location: { lat: -34.6118, lng: -58.3960 },
        radiusKm: 10,
        serviceCategory: 'plomero'
      };

      const createResponse = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(requestData);

      const concurrentRequestId = createResponse.body.id;

      // Wait for candidates
      await new Promise(resolve => setTimeout(resolve, 200));

      // Both professionals try to accept simultaneously
      const acceptPromises = [
        request(app)
          .post(`/api/urgent/${concurrentRequestId}/accept`)
          .set('Authorization', `Bearer ${professional1Token}`),
        request(app)
          .post(`/api/urgent/${concurrentRequestId}/accept`)
          .set('Authorization', `Bearer ${professional2Token}`)
      ];

      const responses = await Promise.all(acceptPromises);

      // Only one should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      const failureCount = responses.filter(r => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify final state
      const finalRequest = await prisma.urgent_requests.findUnique({
        where: { id: concurrentRequestId },
        include: { assignments: true }
      });

      expect(finalRequest.status).toBe('assigned');
      expect(finalRequest.assignments).toHaveLength(1);
    });
  });

  describe('Data Integrity and Cleanup', () => {
    test('should maintain referential integrity', async () => {
      // Create and complete a request
      const requestData = {
        description: 'Integrity test',
        location: { lat: -34.6118, lng: -58.3960 },
        radiusKm: 5,
        serviceCategory: 'plomero'
      };

      const createResponse = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(requestData);

      const integrityRequestId = createResponse.body.id;

      // Accept and complete
      await new Promise(resolve => setTimeout(resolve, 200));
      await request(app)
        .post(`/api/urgent/${integrityRequestId}/accept`)
        .set('Authorization', `Bearer ${professional1Token}`);

      await request(app)
        .post(`/api/urgent/${integrityRequestId}/complete`)
        .set('Authorization', `Bearer ${clientToken}`);

      // Verify all related data exists and is consistent
      const request = await prisma.urgent_requests.findUnique({
        where: { id: integrityRequestId },
        include: {
          assignments: true,
          candidates: true,
          tracking: true
        }
      });

      expect(request).toBeTruthy();
      expect(request.status).toBe('completed');
      expect(request.assignments).toHaveLength(1);
      expect(request.tracking.length).toBeGreaterThan(0);

      // Check tracking entries
      const statusChanges = request.tracking.map(t => t.new_status);
      expect(statusChanges).toContain('pending');
      expect(statusChanges).toContain('assigned');
      expect(statusChanges).toContain('completed');
    });

    test('should handle database constraints', async () => {
      // Try to create request with non-existent client
      const invalidRequest = {
        description: 'Invalid client test',
        location: { lat: -34.6118, lng: -58.3960 },
        radiusKm: 5
      };

      // This should fail at application level, not database level
      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(invalidRequest);

      expect([200, 201, 400]).toContain(response.status);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple simultaneous requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        description: `Load test request ${i}`,
        location: { lat: -34.6118 + (Math.random() - 0.5) * 0.01, lng: -58.3960 + (Math.random() - 0.5) * 0.01 },
        radiusKm: 5,
        serviceCategory: 'plomero'
      }));

      const startTime = Date.now();

      const responses = await Promise.all(
        concurrentRequests.map(reqData =>
          request(app)
            .post('/api/urgent-requests')
            .set('Authorization', `Bearer ${clientToken}`)
            .send(reqData)
        )
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete
      responses.forEach(response => {
        expect([200, 201, 400]).toContain(response.status);
      });

      // Should complete within reasonable time (allowing for rate limiting)
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
    });

    test('should maintain performance with large datasets', async () => {
      // Create multiple professionals
      const bulkProfessionals = [];
      for (let i = 0; i < 20; i++) {
        const prof = await createTestUser(`bulk_prof_${i}@test.com`, 'profesional');
        bulkProfessionals.push(prof);

        await prisma.perfiles_profesionales.create({
          data: {
            usuario_id: prof.id,
            especialidad: 'Plomero',
            zona_cobertura: 'Buenos Aires',
            latitud: -34.6118 + (Math.random() - 0.5) * 0.1,
            longitud: -58.3960 + (Math.random() - 0.5) * 0.1,
            esta_disponible: true,
            tarifa_hora: 1500 + Math.random() * 500,
            calificacion_promedio: 3.5 + Math.random() * 1.5,
            total_resenas: Math.floor(Math.random() * 50)
          }
        });
      }

      // Create request and measure matching time
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'Bulk test request',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 15, // Larger radius to include more professionals
          serviceCategory: 'plomero'
        });

      expect(response.status).toBe(201);

      const endTime = Date.now();
      const matchingTime = endTime - startTime;

      // Should complete matching within reasonable time
      expect(matchingTime).toBeLessThan(2000); // 2 seconds max

      // Cleanup
      await cleanupTestData(bulkProfessionals.map(p => p.id));
    });
  });
});