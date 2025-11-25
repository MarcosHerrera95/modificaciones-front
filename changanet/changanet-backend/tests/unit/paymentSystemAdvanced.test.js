/**
 * Tests avanzados del sistema de pagos
 * Incluye pruebas para disputas, reembolsos y eventos
 */

const request = require('supertest');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const paymentController = require('../../src/controllers/paymentController');
const paymentService = require('../../src/services/paymentsService');

const prisma = new PrismaClient();

// Mock del servicio de notificaciones
jest.mock('../../src/services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(true)
}));

// Mock del servicio de MercadoPago
jest.mock('../../src/services/mercadoPagoService', () => ({
  createPaymentPreference: jest.fn().mockResolvedValue({
    id: 'pref_test_123',
    init_point: 'https://test.mercadopago.com/test',
    sandbox_init_point: 'https://test.mercadopago.com/test'
  })
}));

describe('Sistema de Pagos - Funcionalidades Avanzadas', () => {
  let mockUser;
  let mockPayment;
  let mockService;

  beforeEach(async () => {
    // Limpiar base de datos
    await prisma.eventos_pagos.deleteMany();
    await prisma.disputas_pagos.deleteMany();
    await prisma.pagos.deleteMany();
    await prisma.servicios.deleteMany();
    await prisma.usuarios.deleteMany();

    // Crear datos de prueba
    mockUser = await prisma.usuarios.create({
      data: {
        id: 'user_test_123',
        email: 'test@example.com',
        nombre: 'Usuario Test',
        rol: 'cliente'
      }
    });

    const mockProfessional = await prisma.usuarios.create({
      data: {
        id: 'prof_test_456',
        email: 'prof@example.com',
        nombre: 'Profesional Test',
        rol: 'profesional'
      }
    });

    mockService = await prisma.servicios.create({
      data: {
        id: 'srv_test_789',
        cliente_id: 'user_test_123',
        profesional_id: 'prof_test_456',
        descripcion: 'Servicio de prueba',
        estado: 'PENDIENTE'
      }
    });

    mockPayment = await prisma.pagos.create({
      data: {
        id: 'pay_test_001',
        servicio_id: 'srv_test_789',
        cliente_id: 'user_test_123',
        profesional_id: 'prof_test_456',
        monto_total: 1000.00,
        comision_plataforma: 0,
        monto_profesional: 1000.00,
        estado: 'aprobado',
        mercado_pago_id: 'mp_test_123'
      }
    });
  });

  afterEach(async () => {
    // Limpiar después de cada test
    await prisma.eventos_pagos.deleteMany();
    await prisma.disputas_pagos.deleteMany();
    await prisma.pagos.deleteMany();
    await prisma.servicios.deleteMany();
    await prisma.usuarios.deleteMany();
  });

  describe('Crear Disputa', () => {
    test('Debe crear una disputa exitosamente', async () => {
      const req = {
        params: { paymentId: 'pay_test_001' },
        body: {
          motivo: 'servicio_no_completado',
          descripcion: 'El profesional no completó el servicio'
        },
        user: { id: 'user_test_123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.createDispute(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            disputeId: expect.stringContaining('disp_'),
            paymentId: 'pay_test_001',
            estado: 'abierta'
          })
        })
      );
    });

    test('Debe fallar si el pago no existe', async () => {
      const req = {
        params: { paymentId: 'pay_inexistente' },
        body: {
          motivo: 'servicio_no_completado',
          descripcion: 'Test'
        },
        user: { id: 'user_test_123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.createDispute(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('no encontrado')
        })
      );
    });

    test('Debe fallar si el usuario no está autorizado', async () => {
      const unauthorizedUser = await prisma.usuarios.create({
        data: {
          id: 'user_unauthorized',
          email: 'unauthorized@example.com',
          nombre: 'No Autorizado',
          rol: 'cliente'
        }
      });

      const req = {
        params: { paymentId: 'pay_test_001' },
        body: {
          motivo: 'servicio_no_completado',
          descripcion: 'Test'
        },
        user: { id: 'user_unauthorized' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.createDispute(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('autorización')
        })
      );
    });
  });

  describe('Procesar Reembolso', () => {
    test('Debe procesar un reembolso completo exitosamente', async () => {
      const req = {
        params: { paymentId: 'pay_test_001' },
        body: {
          amount: 1000.00,
          reason: 'servicio_no_completado'
        },
        user: { id: 'user_test_123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.processRefund(req, res);

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            refundId: expect.stringContaining('ref_'),
            amount: 1000.00,
            newStatus: 'reembolsado'
          })
        })
      );
    });

    test('Debe procesar un reembolso parcial', async () => {
      const req = {
        params: { paymentId: 'pay_test_001' },
        body: {
          amount: 500.00,
          reason: 'calidad_deficiente'
        },
        user: { id: 'user_test_123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.processRefund(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            amount: 500.00,
            newStatus: 'reembolsado_parcial'
          })
        })
      );
    });

    test('Debe fallar si el monto del reembolso es mayor al total', async () => {
      const req = {
        params: { paymentId: 'pay_test_001' },
        body: {
          amount: 1500.00, // Mayor al monto total
          reason: 'servicio_no_completado'
        },
        user: { id: 'user_test_123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.processRefund(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('mayor')
        })
      );
    });
  });

  describe('Obtener Eventos de Pago', () => {
    test('Debe obtener eventos del pago correctamente', async () => {
      // Crear algunos eventos de prueba
      await prisma.eventos_pagos.createMany({
        data: [
          {
            id: 'evt_1',
            pago_id: 'pay_test_001',
            tipo_evento: 'payment_created',
            datos: JSON.stringify({ amount: 1000 }),
            procesado: true
          },
          {
            id: 'evt_2',
            pago_id: 'pay_test_001',
            tipo_evento: 'payment_approved',
            datos: JSON.stringify({ mpId: 'mp_test_123' }),
            procesado: true
          }
        ]
      });

      const req = {
        params: { paymentId: 'pay_test_001' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.getPaymentEvents(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              tipo_evento: 'payment_created',
              datos: expect.objectContaining({ amount: 1000 })
            }),
            expect.objectContaining({
              tipo_evento: 'payment_approved',
              datos: expect.objectContaining({ mpId: 'mp_test_123' })
            })
          ])
        })
      );
    });
  });

  describe('Obtener Disputas del Usuario', () => {
    test('Debe obtener disputas del usuario autenticado', async () => {
      // Crear una disputa para el usuario de prueba
      await prisma.disputas_pagos.create({
        data: {
          id: 'disp_test_001',
          pago_id: 'pay_test_001',
          usuario_id: 'user_test_123',
          motivo: 'servicio_no_completado',
          descripcion: 'Test dispute',
          estado: 'abierta'
        }
      });

      const req = {
        user: { id: 'user_test_123' },
        query: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.getUserDisputes(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              motivo: 'servicio_no_completado',
              estado: 'abierta'
            })
          ])
        })
      );
    });

    test('Debe filtrar disputas por estado si se especifica', async () => {
      // Crear disputas con diferentes estados
      await prisma.disputas_pagos.createMany({
        data: [
          {
            id: 'disp_abierta',
            pago_id: 'pay_test_001',
            usuario_id: 'user_test_123',
            motivo: 'servicio_no_completado',
            descripcion: 'Disputa abierta',
            estado: 'abierta'
          },
          {
            id: 'disp_resuelta',
            pago_id: 'pay_test_001',
            usuario_id: 'user_test_123',
            motivo: 'calidad_deficiente',
            descripcion: 'Disputa resuelta',
            estado: 'resuelta'
          }
        ]
      });

      const req = {
        user: { id: 'user_test_123' },
        query: { status: 'abierta' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.getUserDisputes(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ estado: 'abierta' })
          ])
        })
      );

      // Verificar que no incluya la disputa resuelta
      const callArgs = res.json.mock.calls[0][0];
      const resolvedDisputes = callArgs.data.filter(d => d.estado === 'resuelta');
      expect(resolvedDisputes).toHaveLength(0);
    });
  });

  describe('Validaciones de Seguridad', () => {
    test('Debe validar que solo el cliente puede solicitar reembolsos', async () => {
      const professionalUser = await prisma.usuarios.create({
        data: {
          id: 'prof_attempting_refund',
          email: 'prof.refund@example.com',
          nombre: 'Profesional Malicioso',
          rol: 'profesional'
        }
      });

      const req = {
        params: { paymentId: 'pay_test_001' },
        body: {
          amount: 500.00,
          reason: 'servicio_no_completado'
        },
        user: { id: 'prof_attempting_refund' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.processRefund(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('cliente')
        })
      );
    });

    test('Debe validar estados válidos para crear disputas', async () => {
      // Crear un pago en estado pendiente
      const pendingPayment = await prisma.pagos.create({
        data: {
          id: 'pay_pending',
          servicio_id: 'srv_test_789',
          cliente_id: 'user_test_123',
          profesional_id: 'prof_test_456',
          monto_total: 1000.00,
          estado: 'pendiente'
        }
      });

      const req = {
        params: { paymentId: 'pay_pending' },
        body: {
          motivo: 'servicio_no_completado',
          descripcion: 'Test'
        },
        user: { id: 'user_test_123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.createDispute(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('estado válido')
        })
      );
    });
  });

  describe('Logging de Eventos', () => {
    test('Debe registrar eventos cuando se crean disputas', async () => {
      const req = {
        params: { paymentId: 'pay_test_001' },
        body: {
          motivo: 'servicio_no_completado',
          descripcion: 'Test dispute logging'
        },
        user: { id: 'user_test_123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.createDispute(req, res);

      // Verificar que se creó el evento
      const events = await prisma.eventos_pagos.findMany({
        where: {
          pago_id: 'pay_test_001',
          tipo_evento: 'dispute_created'
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].datos).toContain('dispute_created');
    });

    test('Debe registrar eventos cuando se procesan reembolsos', async () => {
      const req = {
        params: { paymentId: 'pay_test_001' },
        body: {
          amount: 1000.00,
          reason: 'servicio_no_completado'
        },
        user: { id: 'user_test_123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await paymentController.processRefund(req, res);

      // Verificar que se creó el evento
      const events = await prisma.eventos_pagos.findMany({
        where: {
          pago_id: 'pay_test_001',
          tipo_evento: 'refund_processed'
        }
      });

      expect(events).toHaveLength(1);
      const eventData = JSON.parse(events[0].datos);
      expect(eventData.amount).toBe(1000.00);
    });
  });
});

describe('PaymentService - Métodos Avanzados', () => {
  beforeEach(async () => {
    // Setup similar al anterior
    await prisma.eventos_pagos.deleteMany();
    await prisma.disputas_pagos.deleteMany();
    await prisma.pagos.deleteMany();
    await prisma.servicios.deleteMany();
    await prisma.usuarios.deleteMany();
  });

  test('Debe calcular fondos disponibles correctamente', async () => {
    // Crear datos de prueba
    const professional = await prisma.usuarios.create({
      data: {
        id: 'prof_funds_test',
        email: 'prof.funds@example.com',
        nombre: 'Profesional Funds Test',
        rol: 'profesional'
      }
    });

    // Crear pagos liberados con diferentes montos
    await prisma.pagos.createMany({
      data: [
        {
          id: 'pay_funds_1',
          servicio_id: 'srv_1',
          cliente_id: 'user_test',
          profesional_id: 'prof_funds_test',
          monto_total: 1000.00,
          monto_profesional: 950.00, // Después de comisión
          estado: 'liberado'
        },
        {
          id: 'pay_funds_2',
          servicio_id: 'srv_2',
          cliente_id: 'user_test',
          profesional_id: 'prof_funds_test',
          monto_total: 1500.00,
          monto_profesional: 1425.00, // Después de comisión
          estado: 'liberado'
        },
        {
          id: 'pay_funds_3',
          servicio_id: 'srv_3',
          cliente_id: 'user_test',
          profesional_id: 'prof_funds_test',
          monto_total: 500.00,
          estado: 'pendiente' // No debe contar
        }
      ]
    });

    const availableFunds = await paymentService.calculateAvailableFunds('prof_funds_test');

    expect(availableFunds).toBe(2375.00); // 950 + 1425
  });

  test('Debe manejar errores gracefully en logPaymentEvent', async () => {
    // Intentar loggear evento con pago inexistente
    await expect(
      paymentService.logPaymentEvent('pago_inexistente', 'test_event', { test: 'data' })
    ).resolves.not.toThrow();
  });
});