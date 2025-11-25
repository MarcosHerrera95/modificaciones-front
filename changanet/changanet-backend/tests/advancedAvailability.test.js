/**
 * Tests para el Sistema Avanzado de Disponibilidad y Agenda
 * Implementa tests unitarios e integración según especificaciones REQ-26 a REQ-30
 */

const { PrismaClient } = require('@prisma/client');
const {
  createAvailability,
  getAvailability,
  createAppointment,
  confirmAppointment,
  cancelAppointment
} = require('../src/controllers/advancedAvailabilityController');

const prisma = new PrismaClient();

// Mock de request/response
const mockRequest = (userId, body = {}, params = {}, query = {}) => ({
  user: { id: userId },
  body,
  params,
  query
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Sistema Avanzado de Disponibilidad y Agenda', () => {
  let professionalUser, clientUser;

  beforeAll(async () => {
    // Crear usuarios de prueba
    professionalUser = await prisma.usuarios.create({
      data: {
        email: 'professional-test@example.com',
        hash_contrasena: 'hashed_password',
        nombre: 'Profesional Test',
        rol: 'profesional',
        esta_verificado: true
      }
    });

    clientUser = await prisma.usuarios.create({
      data: {
        email: 'client-test@example.com',
        hash_contrasena: 'hashed_password',
        nombre: 'Cliente Test',
        rol: 'cliente',
        esta_verificado: true
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.appointments.deleteMany({
      where: {
        OR: [
          { professional_id: professionalUser.id },
          { client_id: clientUser.id }
        ]
      }
    });

    await prisma.professionals_availability.deleteMany({
      where: { professional_id: professionalUser.id }
    });

    await prisma.blocked_slots.deleteMany({
      where: { professional_id: professionalUser.id }
    });

    await prisma.usuarios.deleteMany({
      where: {
        id: { in: [professionalUser.id, clientUser.id] }
      }
    });

    await prisma.$disconnect();
  });

  describe('REQ-26: Calendario editable', () => {
    test('debe permitir crear slots de disponibilidad únicos', async () => {
      const req = mockRequest(professionalUser.id, {
        recurrence_type: 'single',
        start_datetime: '2025-12-01T09:00:00.000Z',
        end_datetime: '2025-12-01T17:00:00.000Z',
        timezone: 'America/Argentina/Buenos_Aires'
      });
      const res = mockResponse();

      await createAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Disponibilidad creada exitosamente.',
          availability: expect.objectContaining({
            professional_id: professionalUser.id,
            recurrence_type: 'single'
          })
        })
      );
    });

    test('debe rechazar slots con solapamiento', async () => {
      const req = mockRequest(professionalUser.id, {
        recurrence_type: 'single',
        start_datetime: '2025-12-01T10:00:00.000Z', // Solapa con el slot anterior
        end_datetime: '2025-12-01T12:00:00.000Z',
        timezone: 'America/Argentina/Buenos_Aires'
      });
      const res = mockResponse();

      await createAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('solapa')
        })
      );
    });

    test('debe rechazar creación por usuarios no profesionales', async () => {
      const req = mockRequest(clientUser.id, {
        recurrence_type: 'single',
        start_datetime: '2025-12-02T09:00:00.000Z',
        end_datetime: '2025-12-02T17:00:00.000Z'
      });
      const res = mockResponse();

      await createAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Solo los profesionales pueden gestionar disponibilidad.'
        })
      );
    });
  });

  describe('REQ-28: Visualización en tiempo real', () => {
    test('debe retornar slots disponibles para clientes', async () => {
      const req = mockRequest(clientUser.id, {}, { professionalId: professionalUser.id }, {
        from: '2025-12-01',
        to: '2025-12-01'
      });
      const res = mockResponse();

      await getAvailability(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          professional_id: professionalUser.id,
          slots: expect.any(Array)
        })
      );
    });

    test('debe filtrar solo slots disponibles', async () => {
      // Este test requiere que haya slots disponibles creados en el test anterior
      const req = mockRequest(clientUser.id, {}, { professionalId: professionalUser.id }, {
        from: '2025-12-01',
        to: '2025-12-01'
      });
      const res = mockResponse();

      await getAvailability(req, res);

      const responseData = res.json.mock.calls[0][0];
      // Todos los slots retornados deben estar disponibles
      responseData.slots.forEach(slot => {
        expect(slot.is_available).toBe(true);
      });
    });
  });

  describe('REQ-29: Agendamiento directo', () => {
    let availableSlot;

    beforeAll(async () => {
      // Crear un slot disponible para testing
      availableSlot = await prisma.professionals_availability.create({
        data: {
          professional_id: professionalUser.id,
          recurrence_type: 'single',
          start_datetime: new Date('2025-12-03T10:00:00.000Z'),
          end_datetime: new Date('2025-12-03T12:00:00.000Z'),
          timezone: 'America/Argentina/Buenos_Aires'
        }
      });
    });

    test('debe permitir agendar servicios en slots disponibles', async () => {
      const req = mockRequest(clientUser.id, {
        professional_id: professionalUser.id,
        start_datetime: '2025-12-03T10:00:00.000Z',
        end_datetime: '2025-12-03T12:00:00.000Z',
        notes: 'Servicio de prueba'
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cita creada exitosamente.',
          appointment: expect.objectContaining({
            client_id: clientUser.id,
            professional_id: professionalUser.id,
            status: 'pending'
          })
        })
      );
    });

    test('debe prevenir doble reserva del mismo slot', async () => {
      // Intentar reservar el mismo slot nuevamente
      const req = mockRequest(clientUser.id, {
        professional_id: professionalUser.id,
        start_datetime: '2025-12-03T10:00:00.000Z',
        end_datetime: '2025-12-03T12:00:00.000Z'
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'El horario seleccionado ya no está disponible.'
        })
      );
    });

    test('debe rechazar agendamiento por usuarios no clientes', async () => {
      const req = mockRequest(professionalUser.id, {
        professional_id: professionalUser.id,
        start_datetime: '2025-12-04T10:00:00.000Z',
        end_datetime: '2025-12-04T12:00:00.000Z'
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Solo los clientes pueden crear citas.'
        })
      );
    });
  });

  describe('REQ-30: Confirmación automática', () => {
    let testAppointment;

    beforeAll(async () => {
      // Crear una cita de prueba
      testAppointment = await prisma.appointments.create({
        data: {
          professional_id: professionalUser.id,
          client_id: clientUser.id,
          start_datetime: new Date('2025-12-05T10:00:00.000Z'),
          end_datetime: new Date('2025-12-05T12:00:00.000Z'),
          status: 'pending'
        }
      });
    });

    test('debe permitir confirmar citas por el profesional', async () => {
      const req = mockRequest(professionalUser.id, {}, { appointmentId: testAppointment.id });
      const res = mockResponse();

      await confirmAppointment(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cita confirmada exitosamente.',
          appointment: expect.objectContaining({
            status: 'confirmed'
          })
        })
      );
    });

    test('debe rechazar confirmación por usuarios no autorizados', async () => {
      // Crear otra cita para test
      const anotherAppointment = await prisma.appointments.create({
        data: {
          professional_id: professionalUser.id,
          client_id: clientUser.id,
          start_datetime: new Date('2025-12-06T10:00:00.000Z'),
          end_datetime: new Date('2025-12-06T12:00:00.000Z'),
          status: 'pending'
        }
      });

      const req = mockRequest(clientUser.id, {}, { appointmentId: anotherAppointment.id });
      const res = mockResponse();

      await confirmAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No tienes permiso para confirmar esta cita.'
        })
      );
    });
  });

  describe('Validaciones de conflictos', () => {
    test('debe detectar conflictos con citas existentes', async () => {
      // Este test requiere lógica de validación implementada
      // Verificar que checkAvailabilityConflicts funciona correctamente
      const conflictExists = await checkAvailabilityConflicts(
        professionalUser.id,
        new Date('2025-12-03T10:00:00.000Z'),
        new Date('2025-12-03T12:00:00.000Z')
      );

      expect(conflictExists).toBe(false); // Debería haber conflicto con la cita creada
    });

    test('debe detectar conflictos con slots bloqueados', async () => {
      // Crear un bloqueo
      await prisma.blocked_slots.create({
        data: {
          professional_id: professionalUser.id,
          start_datetime: new Date('2025-12-07T10:00:00.000Z'),
          end_datetime: new Date('2025-12-07T12:00:00.000Z'),
          reason: 'Bloqueo de prueba'
        }
      });

      const conflictExists = await checkAvailabilityConflicts(
        professionalUser.id,
        new Date('2025-12-07T10:00:00.000Z'),
        new Date('2025-12-07T12:00:00.000Z')
      );

      expect(conflictExists).toBe(false); // Debería haber conflicto con el bloqueo
    });
  });

  describe('Políticas de cancelación', () => {
    test('debe permitir cancelación por el cliente con anticipación', async () => {
      const futureAppointment = await prisma.appointments.create({
        data: {
          professional_id: professionalUser.id,
          client_id: clientUser.id,
          start_datetime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 días en el futuro
          end_datetime: new Date(Date.now() + 48 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          status: 'confirmed'
        }
      });

      const req = mockRequest(clientUser.id, { reason: 'Cambio de planes' }, { appointmentId: futureAppointment.id });
      const res = mockResponse();

      await cancelAppointment(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cita cancelada exitosamente.'
        })
      );
    });

    test('debe rechazar cancelación con menos de 24h de anticipación', async () => {
      const soonAppointment = await prisma.appointments.create({
        data: {
          professional_id: professionalUser.id,
          client_id: clientUser.id,
          start_datetime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas en el futuro
          end_datetime: new Date(Date.now() + 4 * 60 * 60 * 1000),
          status: 'confirmed'
        }
      });

      const req = mockRequest(clientUser.id, { reason: 'Cancelación tardía' }, { appointmentId: soonAppointment.id });
      const res = mockResponse();

      await cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No se puede cancelar con menos de 24 horas de anticipación.'
        })
      );
    });
  });
});

// Función auxiliar para verificar conflictos (debe estar disponible en el controlador)
async function checkAvailabilityConflicts(professionalId, start, end, excludeAppointmentId = null) {
  const conflictCount = await prisma.appointments.count({
    where: {
      professional_id: professionalId,
      status: { in: ['pending', 'confirmed'] },
      OR: [
        { start_datetime: { lte: start }, end_datetime: { gt: start } },
        { start_datetime: { lt: end }, end_datetime: { gte: end } },
        { start_datetime: { gte: start }, end_datetime: { lte: end } }
      ],
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } })
    }
  });

  if (conflictCount > 0) return false;

  const blockConflicts = await prisma.blocked_slots.count({
    where: {
      professional_id: professionalId,
      OR: [
        { start_datetime: { lte: start }, end_datetime: { gt: start } },
        { start_datetime: { lt: end }, end_datetime: { gte: end } },
        { start_datetime: { gte: start }, end_datetime: { lte: end } }
      ]
    }
  });

  return blockConflicts === 0;
}