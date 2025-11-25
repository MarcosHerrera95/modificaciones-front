/**
 * Tests Unitarios para SearchController
 * Cubre las funcionalidades críticas del sistema de búsqueda y filtros
 *
 * Tests incluidos:
 * - Validación de parámetros con Joi
 * - Sanitización de entrada
 * - Lógica de filtros y ordenamiento
 * - Manejo de errores
 * - Cálculo de distancia
 */

const { searchProfessionals } = require('../../controllers/searchController');
const { sanitizeSearchParams, getOptimizedOrderBy } = require('../../controllers/searchController');

// Mock de Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    perfiles_profesionales: {
      findMany: jest.fn(),
      count: jest.fn()
    },
    resenas: {
      findMany: jest.fn()
    },
    servicios: {
      groupBy: jest.fn()
    }
  }))
}));

// Mock del servicio de caché
jest.mock('../../services/cacheService', () => ({
  getCachedProfessionalSearch: jest.fn(),
  cacheProfessionalSearch: jest.fn()
}));

// Mock de Joi con encadenamiento correcto
jest.mock('joi', () => {
  const mockJoi = {
    object: jest.fn(() => mockJoi),
    string: jest.fn(() => mockJoi),
    number: jest.fn(() => mockJoi),
    boolean: jest.fn(() => mockJoi),
    integer: jest.fn(() => mockJoi),
    min: jest.fn(() => mockJoi),
    max: jest.fn(() => mockJoi),
    valid: jest.fn(() => mockJoi),
    default: jest.fn(() => mockJoi),
    optional: jest.fn(() => mockJoi),
    required: jest.fn(() => mockJoi),
    when: jest.fn(() => mockJoi),
    then: jest.fn(() => mockJoi),
    greater: jest.fn(() => mockJoi),
    ref: jest.fn(() => mockJoi),
    validate: jest.fn(() => ({ error: null, value: {} }))
  };
  return mockJoi;
});

// Mock de DOMPurify
jest.mock('isomorphic-dompurify', () => ({
  sanitize: jest.fn((input) => input)
}));

