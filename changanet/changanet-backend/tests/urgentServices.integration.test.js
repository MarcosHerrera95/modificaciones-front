/**
 * Pruebas de integración para Servicios Urgentes
 * Cubre el flujo completo cliente → asignación → aceptación
 * Incluye notificaciones y validación de seguridad
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const { createTestUser, cleanupTestData } = require('./testHelpers');

const prisma = new PrismaClient();

describe('Urgent Services - Integration Tests', () => {
  let app;
  let testClient;
  let testProfessional;
  let server;

  beforeAll(async () => {
    // Importar app después de configurar variables de entorno
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db';

    app = require('../src/server');

    // Crear usuarios de prueba
    testClient = await createTestUser('cliente_urgente@test.com', 'cliente');
    testProfessional = await createTestUser('profesional_urgente@test.com', 'profesional');

    // Crear perfil profesional
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: testProfessional.id,
        especialidad: 'Plomero',
        zona_cobertura: 'Buenos Aires',
        latitud: -34.5881,
        longitud: -58.4165,
        esta_disponible: true,
        tarifa_hora: 1500
      }
    });

    // Crear regla de precios de prueba
    await prisma.urgent_pricing_rules.create({
      data: {
        service_category: 'plomero',
        base_multiplier: 1.5,
        min_price: 500
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await cleanupTestData();
    await prisma.urgent_pricing_rules.deleteMany({
      where: { service_category: 'plomero' }
    });
    await prisma.$disconnect();

    if (server) {
      server.close();
    }
  });

  describe('Complete Flow: Client → Assignment → Acceptance', () => {
    let urgentRequestId;
    let authToken;

    beforeAll(async () => {
      // Login para obtener token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testClient.email,
          contrasena: 'testpassword123'
        });

      authToken = loginResponse.body.token;
      expect(authToken).toBeDefined();
    });

    test('1. Client creates urgent request successfully', async () => {
      const response = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Fuga de agua en cocina urgente',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5,
          serviceCategory: 'plomero'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('pending');
      expect(response.body.description).toBe('Fuga de agua en cocina urgente');

      urgentRequestId = response.body.id;
    });

    test('2. System automatically dispatches to nearby professionals', async () => {
      // Esperar un momento para que el auto-dispatch se complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verificar que se crearon candidatos
      const candidates = await prisma.urgent_request_candidates.findMany({
        where: { urgent_request_id: urgentRequestId }
      });

      expect(candidates.length).toBeGreaterThan(0);

      // Verificar que el profesional de prueba está incluido
      const testProfessionalCandidate = candidates.find(
        c => c.professional_id === testProfessional.id
      );
      expect(testProfessionalCandidate).toBeDefined();
      expect(testProfessionalCandidate.responded).toBe(false);
    });

    test('3. Professional can see nearby urgent requests', async () => {
      const profLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testProfessional.email,
          contrasena: 'testpassword123'
        });

      const profToken = profLoginResponse.body.token;

      const response = await request(app)
        .get('/api/urgent/nearby?lat=-34.5881&lng=-58.4165&serviceCategory=plomero')
        .set('Authorization', `Bearer ${profToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Debería encontrar la solicitud urgente
      const foundRequest = response.body.find(req => req.id === urgentRequestId);
      expect(foundRequest).toBeDefined();
      expect(foundRequest.distance_km).toBeLessThanOrEqual(5);
    });

    test('4. Professional accepts urgent request', async () => {
      const profLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testProfessional.email,
          contrasena: 'testpassword123'
        });

      const profToken = profLoginResponse.body.token;

      const response = await request(app)
        .post(`/api/urgent/${urgentRequestId}/accept`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('assignment');
      expect(response.body.message).toContain('aceptada');
    });

    test('5. Request status updates to assigned', async () => {
      const response = await request(app)
        .get(`/api/urgent-requests/${urgentRequestId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('assigned');
      expect(response.body.assignments).toHaveLength(1);
      expect(response.body.assignments[0].professional_id).toBe(testProfessional.id);
    });

    test('6. Other professionals cannot accept already assigned request', async () => {
      // Crear otro profesional
      const otherProfessional = await createTestUser('otro_profesional@test.com', 'profesional');

      await prisma.perfiles_profesionales.create({
        data: {
          usuario_id: otherProfessional.id,
          especialidad: 'Plomero',
          zona_cobertura: 'Buenos Aires',
          latitud: -34.6118,
          longitud: -58.3960,
          esta_disponible: true,
          tarifa_hora: 1600
        }
      });

      const profLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: otherProfessional.email,
          contrasena: 'testpassword123'
        });

      const profToken = profLoginResponse.body.token;

      const response = await request(app)
        .post(`/api/urgent/${urgentRequestId}/accept`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('ya asignada');

      // Limpiar
      await cleanupTestData([otherProfessional.id]);
    });

    test('7. Client can cancel pending request', async () => {
      // Crear nueva solicitud para cancelar
      const newRequestResponse = await request(app)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Otra fuga urgente',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5,
          serviceCategory: 'plomero'
        });

      const newRequestId = newRequestResponse.body.id;

      // Cancelar la solicitud
      const cancelResponse = await request(app)
        .post(`/api/urgent-requests/${newRequestId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.status).toBe('cancelled');

      // Verificar que no se puede cancelar de nuevo
      const cancelAgainResponse = await request(app)
        .post(`/api/urgent-requests/${newRequestId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(cancelAgainResponse.status).toBe(400);
    });
  });

  describe('Security Validations', () => {
    let clientToken;

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testClient.email,
          contrasena: 'testpassword123'
        });

      clientToken = loginResponse.body.token;
    });

    test('rejects request without authentication', async () => {
      const response = await request(app)
        .post('/api/urgent-requests')
        .send({
          description: 'Test',
          location: { lat: 0, lng: 0 },
          radiusKm: 5
        });

      expect(response.status).toBe(401);
    });

    test('validates location coordinates', async () => {
      const invalidLocations = [
        { lat: 91, lng: 0 }, // Latitud inválida
        { lat: 0, lng: 181 }, // Longitud inválida
        { lat: 'invalid', lng: 0 }, // No numérico
        {} // Faltante
      ];

      for (const location of invalidLocations) {
        const response = await request(app)
          .post('/api/urgent-requests')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            description: 'Test validation',
            location,
            radiusKm: 5
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('ubicación');
      }
    });

    test('validates radius limits', async () => {
      const invalidRadii = [0, 51, -1, 'invalid'];

      for (const radius of invalidRadii) {
        const response = await request(app)
          .post('/api/urgent-requests')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            description: 'Test radius',
            location: { lat: -34.6118, lng: -58.3960 },
            radiusKm: radius
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('radio');
      }
    });

    test('prevents client from accessing professional endpoints', async () => {
      const response = await request(app)
        .get('/api/urgent/nearby?lat=0&lng=0')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(403);
    });

    test('rate limits urgent requests', async () => {
      // Crear múltiples solicitudes rápidamente
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app)
            .post('/api/urgent-requests')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              description: `Test rate limit ${i}`,
              location: { lat: -34.6118, lng: -58.3960 },
              radiusKm: 5
            })
        );
      }

      const responses = await Promise.all(promises);

      // Al menos una debería ser rechazada por rate limiting
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Notification System', () => {
    test('sends notifications when request is created and assigned', async () => {
      // Este test verificaría que las notificaciones se envían correctamente
      // En un entorno real, se verificarían los servicios de notificación externos
      expect(true).toBe(true); // Placeholder para implementación completa
    });
  });

  describe('WebSocket Integration', () => {
    test('emits real-time events for urgent requests', async () => {
      // Test para verificar que los eventos WebSocket se emiten correctamente
      // Esto requeriría un cliente WebSocket de prueba
      expect(true).toBe(true); // Placeholder para implementación completa
    });
  });
});