/**
 * @archivo test-availability-system.js - Tests completos del sistema de disponibilidad
 * @descripción Tests unitarios, de integración y end-to-end para el módulo de disponibilidad
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

// Configuración de test
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Mock data para tests
const mockData = {
  professional: {
    id: 'test-professional-123',
    email: 'profesional@test.com',
    nombre: 'Juan Pérez',
    rol: 'profesional',
    password_hash: 'hashed_password'
  },
  client: {
    id: 'test-client-123',
    email: 'cliente@test.com',
    nombre: 'María García',
    rol: 'cliente',
    password_hash: 'hashed_password'
  },
  availabilitySlot: {
    id: 'test-slot-123',
    profesional_id: 'test-professional-123',
    fecha: new Date('2025-12-15'),
    hora_inicio: new Date('2025-12-15T10:00:00.000Z'),
    hora_fin: new Date('2025-12-15T12:00:00.000Z'),
    esta_disponible: true,
    reservado_por: null,
    reservado_en: null,
    servicio_id: null
  }
};

// Helpers para tests
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function createTestSlot(slotData = {}) {
  return {
    profesional_id: slotData.profesional_id || mockData.availabilitySlot.profesional_id,
    fecha: slotData.fecha || mockData.availabilitySlot.fecha,
    hora_inicio: slotData.hora_inicio || mockData.availabilitySlot.hora_inicio,
    hora_fin: slotData.hora_fin || mockData.availabilitySlot.hora_fin,
    esta_disponible: slotData.esta_disponible !== undefined ? slotData.esta_disponible : true
  };
}

async function setupDatabase() {
  // Limpiar datos existentes
  await prisma.disponibilidad.deleteMany();
  await prisma.servicios.deleteMany();
  await prisma.usuarios.deleteMany();
  
  // Crear usuarios de test
  await prisma.usuarios.create({
    data: {
      ...mockData.professional,
      created_at: new Date(),
      updated_at: new Date()
    }
  });
  
  await prisma.usuarios.create({
    data: {
      ...mockData.client,
      created_at: new Date(),
      updated_at: new Date()
    }
  });
}

async function cleanupDatabase() {
  await prisma.disponibilidad.deleteMany();
  await prisma.servicios.deleteMany();
  await prisma.usuarios.deleteMany();
}

// TEST SUITE: Tests Unitarios
describe('🏗️ Tests Unitarios - Controlador de Disponibilidad', () => {
  let availabilityController;
  let mockReq, mockRes;
  
  beforeEach(() => {
    availabilityController = require('./src/controllers/availabilityController');
    mockReq = {
      user: { id: mockData.professional.id, email: mockData.professional.email },
      body: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('createAvailability', () => {
    it('✅ debería crear un slot de disponibilidad válido', async () => {
      // Arrange
      mockReq.body = {
        fecha: '2025-12-15',
        hora_inicio: '2025-12-15T10:00:00.000Z',
        hora_fin: '2025-12-15T12:00:00.000Z',
        esta_disponible: true
      };

      // Mock Prisma operations
      jest.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue(mockData.professional);
      jest.spyOn(prisma.disponibilidad, 'findMany').mockResolvedValue([]); // No overlapping slots
      jest.spyOn(prisma.disponibilidad, 'create').mockResolvedValue({
        id: 'new-slot-id',
        ...mockReq.body,
        profesional_id: mockData.professional.id
      });

      // Act
      await availabilityController.createAvailability(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-slot-id',
          profesional_id: mockData.professional.id
        })
      );
    });

    it('❌ debería rechazar solicitud de usuario no profesional', async () => {
      // Arrange
      mockReq.user = { id: mockData.client.id, email: mockData.client.email, rol: 'cliente' };
      mockReq.body = {
        fecha: '2025-12-15',
        hora_inicio: '2025-12-15T10:00:00.000Z',
        hora_fin: '2025-12-15T12:00:00.000Z'
      };

      // Mock
      jest.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue(mockData.client);

      // Act
      await availabilityController.createAvailability(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Solo los profesionales pueden gestionar disponibilidad.'
      });
    });

    it('❌ debería rechazar horarios que se solapan', async () => {
      // Arrange
      mockReq.body = {
        fecha: '2025-12-15',
        hora_inicio: '2025-12-15T11:00:00.000Z',
        hora_fin: '2025-12-15T13:00:00.000Z'
      };

      // Mock - overlapping slot exists
      const overlappingSlot = {
        id: 'existing-slot',
        profesional_id: mockData.professional.id,
        fecha: new Date('2025-12-15'),
        hora_inicio: new Date('2025-12-15T10:00:00.000Z'),
        hora_fin: new Date('2025-12-15T12:00:00.000Z'),
        esta_disponible: true
      };

      jest.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue(mockData.professional);
      jest.spyOn(prisma.disponibilidad, 'findMany').mockResolvedValue([overlappingSlot]);

      // Act
      await availabilityController.createAvailability(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Ya existe un horario que se solapa con el horario seleccionado.'
      });
    });
  });

  describe('bookAvailability', () => {
    it('✅ debería reservar un slot disponible', async () => {
      // Arrange
      mockReq.user = { id: mockData.client.id, email: mockData.client.email, rol: 'cliente' };
      mockReq.params = { slotId: 'test-slot-123' };
      mockReq.body = { descripcion: 'Servicio de prueba' };

      const mockSlot = {
        ...mockData.availabilitySlot,
        esta_disponible: true,
        profesional: mockData.professional
      };

      const mockService = {
        id: 'new-service-id',
        cliente_id: mockData.client.id,
        profesional_id: mockData.professional.id,
        descripcion: 'Servicio de prueba',
        estado: 'AGENDADO',
        fecha_agendada: new Date('2025-12-15')
      };

      // Mock
      jest.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue(mockData.client);
      jest.spyOn(prisma.disponibilidad, 'findUnique').mockResolvedValue(mockSlot);
      jest.spyOn(prisma.servicios, 'create').mockResolvedValue(mockService);
      jest.spyOn(prisma.disponibilidad, 'update').mockResolvedValue({
        ...mockSlot,
        reservado_por: mockData.client.id,
        reservado_en: new Date(),
        servicio_id: mockService.id
      });
      
      // Mock notification service
      const mockNotificationService = {
        createNotification: jest.fn().mockResolvedValue({ id: 'notification-id' })
      };
      jest.doMock('./src/services/notificationService', () => mockNotificationService);

      // Act
      await availabilityController.bookAvailability(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Servicio agendado exitosamente.',
        service: mockService,
        slot: expect.objectContaining({
          reservado_por: mockData.client.id,
          servicio_id: mockService.id
        })
      });
    });

    it('❌ debería rechazar reserva de slot no disponible', async () => {
      // Arrange
      mockReq.user = { id: mockData.client.id, email: mockData.client.email, rol: 'cliente' };
      mockReq.params = { slotId: 'test-slot-123' };

      const mockSlot = {
        ...mockData.availabilitySlot,
        esta_disponible: false // No disponible
      };

      // Mock
      jest.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue(mockData.client);
      jest.spyOn(prisma.disponibilidad, 'findUnique').mockResolvedValue(mockSlot);

      // Act
      await availabilityController.bookAvailability(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Este horario ya no está disponible.'
      });
    });

    it('❌ debería rechazar reserva de slot ya reservado', async () => {
      // Arrange
      mockReq.user = { id: mockData.client.id, email: mockData.client.email, rol: 'cliente' };
      mockReq.params = { slotId: 'test-slot-123' };

      const mockSlot = {
        ...mockData.availabilitySlot,
        esta_disponible: true,
        reservado_por: 'other-client-id' // Ya reservado
      };

      // Mock
      jest.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue(mockData.client);
      jest.spyOn(prisma.disponibilidad, 'findUnique').mockResolvedValue(mockSlot);

      // Act
      await availabilityController.bookAvailability(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Este horario ya ha sido reservado.'
      });
    });
  });
});

// TEST SUITE: Tests de Integración
describe('🔗 Tests de Integración - API de Disponibilidad', () => {
  let app;
  let professionalToken, clientToken;

  beforeAll(async () => {
    // Importar app de test
    app = require('./src/app');
    
    // Setup database
    await setupDatabase();
    
    // Generate tokens
    professionalToken = generateToken(mockData.professional);
    clientToken = generateToken(mockData.client);
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  describe('POST /api/availability', () => {
    it('✅ debería crear disponibilidad con token profesional', async () => {
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          fecha: '2025-12-15',
          hora_inicio: '2025-12-15T10:00:00.000Z',
          hora_fin: '2025-12-15T12:00:00.000Z',
          esta_disponible: true
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.profesional_id).toBe(mockData.professional.id);
      expect(response.body.esta_disponible).toBe(true);
    });

    it('❌ debería rechazar creación sin token', async () => {
      const response = await request(app)
        .post('/api/availability')
        .send({
          fecha: '2025-12-15',
          hora_inicio: '2025-12-15T10:00:00.000Z',
          hora_fin: '2025-12-15T12:00:00.000Z'
        });

      expect(response.status).toBe(401);
    });

    it('❌ debería rechazar creación con token de cliente', async () => {
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          fecha: '2025-12-15',
          hora_inicio: '2025-12-15T10:00:00.000Z',
          hora_fin: '2025-12-15T12:00:00.000Z'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/availability/:professionalId', () => {
    let testSlotId;

    beforeEach(async () => {
      // Crear slot de test
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          fecha: '2025-12-15',
          hora_inicio: '2025-12-15T10:00:00.000Z',
          hora_fin: '2025-12-15T12:00:00.000Z',
          esta_disponible: true
        });
      testSlotId = response.body.id;
    });

    it('✅ debería obtener disponibilidad del profesional', async () => {
      const response = await request(app)
        .get(`/api/availability/${mockData.professional.id}?date=2025-12-15`)
        .set('Authorization', `Bearer ${professionalToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('esta_disponible', true);
    });

    it('✅ debería filtrar por fecha específica', async () => {
      // Crear slot para otra fecha
      await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          fecha: '2025-12-16',
          hora_inicio: '2025-12-16T10:00:00.000Z',
          hora_fin: '2025-12-16T12:00:00.000Z',
          esta_disponible: true
        });

      const response = await request(app)
        .get(`/api/availability/${mockData.professional.id}?date=2025-12-15`)
        .set('Authorization', `Bearer ${professionalToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(new Date(response.body[0].fecha).toDateString()).toBe(new Date('2025-12-15').toDateString());
    });
  });

  describe('POST /api/availability/:slotId/book', () => {
    let testSlotId;

    beforeEach(async () => {
      // Crear slot de test
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          fecha: '2025-12-15',
          hora_inicio: '2025-12-15T10:00:00.000Z',
          hora_fin: '2025-12-15T12:00:00.000Z',
          esta_disponible: true
        });
      testSlotId = response.body.id;
    });

    it('✅ debería agendar servicio con token de cliente', async () => {
      const response = await request(app)
        .post(`/api/availability/${testSlotId}/book`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          descripcion: 'Servicio de prueba'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Servicio agendado exitosamente.');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('slot');
      expect(response.body.service.estado).toBe('AGENDADO');
    });

    it('❌ debería rechazar agendamiento sin token', async () => {
      const response = await request(app)
        .post(`/api/availability/${testSlotId}/book`)
        .send({
          descripcion: 'Servicio de prueba'
        });

      expect(response.status).toBe(401);
    });

    it('❌ debería rechazar agendamiento con token de profesional', async () => {
      const response = await request(app)
        .post(`/api/availability/${testSlotId}/book`)
        .set('Authorization', `Bearer ${professionalToken}`)
        .send({
          descripcion: 'Servicio de prueba'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Solo los clientes pueden agendar servicios.');
    });
  });
});

// TEST SUITE: Tests End-to-End
describe('🎯 Tests End-to-End - Flujo Completo de Disponibilidad', () => {
  let app;
  let professionalToken, clientToken;
  let testSlotId;

  beforeAll(async () => {
    app = require('./src/app');
    await setupDatabase();
    professionalToken = generateToken(mockData.professional);
    clientToken = generateToken(mockData.client);
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  it('🎯 flujo completo: profesional crea disponibilidad → cliente agenda → sistema envía notificaciones', async () => {
    // 1. Profesional crea disponibilidad
    const createResponse = await request(app)
      .post('/api/availability')
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        fecha: '2025-12-20',
        hora_inicio: '2025-12-20T14:00:00.000Z',
        hora_fin: '2025-12-20T16:00:00.000Z',
        esta_disponible: true
      });

    expect(createResponse.status).toBe(201);
    testSlotId = createResponse.body.id;

    // 2. Cliente verifica disponibilidad
    const availabilityResponse = await request(app)
      .get(`/api/availability/${mockData.professional.id}?date=2025-12-20`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(availabilityResponse.status).toBe(200);
    expect(availabilityResponse.body.length).toBe(1);
    expect(availabilityResponse.body[0].id).toBe(testSlotId);
    expect(availabilityResponse.body[0].esta_disponible).toBe(true);

    // 3. Cliente agenda servicio
    const bookResponse = await request(app)
      .post(`/api/availability/${testSlotId}/book`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        descripcion: 'Servicio de plomería - Reparación de fuga'
      });

    expect(bookResponse.status).toBe(201);
    expect(bookResponse.body.service.estado).toBe('AGENDADO');
    expect(bookResponse.body.service.cliente_id).toBe(mockData.client.id);
    expect(bookResponse.body.service.profesional_id).toBe(mockData.professional.id);

    // 4. Cliente intenta agendar nuevamente (debe fallar)
    const secondBookResponse = await request(app)
      .post(`/api/availability/${testSlotId}/book`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        descripcion: 'Segundo intento'
      });

    expect(secondBookResponse.status).toBe(400);
    expect(secondBookResponse.body.error).toBe('Este horario ya ha sido reservado.');

    // 5. Profesional verifica que el slot ya no está disponible
    const finalAvailabilityResponse = await request(app)
      .get(`/api/availability/${mockData.professional.id}?date=2025-12-20`)
      .set('Authorization', `Bearer ${professionalToken}`);

    expect(finalAvailabilityResponse.status).toBe(200);
    expect(finalAvailabilityResponse.body.length).toBe(0); // Ya no aparece en disponibilidad disponible
  });

  it('🎯 prevención de doble reserva concurrente', async () => {
    // Crear slot disponible
    const createResponse = await request(app)
      .post('/api/availability')
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        fecha: '2025-12-21',
        hora_inicio: '2025-12-21T10:00:00.000Z',
        hora_fin: '2025-12-21T12:00:00.000Z',
        esta_disponible: true
      });

    const concurrentSlotId = createResponse.body.id;

    // Simular múltiples clientes intentando reservar al mismo tiempo
    const promises = Array.from({ length: 5 }, (_, i) => 
      request(app)
        .post(`/api/availability/${concurrentSlotId}/book`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          descripcion: `Intento ${i + 1}`
        })
    );

    const results = await Promise.all(promises);

    // Solo uno debería tener éxito
    const successCount = results.filter(r => r.status === 201).length;
    const errorCount = results.filter(r => r.status === 400).length;

    expect(successCount).toBe(1);
    expect(errorCount).toBe(4);
  });
});

// TEST SUITE: Tests de Rendimiento
describe('⚡ Tests de Rendimiento - Disponibilidad', () => {
  let app;
  let professionalToken;

  beforeAll(async () => {
    app = require('./src/app');
    await setupDatabase();
    professionalToken = generateToken(mockData.professional);
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  it('⚡ debería manejar consultas de disponibilidad con múltiples slots', async () => {
    const startTime = Date.now();

    // Crear 100 slots
    const createPromises = [];
    for (let i = 0; i < 100; i++) {
      const start = new Date('2025-12-25');
      start.setHours(8 + i * 0.5); // Cada 30 minutos
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);

      createPromises.push(
        request(app)
          .post('/api/availability')
          .set('Authorization', `Bearer ${professionalToken}`)
          .send({
            fecha: '2025-12-25',
            hora_inicio: start.toISOString(),
            hora_fin: end.toISOString(),
            esta_disponible: true
          })
      );
    }

    await Promise.all(createPromises);

    const queryStartTime = Date.now();
    const response = await request(app)
      .get(`/api/availability/${mockData.professional.id}?date=2025-12-25`)
      .set('Authorization', `Bearer ${professionalToken}`);
    const queryEndTime = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(100);
    
    // La consulta no debería tomar más de 2 segundos
    const queryTime = queryEndTime - queryStartTime;
    expect(queryTime).toBeLessThan(2000);
  });
});

// EJECUCIÓN DE TESTS
if (require.main === module) {
  console.log('🧪 Ejecutando tests del sistema de disponibilidad...');
  
  // Configurar Jest para los tests unitarios
  beforeEach(() => {
    jest.clearAllMocks();
  });

  console.log('✅ Configuración de tests completada');
  console.log('📋 Tests incluidos:');
  console.log('   - Tests unitarios del controlador');
  console.log('   - Tests de integración de API');
  console.log('   - Tests end-to-end del flujo completo');
  console.log('   - Tests de rendimiento');
  console.log('   - Tests de prevención de doble reserva');
}

module.exports = {
  mockData,
  generateToken,
  createTestSlot,
  setupDatabase,
  cleanupDatabase
};