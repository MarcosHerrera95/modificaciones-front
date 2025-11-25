/**
 * Pruebas unitarias para el controlador de reseñas
 * Verifica que las funciones del controlador funcionen correctamente
 */

const { PrismaClient } = require('@prisma/client');
const { createReview, getReviewStats, checkReviewEligibility, getReviewsByProfessional } = require('../../src/controllers/reviewController');
const { uploadImage } = require('../../src/services/storageService');
const { createNotification } = require('../../src/services/notificationService');
const { sendPushNotification } = require('../../src/services/pushNotificationService');
const { 
  getCachedReviewStats, 
  cacheReviewStats, 
  invalidateReviewStatsCache,
  getCachedReviewsList,
  cacheReviewsList,
  invalidateReviewsListCache,
  invalidateAllProfessionalCaches
} = require('../../src/services/cacheService');

// Mock de Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    servicios: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    resenas: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    },
    perfiles_profesionales: {
      update: jest.fn()
    },
    $transaction: jest.fn(callback => callback({
      resenas: {
        create: jest.fn(),
        aggregate: jest.fn()
      },
      perfiles_profesionales: {
        update: jest.fn()
      }
    })),
    $queryRaw: jest.fn()
  };
  return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

// Mock de servicios externos
jest.mock('../../src/services/storageService', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn()
}));

jest.mock('../../src/services/notificationService', () => ({
  createNotification: jest.fn(),
  NOTIFICATION_TYPES: {
    RESENA_RECIBIDA: 'RESENA_RECIBIDA'
  }
}));

jest.mock('../../src/services/pushNotificationService', () => ({
  sendPushNotification: jest.fn()
}));

jest.mock('../../src/services/cacheService', () => ({
  getCachedReviewStats: jest.fn(),
  cacheReviewStats: jest.fn(),
  invalidateReviewStatsCache: jest.fn(),
  getCachedReviewsList: jest.fn(),
  cacheReviewsList: jest.fn(),
  invalidateReviewsListCache: jest.fn(),
  invalidateAllProfessionalCaches: jest.fn()
}));