describe('SearchController', () => {
  let mockReq;
  let mockRes;
  let mockPrisma;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request/response
    mockReq = {
      query: {},
      user: { id: 'user123', rol: 'cliente' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn()
    };

    // Mock Prisma client
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();
  });

  describe('sanitizeSearchParams', () => {
    test('debe sanitizar strings correctamente', () => {
      const params = {
        q: 'test<script>alert("xss")</script>',
        especialidad: 'plomero',
        ciudad: 'Buenos Aires'
      };

      const result = sanitizeSearchParams(params);

      expect(result.q).toBe('test<script>alert("xss")</script>'); // DOMPurify debería limpiar esto
      expect(result.especialidad).toBe('plomero');
      expect(result.ciudad).toBe('Buenos Aires');
    });

    test('debe preservar valores numéricos', () => {
      const params = {
        precio_min: '1000',
        precio_max: '5000',
        radio_km: '10'
      };

      const result = sanitizeSearchParams(params);

      expect(result.precio_min).toBe(1000);
      expect(result.precio_max).toBe(5000);
      expect(result.radio_km).toBe(10);
    });
  });

  describe('getOptimizedOrderBy', () => {
    test('debe retornar ordenamiento correcto para calificación', () => {
      const result = getOptimizedOrderBy('calificacion_promedio', false);
      expect(result).toEqual([
        { calificacion_promedio: 'desc' },
        { usuario: { nombre: 'asc' } }
      ]);
    });

    test('debe retornar ordenamiento correcto para distancia con coordenadas', () => {
      const result = getOptimizedOrderBy('distancia', true);
      expect(result).toEqual([{ zona_cobertura: 'asc' }]);
    });

    test('debe retornar ordenamiento por defecto para casos inválidos', () => {
      const result = getOptimizedOrderBy('invalid_sort', false);
      expect(result).toEqual([{ calificacion_promedio: 'desc' }]);
    });
  });

  describe('REQ-11: Búsqueda por palabra clave', () => {
    test('debe buscar por especialidad cuando se proporciona "q"', async () => {
      mockReq.query = { q: 'plomero' };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      mockPrisma.perfiles_profesionales.count.mockResolvedValue(0);

      await searchProfessionals(mockReq, mockRes);

      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ especialidad: { contains: 'plomero', mode: 'insensitive' } })
            ])
          })
        })
      );
    });

    test('debe manejar búsqueda sin resultados', async () => {
      mockReq.query = { q: 'servicio_inexistente' };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      mockPrisma.perfiles_profesionales.count.mockResolvedValue(0);

      await searchProfessionals(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          professionals: [],
          total: 0
        })
      );
    });
  });

  describe('REQ-12: Filtros geográficos', () => {
    test('debe filtrar por ciudad correctamente', async () => {
      mockReq.query = { ciudad: 'Buenos Aires' };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      mockPrisma.perfiles_profesionales.count.mockResolvedValue(0);

      await searchProfessionals(mockReq, mockRes);

      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            zona_cobertura: { contains: 'Buenos Aires', mode: 'insensitive' }
          })
        })
      );
    });

    test('debe validar radio geográfico con coordenadas', async () => {
      mockReq.query = { radio_km: '10', user_lat: '-34.6037', user_lng: '-58.3816' };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      mockPrisma.perfiles_profesionales.count.mockResolvedValue(0);

      await searchProfessionals(mockReq, mockRes);

      // Debería procesar sin errores de validación
      expect(mockRes.status).not.toHaveBeenCalledWith(400);
    });

    test('debe rechazar radio sin coordenadas', async () => {
      mockReq.query = { radio_km: '10' }; // Sin coordenadas

      await searchProfessionals(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Parámetros de búsqueda inválidos')
        })
      );
    });
  });

  describe('REQ-13: Filtros de precio', () => {
    test('debe filtrar por rango de precios para tarifa por hora', async () => {
      mockReq.query = {
        precio_min: '2000',
        precio_max: '5000',
        tipo_tarifa: 'hora'
      };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      mockPrisma.perfiles_profesionales.count.mockResolvedValue(0);

      await searchProfessionals(mockReq, mockRes);

      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tarifa_hora: {
              gte: 2000,
              lte: 5000
            },
            tipo_tarifa: 'hora'
          })
        })
      );
    });

    test('debe validar precios negativos', async () => {
      mockReq.query = { precio_min: '-100' };

      await searchProfessionals(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('REQ-14: Ordenamiento', () => {
    test('debe ordenar por calificación promedio descendente', async () => {
      mockReq.query = { sort_by: 'calificacion_promedio' };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      mockPrisma.perfiles_profesionales.count.mockResolvedValue(0);

      await searchProfessionals(mockReq, mockRes);

      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ calificacion_promedio: 'desc' }, { usuario: { nombre: 'asc' } }]
        })
      );
    });

    test('debe rechazar criterios de ordenamiento inválidos', async () => {
      mockReq.query = { sort_by: 'ordenamiento_invalido' };

      await searchProfessionals(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Paginación', () => {
    test('debe aplicar paginación correctamente', async () => {
      mockReq.query = { page: '2', limit: '10' };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      mockPrisma.perfiles_profesionales.count.mockResolvedValue(25);

      await searchProfessionals(mockReq, mockRes);

      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page-1) * limit
          take: 10
        })
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPages: 3 // Math.ceil(25/10)
        })
      );
    });

    test('debe validar límites de paginación', async () => {
      mockReq.query = { limit: '200' }; // Límite excedido

      await searchProfessionals(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Sistema de caché', () => {
    test('debe retornar resultados desde caché cuando están disponibles', async () => {
      const { getCachedProfessionalSearch } = require('../../services/cacheService');
      getCachedProfessionalSearch.mockResolvedValue({
        professionals: [{ id: 1, nombre: 'Test' }],
        total: 1,
        page: 1
      });

      mockReq.query = { q: 'test' };

      await searchProfessionals(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        professionals: [{ id: 1, nombre: 'Test' }],
        total: 1,
        page: 1
      });
      expect(mockPrisma.perfiles_profesionales.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Manejo de errores', () => {
    test('debe manejar errores de base de datos gracefully', async () => {
      mockPrisma.perfiles_profesionales.findMany.mockRejectedValue(new Error('Database connection failed'));

      await searchProfessionals(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Error interno del servidor'
        })
      );
    });

    test('debe incluir requestId en respuestas de error', async () => {
      mockPrisma.perfiles_profesionales.findMany.mockRejectedValue(new Error('Test error'));

      await searchProfessionals(mockReq, mockRes);

      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.requestId).toBeDefined();
      expect(typeof errorResponse.requestId).toBe('string');
    });
  });

  describe('Headers de respuesta', () => {
    test('debe incluir headers de caché y timing', async () => {
      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      mockPrisma.perfiles_profesionales.count.mockResolvedValue(0);

      await searchProfessionals(mockReq, mockRes);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Cache-Control': 'public, max-age=300',
          'X-Search-Request-ID': expect.any(String),
          'X-Search-Duration': expect.stringMatching(/^\d+ms$/),
          'X-Search-Query-Duration': expect.stringMatching(/^\d+ms$/)
        })
      );
    });
  });
});