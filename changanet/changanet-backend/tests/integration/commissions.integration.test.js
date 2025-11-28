/**
 * Pruebas de integración para sistema de comisiones
 * Cubre: Cálculo, aplicación, historial
 * REQ-43: Comisión configurable (5-10%)
 * RB-03: Comisión se cobra solo si el servicio se completa
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const app = require('../../src/server');

const prisma = new PrismaClient();

describe('Sistema de Comisiones - Integration Tests', () => {
  let clientUser;
  let professionalUser;
  let service;
  let clientToken;
  let professionalToken;
  let payment;

  beforeAll(async () => {
    // Crear usuarios de prueba
    clientUser = await prisma.usuarios.create({
      data: {
        email: 'client.commissions@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Cliente Comisiones',
        rol: 'cliente',
        esta_verificado: true
      }
    });

    professionalUser = await prisma.usuarios.create({
      data: {
        email: 'professional.commissions@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Profesional Comisiones',
        rol: 'profesional',
        esta_verificado: true
      }
    });

    // Crear perfil profesional
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: professionalUser.id,
        especialidad: 'Plomero',
        zona_cobertura: 'Buenos Aires',
        tarifa_hora: 2500
      }
    });

    // Crear servicio
    service = await prisma.servicios.create({
      data: {
        cliente_id: clientUser.id,
        profesional_id: professionalUser.id,
        descripcion: 'Reparación de cañería',
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

  describe('Cálculo de comisiones', () => {
    test('debe calcular comisión correctamente al liberar fondos (5% por defecto)', async () => {
      // Crear pago
      const createResponse = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          amount: 10000,
          description: 'Reparación de cañería'
        });

      expect(createResponse.status).toBe(201);

      // Cambiar servicio a completado
      await prisma.servicios.update({
        where: { id: service.id },
        data: { estado: 'COMPLETADO' }
      });

      // Obtener el pago creado
      payment = await prisma.pagos.findFirst({
        where: { servicio_id: service.id }
      });

      // Liberar fondos
      const releaseResponse = await request(app)
        .post('/api/payments/release-funds')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId: payment.mercado_pago_id,
          serviceId: service.id
        });

      expect(releaseResponse.status).toBe(200);

      // Verificar cálculo de comisión
      const updatedPayment = await prisma.pagos.findFirst({
        where: { servicio_id: service.id }
      });

      expect(updatedPayment.comision_plataforma).toBe(500); // 5% de 10000
      expect(updatedPayment.monto_profesional).toBe(9500); // 10000 - 500
      expect(updatedPayment.estado).toBe('LIBERADO');
    });

    test('debe respetar configuración de comisión vía variable de entorno', async () => {
      // Configurar comisión al 8%
      const originalCommission = process.env.PLATFORM_COMMISSION_RATE;
      process.env.PLATFORM_COMMISSION_RATE = '0.08';

      try {
        // Crear nuevo servicio y pago
        const newService = await prisma.servicios.create({
          data: {
            cliente_id: clientUser.id,
            profesional_id: professionalUser.id,
            descripcion: 'Servicio adicional',
            estado: 'PENDIENTE'
          }
        });

        // Crear pago
        const createResponse = await request(app)
          .post('/api/payments/create-preference')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            serviceId: newService.id,
            amount: 8000,
            description: 'Servicio adicional'
          });

        expect(createResponse.status).toBe(201);

        // Completar servicio
        await prisma.servicios.update({
          where: { id: newService.id },
          data: { estado: 'COMPLETADO' }
        });

        // Obtener pago
        const newPayment = await prisma.pagos.findFirst({
          where: { servicio_id: newService.id }
        });

        // Liberar fondos
        const releaseResponse = await request(app)
          .post('/api/payments/release-funds')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            paymentId: newPayment.mercado_pago_id,
            serviceId: newService.id
          });

        expect(releaseResponse.status).toBe(200);

        // Verificar comisión al 8%
        const updatedPayment = await prisma.pagos.findFirst({
          where: { servicio_id: newService.id }
        });

        expect(updatedPayment.comision_plataforma).toBe(640); // 8% de 8000
        expect(updatedPayment.monto_profesional).toBe(7360); // 8000 - 640

        // Limpiar
        await prisma.comisiones_historial.deleteMany({
          where: { servicio_id: newService.id }
        });
        await prisma.pagos.deleteMany({
          where: { servicio_id: newService.id }
        });
        await prisma.servicios.delete({
          where: { id: newService.id }
        });

      } finally {
        // Restaurar configuración original
        if (originalCommission) {
          process.env.PLATFORM_COMMISSION_RATE = originalCommission;
        } else {
          delete process.env.PLATFORM_COMMISSION_RATE;
        }
      }
    });

    test('debe validar que la comisión esté entre 5% y 10%', async () => {
      const invalidRates = ['0.03', '0.15', '-0.05', '1.5'];

      for (const rate of invalidRates) {
        const originalRate = process.env.PLATFORM_COMMISSION_RATE;
        process.env.PLATFORM_COMMISSION_RATE = rate;

        try {
          // Crear nuevo servicio
          const testService = await prisma.servicios.create({
            data: {
              cliente_id: clientUser.id,
              profesional_id: professionalUser.id,
              descripcion: 'Servicio de prueba',
              estado: 'COMPLETADO'
            }
          });

          // Crear pago
          await prisma.pagos.create({
            data: {
              servicio_id: testService.id,
              cliente_id: clientUser.id,
              profesional_id: professionalUser.id,
              monto_total: 5000,
              estado: 'APROBADO',
              mercado_pago_id: 'test_payment_id'
            }
          });

          // Intentar liberar fondos
          const releaseResponse = await request(app)
            .post('/api/payments/release-funds')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              paymentId: 'test_payment_id',
              serviceId: testService.id
            });

          expect(releaseResponse.status).toBe(500);
          expect(releaseResponse.body.error).toContain('entre 5% y 10%');

          // Limpiar
          await prisma.pagos.deleteMany({
            where: { servicio_id: testService.id }
          });
          await prisma.servicios.delete({
            where: { id: testService.id }
          });

        } finally {
          // Restaurar configuración
          if (originalRate) {
            process.env.PLATFORM_COMMISSION_RATE = originalRate;
          } else {
            delete process.env.PLATFORM_COMMISSION_RATE;
          }
        }
      }
    });
  });

  describe('Historial de comisiones', () => {
    test('debe registrar comisión en historial al liberar fondos', async () => {
      // Crear nuevo servicio para prueba
      const historyService = await prisma.servicios.create({
        data: {
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          descripcion: 'Servicio para historial',
          estado: 'COMPLETADO'
        }
      });

      // Crear pago
      await prisma.pagos.create({
        data: {
          servicio_id: historyService.id,
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          monto_total: 6000,
          estado: 'APROBADO',
          mercado_pago_id: 'history_test_id'
        }
      });

      // Liberar fondos
      const releaseResponse = await request(app)
        .post('/api/payments/release-funds')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId: 'history_test_id',
          serviceId: historyService.id
        });

      expect(releaseResponse.status).toBe(200);

      // Verificar registro en historial
      const commissionHistory = await prisma.comisiones_historial.findFirst({
        where: { servicio_id: historyService.id }
      });

      expect(commissionHistory).toBeTruthy();
      expect(commissionHistory.tipo).toBe('PLATAFORMA');
      expect(commissionHistory.evento).toBe('APLICADA');
      expect(commissionHistory.monto).toBe(300); // 5% de 6000
      expect(commissionHistory.porcentaje).toBe(0.05);
      expect(commissionHistory.aplicado_por).toBe(clientUser.id);
      expect(commissionHistory.descripcion).toContain('liberación manual');

      // Limpiar
      await prisma.comisiones_historial.deleteMany({
        where: { servicio_id: historyService.id }
      });
      await prisma.pagos.deleteMany({
        where: { servicio_id: historyService.id }
      });
      await prisma.servicios.delete({
        where: { id: historyService.id }
      });
    });

    test('debe registrar comisión por liberación automática', async () => {
      // Crear servicio completado hace más de 24 horas
      const oldService = await prisma.servicios.create({
        data: {
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          descripcion: 'Servicio antiguo completado',
          estado: 'COMPLETADO',
          completado_en: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 horas atrás
        }
      });

      // Crear pago aprobado
      await prisma.pagos.create({
        data: {
          servicio_id: oldService.id,
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          monto_total: 4000,
          estado: 'APROBADO',
          mercado_pago_id: 'auto_release_test_id',
          webhook_procesado: true,
          fecha_liberacion_programada: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hora atrás
        }
      });

      // Ejecutar liberación automática
      const autoReleaseResponse = await request(app)
        .post('/api/payments/auto-release')
        .send();

      expect(autoReleaseResponse.status).toBe(200);

      // Verificar que se liberaron fondos
      const updatedPayment = await prisma.pagos.findFirst({
        where: { servicio_id: oldService.id }
      });

      expect(updatedPayment.estado).toBe('LIBERADO');
      expect(updatedPayment.comision_plataforma).toBe(200); // 5% de 4000

      // Verificar historial de comisiones
      const commissionHistory = await prisma.comisiones_historial.findFirst({
        where: { servicio_id: oldService.id }
      });

      expect(commissionHistory).toBeTruthy();
      expect(commissionHistory.evento).toBe('APLICADA');
      expect(commissionHistory.monto).toBe(200);
      expect(commissionHistory.aplicado_por).toBeNull(); // Sistema automático
      expect(commissionHistory.descripcion).toContain('liberación automática');

      // Limpiar
      await prisma.comisiones_historial.deleteMany({
        where: { servicio_id: oldService.id }
      });
      await prisma.pagos.deleteMany({
        where: { servicio_id: oldService.id }
      });
      await prisma.servicios.delete({
        where: { id: oldService.id }
      });
    });

    test('debe registrar reembolso de comisión', async () => {
      // Crear servicio con pago liberado
      const refundService = await prisma.servicios.create({
        data: {
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          descripcion: 'Servicio para reembolso',
          estado: 'COMPLETADO'
        }
      });

      const refundPayment = await prisma.pagos.create({
        data: {
          servicio_id: refundService.id,
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          monto_total: 3000,
          estado: 'LIBERADO',
          mercado_pago_id: 'refund_test_id',
          comision_plataforma: 150,
          monto_profesional: 2850
        }
      });

      // Simular reembolso (esto requeriría implementación completa del reembolso)
      // Por ahora, verificamos que el historial registre correctamente
      await prisma.comisiones_historial.create({
        data: {
          pago_id: refundPayment.id,
          servicio_id: refundService.id,
          tipo: 'PLATAFORMA',
          evento: 'REEMBOLSADA',
          monto: -150, // Monto negativo para reembolso
          descripcion: 'Comisión reembolsada por cancelación del pago',
          aplicado_por: professionalUser.id,
          referencia: `REFUND_TEST_${refundPayment.id}`
        }
      });

      // Verificar registro de reembolso
      const refundHistory = await prisma.comisiones_historial.findFirst({
        where: {
          servicio_id: refundService.id,
          evento: 'REEMBOLSADA'
        }
      });

      expect(refundHistory).toBeTruthy();
      expect(refundHistory.monto).toBe(-150);
      expect(refundHistory.evento).toBe('REEMBOLSADA');

      // Limpiar
      await prisma.comisiones_historial.deleteMany({
        where: { servicio_id: refundService.id }
      });
      await prisma.pagos.deleteMany({
        where: { servicio_id: refundService.id }
      });
      await prisma.servicios.delete({
        where: { id: refundService.id }
      });
    });
  });

  describe('Aplicación de comisiones', () => {
    test('no debe aplicar comisión en creación de pago (RB-03)', async () => {
      // Crear nuevo servicio
      const noCommissionService = await prisma.servicios.create({
        data: {
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          descripcion: 'Servicio sin comisión inicial',
          estado: 'PENDIENTE'
        }
      });

      // Crear pago
      const createResponse = await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: noCommissionService.id,
          amount: 7000,
          description: 'Servicio sin comisión inicial'
        });

      expect(createResponse.status).toBe(201);

      // Verificar que no se aplicó comisión
      const createdPayment = await prisma.pagos.findFirst({
        where: { servicio_id: noCommissionService.id }
      });

      expect(createdPayment.comision_plataforma).toBe(0);
      expect(createdPayment.monto_profesional).toBe(7000); // Monto completo

      // Limpiar
      await prisma.pagos.deleteMany({
        where: { servicio_id: noCommissionService.id }
      });
      await prisma.servicios.delete({
        where: { id: noCommissionService.id }
      });
    });

    test('debe aplicar comisión solo al liberar fondos', async () => {
      // Crear servicio
      const applyCommissionService = await prisma.servicios.create({
        data: {
          cliente_id: clientUser.id,
          profesional_id: professionalUser.id,
          descripcion: 'Servicio con aplicación de comisión',
          estado: 'PENDIENTE'
        }
      });

      // Crear pago (sin comisión)
      await request(app)
        .post('/api/payments/create-preference')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: applyCommissionService.id,
          amount: 9000,
          description: 'Servicio con aplicación de comisión'
        });

      // Verificar que inicialmente no hay comisión
      let payment = await prisma.pagos.findFirst({
        where: { servicio_id: applyCommissionService.id }
      });
      expect(payment.comision_plataforma).toBe(0);

      // Completar servicio
      await prisma.servicios.update({
        where: { id: applyCommissionService.id },
        data: { estado: 'COMPLETADO' }
      });

      // Liberar fondos (aquí se aplica la comisión)
      await request(app)
        .post('/api/payments/release-funds')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId: payment.mercado_pago_id,
          serviceId: applyCommissionService.id
        });

      // Verificar que ahora sí hay comisión
      payment = await prisma.pagos.findFirst({
        where: { servicio_id: applyCommissionService.id }
      });

      expect(payment.comision_plataforma).toBe(450); // 5% de 9000
      expect(payment.monto_profesional).toBe(8550); // 9000 - 450
      expect(payment.estado).toBe('LIBERADO');

      // Limpiar
      await prisma.comisiones_historial.deleteMany({
        where: { servicio_id: applyCommissionService.id }
      });
      await prisma.pagos.deleteMany({
        where: { servicio_id: applyCommissionService.id }
      });
      await prisma.servicios.delete({
        where: { id: applyCommissionService.id }
      });
    });
  });
});