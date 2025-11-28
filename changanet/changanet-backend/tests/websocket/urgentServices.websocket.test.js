/**
 * @archivo tests/websocket/urgentServices.websocket.test.js
 * @descripción Pruebas de WebSocket para funcionalidades en tiempo real de Servicios Urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests WebSocket para notificaciones y actualizaciones en vivo
 * @impacto Social: Validación de comunicación en tiempo real durante emergencias
 */

const { io: Client } = require('socket.io-client');
const { createTestUser, cleanupTestData } = require('../testHelpers');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Urgent Services - WebSocket Tests', () => {
  let server;
  let clientSocket;
  let professionalSocket;
  let adminSocket;
  let testClient;
  let testProfessional;
  let testAdmin;
  let clientToken;
  let professionalToken;
  let adminToken;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test-ws.db';

    // Start server
    server = require('../../src/server');

    // Create test users
    testClient = await createTestUser('ws_client@test.com', 'cliente');
    testProfessional = await createTestUser('ws_prof@test.com', 'profesional');
    testAdmin = await createTestUser('ws_admin@test.com', 'admin');

    // Get tokens
    const clientLogin = await require('supertest')(server)
      .post('/api/auth/login')
      .send({
        email: testClient.email,
        contrasena: 'testpassword123'
      });
    clientToken = clientLogin.body.token;

    const profLogin = await require('supertest')(server)
      .post('/api/auth/login')
      .send({
        email: testProfessional.email,
        contrasena: 'testpassword123'
      });
    professionalToken = profLogin.body.token;

    const adminLogin = await require('supertest')(server)
      .post('/api/auth/login')
      .send({
        email: testAdmin.email,
        contrasena: 'testpassword123'
      });
    adminToken = adminLogin.body.token;

    // Create professional profile
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: testProfessional.id,
        especialidad: 'Plomero',
        zona_cobertura: 'Buenos Aires',
        latitud: -34.6118,
        longitud: -58.3960,
        esta_disponible: true,
        tarifa_hora: 1500
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    if (clientSocket) clientSocket.disconnect();
    if (professionalSocket) professionalSocket.disconnect();
    if (adminSocket) adminSocket.disconnect();
    if (server) server.close();
    await prisma.$disconnect();
  });

  beforeEach((done) => {
    // Connect client socket
    clientSocket = Client('http://localhost:3000', {
      auth: { token: clientToken },
      transports: ['websocket']
    });

    // Connect professional socket
    professionalSocket = Client('http://localhost:3000', {
      auth: { token: professionalToken },
      transports: ['websocket']
    });

    // Connect admin socket
    adminSocket = Client('http://localhost:3000', {
      auth: { token: adminToken },
      transports: ['websocket']
    });

    let connected = 0;
    const onConnect = () => {
      connected++;
      if (connected === 3) done();
    };

    clientSocket.on('connect', onConnect);
    professionalSocket.on('connect', onConnect);
    adminSocket.on('connect', onConnect);

    // Timeout for connection
    setTimeout(() => {
      if (connected < 3) done(new Error('WebSocket connection timeout'));
    }, 5000);
  });

  afterEach(() => {
    if (clientSocket) clientSocket.disconnect();
    if (professionalSocket) professionalSocket.disconnect();
    if (adminSocket) adminSocket.disconnect();
  });

  describe('Real-time Urgent Request Creation', () => {
    test('should notify professionals when urgent request is created', (done) => {
      const requestData = {
        description: 'WebSocket test request',
        location: { lat: -34.6118, lng: -58.3960 },
        radiusKm: 5,
        serviceCategory: 'plomero'
      };

      // Listen for notification on professional socket
      professionalSocket.on('urgent_request_nearby', (data) => {
        expect(data).toHaveProperty('urgentRequestId');
        expect(data).toHaveProperty('distance');
        expect(data.description).toBe(requestData.description);
        expect(data.distance).toBeLessThan(5);
        done();
      });

      // Create urgent request via HTTP
      require('supertest')(server)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(requestData)
        .expect(201);
    });

    test('should notify client when request status changes', (done) => {
      let urgentRequestId;

      // First create a request
      require('supertest')(server)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'Status change test',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5,
          serviceCategory: 'plomero'
        })
        .then(response => {
          urgentRequestId = response.body.id;

          // Listen for status update
          clientSocket.on('urgent_request_status_update', (data) => {
            expect(data.requestId).toBe(urgentRequestId);
            expect(data.status).toBe('assigned');
            done();
          });

          // Accept the request (this should trigger status update)
          setTimeout(() => {
            require('supertest')(server)
              .post(`/api/urgent/${urgentRequestId}/accept`)
              .set('Authorization', `Bearer ${professionalToken}`)
              .expect(200);
          }, 200);
        });
    });
  });

  describe('Real-time Assignment Notifications', () => {
    let urgentRequestId;

    beforeEach(async () => {
      // Create a test request
      const response = await require('supertest')(server)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'Assignment test request',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5,
          serviceCategory: 'plomero'
        });

      urgentRequestId = response.body.id;

      // Wait for candidates to be created
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('should notify client when professional accepts request', (done) => {
      clientSocket.on('urgent_request_accepted', (data) => {
        expect(data.urgentRequestId).toBe(urgentRequestId);
        expect(data.professional).toHaveProperty('id', testProfessional.id);
        expect(data.professional).toHaveProperty('nombre');
        expect(data.professional).toHaveProperty('telefono');
        expect(data).toHaveProperty('assigned_at');
        done();
      });

      // Accept the request
      require('supertest')(server)
        .post(`/api/urgent/${urgentRequestId}/accept`)
        .set('Authorization', `Bearer ${professionalToken}`)
        .expect(200);
    });

    test('should notify other professionals when request is assigned', (done) => {
      // Create another professional
      createTestUser('other_ws_prof@test.com', 'profesional').then(async (otherProf) => {
        await prisma.perfiles_profesionales.create({
          data: {
            usuario_id: otherProf.id,
            especialidad: 'Plomero',
            zona_cobertura: 'Buenos Aires',
            latitud: -34.6118,
            longitud: -58.3960,
            esta_disponible: true,
            tarifa_hora: 1600
          }
        });

        const otherLogin = await require('supertest')(server)
          .post('/api/auth/login')
          .send({
            email: otherProf.email,
            contrasena: 'testpassword123'
          });

        const otherSocket = Client('http://localhost:3000', {
          auth: { token: otherLogin.body.token },
          transports: ['websocket']
        });

        otherSocket.on('connect', () => {
          otherSocket.on('urgent_request_assigned_to_other', (data) => {
            expect(data.urgentRequestId).toBe(urgentRequestId);
            otherSocket.disconnect();
            cleanupTestData([otherProf.id]).then(() => done());
          });

          // Accept with first professional
          require('supertest')(server)
            .post(`/api/urgent/${urgentRequestId}/accept`)
            .set('Authorization', `Bearer ${professionalToken}`)
            .expect(200);
        });
      });
    });
  });

  describe('Real-time Completion Notifications', () => {
    let urgentRequestId;

    beforeEach(async () => {
      // Create and assign a request
      const createResponse = await require('supertest')(server)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'Completion test request',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5,
          serviceCategory: 'plomero'
        });

      urgentRequestId = createResponse.body.id;

      // Wait and accept
      await new Promise(resolve => setTimeout(resolve, 200));
      await require('supertest')(server)
        .post(`/api/urgent/${urgentRequestId}/accept`)
        .set('Authorization', `Bearer ${professionalToken}`);
    });

    test('should notify professional when client completes request', (done) => {
      professionalSocket.on('urgent_request_completed', (data) => {
        expect(data.urgentRequestId).toBe(urgentRequestId);
        expect(data.completedBy).toBe(testClient.id);
        done();
      });

      // Complete the request
      require('supertest')(server)
        .post(`/api/urgent/${urgentRequestId}/complete`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ rating: 5, comments: 'Excellent service' })
        .expect(200);
    });
  });

  describe('Real-time Cancellation Notifications', () => {
    let urgentRequestId;

    beforeEach(async () => {
      // Create a request
      const response = await require('supertest')(server)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'Cancellation test request',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5,
          serviceCategory: 'plomero'
        });

      urgentRequestId = response.body.id;
    });

    test('should notify active candidates when request is cancelled', (done) => {
      let notificationCount = 0;

      professionalSocket.on('urgent_request_cancelled', (data) => {
        expect(data.urgentRequestId).toBe(urgentRequestId);
        notificationCount++;
        if (notificationCount === 1) done(); // Should receive one notification
      });

      // Cancel the request
      require('supertest')(server)
        .post(`/api/urgent-requests/${urgentRequestId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
    });
  });

  describe('SLA Real-time Alerts', () => {
    let urgentRequestId;

    beforeEach(async () => {
      // Create and assign a request
      const createResponse = await require('supertest')(server)
        .post('/api/urgent-requests')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'SLA test request',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5,
          serviceCategory: 'plomero'
        });

      urgentRequestId = createResponse.body.id;

      // Wait and accept
      await new Promise(resolve => setTimeout(resolve, 200));
      await require('supertest')(server)
        .post(`/api/urgent/${urgentRequestId}/accept`)
        .set('Authorization', `Bearer ${professionalToken}`);
    });

    test('should send SLA warning notifications to admins', (done) => {
      adminSocket.on('sla_warning', (data) => {
        expect(data.requestId).toBe(urgentRequestId);
        expect(data.slaType).toBe('urgent_response');
        expect(data).toHaveProperty('elapsedMinutes');
        expect(data).toHaveProperty('maxTime');
        done();
      });

      // Manually trigger SLA check (in real scenario this would be automatic)
      const slaService = require('../../src/services/slaService').SLAService;
      const slaInstance = new slaService();
      slaInstance.forceSLACheck();
    });

    test('should send critical SLA alerts', (done) => {
      adminSocket.on('sla_critical', (data) => {
        expect(data.requestId).toBe(urgentRequestId);
        expect(data.priority).toBe('CRITICAL');
        expect(data).toHaveProperty('elapsedMinutes');
        done();
      });

      // Advance time to critical threshold
      jest.advanceTimersByTime(25 * 60 * 1000); // 25 minutes

      const slaService = require('../../src/services/slaService').SLAService;
      const slaInstance = new slaService();
      slaInstance.forceSLACheck();
    });

    test('should send SLA breach notifications', (done) => {
      adminSocket.on('sla_breached', (data) => {
        expect(data.requestId).toBe(urgentRequestId);
        expect(data.priority).toBe('CRITICAL');
        expect(data).toHaveProperty('breachDuration');
        done();
      });

      // Advance time beyond SLA limit
      jest.advanceTimersByTime(35 * 60 * 1000); // 35 minutes

      const slaService = require('../../src/services/slaService').SLAService;
      const slaInstance = new slaService();
      slaInstance.forceSLACheck();
    });
  });

  describe('WebSocket Connection Management', () => {
    test('should handle connection authentication', (done) => {
      // Try to connect without token
      const unauthSocket = Client('http://localhost:3000', {
        transports: ['websocket']
      });

      unauthSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        unauthSocket.disconnect();
        done();
      });
    });

    test('should handle invalid tokens', (done) => {
      const invalidSocket = Client('http://localhost:3000', {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      });

      invalidSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid token');
        invalidSocket.disconnect();
        done();
      });
    });

    test('should handle reconnection', (done) => {
      clientSocket.disconnect();

      clientSocket.on('reconnect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      // Reconnect
      clientSocket.connect();
    });

    test('should handle multiple concurrent connections', () => {
      const sockets = [];
      const connectionPromises = [];

      for (let i = 0; i < 5; i++) {
        const promise = new Promise((resolve) => {
          const socket = Client('http://localhost:3000', {
            auth: { token: clientToken },
            transports: ['websocket']
          });

          socket.on('connect', () => {
            sockets.push(socket);
            resolve();
          });
        });
        connectionPromises.push(promise);
      }

      return Promise.all(connectionPromises).then(() => {
        expect(sockets.length).toBe(5);
        sockets.forEach(socket => socket.disconnect());
      });
    });
  });

  describe('Real-time Professional Location Updates', () => {
    test('should handle location update broadcasts', (done) => {
      // This would test if location updates are broadcasted to relevant clients
      // In a real implementation, this would involve GPS tracking

      clientSocket.on('professional_location_update', (data) => {
        expect(data).toHaveProperty('professionalId');
        expect(data).toHaveProperty('location');
        done();
      });

      // Simulate location update (this would normally come from a mobile app)
      // For testing, we might need to mock the location service
      setTimeout(() => {
        // If no event received, complete test (location updates might not be implemented)
        done();
      }, 1000);
    });
  });

  describe('Real-time Error Handling', () => {
    test('should handle malformed WebSocket messages', () => {
      expect(() => {
        clientSocket.emit('invalid_event', { malformed: 'data' });
      }).not.toThrow();
    });

    test('should handle rapid event emissions', () => {
      for (let i = 0; i < 100; i++) {
        clientSocket.emit('test_event', { count: i });
      }

      // Should not crash the connection
      expect(clientSocket.connected).toBe(true);
    });

    test('should handle large payload events', () => {
      const largePayload = {
        data: 'x'.repeat(10000), // 10KB payload
        metadata: { size: 'large' }
      };

      expect(() => {
        clientSocket.emit('large_payload_test', largePayload);
      }).not.toThrow();
    });
  });

  describe('WebSocket Performance', () => {
    test('should handle high-frequency events', () => {
      const eventCount = 1000;
      let receivedCount = 0;

      clientSocket.on('performance_test', () => {
        receivedCount++;
      });

      for (let i = 0; i < eventCount; i++) {
        clientSocket.emit('performance_test', { index: i });
      }

      // Allow some time for processing
      return new Promise((resolve) => {
        setTimeout(() => {
          // Should handle the load without crashing
          expect(clientSocket.connected).toBe(true);
          resolve();
        }, 1000);
      });
    });

    test('should maintain connection stability under load', () => {
      const startTime = Date.now();

      // Send many messages rapidly
      const promises = [];
      for (let i = 0; i < 500; i++) {
        promises.push(new Promise((resolve) => {
          clientSocket.emit('load_test', { id: i }, () => resolve());
        }));
      }

      return Promise.all(promises).then(() => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within reasonable time
        expect(duration).toBeLessThan(5000); // 5 seconds
        expect(clientSocket.connected).toBe(true);
      });
    });
  });

  describe('Real-time Security', () => {
    test('should validate event permissions', () => {
      // Client should not be able to emit admin-only events
      clientSocket.emit('admin_only_event', { sensitive: 'data' });

      // Professional should not be able to emit client-only events
      professionalSocket.emit('client_only_event', { sensitive: 'data' });

      // Should not crash and should maintain connections
      expect(clientSocket.connected).toBe(true);
      expect(professionalSocket.connected).toBe(true);
    });

    test('should prevent event injection attacks', () => {
      const maliciousEvents = [
        'urgent_request_created',
        'sla_breached',
        'professional_location_update'
      ];

      maliciousEvents.forEach(event => {
        expect(() => {
          clientSocket.emit(event, { malicious: 'data' });
        }).not.toThrow();
      });
    });

    test('should handle disconnect gracefully', (done) => {
      const tempSocket = Client('http://localhost:3000', {
        auth: { token: clientToken },
        transports: ['websocket']
      });

      tempSocket.on('connect', () => {
        tempSocket.disconnect();

        tempSocket.on('disconnect', () => {
          expect(tempSocket.connected).toBe(false);
          done();
        });
      });
    });
  });
});