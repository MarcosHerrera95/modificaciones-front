/**
 * @archivo tests/unit/services/geolocationService.test.js
 * @descripción Pruebas unitarias completas para GeolocationService
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests unitarios para algoritmos geoespaciales y cache
 * @impacto Social: Validación de precisión en búsqueda de profesionales cercanos
 */

const { GeolocationService } = require('../../../src/services/geolocationService');
const { PrismaClient } = require('@prisma/client');

// Mocks
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    perfiles_profesionales: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    urgent_requests: {
      findMany: jest.fn()
    },
    usuarios: {
      findUnique: jest.fn()
    }
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('GeolocationService - Unit Tests', () => {
  let geolocationService;
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
    geolocationService = new GeolocationService();
  });

  describe('findNearbyProfessionals', () => {
    const baseLat = -34.6118;
    const baseLng = -58.3960;
    const radiusKm = 5;

    test('should find nearby professionals with caching', async () => {
      const mockProfessionals = [
        {
          usuario: { id: 'prof-1', nombre: 'Test Professional' },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          latitud: -34.5881,
          longitud: -58.4165
        }
      ];

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue(mockProfessionals);

      const result1 = await geolocationService.findNearbyProfessionals(baseLat, baseLng, radiusKm);
      const result2 = await geolocationService.findNearbyProfessionals(baseLat, baseLng, radiusKm);

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1); // Should use cache
      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalledTimes(1); // Only called once due to cache
    });

    test('should calculate distances correctly', async () => {
      const mockProfessionals = [
        {
          usuario: { id: 'prof-1' },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          latitud: -34.5881, // Approximately 3.5km from center
          longitud: -58.4165
        },
        {
          usuario: { id: 'prof-2' },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          latitud: -34.5211, // Approximately 10km from center
          longitud: -58.7000
        }
      ];

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue(mockProfessionals);

      const result = await geolocationService.findNearbyProfessionals(baseLat, baseLng, radiusKm);

      expect(result).toHaveLength(1); // Only the closer one
      expect(result[0].usuario.id).toBe('prof-1');
      expect(result[0].distance_km).toBeGreaterThan(3);
      expect(result[0].distance_km).toBeLessThan(4);
    });

    test('should apply filters correctly', async () => {
      const filters = {
        esta_disponible: true,
        minRating: 4.0,
        serviceCategory: 'plomero'
      };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);

      await geolocationService.findNearbyProfessionals(baseLat, baseLng, radiusKm, filters);

      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          latitud: { gte: expect.any(Number), lte: expect.any(Number) },
          longitud: { gte: expect.any(Number), lte: expect.any(Number) },
          usuario: expect.objectContaining({
            esta_disponible: true,
            rol: 'profesional',
            esta_verificado: true
          })
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array)
      });
    });

    test('should handle empty results', async () => {
      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);

      const result = await geolocationService.findNearbyProfessionals(baseLat, baseLng, radiusKm);

      expect(result).toEqual([]);
    });

    test('should invalidate cache for updated professionals', async () => {
      const professionalId = 'prof-123';

      // First call
      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);
      await geolocationService.findNearbyProfessionals(baseLat, baseLng, radiusKm);

      // Update professional location
      mockPrisma.perfiles_profesionales.updateMany.mockResolvedValue({ count: 1 });
      await geolocationService.updateProfessionalLocation(professionalId, -34.6, -58.4);

      // Second call should not use cache
      mockPrisma.perfiles_profesionales.findMany.mockClear();
      await geolocationService.findNearbyProfessionals(baseLat, baseLng, radiusKm);

      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('performGeospatialQuery', () => {
    test('should create correct bounding box', async () => {
      const lat = -34.6118;
      const lng = -58.3960;
      const radiusKm = 5;

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);

      await geolocationService.findNearbyProfessionals(lat, lng, radiusKm);

      const call = mockPrisma.perfiles_profesionales.findMany.mock.calls[0][0];
      const where = call.where;

      // Check bounding box coordinates
      expect(where.latitud.gte).toBeLessThan(lat);
      expect(where.latitud.lte).toBeGreaterThan(lat);
      expect(where.longitud.gte).toBeLessThan(lng);
      expect(where.longitud.lte).toBeGreaterThan(lng);
    });

    test('should filter by service category', async () => {
      const filters = { serviceCategory: 'plomero' };

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue([]);

      await geolocationService.findNearbyProfessionals(-34.6118, -58.3960, 5, filters);

      const call = mockPrisma.perfiles_profesionales.findMany.mock.calls[0][0];
      expect(call.where.especialidades).toBeDefined();
      expect(call.where.especialidades.some).toBeDefined();
    });
  });

  describe('calculateBoundingBox', () => {
    test('should calculate bounding box correctly', () => {
      const lat = -34.6118;
      const lng = -58.3960;
      const radiusKm = 5;

      const bbox = geolocationService.calculateBoundingBox(lat, lng, radiusKm);

      expect(bbox.minLat).toBeLessThan(lat);
      expect(bbox.maxLat).toBeGreaterThan(lat);
      expect(bbox.minLng).toBeLessThan(lng);
      expect(bbox.maxLng).toBeGreaterThan(lng);

      // Check approximate distances
      const latDiff = bbox.maxLat - bbox.minLat;
      const lngDiff = bbox.maxLng - bbox.minLng;

      expect(latDiff).toBeGreaterThan(0.08); // Approximately 5km in degrees
      expect(latDiff).toBeLessThan(0.1);
    });

    test('should handle different latitudes', () => {
      // Test near equator
      const bboxEquator = geolocationService.calculateBoundingBox(0, 0, 5);
      expect(bboxEquator.maxLat - bboxEquator.minLat).toBeGreaterThan(0.04);

      // Test near pole
      const bboxPole = geolocationService.calculateBoundingBox(85, 0, 5);
      expect(bboxPole.maxLat - bboxPole.minLat).toBeGreaterThan(0.04);
    });
  });

  describe('calculateDistance', () => {
    test('should calculate Haversine distance correctly', () => {
      // Buenos Aires to Mendoza (known distance ~1000km)
      const distance = geolocationService.calculateDistance(-34.6118, -58.3960, -32.8908, -68.8272);

      expect(distance).toBeGreaterThan(950);
      expect(distance).toBeLessThan(1050);
    });

    test('should return 0 for same coordinates', () => {
      const distance = geolocationService.calculateDistance(0, 0, 0, 0);

      expect(distance).toBe(0);
    });

    test('should handle antipodal points', () => {
      const distance = geolocationService.calculateDistance(0, 0, 0, 180);

      expect(distance).toBeGreaterThan(20000); // Half circumference
    });

    test('should be symmetric', () => {
      const distance1 = geolocationService.calculateDistance(10, 20, 30, 40);
      const distance2 = geolocationService.calculateDistance(30, 40, 10, 20);

      expect(distance1).toBe(distance2);
    });
  });

  describe('calculateApproximateDistance', () => {
    test('should provide fast approximation', () => {
      const exact = geolocationService.calculateDistance(-34.6118, -58.3960, -32.8908, -68.8272);
      const approx = geolocationService.calculateApproximateDistance(-34.6118, -58.3960, -32.8908, -68.8272);

      // Approximate should be close but not exact
      expect(Math.abs(exact - approx)).toBeLessThan(50); // Within 50km
      expect(approx).toBeGreaterThan(900);
    });

    test('should be faster than Haversine (performance test)', () => {
      const startHaversine = Date.now();
      for (let i = 0; i < 1000; i++) {
        geolocationService.calculateDistance(-34.6118, -58.3960, -32.8908, -68.8272);
      }
      const haversineTime = Date.now() - startHaversine;

      const startApprox = Date.now();
      for (let i = 0; i < 1000; i++) {
        geolocationService.calculateApproximateDistance(-34.6118, -58.3960, -32.8908, -68.8272);
      }
      const approxTime = Date.now() - startApprox;

      // Approximate should be faster
      expect(approxTime).toBeLessThan(haversineTime);
    });
  });

  describe('findNearbyUrgentRequests', () => {
    test('should find nearby urgent requests', async () => {
      const professionalLat = -34.6118;
      const professionalLng = -58.3960;
      const radiusKm = 10;

      const mockRequests = [
        {
          id: 'request-1',
          latitude: -34.5881,
          longitude: -58.4165,
          description: 'Test request',
          client: { nombre: 'Test Client' },
          service: { nombre: 'Test Service' }
        }
      ];

      mockPrisma.urgent_requests.findMany.mockResolvedValue(mockRequests);

      const result = await geolocationService.findNearbyUrgentRequests(professionalLat, professionalLng, radiusKm);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('request-1');
      expect(result[0].distance_km).toBeDefined();
    });

    test('should filter by service and price', async () => {
      const filters = {
        serviceId: 'service-123',
        minPrice: 500
      };

      mockPrisma.urgent_requests.findMany.mockResolvedValue([]);

      await geolocationService.findNearbyUrgentRequests(-34.6118, -58.3960, 10, filters);

      const call = mockPrisma.urgent_requests.findMany.mock.calls[0][0];
      expect(call.where.service_id).toBe('service-123');
      expect(call.where.price_estimate).toEqual({ gte: 500 });
    });

    test('should sort by distance', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          latitude: -34.6118,
          longitude: -58.3960,
          description: 'Close request'
        },
        {
          id: 'request-2',
          latitude: -34.5,
          longitude: -58.3,
          description: 'Far request'
        }
      ];

      mockPrisma.urgent_requests.findMany.mockResolvedValue(mockRequests);

      const result = await geolocationService.findNearbyUrgentRequests(-34.6118, -58.3960, 50);

      expect(result[0].id).toBe('request-1'); // Closer first
      expect(result[0].distance_km).toBeLessThan(result[1].distance_km);
    });
  });

  describe('updateProfessionalLocation', () => {
    const professionalId = 'prof-123';
    const newLat = -34.6118;
    const newLng = -58.3960;

    test('should update professional location successfully', async () => {
      mockPrisma.perfiles_profesionales.updateMany.mockResolvedValue({ count: 1 });

      const result = await geolocationService.updateProfessionalLocation(professionalId, newLat, newLng);

      expect(result.success).toBe(true);
      expect(result.coordinates).toEqual({ lat: newLat, lng: newLng });
      expect(mockPrisma.perfiles_profesionales.updateMany).toHaveBeenCalledWith({
        where: { usuario_id: professionalId },
        data: {
          latitud: newLat,
          longitud: newLng,
          last_location_update: expect.any(Date)
        }
      });
    });

    test('should validate coordinates', async () => {
      await expect(geolocationService.updateProfessionalLocation(professionalId, 91, 0))
        .rejects.toThrow('Coordenadas inválidas');

      await expect(geolocationService.updateProfessionalLocation(professionalId, 0, 181))
        .rejects.toThrow('Coordenadas inválidas');

      await expect(geolocationService.updateProfessionalLocation(professionalId, 'invalid', 0))
        .rejects.toThrow('Coordenadas inválidas');
    });

    test('should invalidate location cache', async () => {
      // Add something to cache first
      geolocationService.setCache('test-key', { data: 'test' });

      await geolocationService.updateProfessionalLocation(professionalId, newLat, newLng);

      // Cache should be cleared for this professional
      expect(geolocationService.getCacheSize()).toBe(0);
    });
  });

  describe('getProfessionalLocation', () => {
    const professionalId = 'prof-123';

    test('should return professional location', async () => {
      const mockProfile = {
        latitud: -34.6118,
        longitud: -58.3960,
        last_location_update: new Date()
      };

      mockPrisma.perfiles_profesionales.findFirst.mockResolvedValue(mockProfile);

      const result = await geolocationService.getProfessionalLocation(professionalId);

      expect(result.lat).toBe(-34.6118);
      expect(result.lng).toBe(-58.3960);
      expect(result.lastUpdate).toBeDefined();
    });

    test('should throw error for missing location', async () => {
      mockPrisma.perfiles_profesionales.findFirst.mockResolvedValue({
        latitud: null,
        longitud: null
      });

      await expect(geolocationService.getProfessionalLocation(professionalId))
        .rejects.toThrow('Ubicación no disponible');
    });
  });

  describe('calculateOptimalRoute', () => {
    test('should calculate optimal route for multiple points', () => {
      const startPoint = { lat: 0, lng: 0 };
      const points = [
        { lat: 1, lng: 1 },
        { lat: -1, lng: -1 },
        { lat: 2, lng: 2 }
      ];

      const route = geolocationService.calculateOptimalRoute(points, startPoint);

      expect(route).toHaveLength(4); // start + 3 points
      expect(route[0]).toEqual(startPoint);
      expect(route).toContainEqual(points[0]);
      expect(route).toContainEqual(points[1]);
      expect(route).toContainEqual(points[2]);
    });

    test('should handle single point', () => {
      const startPoint = { lat: 0, lng: 0 };
      const points = [{ lat: 1, lng: 1 }];

      const route = geolocationService.calculateOptimalRoute(points, startPoint);

      expect(route).toEqual([{ lat: 1, lng: 1 }]);
    });

    test('should handle empty points array', () => {
      const startPoint = { lat: 0, lng: 0 };
      const points = [];

      const route = geolocationService.calculateOptimalRoute(points, startPoint);

      expect(route).toEqual([]);
    });
  });

  describe('getGeospatialStats', () => {
    test('should calculate geospatial statistics', async () => {
      const mockRequests = [
        {
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          assignments: [
            {
              professional: {
                perfiles_profesionales: [
                  { latitud: -34.5881, longitud: -58.4165 }
                ]
              }
            }
          ]
        },
        {
          latitude: -34.5,
          longitude: -58.3,
          radius_km: 10,
          assignments: []
        }
      ];

      mockPrisma.urgent_requests.findMany.mockResolvedValue(mockRequests);

      const stats = await geolocationService.getGeospatialStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.avgRadius).toBe(7.5); // (5 + 10) / 2
      expect(stats.locationDistribution).toBeDefined();
      expect(stats.coverageArea).toBeGreaterThan(0);
    });

    test('should handle requests without assignments', async () => {
      const mockRequests = [
        {
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          assignments: []
        }
      ];

      mockPrisma.urgent_requests.findMany.mockResolvedValue(mockRequests);

      const stats = await geolocationService.getGeospatialStats();

      expect(stats.avgMatchingDistance).toBe(0);
    });

    test('should filter by date and category', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        serviceCategory: 'plomero'
      };

      mockPrisma.urgent_requests.findMany.mockResolvedValue([]);

      await geolocationService.getGeospatialStats(filters);

      const call = mockPrisma.urgent_requests.findMany.mock.calls[0][0];
      expect(call.where.created_at).toBeDefined();
      expect(call.where.service).toEqual({ categoria: 'plomero' });
    });
  });

  describe('Cache Management', () => {
    test('should manage cache correctly', () => {
      geolocationService.setCache('key1', { data: 'value1' });
      geolocationService.setCache('key2', { data: 'value2' });

      expect(geolocationService.getCacheSize()).toBe(2);

      const value1 = geolocationService.getFromCache('key1');
      expect(value1).toEqual({ data: 'value1' });

      geolocationService.clearCache();
      expect(geolocationService.getCacheSize()).toBe(0);
    });

    test('should expire old cache entries', () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => 0);
      geolocationService.setCache('key1', { data: 'value1' });

      Date.now = jest.fn(() => 10 * 60 * 1000 + 1000); // 10 min + 1 sec
      const value = geolocationService.getFromCache('key1');

      expect(value).toBeNull(); // Should be expired

      Date.now = originalNow;
    });

    test('should cleanup expired cache', () => {
      const originalNow = Date.now;
      Date.now = jest.fn(() => 0);
      geolocationService.setCache('key1', { data: 'value1' });

      Date.now = jest.fn(() => 15 * 60 * 1000); // 15 min
      geolocationService.cleanupExpiredCache();

      expect(geolocationService.getCacheSize()).toBe(0);

      Date.now = originalNow;
    });
  });

  describe('validateCoordinates', () => {
    test('should validate correct coordinates', () => {
      expect(geolocationService.validateCoordinates(0, 0)).toBe(true);
      expect(geolocationService.validateCoordinates(90, 180)).toBe(true);
      expect(geolocationService.validateCoordinates(-90, -180)).toBe(true);
      expect(geolocationService.validateCoordinates(45.123, -122.456)).toBe(true);
    });

    test('should reject invalid coordinates', () => {
      expect(geolocationService.validateCoordinates(91, 0)).toBe(false);
      expect(geolocationService.validateCoordinates(-91, 0)).toBe(false);
      expect(geolocationService.validateCoordinates(0, 181)).toBe(false);
      expect(geolocationService.validateCoordinates(0, -181)).toBe(false);
      expect(geolocationService.validateCoordinates('invalid', 0)).toBe(false);
      expect(geolocationService.validateCoordinates(0, 'invalid')).toBe(false);
      expect(geolocationService.validateCoordinates(null, 0)).toBe(false);
      expect(geolocationService.validateCoordinates(0, undefined)).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockPrisma.perfiles_profesionales.findMany.mockRejectedValue(new Error('DB Error'));

      await expect(geolocationService.findNearbyProfessionals(0, 0, 5))
        .resolves.toEqual([]);
    });

    test('should handle invalid bounding box calculations', () => {
      // Should not crash with extreme coordinates
      expect(() => {
        geolocationService.calculateBoundingBox(90, 180, 1000);
      }).not.toThrow();

      expect(() => {
        geolocationService.calculateBoundingBox(-90, -180, 0);
      }).not.toThrow();
    });

    test('should handle concurrent cache operations', () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(geolocationService.setCache(`key${i}`, { data: `value${i}` }));
      }

      expect(() => Promise.all(promises)).not.toThrow();
      expect(geolocationService.getCacheSize()).toBe(10);
    });

    test('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        usuario: { id: `prof-${i}`, esta_disponible: true },
        especialidades: [{ especialidad: { nombre: 'Plomero' } }],
        latitud: -34.6118 + (Math.random() - 0.5) * 0.1,
        longitud: -58.3960 + (Math.random() - 0.5) * 0.1
      }));

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue(largeDataset);

      const startTime = Date.now();
      const result = await geolocationService.findNearbyProfessionals(-34.6118, -58.3960, 10);
      const endTime = Date.now();

      expect(result.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle coordinate precision', () => {
      // Test with high precision coordinates
      const lat1 = -34.611812345;
      const lng1 = -58.396045678;
      const lat2 = -34.588112345;
      const lng2 = -58.416545678;

      const distance = geolocationService.calculateDistance(lat1, lng1, lat2, lng2);

      expect(distance).toBeGreaterThan(3);
      expect(distance).toBeLessThan(4);
    });

    test('should handle route optimization with many points', () => {
      const startPoint = { lat: 0, lng: 0 };
      const points = Array.from({ length: 50 }, (_, i) => ({
        lat: Math.random() * 180 - 90,
        lng: Math.random() * 360 - 180
      }));

      expect(() => {
        geolocationService.calculateOptimalRoute(points, startPoint);
      }).not.toThrow();
    });

    test('should handle cache key collisions', () => {
      // Same coordinates should generate different cache keys with different filters
      geolocationService.setCache('0.00000_-0.00000_5_', { data: 'no filters' });
      geolocationService.setCache('0.00000_-0.00000_5_' + JSON.stringify({ category: 'test' }), { data: 'with filters' });

      expect(geolocationService.getCacheSize()).toBe(2);
    });

    test('should handle memory pressure', () => {
      // Add many cache entries
      for (let i = 0; i < 10000; i++) {
        geolocationService.setCache(`key${i}`, { data: `value${i}` });
      }

      // Should not crash
      expect(() => {
        geolocationService.getCacheSize();
        geolocationService.clearCache();
      }).not.toThrow();

      expect(geolocationService.getCacheSize()).toBe(0);
    });
  });
});