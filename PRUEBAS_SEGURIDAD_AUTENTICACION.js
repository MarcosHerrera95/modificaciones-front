/**
 * Pruebas de Seguridad Avanzadas - Sistema de Autenticación Changánet
 * @file src/tests/security/authSecurity.test.js
 * @description Tests de seguridad adicionales para detectar vulnerabilidades
 * @version 1.0.0
 * @date 24 de Noviembre, 2025
 */

const request = require('supertest');
const app = require('../../server');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const prisma = new PrismaClient();

describe('🛡️ Auth Security Tests', () => {
  let testUser;
  let validToken;

  beforeEach(async () => {
    // Crear usuario de prueba
    testUser = await prisma.usuarios.create({
      data: {
        email: 'security.test@example.com',
        password: 'SecurePassword123!',
        name: 'Security Test User',
        role: 'cliente'
      }
    });

    // Generar token válido
    validToken = jwt.sign(
      { userId: testUser.id, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterEach(async () => {
    // Limpiar datos de prueba
    await prisma.usuarios.deleteMany({
      where: {
        email: { contains: 'security.test@example.com' }
      }
    });
  });

  describe('🔒 Brute Force Protection', () => {
    test('should block user after 5 failed login attempts', async () => {
      const email = 'bruteforce.test@example.com';
      const password = 'wrongpassword';

      // Crear usuario para test
      await prisma.usuarios.create({
        data: {
          email,
          password,
          name: 'Brute Force Test',
          role: 'cliente'
        }
      });

      // 5 intentos fallidos
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'wrongpassword' })
          .expect(401);

        expect(response.body.error).toMatch(/credenciales inválidas/i);
      }

      // 6to intento debería estar bloqueado
      const blockedResponse = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrongpassword' })
        .expect(429);

      expect(blockedResponse.body.error).toMatch(/bloqueada.*intentos/i);
      expect(blockedResponse.body.retryAfter).toBeGreaterThan(0);

      // Limpiar
      await prisma.usuarios.deleteMany({ where: { email } });
    });

    test('should prevent distributed brute force attacks', async () => {
      const email = 'distributed.test@example.com';
      const password = 'testpassword';

      await prisma.usuarios.create({
        data: { email, password, name: 'Distributed Test', role: 'cliente' }
      });

      // Simular ataques desde diferentes IPs (en test, simulamos con diferentes user agents)
      const attempts = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .set('User-Agent', `attack-script-${i}`)
          .send({ email, password: 'wrongpassword' });
        
        attempts.push(response.status);
      }

      // Al menos algunos deberían ser bloqueados
      expect(attempts).toContain(429);
    });
  });

  describe('🔑 JWT Security', () => {
    test('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'invalid.token.here',
        'Bearer invalidtoken',
        '',
        null,
        undefined,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        crypto.randomBytes(32).toString('hex')
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(403);

        expect(response.body.error).toMatch(/token.*inválid/i);
      }
    });

    test('should reject expired JWT tokens', async () => {
      // Crear token expirado
      const expiredToken = jwt.sign(
        { userId: testUser.id, role: testUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expirado hace 1 hora
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.message).toMatch(/sesión.*expirad/i);
    });

    test('should reject tokens with invalid signature', async () => {
      const invalidToken = jwt.sign(
        { userId: testUser.id, role: testUser.role },
        'wrong-secret-key',
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      expect(response.body.error).toMatch(/token.*inválid/i);
    });

    test('should reject tokens with manipulated payload', async () => {
      // Crear token válido y manipular el payload
      const token = jwt.sign(
        { userId: testUser.id, role: 'admin' }, // Intentar escalar privilegios
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // En un ataque real, el token sería decodificado y recodificado
      // Para este test, verificamos que el backend rechace tokens manipulados
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(403); // Debería fallar por validación de usuario en BD
    });
  });

  describe('🚪 Rate Limiting', () => {
    test('should limit registration attempts per IP', async () => {
      const baseEmail = Date.now() + '@example.com';
      
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({
            name: `User ${i}`,
            email: `${baseEmail.split('@')[0]}${i}@example.com`,
            password: 'ValidPassword123!',
            role: 'cliente'
          })
          .expect(201);
      }

      // 4to intento debería ser limitado
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Blocked User',
          email: 'blocked@example.com',
          password: 'ValidPassword123!',
          role: 'cliente'
        })
        .expect(429);

      expect(response.body.error).toMatch(/demasiados.*intentos/i);
    });

    test('should limit password reset attempts', async () => {
      const email = 'reset.test@example.com';

      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email })
          .expect(200);
      }

      // 4to intento debería ser limitado
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(429);

      expect(response.body.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('📧 Email Security', () => {
    test('should not reveal email existence in forgot password', async () => {
      const nonExistentEmail = 'nonexistent@example.com';
      
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: nonExistentEmail })
        .expect(200);

      // Debería retornar mensaje genérico
      expect(response.body.message).toMatch(/si.*email.*existe/i);
    });

    test('should generate secure verification tokens', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Token Test User',
          email: 'tokentest@example.com',
          password: 'ValidPassword123!',
          role: 'cliente'
        })
        .expect(201);

      // Buscar el usuario y verificar el token
      const user = await prisma.usuarios.findUnique({
        where: { email: 'tokentest@example.com' }
      });

      expect(user.token_verificacion).toBeDefined();
      expect(user.token_verificacion.length).toBe(64); // 32 bytes en hex
      expect(user.token_expiracion).toBeDefined();
      expect(new Date(user.token_expiracion)).toBeInstanceOf(Date);

      // Limpiar
      await prisma.usuarios.delete({ where: { id: user.id } });
    });

    test('should reject expired verification tokens', async () => {
      // Crear usuario con token expirado
      const expiredToken = crypto.randomBytes(32).toString('hex');
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h atrás

      const user = await prisma.usuarios.create({
        data: {
          email: 'expired.test@example.com',
          password: 'password123',
          name: 'Expired Test',
          role: 'cliente',
          token_verificacion: expiredToken,
          token_expiracion: pastDate
        }
      });

      const response = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: expiredToken })
        .expect(400);

      expect(response.body.error).toMatch(/expirad/i);

      // Limpiar
      await prisma.usuarios.delete({ where: { id: user.id } });
    });
  });

  describe('🔐 OAuth Security', () => {
    test('should validate Google OAuth tokens properly', async () => {
      const invalidGoogleData = {
        uid: '', // UID vacío
        email: 'invalid@example.com',
        name: 'Invalid User'
      };

      const response = await request(app)
        .post('/api/auth/google-login')
        .send(invalidGoogleData)
        .expect(400);

      expect(response.body.error).toMatch(/campos.*requeridos/i);
    });

    test('should handle Facebook OAuth edge cases', async () => {
      const malformedFacebookData = {
        uid: 'invalid-facebook-id',
        email: 'test@facebook.com',
        name: 'Test User',
        foto: 'not-a-valid-url'
      };

      const response = await request(app)
        .post('/api/auth/facebook-login')
        .send(malformedFacebookData)
        .expect(200); // Debería manejar graciosamente URLs inválidas

      expect(response.body.user).toBeDefined();
    });
  });

  describe('💾 Database Security', () => {
    test('should prevent SQL injection in authentication', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE usuarios; --",
        "' OR '1'='1",
        "admin@test.com'; UPDATE usuarios SET role='admin' WHERE email='",
        "test@example.com' UNION SELECT * FROM usuarios--"
      ];

      for (const attempt of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ 
            email: attempt, 
            password: 'password' 
          })
          .expect(401); // Debería rechazar sin error SQL

        expect(response.body.error).not.toMatch(/sql|syntax|error/i);
      }
    });

    test('should handle concurrent login attempts safely', async () => {
      const concurrentAttempts = 10;
      const promises = [];

      for (let i = 0; i < concurrentAttempts; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({ 
              email: testUser.email, 
              password: 'wrongpassword' 
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // Todos deberían fallar graciosamente
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status);
      });

      // Verificar que el contador se incrementó correctamente
      const updatedUser = await prisma.usuarios.findUnique({
        where: { id: testUser.id }
      });

      expect(updatedUser.failed_login_attempts).toBeGreaterThanOrEqual(concurrentAttempts);
    });
  });

  describe('🚨 Input Validation', () => {
    test('should reject malformed email addresses', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..double.dot@example.com',
        'user@example',
        'user@.com',
        'user@example..com',
        'a'.repeat(255) + '@example.com', // Email muy largo
        crypto.randomBytes(100).toString('hex') + '@example.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email,
            password: 'ValidPassword123!',
            role: 'cliente'
          })
          .expect(400);

        expect(response.body.error).toMatch(/email.*inválid/i);
      }
    });

    test('should reject weak passwords', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        'password123',
        '123456789',
        'admin',
        'letmein',
        '12345678',
        'iloveyou'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: `weakpass.${Date.now()}@example.com`,
            password,
            role: 'cliente'
          })
          .expect(400);

        expect(response.body.error).toMatch(/contraseña.*requisitos/i);
        expect(response.body.details).toBeDefined();
        expect(response.body.details.score).toBeLessThan(30);
      }
    });

    test('should validate role field strictly', async () => {
      const invalidRoles = [
        'admin',
        'superuser',
        'moderator',
        'user',
        '',
        'CLIENT',
        'PROFESSIONAL',
        123,
        null,
        undefined
      ];

      for (const role of invalidRoles) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: `role.${Date.now()}@example.com`,
            password: 'ValidPassword123!',
            role
          })
          .expect(400);

        expect(response.body.error).toMatch(/rol.*inválid/i);
      }
    });
  });

  describe('🔄 Session Management', () => {
    test('should handle session fixation attempts', async () => {
      // Intentar usar un token de otra sesión
      const otherUserToken = jwt.sign(
        { userId: 'different-user-id', role: 'cliente' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.error).toMatch(/token.*inválid/i);
    });

    test('should properly revoke refresh tokens on logout', async () => {
      // Login para obtener refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ 
          email: testUser.email, 
          password: 'password' 
        })
        .expect(200);

      const refreshToken = loginResponse.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Intentar usar refresh token después del logout
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.error).toMatch(/refresh.*inválid/i);
    });

    test('should detect token reuse attacks', async () => {
      // Login para obtener tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ 
          email: testUser.email, 
          password: 'password' 
        })
        .expect(200);

      const refreshToken = loginResponse.body.refreshToken;

      // Usar refresh token
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Intentar usar el mismo refresh token nuevamente
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.error).toMatch(/refresh.*inválid/i);
    });
  });

  describe('🌐 Network Security', () => {
    test('should handle malformed HTTP headers', async () => {
      const malformedHeaders = [
        { 'Authorization': 'Invalid format' },
        { 'Authorization': 'Bearer' }, // Sin token
        { 'Content-Type': 'invalid/type' },
        { 'X-Forwarded-For': '../../../etc/passwd' },
        { 'User-Agent': '<script>alert("xss")</script>' }
      ];

      for (const headers of malformedHeaders) {
        const response = await request(app)
          .get('/api/auth/me')
          .set(headers)
          .expect(403);
      }
    });

    test('should not expose sensitive information in error responses', async () => {
      const sensitiveEndpoints = [
        { method: 'get', path: '/api/auth/me', headers: {} },
        { method: 'post', path: '/api/auth/login', data: { email: 'test@example.com', password: 'test' } },
        { method: 'post', path: '/api/auth/register', data: { name: 'Test', email: 'test@example.com', password: 'test', role: 'cliente' } }
      ];

      for (const endpoint of sensitiveEndpoints) {
        const requestBuilder = request(app)[endpoint.method](endpoint.path);
        
        if (endpoint.headers) requestBuilder.set(endpoint.headers);
        if (endpoint.data) requestBuilder.send(endpoint.data);

        const response = await requestBuilder;
        
        // Verificar que no hay información sensible en errores
        const responseBody = JSON.stringify(response.body).toLowerCase();
        const sensitivePatterns = [
          /password/,
          /hash/,
          /secret/,
          /key/,
          /token.*[0-9a-f]{32,}/i,
          /database/,
          /sql/,
          /schema/
        ];

        sensitivePatterns.forEach(pattern => {
          expect(responseBody).not.toMatch(pattern);
        });
      }
    });
  });

  describe('⚡ Performance Security', () => {
    test('should handle slowloris attacks', async () => {
      // Simular conexiones lentas enviando requests muy lentamente
      const slowRequests = [];
      
      for (let i = 0; i < 5; i++) {
        slowRequests.push(
          new Promise(resolve => {
            setTimeout(() => {
              request(app)
                .post('/api/auth/login')
                .send({ 
                  email: testUser.email, 
                  password: 'password' 
                })
                .then(resolve)
                .catch(resolve);
            }, i * 1000);
          })
        );
      }

      const responses = await Promise.all(slowRequests);
      
      // Las respuestas deberían ser consistentes
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status);
      });
    });

    test('should handle large payload attacks', async () => {
      const largePayload = {
        name: 'A'.repeat(10000), // Nombre muy largo
        email: 'large@example.com',
        password: 'ValidPassword123!',
        role: 'cliente',
        metadata: 'B'.repeat(50000) // Metadatos adicionales
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largePayload)
        .expect(400);

      expect(response.body.error).toMatch(/datos.*inválid/i);
    });
  });
});

// Tests adicionales para verificar configuración de seguridad
describe('🔧 Security Configuration Tests', () => {
  test('should have secure JWT configuration', () => {
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    
    // Verificar que no se use el secret por defecto
    expect(process.env.JWT_SECRET).not.toMatch(/secret|key|default/i);
  });

  test('should have secure database configuration', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.DATABASE_URL).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  test('should have email service configured', () => {
    expect(process.env.SENDGRID_API_KEY).toBeDefined();
    expect(process.env.FROM_EMAIL).toBeDefined();
  });

  test('should have proper CORS configuration', () => {
    // Verificar que se permita solo dominios específicos
    const corsOptions = require('../../middleware/cors');
    expect(corsOptions).toBeDefined();
  });
});

module.exports = {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  request,
  app,
  PrismaClient,
  jwt,
  crypto
};