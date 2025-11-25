/**
 * Tests de Concurrencia para el Sistema de Disponibilidad
 * Verifica que no existan race conditions en reservas simultáneas
 */

const { PrismaClient } = require('@prisma/client');
const { createAppointment } = require('../src/controllers/advancedAvailabilityController');

const prisma = new PrismaClient();

// Mock de request/response
const mockRequest = (userId, body = {}, params = {}) => ({
  user: { id: userId },
  body,
  params
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Tests de Concurrencia - Prevención de Race Conditions', () => {
  let professionalUser, clientUsers, availableSlot;

  beforeAll(async () => {
    // Crear usuario profesional
    professionalUser = await prisma.usuarios.create({
      data: {
        email: 'professional-concurrency@example.com',
        hash_contrasena: 'hashed_password',
        nombre: 'Profesional Concurrency',
        rol: 'profesional',
        esta_verificado: true
      }
    });

    // Crear múltiples usuarios clientes
    clientUsers = [];
    for (let i = 1; i <= 5; i++) {
      const client = await prisma.usuarios.create({
        data: {
          email: `client-concurrency-${i}@example.com`,
          hash_contrasena: 'hashed_password',
          nombre: `Cliente Concurrency ${i}`,
          rol: 'cliente',
          esta_verificado: true
        }
      });
      clientUsers.push(client);
    }

    // Crear slot disponible
    availableSlot = await prisma.professionals_availability.create({
      data: {
        professional_id: professionalUser.id,
        recurrence_type: 'single',
        start_datetime: new Date('2025-12-10T10:00:00.000Z'),
        end_datetime: new Date('2025-12-10T12:00:00.000Z'),
        timezone: 'America/Argentina/Buenos_Aires'
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos
    await prisma.appointments.deleteMany({
      where: { professional_id: professionalUser.id }
    });

    await prisma.professionals_availability.deleteMany({
      where: { professional_id: professionalUser.id }
    });

    await prisma.usuarios.deleteMany({
      where: {
        OR: [
          { id: professionalUser.id },
          ...clientUsers.map(u => ({ id: u.id }))
        ]
      }
    });

    await prisma.$disconnect();
  });

  test('debe permitir solo una reserva exitosa en concurrencia', async () => {
    // Preparar múltiples requests simultáneos
    const requests = clientUsers.map(client => {
      const req = mockRequest(client.id, {
        professional_id: professionalUser.id,
        start_datetime: '2025-12-10T10:00:00.000Z',
        end_datetime: '2025-12-10T12:00:00.000Z',
        notes: `Reserva del cliente ${client.nombre}`
      });
      const res = mockResponse();
      return { req, res, client };
    });

    // Ejecutar todas las requests simultáneamente
    const promises = requests.map(({ req, res }) =>
      createAppointment(req, res)
    );

    // Esperar a que todas terminen
    await Promise.all(promises);

    // Verificar resultados
    const successfulBookings = requests.filter(({ res }) =>
      res.status.mock.calls[0][0] === 201
    );

    const failedBookings = requests.filter(({ res }) =>
      res.status.mock.calls[0][0] === 409
    );

    // Debe haber exactamente 1 reserva exitosa
    expect(successfulBookings).toHaveLength(1);

    // El resto deben fallar con conflicto
    expect(failedBookings).toHaveLength(clientUsers.length - 1);

    // Verificar que el slot esté efectivamente reservado
    const updatedSlot = await prisma.professionals_availability.findUnique({
      where: { id: availableSlot.id },
      include: { appointments: true }
    });

    expect(updatedSlot.appointments).toHaveLength(1);
    expect(updatedSlot.appointments[0].status).toBe('pending');
  });

  test('debe manejar correctamente transacciones en alta concurrencia', async () => {
    // Crear múltiples slots disponibles
    const slots = [];
    for (let i = 0; i < 3; i++) {
      const slot = await prisma.professionals_availability.create({
        data: {
          professional_id: professionalUser.id,
          recurrence_type: 'single',
          start_datetime: new Date(`2025-12-11T${10 + i * 2}:00:00.000Z`),
          end_datetime: new Date(`2025-12-11T${12 + i * 2}:00:00.000Z`),
          timezone: 'America/Argentina/Buenos_Aires'
        }
      });
      slots.push(slot);
    }

    // Crear más clientes para esta prueba
    const additionalClients = [];
    for (let i = 1; i <= 6; i++) {
      const client = await prisma.usuarios.create({
        data: {
          email: `additional-client-${i}@example.com`,
          hash_contrasena: 'hashed_password',
          nombre: `Cliente Adicional ${i}`,
          rol: 'cliente',
          esta_verificado: true
        }
      });
      additionalClients.push(client);
    }

    // Mezclar clientes y slots para simular concurrencia realista
    const allRequests = [];
    slots.forEach(slot => {
      additionalClients.slice(0, 2).forEach(client => { // 2 clientes por slot
        const req = mockRequest(client.id, {
          professional_id: professionalUser.id,
          start_datetime: slot.start_datetime.toISOString(),
          end_datetime: slot.end_datetime.toISOString(),
          notes: `Reserva concurrente ${client.nombre} - ${slot.id}`
        });
        const res = mockResponse();
        allRequests.push({ req, res, slot, client });
      });
    });

    // Ejecutar requests concurrentemente
    const promises = allRequests.map(({ req, res }) =>
      createAppointment(req, res)
    );

    await Promise.all(promises);

    // Verificar que cada slot tenga exactamente 1 reserva
    for (const slot of slots) {
      const slotWithAppointments = await prisma.professionals_availability.findUnique({
        where: { id: slot.id },
        include: { appointments: true }
      });

      expect(slotWithAppointments.appointments).toHaveLength(1);
      expect(slotWithAppointments.appointments[0].status).toBe('pending');
    }

    // Verificar que algunos clientes hayan tenido éxito y otros no
    const successfulBookings = allRequests.filter(({ res }) =>
      res.status.mock.calls[0][0] === 201
    );

    const failedBookings = allRequests.filter(({ res }) =>
      res.status.mock.calls[0][0] === 409
    );

    expect(successfulBookings).toHaveLength(slots.length); // 1 por slot
    expect(failedBookings).toHaveLength(allRequests.length - slots.length);

    // Limpiar clientes adicionales
    await prisma.usuarios.deleteMany({
      where: {
        id: { in: additionalClients.map(c => c.id) }
      }
    });
  });

  test('debe mantener integridad de datos bajo carga concurrente', async () => {
    // Crear un slot para prueba de integridad
    const integritySlot = await prisma.professionals_availability.create({
      data: {
        professional_id: professionalUser.id,
        recurrence_type: 'single',
        start_datetime: new Date('2025-12-12T10:00:00.000Z'),
        end_datetime: new Date('2025-12-12T12:00:00.000Z'),
        timezone: 'America/Argentina/Buenos_Aires'
      }
    });

    // Crear 10 clientes para sobrecargar
    const stressClients = [];
    for (let i = 1; i <= 10; i++) {
      const client = await prisma.usuarios.create({
        data: {
          email: `stress-client-${i}@example.com`,
          hash_contrasena: 'hashed_password',
          nombre: `Cliente Stress ${i}`,
          rol: 'cliente',
          esta_verificado: true
        }
      });
      stressClients.push(client);
    }

    // Ejecutar 10 requests simultáneas
    const stressRequests = stressClients.map(client => {
      const req = mockRequest(client.id, {
        professional_id: professionalUser.id,
        start_datetime: '2025-12-12T10:00:00.000Z',
        end_datetime: '2025-12-12T12:00:00.000Z',
        notes: `Stress test ${client.nombre}`
      });
      const res = mockResponse();
      return { req, res };
    });

    const stressPromises = stressRequests.map(({ req, res }) =>
      createAppointment(req, res)
    );

    await Promise.all(stressPromises);

    // Verificar integridad: exactamente 1 reserva exitosa
    const finalSlot = await prisma.professionals_availability.findUnique({
      where: { id: integritySlot.id },
      include: { appointments: true }
    });

    expect(finalSlot.appointments).toHaveLength(1);

    // Verificar que no hay slots huérfanos o datos corruptos
    const appointment = finalSlot.appointments[0];
    expect(appointment.client_id).toBeDefined();
    expect(appointment.professional_id).toBe(professionalUser.id);
    expect(appointment.status).toBe('pending');

    // Limpiar
    await prisma.usuarios.deleteMany({
      where: {
        id: { in: stressClients.map(c => c.id) }
      }
    });
  });
});