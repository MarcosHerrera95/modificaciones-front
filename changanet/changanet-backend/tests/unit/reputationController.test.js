/**
 * Pruebas unitarias para reputationController.js
 * Cubre: REQ-36 a REQ-40: Sistema de verificación de identidad y reputación
 */

const { PrismaClient } = require('@prisma/client');
const reputationController = require('../../src/controllers/reputationController');

// Mock de Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    professional_reputation: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn()
    },
    reputation_history: {
      create: jest.fn()
    },
    servicios: {
      findMany: jest.fn()
    },
    perfiles_profesionales: {
      findUnique: jest.fn()
    },
    usuarios: {
      findUnique: jest.fn()
    }
  }))
}));

describe('Reputation Controller', () => {
  let prisma;
  let req;
  let res;

  beforeEach(() => {
    prisma = new PrismaClient();
    req = {
      params: {},
      body: {},
      user: { id: 'user-123' }
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserReputation', () => {
    test('debe retornar reputación existente', async () => {
      const mockReputation = {
        user_id: 'user-123',
        average_rating: 4.5,
        completed_jobs: 10,
        on_time_percentage: 95.0,
        ranking_score: 8.75,
        medals: '["puntualidad"]',
        user: { nombre: 'Test User' }
      };

      prisma.professional_reputation.findUnique.mockResolvedValue(mockReputation);

      req.params.userId = 'user-123';

      await reputationController.getUserReputation(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReputation
      });
    });

    test('debe calcular reputación si no existe', async () => {
      const mockCalculatedReputation = {
        user_id: 'user-123',
        average_rating: 4.0,
        completed_jobs: 5,
        on_time_percentage: 100.0,
        ranking_score: 7.0,
        medals: '[]'
      };

      prisma.professional_reputation.findUnique.mockResolvedValue(null);
      // Mock de updateProfessionalReputation
      reputationController.updateProfessionalReputation = jest.fn().mockResolvedValue(mockCalculatedReputation);

      req.params.userId = 'user-123';

      await reputationController.getUserReputation(req, res);

      expect(reputationController.updateProfessionalReputation).toHaveBeenCalledWith('user-123');
    });
  });

  describe('updateReputation', () => {
    test('debe actualizar reputación exitosamente', async () => {
      const mockUpdatedReputation = {
        user_id: 'user-123',
        ranking_score: 8.5
      };

      reputationController.updateProfessionalReputation = jest.fn().mockResolvedValue(mockUpdatedReputation);

      req.body.userId = 'user-123';

      await reputationController.updateReputation(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedReputation
      });
    });

    test('debe retornar error si falta userId', async () => {
      req.body = {};

      await reputationController.updateReputation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'userId es requerido'
      });
    });
  });

  describe('assignMedal', () => {
    test('debe asignar medalla exitosamente', async () => {
      const mockReputation = {
        user_id: 'user-123',
        medals: '[]'
      };

      const mockUpdatedReputation = {
        user_id: 'user-123',
        medals: '["puntualidad"]'
      };

      prisma.professional_reputation.findUnique.mockResolvedValue(mockReputation);
      prisma.professional_reputation.update.mockResolvedValue(mockUpdatedReputation);

      req.body = {
        userId: 'user-123',
        medalType: 'puntualidad',
        reason: 'Excelente puntualidad'
      };

      await reputationController.assignMedal(req, res);

      expect(prisma.professional_reputation.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: {
          medals: JSON.stringify(['puntualidad']),
          updated_at: expect.any(Date)
        }
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedReputation
      });
    });

    test('debe retornar error si faltan parámetros', async () => {
      req.body = { userId: 'user-123' };

      await reputationController.assignMedal(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'userId y medalType son requeridos'
      });
    });
  });

  describe('getReputationRanking', () => {
    test('debe retornar ranking con paginación', async () => {
      const mockRankings = [
        {
          id: 'user-1',
          ranking_score: 9.0,
          position: 1,
          user: { nombre: 'User 1', esta_verificado: true }
        }
      ];

      prisma.professional_reputation.findMany.mockResolvedValue(mockRankings);
      prisma.professional_reputation.count.mockResolvedValue(100);

      req.query = { limit: '10', page: '1' };

      await reputationController.getReputationRanking(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 10,
          total: 100
        }
      });
    });
  });
});