jest.mock('../../src/middleware/performanceLogger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Controlador de Reseñas', () => {
  let prisma;
  let req;
  let res;
  let mockUser;
  let mockService;
  let mockReview;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    prisma = new PrismaClient();
    
    // Setup request and response objects
    mockUser = { id: 'test-user-id', nombre: 'Test User' };
    
    mockService = {
      id: 'test-service-id',
      estado: 'completado',
      cliente_id: 'test-user-id',
      profesional_id: 'test-professional-id',
      cliente: { nombre: 'Test Client' },
      profesional: { id: 'test-professional-id' }
    };
    
    mockReview = {
      id: 'test-review-id',
      servicio_id: 'test-service-id',
      cliente_id: 'test-user-id',
      calificacion: 5,
      comentario: 'Excelente servicio',
      url_foto: null,
      creado_en: new Date()
    };
    
    req = {
      body: {
        servicio_id: 'test-service-id',
        calificacion: 5,
        comentario: 'Excelente servicio'
      },
      file: null,
      user: mockUser,
      params: { professionalId: 'test-professional-id', servicioId: 'test-service-id' },
      query: { page: 1, limit: 10 }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('createReview', () => {
    test('debería crear una reseña exitosamente', async () => {
      // Arrange
      prisma.servicios.findFirst.mockResolvedValue(mockService);
      prisma.resenas.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          resenas: {
            create: jest.fn().mockResolvedValue(mockReview),
            aggregate: jest.fn().mockResolvedValue({ _avg: { calificacion: 4.5 } })
          },
          perfiles_profesionales: {
            update: jest.fn().mockResolvedValue({})
          }
        };
        return callback(tx);
      });
      
      // Act
      await createReview(req, res);
      
      // Assert
      expect(prisma.servicios.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'test-service-id',
          cliente_id: 'test-user-id',
          estado: 'completado'
        },
        include: { cliente: true, profesional: true }
      });
      
      expect(prisma.resenas.findUnique).toHaveBeenCalledWith({
        where: { servicio_id: 'test-service-id' }
      });
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockReview);
    });

    test('debería devolver error 400 si la calificación está fuera del rango', async () => {
      // Arrange
      req.body.calificacion = 6;
      
      // Act
      await createReview(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'La calificación debe ser un número entre 1 y 5.'
      });
    });

    test('debería devolver error 404 si el servicio no existe', async () => {
      // Arrange
      prisma.servicios.findFirst.mockResolvedValue(null);
      prisma.servicios.findUnique.mockResolvedValue(null);
      
      // Act
      await createReview(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Servicio no encontrado.'
      });
    });

    test('debería devolver error 403 si el usuario no es el cliente del servicio', async () => {
      // Arrange
      const notOwnedService = { ...mockService, cliente_id: 'different-user-id' };
      prisma.servicios.findFirst.mockResolvedValue(notOwnedService);
      prisma.servicios.findUnique.mockResolvedValue(notOwnedService);
      
      // Act
      await createReview(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No tienes permiso para reseñar este servicio.'
      });
    });

    test('debería devolver error 400 si el servicio no está completado', async () => {
      // Arrange
      const incompleteService = { ...mockService, estado: 'pendiente' };
      prisma.servicios.findFirst.mockResolvedValue(incompleteService);
      prisma.servicios.findUnique.mockResolvedValue(incompleteService);
      
      // Act
      await createReview(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Solo se pueden reseñar servicios completados.'
      });
    });

    test('debería devolver error 400 si ya existe una reseña para el servicio', async () => {
      // Arrange
      prisma.servicios.findFirst.mockResolvedValue(mockService);
      prisma.resenas.findUnique.mockResolvedValue({ id: 'existing-review-id' });
      
      // Act
      await createReview(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Ya se ha dejado una reseña para este servicio. Solo se permite una reseña por servicio.'
      });
    });
  });

  describe('checkReviewEligibility', () => {
    test('debería devolver que el usuario puede reseñar', async () => {
      // Arrange
      prisma.servicios.findFirst.mockResolvedValue({
        ...mockService,
        resenas: []
      });
      
      // Act
      await checkReviewEligibility(req, res);
      
      // Assert
      expect(res.json).toHaveBeenCalledWith({ canReview: true });
    });

    test('debería devolver error 404 si el servicio no existe', async () => {
      // Arrange
      prisma.servicios.findFirst.mockResolvedValue(null);
      prisma.servicios.findUnique.mockResolvedValue(null);
      
      // Act
      await checkReviewEligibility(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Servicio no encontrado.'
      });
    });

    test('debería devolver que el usuario no puede reseñar si no es el cliente', async () => {
      // Arrange
      const notOwnedService = { ...mockService, cliente_id: 'different-user-id' };
      prisma.servicios.findFirst.mockResolvedValue(null);
      prisma.servicios.findUnique.mockResolvedValue(notOwnedService);
      
      // Act
      await checkReviewEligibility(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No tienes permiso para reseñar este servicio.'
      });
    });

    test('debería devolver que el usuario no puede reseñar si el servicio no está completado', async () => {
      // Arrange
      const incompleteService = { ...mockService, estado: 'pendiente' };
      prisma.servicios.findFirst.mockResolvedValue(null);
      prisma.servicios.findUnique.mockResolvedValue(incompleteService);
      
      // Act
      await checkReviewEligibility(req, res);
      
      // Assert
      expect(res.json).toHaveBeenCalledWith({
        canReview: false,
        reason: 'El servicio debe estar completado para poder reseñar.'
      });
    });

    test('debería devolver que el usuario no puede reseñar si ya existe una reseña', async () => {
      // Arrange
      prisma.servicios.findFirst.mockResolvedValue({
        ...mockService,
        resenas: [{ id: 'existing-review-id' }]
      });
      
      // Act
      await checkReviewEligibility(req, res);
      
      // Assert
      expect(res.json).toHaveBeenCalledWith({
        canReview: false,
        reason: 'Ya se ha dejado una reseña para este servicio.'
      });
    });
  });

  describe('getReviewStats', () => {
    test('debería devolver estadísticas de reseñas', async () => {
      // Arrange
      const mockStats = {
        professionalId: 'test-professional-id',
        totalReviews: 5,
        averageRating: 4.5,
        ratingDistribution: { 1: 0, 2: 1, 3: 1, 4: 1, 5: 2 },
        positivePercentage: 60,
        lastReviewDate: new Date()
      };
      
      prisma.$queryRaw.mockResolvedValue([{
        total_reviews: 5,
        average_rating: 4.5,
        star_1: 0,
        star_2: 1,
        star_3: 1,
        star_4: 1,
        star_5: 2,
        positive_reviews: 3,
        last_review_date: new Date()
      }]);
      
      getCachedReviewStats.mockResolvedValue(null); // Simular que no está en caché
      
      // Act
      await getReviewStats(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockStats);
    });

    test('debería devolver estadísticas desde caché si están disponibles', async () => {
      // Arrange
      const mockCachedStats = {
        professionalId: 'test-professional-id',
        totalReviews: 3,
        averageRating: 4.0,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 },
        positivePercentage: 66.67,
        lastReviewDate: new Date()
      };
      
      getCachedReviewStats.mockResolvedValue(mockCachedStats);
      
      // Act
      await getReviewStats(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCachedStats);
      // Verificar que no se consultó la base de datos
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('getReviewsByProfessional', () => {
    test('debería devolver reseñas de un profesional', async () => {
      // Arrange
      const mockReviews = [
        {
          id: 'review-1',
          servicio_id: 'service-1',
          calificacion: 5,
          comentario: 'Excelente servicio',
          url_foto: null,
          creado_en: new Date(),
          servicio: {
            id: 'service-1',
            descripcion: 'Reparación de plumbing',
            completado_en: new Date()
          },
          cliente: {
            nombre: 'Cliente 1',
            email: 'cliente1@test.com',
            url_foto_perfil: null
          }
        },
        {
          id: 'review-2',
          servicio_id: 'service-2',
          calificacion: 4,
          comentario: 'Buen servicio',
          url_foto: 'https://example.com/image.jpg',
          creado_en: new Date(),
          servicio: {
            id: 'service-2',
            descripcion: 'Instalación eléctrica',
            completado_en: new Date()
          },
          cliente: {
            nombre: 'Cliente 2',
            email: 'cliente2@test.com',
            url_foto_perfil: null
          }
        }
      ];
      
      prisma.resenas.findMany.mockResolvedValue(mockReviews);
      prisma.resenas.count.mockResolvedValue(2);
      
      getCachedReviewsList.mockResolvedValue(null); // Simular que no está en caché
      
      // Act
      await getReviewsByProfessional(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        reviews: mockReviews,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalReviews: 2,
          hasNextPage: false,
          hasPreviousPage: false
        }
      });
    });

    test('debería devolver reseñas desde caché si están disponibles', async () => {
      // Arrange
      const mockCachedData = {
        reviews: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalReviews: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      };
      
      getCachedReviewsList.mockResolvedValue(mockCachedData);
      
      // Act
      await getReviewsByProfessional(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCachedData);
      // Verificar que no se consultó la base de datos
      expect(prisma.resenas.findMany).not.toHaveBeenCalled();
    });

    test('debería paginar correctamente', async () => {
      // Arrange
      const reqWithPagination = {
        ...req,
        query: { page: 2, limit: 5 }
      };
      
      prisma.resenas.findMany.mockResolvedValue([]);
      prisma.resenas.count.mockResolvedValue(10);
      
      getCachedReviewsList.mockResolvedValue(null); // Simular que no está en caché
      
      // Act
      await getReviewsByProfessional(reqWithPagination, res);
      
      // Assert
      expect(prisma.resenas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (2-1) * 5
          take: 5
        })
      );
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            currentPage: 2,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true
          })
        })
      );
    });
  });
});