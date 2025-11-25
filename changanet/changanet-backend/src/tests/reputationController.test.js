/**
 * Tests para el controlador de reputación
 * REQ-36 a REQ-40: Sistema de verificación de identidad y reputación
 */

const { PrismaClient } = require('@prisma/client');
const { calculateAutomaticMedals } = require('../controllers/reputationController');

const prisma = new PrismaClient();

describe('Reputation Controller', () => {
  beforeAll(async () => {
    // Crear datos de prueba
    await prisma.usuarios.upsert({
      where: { email: 'professional-test@example.com' },
      update: {},
      create: {
        id: 'professional-test-id',
        email: 'professional-test@example.com',
        nombre: 'Profesional Test',
        hash_contrasena: 'hashed_password',
        rol: 'profesional'
      }
    });

    await prisma.perfiles_profesionales.upsert({
      where: { usuario_id: 'professional-test-id' },
      update: {},
      create: {
        usuario_id: 'professional-test-id',
        especialidad: 'plomero',
        calificacion_promedio: 4.8,
        anos_experiencia: 5
      }
    });

    // Crear servicios completados
    for (let i = 0; i < 120; i++) {
      await prisma.servicios.upsert({
        where: { id: `service-${i}` },
        update: {},
        create: {
          id: `service-${i}`,
          cliente_id: 'client-test-id',
          profesional_id: 'professional-test-id',
          descripcion: `Servicio ${i}`,
          estado: 'COMPLETADO',
          fecha_agendada: new Date(),
          completado_en: new Date()
        }
      });
    }
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.reputation_history.deleteMany({
      where: { user_id: 'professional-test-id' }
    });
    await prisma.professional_reputation.deleteMany({
      where: { user_id: 'professional-test-id' }
    });
    await prisma.servicios.deleteMany({
      where: { profesional_id: 'professional-test-id' }
    });
    await prisma.perfiles_profesionales.deleteMany({
      where: { usuario_id: 'professional-test-id' }
    });
    await prisma.usuarios.deleteMany({
      where: { email: 'professional-test@example.com' }
    });
    await prisma.$disconnect();
  });

  describe('calculateAutomaticMedals', () => {
    test('debe asignar medalla de puntualidad cuando >= 95%', async () => {
      const medals = await calculateAutomaticMedals(
        'professional-test-id',
        4.8, // averageRating
        120, // completedJobs
        98,  // onTimePercentage
        8.5  // rankingScore
      );

      expect(medals).toContain('puntualidad');
    });

    test('debe asignar medalla de excelencia cuando rating >= 4.7', async () => {
      const medals = await calculateAutomaticMedals(
        'professional-test-id',
        4.8, // averageRating
        50,  // completedJobs
        90,  // onTimePercentage
        7.2  // rankingScore
      );

      expect(medals).toContain('excelencia');
    });

    test('debe asignar medalla de experto cuando trabajos >= 100', async () => {
      const medals = await calculateAutomaticMedals(
        'professional-test-id',
        4.2, // averageRating
        120, // completedJobs
        85,  // onTimePercentage
        6.8  // rankingScore
      );

      expect(medals).toContain('experto');
    });

    test('no debe asignar medallas cuando no cumple criterios', async () => {
      const medals = await calculateAutomaticMedals(
        'professional-test-id',
        3.5, // averageRating bajo
        10,  // pocos trabajos
        70,  // puntualidad baja
        4.0  // score bajo
      );

      expect(medals).toEqual([]);
    });
  });

  describe('updateProfessionalReputation', () => {
    test('debe calcular y actualizar reputación correctamente', async () => {
      const { updateProfessionalReputation } = require('../controllers/reputationController');

      const reputation = await updateProfessionalReputation('professional-test-id');

      expect(reputation).toBeTruthy();
      expect(reputation.average_rating).toBe(4.8);
      expect(reputation.completed_jobs).toBe(120);
      expect(typeof reputation.on_time_percentage).toBe('number');
      expect(typeof reputation.ranking_score).toBe('number');

      // Verificar que se creó historial
      const history = await prisma.reputation_history.findFirst({
        where: { user_id: 'professional-test-id' },
        orderBy: { created_at: 'desc' }
      });

      expect(history).toBeTruthy();
      const historyData = JSON.parse(history.value);
      expect(historyData.average_rating).toBe(4.8);
      expect(historyData.completed_jobs).toBe(120);
    });

    test('debe preservar medallas manuales existentes', async () => {
      // Crear reputación con medalla manual
      await prisma.professional_reputation.upsert({
        where: { user_id: 'professional-test-id' },
        update: { medals: JSON.stringify(['medalla_manual']) },
        create: {
          user_id: 'professional-test-id',
          average_rating: 4.0,
          completed_jobs: 50,
          on_time_percentage: 80,
          ranking_score: 6.0,
          medals: JSON.stringify(['medalla_manual'])
        }
      });

      const { updateProfessionalReputation } = require('../controllers/reputationController');
      await updateProfessionalReputation('professional-test-id');

      const updatedReputation = await prisma.professional_reputation.findUnique({
        where: { user_id: 'professional-test-id' }
      });

      const medals = JSON.parse(updatedReputation.medals);
      expect(medals).toContain('medalla_manual');
      expect(medals).toContain('experto'); // Debe tener la automática también
    });
  });
});