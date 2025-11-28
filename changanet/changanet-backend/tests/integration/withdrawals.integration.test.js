/**
 * Pruebas de integración para sistema de retiros
 * Cubre: Solicitudes, validaciones, procesamiento
 * REQ-44: Retiro de fondos por profesionales
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const app = require('../../src/server');

const prisma = new PrismaClient();

describe('Sistema de Retiros - Integration Tests', () => {
  let clientUser;
  let professionalUser;
  let professionalToken;
  let service;
  let payment;

  beforeAll(async () => {
    // Crear usuarios de prueba
    clientUser = await prisma.usuarios.create({
      data: {
        email: 'client.withdrawals@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Cliente Retiros',
        rol: 'cliente',
        esta_verificado: true
      }
    });

    professionalUser = await prisma.usuarios.create({
      data: {
        email: 'professional.withdrawals@example.com',
        hash_contrasena: '$2a$10$hashedpassword',
        nombre: 'Profesional Retiros',
        rol: 'profesional',
        esta_verificado: true
      }
    });

    // Crear perfil profesional
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: professionalUser.id,
        especialidad: 'Carpintero',
        zona_cobertura: 'Buenos Aires',
        tarifa_hora: 3000
      }
    });

    // Crear servicio completado con pago liberado
    service = await prisma.servicios.create({
      data: {
        cliente_id: clientUser.id,
        profesional_id: professionalUser.id,
        descripcion: 'Construcción de muebles',
        estado: 'COMPLETADO'
      }
    });

    // Crear pago liberado
    payment = await prisma.pagos.create({
      data: {
        servicio_id: service.id,
        cliente_id: clientUser.id,
        profesional_id: professionalUser.id,
        monto_total: 15000,
        comision_plataforma: 750, // 5% de 15000
        monto_profesional: 14250, // 15000 - 750
        estado: 'LIBERADO',
        mercado_pago_id: 'withdrawal_test_payment',
        fecha_liberacion: new Date()
      }
    });

    // Generar token para profesional
    professionalToken = jwt.sign({ userId: professionalUser.id, role: professionalUser.rol }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    // Limpiar datos de prueba
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

  describe('POST /api/payments/withdraw', () => {
    test('profesional debe poder solicitar retiro exitosamente', async () => {
      const bankDetails = {
        cvu: '1234567890123456789012', // 22 dígitos
        alias: 'mi.cuenta.bancaria'
      };

      const response = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          amount: 5000,
          bankDetails
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('withdrawalId');
      expect(response.body.data.amount).toBe(5000);
      expect(response.body.data.processedAt).toBeDefined();
      expect(response.body.data.estimatedArrival).toBeDefined();
      expect(response.body.data.bankDetails.alias).toBe(bankDetails.alias);
      expect(response.body.data.bankDetails.cvuMasked).toBe('***56789012'); // Últimos 4 dígitos
    });

    test('debe rechazar retiro por cliente (solo profesionales)', async () => {
      const clientToken = jwt.sign({ userId: clientUser.id, role: clientUser.rol }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: 1000,
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'cliente.intenta.retiro'
          }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Solo los profesionales pueden retirar fondos');
    });

    test('debe validar montos mínimos y máximos', async () => {
      const bankDetails = {
        cvu: '1234567890123456789012',
        alias: 'test.retiro'
      };

      const testCases = [
        { amount: 50, expectedError: 'mínimo' }, // Monto muy bajo
        { amount: 100000, expectedError: 'máximo' } // Monto muy alto
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/payments/withdraw')
          .set('Authorization', `Bearer ${professionalToken}`)
          .send({
            amount: testCase.amount,
            bankDetails
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain(testCase.expectedError);
      }
    });

    test('debe rechazar retiro con fondos insuficientes', async () => {
      // Crear profesional con pocos fondos
      const poorProfessional = await prisma.usuarios.create({
        data: {
          email: 'poor.professional@example.com',
          hash_contrasena: '$2a$10$hashedpassword',
          nombre: 'Profesional Pobre',
          rol: 'profesional',
          esta_verificado: true
        }
      });

      const poorToken = jwt.sign({ userId: poorProfessional.id, role: poorProfessional.rol }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${poorToken}`)
        .send({
          amount: 10000, // Monto alto para profesional sin fondos
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'pobre.profesional'
          }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Fondos insuficientes');

      // Limpiar
      await prisma.usuarios.delete({ where: { id: poorProfessional.id } });
    });

    test('debe validar formato del CVU', async () => {
      const invalidCVUs = [
        '123456789', // Muy corto
        '123456789012345678901234567890', // Muy largo
        '12345678901234567890AB', // Contiene letras
        '12345678901234567890', // 20 dígitos
        '' // Vacío
      ];

      for (const invalidCVU of invalidCVUs) {
        const response = await request(app)
          .post('/api/payments/withdraw')
          .set('Authorization', `Bearer ${professionalToken}`)
          .send({
            amount: 1000,
            bankDetails: {
              cvu: invalidCVU,
              alias: 'test.cvu'
            }
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('CVU');
      }
    });

    test('debe validar alias bancario', async () => {
      const invalidAliases = [
        'ab', // Muy corto
        'a'.repeat(50), // Muy largo
        '', // Vacío
        'alias con espacios' // Contiene espacios (dependiendo de validación)
      ];

      for (const invalidAlias of invalidAliases) {
        const response = await request(app)
          .post('/api/payments/withdraw')
          .set('Authorization', `Bearer ${professionalToken}`)
          .send({
            amount: 1000,
            bankDetails: {
              cvu: '1234567890123456789012',
              alias: invalidAlias
            }
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('alias');
      }
    });

    test('debe requerir datos bancarios completos', async () => {
      const incompleteBankDetails = [
        { cvu: '1234567890123456789012' }, // Sin alias
        { alias: 'test.alias' }, // Sin CVU
        {} // Sin ninguno
      ];

      for (const bankDetails of incompleteBankDetails) {
        const response = await request(app)
          .post('/api/payments/withdraw')
          .set('Authorization', `Bearer ${professionalToken}`)
          .send({
            amount: 1000,
            bankDetails
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('bancarios');
      }
    });
  });

  describe('Validaciones de negocio', () => {
    test('debe calcular correctamente fondos disponibles', async () => {
      // Verificar que el profesional tiene fondos del pago liberado
      const availableFunds = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          amount: 14250, // Monto exacto disponible
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'test.disponible'
          }
        });

      expect(availableFunds.status).toBe(200);

      // Intentar retirar más de lo disponible
      const insufficientFunds = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          amount: 20000, // Más de lo disponible
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'test.insuficiente'
          }
        });

      expect(insufficientFunds.status).toBe(500);
      expect(insufficientFunds.body.error).toContain('Fondos insuficientes');
    });

    test('debe permitir retiros parciales', async () => {
      // Retirar una parte de los fondos disponibles
      const partialWithdrawal = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          amount: 3000, // Parte de los fondos
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'test.parcial'
          }
        });

      expect(partialWithdrawal.status).toBe(200);
      expect(partialWithdrawal.body.data.amount).toBe(3000);

      // Verificar que aún quedan fondos
      const remainingWithdrawal = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          amount: 3000, // Otra parte
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'test.restante'
          }
        });

      expect(remainingWithdrawal.status).toBe(200);
    });
  });

  describe('Casos límite y edge cases', () => {
    test('debe manejar montos con decimales correctamente', async () => {
      const decimalAmounts = [1000.50, 2500.99, 500.01];

      for (const amount of decimalAmounts) {
        const response = await request(app)
          .post('/api/payments/withdraw')
          .set('Authorization', `Bearer ${professionalToken}`)
          .send({
            amount,
            bankDetails: {
              cvu: '1234567890123456789012',
              alias: 'test.decimal'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.data.amount).toBe(amount);
      }
    });

    test('debe rechazar montos negativos o cero', async () => {
      const invalidAmounts = [-1000, 0, -0.01];

      for (const amount of invalidAmounts) {
        const response = await request(app)
          .post('/api/payments/withdraw')
          .set('Authorization', `Bearer ${professionalToken}`)
          .send({
            amount,
            bankDetails: {
              cvu: '1234567890123456789012',
              alias: 'test.negativo'
            }
          });

        expect([400, 500]).toContain(response.status);
        expect(response.body.error).toBeDefined();
      }
    });

    test('debe manejar concurrencia de retiros', async () => {
      // Simular múltiples retiros concurrentes
      const withdrawalPromises = [];

      for (let i = 0; i < 3; i++) {
        withdrawalPromises.push(
          request(app)
            .post('/api/payments/withdraw')
            .set('Authorization', `Bearer ${professionalToken}`)
            .send({
              amount: 1000,
              bankDetails: {
                cvu: '1234567890123456789012',
                alias: `test.concurrente.${i}`
              }
            })
        );
      }

      const results = await Promise.all(withdrawalPromises);

      // Al menos uno debería fallar por fondos insuficientes
      const failedRequests = results.filter(r => r.status !== 200);
      expect(failedRequests.length).toBeGreaterThan(0);

      // Al menos uno debería tener éxito
      const successfulRequests = results.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Seguridad y auditoría', () => {
    test('debe requerir autenticación para retiros', async () => {
      const response = await request(app)
        .post('/api/payments/withdraw')
        .send({
          amount: 1000,
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'test.sin.auth'
          }
        });

      expect(response.status).toBe(401);
    });

    test('debe validar que el token pertenezca al profesional solicitante', async () => {
      // Crear otro profesional
      const otherProfessional = await prisma.usuarios.create({
        data: {
          email: 'other.professional@example.com',
          hash_contrasena: '$2a$10$hashedpassword',
          nombre: 'Otro Profesional',
          rol: 'profesional',
          esta_verificado: true
        }
      });

      const otherToken = jwt.sign({ userId: otherProfessional.id, role: otherProfessional.rol }, process.env.JWT_SECRET);

      // Intentar retirar con token de otro profesional
      const response = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          amount: 1000,
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'test.otro.profesional'
          }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Fondos insuficientes');

      // Limpiar
      await prisma.usuarios.delete({ where: { id: otherProfessional.id } });
    });

    test('debe enmascarar datos sensibles en respuesta', async () => {
      const response = await request(app)
        .post('/api/payments/withdraw')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          amount: 2000,
          bankDetails: {
            cvu: '1234567890123456789012',
            alias: 'test.masking'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.bankDetails.cvuMasked).toBe('***56789012');
      expect(response.body.data.bankDetails.alias).toBe('test.masking');
      // Asegurarse de que el CVU completo no esté en la respuesta
      expect(response.body.data.bankDetails).not.toHaveProperty('cvu');
    });
  });
});