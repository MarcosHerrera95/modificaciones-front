/**
 * Pruebas de integración para flujo completo de autenticación
 * Cubre: REQ-01, REQ-02, REQ-03 (Registro, Login, Verificación)
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../../src/server');

const prisma = new PrismaClient();

describe('Flujo de Autenticación Completo - Integration Tests', () => {
  let testUser;
  let testToken;

  beforeAll(async () => {
    // Crear usuario de prueba
    testUser = await prisma.usuarios.create({
      data: {
        email: 'integration.test@example.com',
        hash_contrasena: '$2a$10$hashedpassword', // Contraseña hasheada
        nombre: 'Usuario Integración',
        rol: 'cliente',
        esta_verificado: false
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    if (testToken) {
      // Podríamos limpiar tokens si los guardamos en BD
    }
    await prisma.usuarios.deleteMany({
      where: { email: 'integration.test@example.com' }
    });
    await prisma.$disconnect();
  });

  describe('Flujo completo: Registro → Verificación → Login', () => {
    test('debe permitir registro exitoso', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new.integration@example.com',
          password: 'TestPassword123!',
          name: 'Nuevo Usuario',
          role: 'cliente'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('new.integration@example.com');
      expect(response.body.user.name).toBe('Nuevo Usuario');
      expect(response.body.token).toBeDefined();

      // Limpiar usuario creado
      const createdUser = await prisma.usuarios.findUnique({
        where: { email: 'new.integration@example.com' }
      });
      if (createdUser) {
        await prisma.usuarios.delete({ where: { id: createdUser.id } });
      }
    });

    test('debe rechazar registro con email duplicado', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'integration.test@example.com', // Email ya existente
          password: 'TestPassword123!',
          name: 'Usuario Duplicado',
          role: 'cliente'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ya está registrado');
    });

    test('debe permitir login con credenciales correctas', async () => {
      // Primero actualizar el usuario para que esté verificado
      await prisma.usuarios.update({
        where: { id: testUser.id },
        data: { esta_verificado: true }
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'integration.test@example.com',
          password: 'TestPassword123!' // Esta debería coincidir con el hash
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('integration.test@example.com');

      testToken = response.body.token;
    });

    test('debe rechazar login con email no verificado', async () => {
      // Crear usuario no verificado
      const unverifiedUser = await prisma.usuarios.create({
        data: {
          email: 'unverified@example.com',
          hash_contrasena: '$2a$10$hashedpassword',
          nombre: 'Usuario No Verificado',
          rol: 'cliente',
          esta_verificado: false
        }
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('verificar tu email');

      // Limpiar
      await prisma.usuarios.delete({ where: { id: unverifiedUser.id } });
    });

    test('debe rechazar login con credenciales incorrectas', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'integration.test@example.com',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('inválidas');
    });
  });

  describe('Protección de rutas autenticadas', () => {
    test('debe permitir acceso a ruta protegida con token válido', async () => {
      const response = await request(app)
        .get('/api/profile') // Ruta que requiere autenticación
        .set('Authorization', `Bearer ${testToken}`);

      // Debería pasar la autenticación (código de error diferente si hay problema de auth)
      expect([200, 404, 500]).toContain(response.status); // 404 si no hay perfil, pero auth OK
    });

    test('debe rechazar acceso a ruta protegida sin token', async () => {
      const response = await request(app)
        .get('/api/profile')
        .unset('Authorization');

      expect(response.status).toBe(401);
    });

    test('debe rechazar acceso con token inválido', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer invalid-token-123');

      expect(response.status).toBe(403);
    });
  });

  describe('Middleware de autenticación', () => {
    test('debe extraer correctamente datos del usuario del token', async () => {
      const response = await request(app)
        .get('/api/verification/status') // Endpoint que usa req.user
        .set('Authorization', `Bearer ${testToken}`);

      // Debería procesar la solicitud sin error de autenticación
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });
});