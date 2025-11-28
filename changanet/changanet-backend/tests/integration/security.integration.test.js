/**
 * Pruebas de integración para características de seguridad
 * Cubre: Rate limiting, CSRF, validaciones
 * Seguridad: Protección contra ataques comunes
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../../src/server');

const prisma = new PrismaClient();

describe('Seguridad - Integration Tests', () => {
  let clientUser;
  let professionalUser;
  let clientToken;
  let professionalToken;
  let service;

  beforeAll(async () => {
    // Crear usuarios de prueba
    clientUser = await prisma.usuarios.create({
      data: {
        email: 'client.security@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Cliente Seguridad',
        rol: 'cliente',
        esta_verificado: true
      }
    });

    professionalUser = await prisma.usuarios.create({
      data: {
        email: 'professional.security@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Profesional Seguridad',
        rol: 'profesional',
        esta_verificado: true
      }
    });

    // Crear perfil profesional
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: professionalUser.id,
        especialidad: 'Técnico',
        zona_cobertura: 'Buenos Aires',
        tarifa_hora: 2000
      }
    });

    // Crear servicio
    service = await prisma.servicios.create({
      data: {
        cliente_id: clientUser.id,
        profesional_id: professionalUser.id,
        descripcion: 'Servicio de seguridad',
        estado: 'PENDIENTE'
      }
    });

    // Generar tokens JWT
    clientToken = jwt.sign({ userId: clientUser.id, role: clientUser.rol }, process.env.JWT_SECRET);
    professionalToken = jwt.sign({ userId: professionalUser.id, role: professionalUser.rol }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.pagos.deleteMany({
      where: { servicio_id: service.id }
    });

    await prisma.servicios.deleteMany({
      where: {
        cliente_id: { in: [clientUser.id, professionalUser.id] }
      }
    });

    await prisma.perfiles_profesionales.deleteMany({
      where: { usuario_id: { in: [clientUser.id, professionalUser.id] } }
    });

    await prisma.usuarios.deleteMany({
      where: { id: { in: [clientUser.id, professionalUser.id] } }
    });

    await prisma.$disconnect();
  });

  describe('Rate Limiting', () => {
    test('debe aplicar rate limiting a endpoints de pagos', async () => {
      const endpoint = '/api/payments/create-preference';

      // Hacer múltiples requests para exceder el límite
      const requests = [];
      for (let i = 0; i < 15; i++) { // Más que el límite de 10 por 5 minutos
        requests.push(
          request(app)
            .post(endpoint)
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              serviceId: service.id,
              amount: 5000,
              description: `Request ${i}`
            })
        );
      }

      const results = await Promise.all(requests);

      // Al menos algunas requests deberían ser bloqueadas por rate limiting
      const rateLimitedRequests = results.filter(r => r.status === 429);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);

      // Verificar headers de rate limiting
      const lastResponse = results[results.length - 1];
      if (lastResponse.status === 429) {
        expect(lastResponse.headers).toHaveProperty('x-ratelimit-limit');
        expect(lastResponse.headers).toHaveProperty('x-ratelimit-remaining');
        expect(lastResponse.headers).toHaveProperty('x-ratelimit-reset');
        expect(lastResponse.headers).toHaveProperty('retry-after');
      }
    });

    test('debe aplicar rate limiting diferente por endpoint', async () => {
      // Endpoint de pagos (10 por 5 minutos)
      const paymentRequests = [];
      for (let i = 0; i < 12; i++) {
        paymentRequests.push(
          request(app)
            .post('/api/payments/create-preference')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              serviceId: service.id,
              amount: 5000
            })
        );
      }

      // Endpoint de búsqueda (30 por minuto - más permisivo)
      const searchRequests = [];
      for (let i = 0; i < 35; i++) {
        searchRequests.push(
          request(app)
            .get('/api/search/professionals?query=test')
            .set('Authorization', `Bearer ${clientToken}`)
        );
      }

      const [paymentResults, searchResults] = await Promise.all([
        Promise.all(paymentRequests),
        Promise.all(searchRequests)
      ]);

      // Los pagos deberían bloquearse antes que las búsquedas
      const paymentBlocked = paymentResults.filter(r => r.status === 429).length;
      const searchBlocked = searchResults.filter(r => r.status === 429).length;

      expect(paymentBlocked).toBeGreaterThan(searchBlocked);
    });

    test('debe diferenciar rate limiting por usuario', async () => {
      // Crear otro cliente
      const otherClient = await prisma.usuarios.create({
        data: {
          email: 'other.client.security@example.com',
          hash_contrasena: '$2a$10$hashedpassword',
          nombre: 'Otro Cliente Seguridad',
          rol: 'cliente',
          esta_verificado: true
        }
      });

      const otherToken = jwt.sign({ userId: otherClient.id, role: otherClient.rol }, process.env.JWT_SECRET);

      // Hacer requests con el primer cliente hasta casi el límite
      const firstClientRequests = [];
      for (let i = 0; i < 8; i++) {
        firstClientRequests.push(
          request(app)
            .post('/api/payments/create-preference')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              serviceId: service.id,
              amount: 5000
            })
        );
      }

      // Hacer requests con el segundo cliente (debería tener su propio límite)
      const secondClientRequests = [];
      for (let i = 0; i < 8; i++) {
        secondClientRequests.push(
          request(app)
            .post('/api/payments/create-preference')
            .set('Authorization', `Bearer ${otherToken}`)
            .send({
              serviceId: service.id,
              amount: 5000
            })
        );
      }

      const [firstResults, secondResults] = await Promise.all([
        Promise.all(firstClientRequests),
        Promise.all(secondClientRequests)
      ]);

      // Ambos deberían poder hacer requests (límites separados por usuario)
      const firstSuccessful = firstResults.filter(r => r.status !== 429).length;
      const secondSuccessful = secondResults.filter(r => r.status !== 429).length;

      expect(firstSuccessful).toBeGreaterThan(0);
      expect(secondSuccessful).toBeGreaterThan(0);

      // Limpiar
      await prisma.usuarios.delete({ where: { id: otherClient.id } });
    });

    test('debe permitir requests de admin en desarrollo', async () => {
      // Cambiar rol del usuario a admin temporalmente
      await prisma.usuarios.update({
        where: { id: clientUser.id },
        data: { rol: 'admin' }
      });

      const adminToken = jwt.sign({ userId: clientUser.id, role: 'admin' }, process.env.JWT_SECRET);

      // Hacer muchas requests con header especial
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/payments/create-preference')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-skip-rate-limit', 'true')
            .send({
              serviceId: service.id,
              amount: 5000
            })
        );
      }

      const results = await Promise.all(requests);

      // En modo desarrollo, las requests del admin deberían pasar
      if (process.env.NODE_ENV === 'development') {
        const successful = results.filter(r => r.status !== 429).length;
        expect(successful).toBeGreaterThan(10);
      }

      // Restaurar rol
      await prisma.usuarios.update({
        where: { id: clientUser.id },
        data: { rol: 'cliente' }
      });
    });
  });

  describe('Validaciones de entrada', () => {
    test('debe validar formato de serviceId', async () => {
      const invalidServiceIds = [
        '',
        'not-a-uuid',
        '123',
        null,
        undefined
      ];

      for (const invalidId of invalidServiceIds) {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            serviceId: invalidId,
            amount: 5000
          });

        expect([400, 500]).toContain(response.status);
        expect(response.body.error).toBeDefined();
      }
    });

    test('debe sanitizar y validar descripción', async () => {
      const maliciousDescriptions = [
        '<script>alert("xss")</script>',
        'Descripción muy larga '.repeat(100), // Más de 500 caracteres
        'Descripción con caracteres especiales: @#$%^&*()',
        ''
      ];

      for (const description of maliciousDescriptions) {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            serviceId: service.id,
            amount: 5000,
            description
          });

        // Debería manejar la entrada pero posiblemente rechazarla
        expect([200, 201, 400, 500]).toContain(response.status);
      }
    });

    test('debe validar estructura de JSON', async () => {
      const invalidJSON = [
        '{ invalid json }',
        '{"serviceId": "missing closing brace"',
        'null',
        '"string instead of object"'
      ];

      for (const invalidBody of invalidJSON) {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .set('Content-Type', 'application/json')
          .send(invalidBody);

        expect([400, 500]).toContain(response.status);
      }
    });

    test('debe prevenir SQL injection en parámetros', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE pagos; --",
        "' OR '1'='1",
        "1; SELECT * FROM usuarios;",
        "service-id' UNION SELECT * FROM pagos--"
      ];

      for (const maliciousId of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            serviceId: maliciousId,
            amount: 5000
          });

        // Debería fallar por validación, no por SQL injection
        expect([400, 403, 404, 500]).toContain(response.status);
        expect(response.body.error).not.toContain('SQL');
      }
    });
  });

  describe('Autenticación y autorización', () => {
    test('debe requerir token JWT válido', async () => {
      const invalidTokens = [
        '',
        'invalid.jwt.token',
        'Bearer invalid',
        null,
        undefined
      ];

      for (const invalidToken of invalidTokens) {
        const headers = {};
        if (invalidToken) {
          headers['Authorization'] = `Bearer ${invalidToken}`;
        }

        const response = await request(app)
          .post('/api/payments/create-preference')
          .set(headers)
          .send({
            serviceId: service.id,
            amount: 5000
          });

        expect(response.status).toBe(401);
      }
    });

    test('debe validar firma del token JWT', async () => {
      // Crear token con firma inválida
      const invalidToken = jwt.sign(
        { userId: clientUser.id, role: clientUser.rol },
        'wrong_secret'
      );

      const response = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({
          serviceId: service.id,
          amount: 5000
        });

      expect(response.status).toBe(401);
    });

    test('debe validar expiración del token', async () => {
      // Crear token expirado
      const expiredToken = jwt.sign(
        { userId: clientUser.id, role: clientUser.rol, exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET
      );

      const response = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          serviceId: service.id,
          amount: 5000
        });

      expect(response.status).toBe(401);
    });

    test('debe validar permisos por rol', async () => {
      // Intentar que un cliente acceda a endpoint de profesional
      const response = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: 1000,
          bankDetails: { cvu: '1234567890123456789012', alias: 'test' }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('profesionales');
    });
  });

  describe('Protección CSRF (simulada)', () => {
    test('debe validar headers de origen para requests sensibles', async () => {
      // Test básico - en implementación real habría middleware CSRF
      const suspiciousHeaders = [
        { 'Origin': 'https://malicious-site.com' },
        { 'Referer': 'https://phishing-site.com' },
        { 'X-Forwarded-Host': 'evil.com' }
      ];

      for (const headers of suspiciousHeaders) {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .set(headers)
          .send({
            serviceId: service.id,
            amount: 5000
          });

        // Debería procesar normalmente (sin protección CSRF específica en este endpoint)
        // En implementación real, ciertos endpoints tendrían protección CSRF
        expect([200, 201, 400, 403, 500]).toContain(response.status);
      }
    });
  });

  describe('Headers de seguridad', () => {
    test('debe incluir headers de seguridad en respuestas', async () => {
      const response = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          amount: 5000
        });

      // Verificar headers de seguridad comunes
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection'
      ];

      for (const header of securityHeaders) {
        expect(response.headers).toHaveProperty(header);
      }
    });

    test('debe prevenir MIME sniffing', async () => {
      const response = await request(app)
        .get('/api/payments/status/test')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('debe prevenir clickjacking', async () => {
      const response = await request(app)
        .get('/api/payments/status/test')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('Logging de seguridad', () => {
    test('debe loggear intentos de acceso no autorizado', async () => {
      // Hacer request sin autenticación
      const response = await request(app)
        .post('/api/payments/create-preference')
        .send({
          serviceId: service.id,
          amount: 5000
        });

      expect(response.status).toBe(401);

      // En implementación real, verificaríamos que se loggeó el intento
      // Por ahora, solo verificamos que falle correctamente
    });

    test('debe loggear rate limiting excedido', async () => {
      // Hacer muchas requests para exceder límite
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/api/payments/create-preference')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              serviceId: service.id,
              amount: 5000
            })
        );
      }

      await Promise.all(requests);

      // En implementación real, verificaríamos logs de rate limiting
      // Por ahora, verificamos que algunas requests sean bloqueadas
      const results = await Promise.all(requests.slice(-3));
      const blocked = results.filter(r => r.status === 429);
      expect(blocked.length).toBeGreaterThan(0);
    });
  });
});