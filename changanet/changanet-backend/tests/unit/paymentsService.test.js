/**
 * Pruebas unitarias para paymentsService.js
 * Cubre: REQ-41, REQ-42, RB-03, RB-04 (Pagos con custodia)
 */

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { PrismaClient } = require('@prisma/client');
const paymentsService = require('../../src/services/paymentsService');

jest.mock('mercadopago');
jest.mock('@prisma/client');

const mockPrisma = {
  servicios: {
    findUnique: jest.fn(),
  },
  usuarios: {
    findUnique: jest.fn(),
  },
};

PrismaClient.mockImplementation(() => mockPrisma);

describe('Payments Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentPreference', () => {
    test('debe crear preferencia de pago exitosamente', async () => {
      const mockService = {
        id: 'service-123',
        cliente_id: 'client-123',
        profesional_id: 'prof-123',
        estado: 'pendiente'
      };

      const mockPreference = {
        body: {
          id: 'pref-123',
          init_point: 'https://mercadopago.com/pay',
          sandbox_init_point: 'https://sandbox.mercadopago.com/pay'
        }
      };

      mockPrisma.servicios.findUnique.mockResolvedValue(mockService);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'client-123' });

      const mockPreferenceInstance = {
        create: jest.fn().mockResolvedValue(mockPreference)
      };
      Preference.mockImplementation(() => mockPreferenceInstance);

      const result = await paymentsService.createPaymentPreference({
        serviceId: 'service-123',
        amount: 1500,
        professionalEmail: 'prof@example.com',
        specialty: 'Plomero',
        clientId: 'client-123'
      });

      expect(result).toEqual({
        preferenceId: 'pref-123',
        initPoint: 'https://mercadopago.com/pay',
        sandboxInitPoint: 'https://sandbox.mercadopago.com/pay'
      });
    });

    test('debe calcular comisión del 10% correctamente', async () => {
      const mockService = {
        id: 'service-123',
        cliente_id: 'client-123',
        profesional_id: 'prof-123',
        estado: 'pendiente'
      };

      mockPrisma.servicios.findUnique.mockResolvedValue(mockService);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'client-123' });

      const mockPreferenceInstance = {
        create: jest.fn().mockResolvedValue({
          body: {
            id: 'pref-123',
            init_point: 'https://mercadopago.com/pay',
            sandbox_init_point: 'https://sandbox.mercadopago.com/pay'
          }
        })
      };
      Preference.mockImplementation(() => mockPreferenceInstance);

      await paymentsService.createPaymentPreference({
        serviceId: 'service-123',
        amount: 1000, // Monto base
        professionalEmail: 'prof@example.com',
        specialty: 'Plomero',
        clientId: 'client-123'
      });

      // Verificar que se calculó la comisión del 10% (100)
      const createCall = mockPreferenceInstance.create.mock.calls[0][0];
      expect(createCall.body.marketplace_fee).toBe(100);
    });

    test('debe rechazar servicio no perteneciente al cliente', async () => {
      const mockService = {
        id: 'service-123',
        cliente_id: 'different-client-123',
        estado: 'pendiente'
      };

      mockPrisma.servicios.findUnique.mockResolvedValue(mockService);

      await expect(
        paymentsService.createPaymentPreference({
          serviceId: 'service-123',
          amount: 1500,
          professionalEmail: 'prof@example.com',
          specialty: 'Plomero',
          clientId: 'client-123'
        })
      ).rejects.toThrow('No tienes permiso para crear un pago para este servicio');
    });

    test('debe rechazar servicio no pendiente', async () => {
      const mockService = {
        id: 'service-123',
        cliente_id: 'client-123',
        estado: 'completado'
      };

      mockPrisma.servicios.findUnique.mockResolvedValue(mockService);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'client-123' });

      await expect(
        paymentsService.createPaymentPreference({
          serviceId: 'service-123',
          amount: 1500,
          professionalEmail: 'prof@example.com',
          specialty: 'Plomero',
          clientId: 'client-123'
        })
      ).rejects.toThrow('El servicio debe estar en estado pendiente para crear un pago');
    });
  });

  describe('releaseFunds', () => {
    test('debe liberar fondos exitosamente', async () => {
      const mockService = {
        id: 'service-123',
        cliente_id: 'client-123',
        estado: 'completado'
      };

      mockPrisma.servicios.findUnique.mockResolvedValue(mockService);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'client-123' });

      const mockPaymentInstance = {
        update: jest.fn().mockResolvedValue({ success: true })
      };
      Payment.mockImplementation(() => mockPaymentInstance);

      const result = await paymentsService.releaseFunds('payment-123', 'service-123', 'client-123');

      expect(result).toEqual({
        success: true,
        paymentId: 'payment-123',
        serviceId: 'service-123',
        releasedAt: expect.any(Date)
      });
    });

    test('debe rechazar liberación de servicio no completado', async () => {
      const mockService = {
        id: 'service-123',
        cliente_id: 'client-123',
        estado: 'pendiente'
      };

      mockPrisma.servicios.findUnique.mockResolvedValue(mockService);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'client-123' });

      await expect(
        paymentsService.releaseFunds('payment-123', 'service-123', 'client-123')
      ).rejects.toThrow('El servicio debe estar completado para liberar fondos');
    });
  });
});