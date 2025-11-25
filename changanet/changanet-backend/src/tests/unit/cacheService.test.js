/**
 * Tests Unitarios para CacheService
 * Verifica el comportamiento del sistema de caché multinivel
 */

const cacheService = require('../../services/cacheService');

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    connect: jest.fn(),
    on: jest.fn(),
    keys: jest.fn(),
    del: jest.fn()
  }))
}));

// Mock NodeCache
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    getStats: jest.fn(() => ({
      hits: 10,
      misses: 5,
      keys: 15,
      ksize: 1024,
      vsize: 2048
    })),
    flushAll: jest.fn()
  }));
});

describe('CacheService', () => {
  let mockRedis;
  let mockMemoryCache;

  beforeEach(() => {
    jest.clearAllMocks();

    // Obtener referencias a los mocks
    const redis = require('redis');
    const NodeCache = require('node-cache');

    mockRedis = redis.createClient();
    mockMemoryCache = new NodeCache();
  });

  describe('getFromCache', () => {
    test('debe retornar datos desde Redis cuando están disponibles', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test', expires: Date.now() + 10000 }));

      const result = await cacheService.getFromCache('test_key', 'search_basic');

      expect(result).toBe('test');
      expect(mockRedis.get).toHaveBeenCalledWith('search_basic:test_key');
    });

    test('debe fallback a memory cache cuando Redis falla', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      mockMemoryCache.get.mockReturnValue({ data: 'memory_data', expires: Date.now() + 10000 });

      const result = await cacheService.getFromCache('test_key', 'search_basic');

      expect(result).toBe('memory_data');
    });

    test('debe retornar null cuando no hay datos en ningún nivel', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockMemoryCache.get.mockReturnValue(undefined);

      const result = await cacheService.getFromCache('test_key', 'search_basic');

      expect(result).toBeNull();
    });
  });

  describe('setInCache', () => {
    test('debe almacenar en Redis y memory cache', async () => {
      const testData = { id: 1, name: 'test' };

      await cacheService.setInCache('test_key', testData, 'search_basic');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'search_basic:test_key',
        300, // TTL por defecto
        JSON.stringify(expect.objectContaining({
          data: testData,
          expires: expect.any(Number),
          timestamp: expect.any(Number)
        }))
      );

      expect(mockMemoryCache.set).toHaveBeenCalled();
    });

    test('debe usar TTL específico por tipo de contenido', async () => {
      const testData = { suggestions: ['test1', 'test2'] };

      await cacheService.setInCache('suggestions_key', testData, 'suggestions');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'suggestions:suggestions_key',
        180, // TTL para suggestions
        expect.any(String)
      );
    });
  });

  describe('invalidateCacheByPattern', () => {
    test('debe invalidar claves por patrón en Redis y memory', async () => {
      mockRedis.keys.mockResolvedValue(['search_basic:test1', 'search_basic:test2']);

      await cacheService.invalidateCacheByPattern('test*', 'search_basic');

      expect(mockRedis.keys).toHaveBeenCalledWith('search_basic:test*');
      expect(mockRedis.del).toHaveBeenCalledWith(['search_basic:test1', 'search_basic:test2']);
      expect(mockMemoryCache.keys).toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    test('debe retornar estadísticas completas del caché', () => {
      const stats = cacheService.getCacheStats();

      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('redis');
      expect(stats).toHaveProperty('overall');
      expect(stats.overall).toHaveProperty('totalHits');
      expect(stats.overall).toHaveProperty('hitRate');
    });

    test('debe calcular hit rate correctamente', () => {
      // Configurar stats para testing
      const stats = cacheService.getCacheStats();

      // Verificar que hitRate sea un string con porcentaje
      expect(stats.overall.hitRate).toMatch(/^\d+\.\d+%$/);
    });
  });

  describe('resetCacheStats', () => {
    test('debe resetear todas las estadísticas', () => {
      cacheService.resetCacheStats();

      const stats = cacheService.getCacheStats();

      expect(stats.overall.totalHits).toBe(0);
      expect(stats.overall.totalMisses).toBe(0);
    });
  });

  describe('Compatibilidad con API antigua', () => {
    test('getCachedProfessionalSearch debe funcionar', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test', expires: Date.now() + 10000 }));

      const result = await cacheService.getCachedProfessionalSearch('test_key');

      expect(result).toBe('test');
    });

    test('cacheProfessionalSearch debe determinar tipo automáticamente', async () => {
      const searchData = { professionals: [], total: 0 };

      await cacheService.cacheProfessionalSearch('test_key', searchData);

      // Debería usar TTL de search_basic (300s)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'search_basic:test_key',
        300,
        expect.any(String)
      );
    });
  });

  describe('Manejo de errores', () => {
    test('debe manejar errores de Redis gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockMemoryCache.get.mockReturnValue({ data: 'fallback', expires: Date.now() + 10000 });

      const result = await cacheService.getFromCache('test_key', 'search_basic');

      expect(result).toBe('fallback');
    });

    test('debe manejar errores de memory cache gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockMemoryCache.get.mockImplementation(() => {
        throw new Error('Memory cache error');
      });

      const result = await cacheService.getFromCache('test_key', 'search_basic');

      expect(result).toBeNull();
    });
  });
});