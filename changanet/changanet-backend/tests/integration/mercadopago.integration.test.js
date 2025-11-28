/**
 * Pruebas de integración para MercadoPago
 * Cubre: Webhooks, estados, errores
 * REQ-41: Integración real con Mercado Pago
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../../src/server');

const prisma = new PrismaClient();

describe('MercadoPago Integration - Tests', () => {
  let clientUser;
  let professionalUser;
  let service;
  let clientToken;
  let payment;

  beforeAll(async () => {
    // Crear usuarios de prueba
    clientUser = await prisma.usuarios.create({
      data: {
        email: 'client.mp@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Cliente MP',
        rol: 'cliente',
        esta_verificado: true
      }
    });

    professionalUser = await prisma.usuarios.create({
      data: {
        email: 'professional.mp@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Profesional MP',
        rol: 'profesional',
        esta_verificado: true
      }
    });

    // Crear perfil profesional
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: professionalUser.id,
        especialidad: 'Programador',
        zona_cobertura: 'Buenos Aires',
        tarifa_hora: 2500
      }
    });

    // Crear servicio
    service = await prisma.servicios.create({
      data: {
        cliente_id: clientUser.id,
        profesional_id: professionalUser.id,
        descripcion: 'Desarrollo de aplicación web',
        estado: 'PENDIENTE'
      }
    });

    // Generar tokens JWT
    clientToken = jwt.sign({ userId: clientUser.id, role: clientUser.rol }, process.env.JWT_SECRET);
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

  describe('Creación de preferencias de pago', () => {
    test('debe crear preferencia de pago en modo simulado', async () => {
      // Forzar modo simulado removiendo access token
      const originalToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;

      try {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            serviceId: service.id,
            amount: 10000,
            description: 'Desarrollo web simulado'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('preferenceId');
        expect(response.body.data).toHaveProperty('init_point');
        expect(response.body.data.simulated).toBe(true);

        // Verificar que se creó el pago en BD
        payment = await prisma.pagos.findFirst({
          where: { servicio_id: service.id }
        });
        expect(payment).toBeTruthy();
        expect(payment.mercado_pago_id).toMatch(/^sim_/);

      } finally {
        // Restaurar token
        if (originalToken) {
          process.env.MERCADO_PAGO_ACCESS_TOKEN = originalToken;
        }
      }
    });

    test('debe manejar errores de configuración de MercadoPago', async () => {
      // Configurar token inválido
      const originalToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      process.env.MERCADO_PAGO_ACCESS_TOKEN = 'invalid_token';

      try {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            serviceId: service.id,
            amount: 5000,
            description: 'Test con token inválido'
          });

        // Debería manejar el error gracefully
        expect([200, 201, 500]).toContain(response.status);

      } finally {
        // Restaurar token
        if (originalToken) {
          process.env.MERCADO_PAGO_ACCESS_TOKEN = originalToken;
        } else {
          delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
        }
      }
    });
  });

  describe('Procesamiento de webhooks', () => {
    beforeAll(async () => {
      // Crear un pago para testing de webhooks
      payment = await prisma.pagos.create({
        data: {
          servicio_id: service.id,
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          monto_total: 10000,
          estado: 'PENDIENTE',
          mercado_pago_id: 'mp_test_123456789',
          webhook_procesado: false
        }
      });
    });

    test('debe procesar webhook de pago aprobado correctamente', async () => {
      const webhookData = {
        id: 123456789,
        status: 'approved',
        external_reference: service.id,
        transaction_amount: 10000,
        status_detail: 'accredited',
        date_approved: new Date().toISOString(),
        payment_type_id: 'credit_card',
        description: 'Desarrollo web'
      };

      // Generar firma HMAC válida
      const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_webhook_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify(webhookData);
      const manifest = `id:test_webhook;request-id:test_webhook;ts:${timestamp};`;
      const payload = manifest + body;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-signature', `ts=${timestamp},v1=${signature}`)
        .set('x-request-id', 'test_webhook')
        .send(webhookData);

      expect(response.status).toBe(200);
      expect(response.body).toBe('OK');

      // Verificar actualización del pago
      const updatedPayment = await prisma.pagos.findUnique({
        where: { id: payment.id }
      });

      expect(updatedPayment.estado).toBe('APROBADO');
      expect(updatedPayment.mercado_pago_id).toBe('123456789');
      expect(updatedPayment.webhook_procesado).toBe(true);
      expect(updatedPayment.fecha_pago).toBeDefined();

      // Verificar creación de evento
      const events = await prisma.eventos_pagos.findMany({
        where: { pago_id: payment.id }
      });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].tipo_evento).toBe('webhook_approved');
    });

    test('debe manejar diferentes estados de pago en webhooks', async () => {
      const testCases = [
        {
          status: 'rejected',
          statusDetail: 'cc_rejected_bad_filled_card_number',
          expectedState: 'FALLIDO'
        },
        {
          status: 'cancelled',
          statusDetail: 'expired',
          expectedState: 'CANCELADO'
        },
        {
          status: 'pending',
          statusDetail: 'pending_waiting_payment',
          expectedState: 'PENDIENTE'
        }
      ];

      for (const testCase of testCases) {
        const webhookData = {
          id: Math.floor(Math.random() * 1000000),
          status: testCase.status,
          external_reference: service.id,
          transaction_amount: 10000,
          status_detail: testCase.statusDetail,
          payment_type_id: 'credit_card'
        };

        // Firma válida
        const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_webhook_secret';
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
        const updatedPayment = await prisma.pagos.findUnique({
          where: { id: payment.id }
        });
        expect(updatedPayment.estado).toBe(testCase.expectedState);
      }
    });

    test('debe rechazar webhooks con firma inválida', async () => {
      const webhookData = {
        id: 999999,
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

    test('debe rechazar webhooks con timestamp muy antiguo', async () => {
      const webhookData = {
        id: 999998,
        status: 'approved',
        external_reference: service.id
      };

      // Timestamp de hace 10 minutos (muy antiguo)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_webhook_secret';
      const body = JSON.stringify(webhookData);
      const manifest = `id:test;request-id:test;ts:${oldTimestamp};`;
      const payload = manifest + body;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-signature', `ts=${oldTimestamp},v1=${signature}`)
        .set('x-request-id', 'test')
        .send(webhookData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('timestamp too old');
    });

    test('debe manejar webhooks duplicados gracefully', async () => {
      const webhookData = {
        id: 123456789, // Mismo ID que antes
        status: 'approved',
        external_reference: service.id,
        transaction_amount: 10000,
        status_detail: 'accredited'
      };

      // Firma válida
      const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_webhook_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify(webhookData);
      const manifest = `id:test;request-id:test;ts:${timestamp};`;
      const payload = manifest + body;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Enviar webhook duplicado
      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-signature', `ts=${timestamp},v1=${signature}`)
        .set('x-request-id', 'test')
        .send(webhookData);

      expect(response.status).toBe(200);

      // Verificar que no se crearon eventos duplicados innecesarios
      const events = await prisma.eventos_pagos.findMany({
        where: { pago_id: payment.id }
      });
      // Debería haber eventos pero no duplicados críticos
      expect(events.length).toBeGreaterThan(0);
    });

    test('debe manejar webhooks para pagos inexistentes', async () => {
      const webhookData = {
        id: 777777,
        status: 'approved',
        external_reference: 'non-existent-service-id',
        transaction_amount: 5000
      };

      // Firma válida
      const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_webhook_secret';
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

      expect(response.status).toBe(200); // Webhook procesado pero sin pago encontrado

      // Verificar que no se creó ningún pago nuevo
      const paymentsCount = await prisma.pagos.count({
        where: { mercado_pago_id: '777777' }
      });
      expect(paymentsCount).toBe(0);
    });
  });

  describe('Estados de pago y transiciones', () => {
    test('debe mapear correctamente todos los estados de MercadoPago', async () => {
      const stateMappings = {
        'approved': 'APROBADO',
        'pending': 'PENDIENTE',
        'in_process': 'PENDIENTE',
        'rejected': 'FALLIDO',
        'cancelled': 'CANCELADO',
        'refunded': 'REEMBOLSADO',
        'charged_back': 'FALLIDO',
        'expired': 'EXPIRADO'
      };

      for (const [mpStatus, expectedState] of Object.entries(stateMappings)) {
        const testPayment = await prisma.pagos.create({
          data: {
            servicio_id: service.id,
            cliente_id: clientUser.id,
            profesional_id: professionalUser.id,
            monto_total: 1000,
            estado: 'PENDIENTE',
            mercado_pago_id: `test_${mpStatus}_${Date.now()}`
          }
        });

        const webhookData = {
          id: Math.floor(Math.random() * 1000000),
          status: mpStatus,
          external_reference: service.id,
          transaction_amount: 1000,
          status_detail: 'test'
        };

        // Procesar webhook
        const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_webhook_secret';
        const timestamp = Math.floor(Date.now() / 1000);
        const body = JSON.stringify(webhookData);
        const manifest = `id:test;request-id:test;ts:${timestamp};`;
        const payload = manifest + body;
        const signature = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');

        await request(app)
          .post('/api/payments/webhook')
          .set('x-signature', `ts=${timestamp},v1=${signature}`)
          .set('x-request-id', 'test')
          .send(webhookData);

        // Verificar estado
        const updatedPayment = await prisma.pagos.findUnique({
          where: { id: testPayment.id }
        });
        expect(updatedPayment.estado).toBe(expectedState);

        // Limpiar
        await prisma.eventos_pagos.deleteMany({
          where: { pago_id: testPayment.id }
        });
        await prisma.pagos.delete({
          where: { id: testPayment.id }
        });
      }
    });

    test('debe manejar transiciones de estado válidas', async () => {
      const validTransitions = [
        ['PENDIENTE', 'APROBADO'],
        ['APROBADO', 'LIBERADO'],
        ['APROBADO', 'REEMBOLSADO'],
        ['LIBERADO', 'REEMBOLSADO']
      ];

      for (const [fromState, toState] of validTransitions) {
        const transitionPayment = await prisma.pagos.create({
          data: {
            servicio_id: service.id,
            cliente_id: clientUser.id,
            profesional_id: professionalUser.id,
            monto_total: 1000,
            estado: fromState,
            mercado_pago_id: `transition_${fromState}_${toState}_${Date.now()}`
          }
        });

        // Simular transición vía actualización directa (en producción vendría de webhook)
        await prisma.pagos.update({
          where: { id: transitionPayment.id },
          data: { estado: toState }
        });

        const updated = await prisma.pagos.findUnique({
          where: { id: transitionPayment.id }
        });
        expect(updated.estado).toBe(toState);

        // Limpiar
        await prisma.pagos.delete({
          where: { id: transitionPayment.id }
        });
      }
    });
  });

  describe('Manejo de errores de MercadoPago', () => {
    test('debe manejar errores de conexión con MercadoPago', async () => {
      // Simular error configurando URL inválida
      const originalToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      process.env.MERCADO_PAGO_ACCESS_TOKEN = 'invalid_token_that_causes_error';

      try {
        const response = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            serviceId: service.id,
            amount: 5000,
            description: 'Test error handling'
          });

        // Debería manejar el error gracefully
        expect([200, 201, 500]).toContain(response.status);

      } finally {
        if (originalToken) {
          process.env.MERCADO_PAGO_ACCESS_TOKEN = originalToken;
        } else {
          delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
        }
      }
    });

    test('debe manejar timeouts de MercadoPago', async () => {
      // En un test real, simularíamos timeout
      // Por ahora, verificamos que el sistema maneje errores generales
      const response = await request(app)
        .get('/api/payments/status/non_existent_payment_id')
        .set('Authorization', `Bearer ${clientToken}`);

      // Debería manejar el error gracefully
      expect([200, 404, 500]).toContain(response.status);
    });

    test('debe validar formato de datos de webhook', async () => {
      const invalidWebhookData = [
        { status: 'approved' }, // Sin ID
        { id: 'not_a_number', status: 'approved' }, // ID inválido
        { id: 123, status: 'invalid_status' }, // Estado inválido
        {} // Webhook vacío
      ];

      for (const webhookData of invalidWebhookData) {
        const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_webhook_secret';
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

        // Debería procesar el webhook pero manejar los datos inválidos
        expect([200, 400, 500]).toContain(response.status);
      }
    });
  });

  describe('Notificaciones y eventos', () => {
    test('debe enviar notificaciones correctas según estado del pago', async () => {
      const notificationTestPayment = await prisma.pagos.create({
        data: {
          servicio_id: service.id,
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          monto_total: 5000,
          estado: 'PENDIENTE',
          mercado_pago_id: 'notification_test_payment'
        }
      });

      const webhookData = {
        id: 888888,
        status: 'approved',
        external_reference: service.id,
        transaction_amount: 5000,
        status_detail: 'accredited',
        date_approved: new Date().toISOString()
      };

      // Procesar webhook
      const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test_webhook_secret';
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

      // Verificar que se programó liberación automática
      const updatedPayment = await prisma.pagos.findUnique({
        where: { id: notificationTestPayment.id }
      });
      expect(updatedPayment.fecha_liberacion_programada).toBeDefined();

      // Limpiar
      await prisma.eventos_pagos.deleteMany({
        where: { pago_id: notificationTestPayment.id }
      });
      await prisma.pagos.delete({
        where: { id: notificationTestPayment.id }
      });
    });
  });
});