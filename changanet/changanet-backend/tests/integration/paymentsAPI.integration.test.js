/**
 * Pruebas de integración completas para API de Pagos
 * Cubre: Creación, estados, webhooks, validaciones
 * REQ-41: Integración con pasarelas de pago
 * REQ-42: Custodia de fondos hasta aprobación
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../../src/server');

const prisma = new PrismaClient();

describe('API de Pagos - Integration Tests', () => {
  let clientUser;
  let professionalUser;
  let service;
  let clientToken;
  let professionalToken;
  let paymentPreference;

  beforeAll(async () => {
    // Crear usuarios de prueba
    clientUser = await prisma.usuarios.create({
      data: {
        email: 'client.payments.api@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Cliente API Pagos',
        rol: 'cliente',
        esta_verificado: true
      }
    });

    professionalUser = await prisma.usuarios.create({
      data: {
        email: 'professional.payments.api@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Profesional API Pagos',
        rol: 'profesional',
        esta_verificado: true
      }
    });

    // Crear perfil profesional
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: professionalUser.id,
        especialidad: 'Electricista',
        zona_cobertura: 'Buenos Aires',
        tarifa_hora: 2000
      }
    });

    // Crear servicio
    service = await prisma.servicios.create({
      data: {
        cliente_id: clientUser.id,
        profesional_id: professionalUser.id,
        descripcion: 'Instalación eléctrica completa',
        estado: 'PENDIENTE'
      }
    });

    // Generar tokens JWT
    clientToken = jwt.sign({ userId: clientUser.id, role: clientUser.rol }, process.env.JWT_SECRET);
    professionalToken = jwt.sign({ userId: professionalUser.id, role: professionalUser.rol }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.eventos_pagos.deleteMany({
      where: {
        pago: {
          servicio_id: service.id
        }
      }
    });

    await prisma.comisiones_historial.deleteMany({
      where: { servicio_id: service.id }
    });

    await prisma.disputas_pagos.deleteMany({
      where: {
        pago: {
          servicio_id: service.id
        }
      }
    });

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

  describe('POST /api/payments/create-preference', () => {
    test('debe crear preferencia de pago exitosamente', async () => {
      const response = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          amount: 5000,
          description: 'Servicio de instalación eléctrica'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('preferenceId');
      expect(response.body.data).toHaveProperty('paymentId');

      // Verificar que se creó el pago en BD
      const payment = await prisma.pagos.findFirst({
        where: { servicio_id: service.id }
      });
      expect(payment).toBeTruthy();
      expect(payment.monto_total).toBe(5000);
      expect(payment.estado).toBe('PENDIENTE');
      expect(payment.comision_plataforma).toBe(0); // No se cobra comisión aún

      paymentPreference = response.body.data;
    });

    test('debe rechazar creación sin serviceId', async () => {
      const response = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: 5000
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('serviceId');
    });

    test('debe rechazar creación sin autenticación', async () => {
      const response = await request(app)
        .post('/api/payments/create-preference')
        .send({
          serviceId: service.id,
          amount: 5000
        });

      expect(response.status).toBe(401);
    });

    test('debe rechazar creación para servicio que no pertenece al cliente', async () => {
      // Crear otro cliente
      const otherClient = await prisma.usuarios.create({
        data: {
          email: 'other.client.api@example.com',
          hash_contrasena: '$2a$10$hashedpassword',
          nombre: 'Otro Cliente API',
          rol: 'cliente',
          esta_verificado: true
        }
      });

      const otherToken = jwt.sign({ userId: otherClient.id, role: otherClient.rol }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          serviceId: service.id,
          amount: 3000
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('permiso');

      // Limpiar
      await prisma.usuarios.delete({ where: { id: otherClient.id } });
    });

    test('debe rechazar creación para servicio ya pagado', async () => {
      // Cambiar estado del servicio
      await prisma.servicios.update({
        where: { id: service.id },
        data: { estado: 'COMPLETADO' }
      });

      const response = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          amount: 5000
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Ya existe un pago');

      // Restaurar estado
      await prisma.servicios.update({
        where: { id: service.id },
        data: { estado: 'PENDIENTE' }
      });
    });

    test('debe validar montos mínimos y máximos', async () => {
      const testCases = [
        { amount: 100, expectedError: 'mínimo' }, // Monto muy bajo
        { amount: 1000000, expectedError: 'máximo' } // Monto muy alto
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            serviceId: service.id,
            amount: testCase.amount
          });

        expect(response.status).toBe(500); // Error del servicio
        expect(response.body.error).toContain(testCase.expectedError);
      }
    });
  });

  describe('GET /api/payments/status/:paymentId', () => {
    test('debe obtener estado de pago existente', async () => {
      const response = await request(app)
        .get(`/api/payments/status/${paymentPreference.preferenceId}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('debe requerir autenticación', async () => {
      const response = await request(app)
        .get('/api/payments/status/mock-payment-id');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/payments/webhook', () => {
    test('debe procesar webhook de pago aprobado', async () => {
      const webhookData = {
        id: 123456789,
        status: 'approved',
        external_reference: service.id,
        transaction_amount: 5000,
        status_detail: 'accredited',
        date_approved: new Date().toISOString(),
        payment_type_id: 'credit_card'
      };

      // Generar firma HMAC simulada
      const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify(webhookData);
      const manifest = `id:test;request-id:test;ts:${timestamp};`;
      const payload = manifest + body;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-signature', `ts=${timestamp},v1=${signature}`)
        .set('x-request-id', 'test')
        .send(webhookData);

      expect(response.status).toBe(200);
      expect(response.body).toBe('OK');

      // Verificar que se actualizó el pago
      const payment = await prisma.pagos.findFirst({
        where: { servicio_id: service.id }
      });
      expect(payment.estado).toBe('APROBADO');
      expect(payment.mercado_pago_id).toBe('123456789');
      expect(payment.webhook_procesado).toBe(true);
    });

    test('debe rechazar webhook con firma inválida', async () => {
      const webhookData = {
        id: 123456789,
        status: 'approved',
        external_reference: service.id
      };

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-signature', 'ts=123456789,v1=invalid_signature')
        .send(webhookData);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid webhook signature');
    });

    test('debe manejar diferentes estados de pago', async () => {
      const testCases = [
        { status: 'rejected', expectedState: 'FALLIDO' },
        { status: 'cancelled', expectedState: 'CANCELADO' },
        { status: 'expired', expectedState: 'EXPIRADO' }
      ];

      for (const testCase of testCases) {
        const webhookData = {
          id: Math.floor(Math.random() * 1000000),
          status: testCase.status,
          external_reference: service.id,
          transaction_amount: 5000,
          status_detail: 'test',
          date_approved: null
        };

        // Firma válida
        const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_secret';
        const timestamp = Math.floor(Date.now() / 1000);
        const body = JSON.stringify(webhookData);
        const manifest = `id:test;request-id:test;ts:${timestamp};`;
        const payload = manifest + body;
        const signature = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');

        const response = await request(app)
          .post('/api/payments/webhook')
          .set('x-signature', `ts=${timestamp},v1=${signature}`)
          .set('x-request-id', 'test')
          .send(webhookData);

        expect(response.status).toBe(200);

        // Verificar estado actualizado
        const payment = await prisma.pagos.findFirst({
          where: { servicio_id: service.id }
        });
        expect(payment.estado).toBe(testCase.expectedState);
      }
    });
  });

  describe('POST /api/payments/release-funds', () => {
    beforeAll(async () => {
      // Cambiar servicio a completado para poder liberar fondos
      await prisma.servicios.update({
        where: { id: service.id },
        data: { estado: 'COMPLETADO' }
      });
    });

    test('cliente debe poder liberar fondos de servicio completado', async () => {
      const payment = await prisma.pagos.findFirst({
        where: { servicio_id: service.id }
      });

      const response = await request(app)
        .post('/api/payments/release-funds')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId: payment.mercado_pago_id,
          serviceId: service.id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('commission');
      expect(response.body.data).toHaveProperty('professionalAmount');

      // Verificar comisión aplicada (5% por defecto)
      expect(response.body.data.commission).toBe(250); // 5% de 5000
      expect(response.body.data.professionalAmount).toBe(4750); // 5000 - 250
    });

    test('debe rechazar liberación por profesional', async () => {
      const payment = await prisma.pagos.findFirst({
        where: { servicio_id: service.id }
      });

      const response = await request(app)
        .post('/api/payments/release-funds')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          paymentId: payment.mercado_pago_id,
          serviceId: service.id
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('permiso');
    });

    test('debe rechazar liberación de servicio no completado', async () => {
      // Cambiar estado a pendiente
      await prisma.servicios.update({
        where: { id: service.id },
        data: { estado: 'PENDIENTE' }
      });

      const payment = await prisma.pagos.findFirst({
        where: { servicio_id: service.id }
      });

      const response = await request(app)
        .post('/api/payments/release-funds')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId: payment.mercado_pago_id,
          serviceId: service.id
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('completado');

      // Restaurar estado
      await prisma.servicios.update({
        where: { id: service.id },
        data: { estado: 'COMPLETADO' }
      });
    });
  });

  describe('Validaciones de seguridad', () => {
    test('todos los endpoints deben requerir autenticación', async () => {
      const endpoints = [
        { method: 'post', path: '/api/payments/create-preference' },
        { method: 'get', path: '/api/payments/status/mock-id' },
        { method: 'post', path: '/api/payments/release-funds' },
        { method: 'post', path: '/api/payments/withdraw' },
        { method: 'get', path: '/api/payments/receipt/mock-id' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    test('debe validar formato de datos de entrada', async () => {
      const invalidData = [
        { serviceId: 'invalid-uuid', amount: 5000 },
        { serviceId: service.id, amount: 'not-a-number' },
        { serviceId: service.id, amount: -100 },
        { serviceId: '', amount: 5000 }
      ];

      for (const data of invalidData) {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send(data);

        expect([400, 500]).toContain(response.status);
        expect(response.body.error).toBeDefined();
      }
    });
  });
});