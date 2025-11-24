// src/tests/unit/authController.test.js
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../server');

const prisma = new PrismaClient();

describe('Auth Controller', () => {
  beforeEach(async () => {
    await prisma.usuarios.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        rol: 'cliente'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('Usuario registrado exitosamente. Revisa tu email para verificar la cuenta.');

      const user = await prisma.usuarios.findUnique({ where: { email: userData.email } });
      expect(user).toBeTruthy();
      expect(user.email).toBe(userData.email);
      expect(user.nombre).toBe(userData.name);
      expect(await bcrypt.compare(userData.password, user.hash_contrasena)).toBe(true);
    });

    it('should return 400 if email already exists', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
        name: 'Duplicate User',
        rol: 'cliente'
      };

      // Crear usuario primero
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Intentar crearlo de nuevo
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('El email ya está registrado.');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login a user with valid credentials', async () => {
      const userData = {
        email: 'login@example.com',
        password: 'password123',
        name: 'Login User',
        rol: 'cliente'
      };

      // Registrar usuario primero
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Verificar usuario (simulación)
      await prisma.usuarios.update({
        where: { email: userData.email },
        data: { esta_verificado: true }
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid@example.com', password: 'wrong' })
        .expect(401);

      expect(response.body.error).toBe('Credenciales inválidas.');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const userData = {
        email: 'refresh@example.com',
        password: 'password123',
        name: 'Refresh User',
        rol: 'cliente'
      };

      // Registrar usuario
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Login para obtener refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password });

      const refreshToken = loginResponse.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // Refresh token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.message).toBe('Token refrescado exitosamente');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('Refresh token inválido');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user and revoke tokens', async () => {
      const userData = {
        email: 'logout@example.com',
        password: 'password123',
        name: 'Logout User',
        rol: 'cliente'
      };

      // Registrar y login
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password });

      const token = loginResponse.body.token;

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.message).toBe('Logout exitoso');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification email', async () => {
      const userData = {
        email: 'resend@example.com',
        password: 'password123',
        name: 'Resend User',
        rol: 'cliente'
      };

      // Registrar usuario
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Reenviar verificación
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: userData.email })
        .expect(200);

      expect(response.body.message).toBe('Email de verificación reenviado exitosamente');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' })
        .expect(404);

      expect(response.body.error).toBe('Usuario no encontrado');
    });
  });
});