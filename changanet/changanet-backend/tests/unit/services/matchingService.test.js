/**
 * @archivo tests/unit/services/matchingService.test.js
 * @descripción Pruebas unitarias completas para MatchingService
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests unitarios para algoritmos de matching geoespacial
 * @impacto Social: Validación de algoritmos de conexión profesional-cliente
 */

const { MatchingService } = require('../../../src/services/matchingService');
const { PrismaClient } = require('@prisma/client');

// Mocks
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    perfiles_profesionales: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    urgent_pricing_rules: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn()
    },
    urgent_requests: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    urgent_assignments: {
      findMany: jest.fn()
    },
    servicios: {
      findMany: jest.fn()
    }
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('MatchingService - Unit Tests', () => {
  let matchingService;
  let mockPrisma;
  let mockGeolocationService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGeolocationService = {
      findNearbyProfessionals: jest.fn()
    };

    mockPrisma = new PrismaClient();
    matchingService = new MatchingService();
    matchingService.setGeolocationService(mockGeolocationService);
  });

  describe('findMatchingProfessionals', () => {
    const baseLat = -34.6118;
    const baseLng = -58.3960;
    const radiusKm = 5;

    test('should find and score matching professionals', async () => {
      const mockNearbyProfessionals = [
        {
          usuario: {
            id: 'prof-1',
            nombre: 'Professional 1',
            calificacion_promedio: 4.5,
            total_resenas: 20,
            esta_disponible: true
          },
          especialidades: [{ especialidad: { nombre: 'Plomero', categoria: 'Hogar' } }],
          distance_km: 2.5
        },
        {
          usuario: {
            id: 'prof-2',
            nombre: 'Professional 2',
            calificacion_promedio: 3.8,
            total_resenas: 15,
            esta_disponible: true
          },
          especialidades: [{ especialidad: { nombre: 'Electricista', categoria: 'Hogar' } }],
          distance_km: 3.1
        }
      ];

      mockGeolocationService.findNearbyProfessionals.mockResolvedValue(mockNearbyProfessionals);

      const result = await matchingService.findMatchingProfessionals(baseLat, baseLng, radiusKm, {
        serviceCategory: 'plomero',
        minRating: 3.0,
        maxCandidates: 5
      });

      expect(result).toHaveLength(2);
      expect(result[0].professionalId).toBe('prof-1'); // Higher score due to better rating
      expect(result[0].totalScore).toBeGreaterThan(result[1].totalScore);
      expect(mockGeolocationService.findNearbyProfessionals).toHaveBeenCalledWith(
        baseLat, baseLng, radiusKm,
        expect.objectContaining({ serviceCategory: 'plomero' })
      );
    });

    test('should return empty array when no professionals found', async () => {
      mockGeolocationService.findNearbyProfessionals.mockResolvedValue([]);

      const result = await matchingService.findMatchingProfessionals(baseLat, baseLng, radiusKm);

      expect(result).toEqual([]);
    });

    test('should apply retry penalty to scores', async () => {
      const mockNearbyProfessionals = [
        {
          usuario: {
            id: 'prof-1',
            nombre: 'Professional 1',
            calificacion_promedio: 4.0,
            total_resenas: 10,
            esta_disponible: true
          },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          distance_km: 2.0
        }
      ];

      mockGeolocationService.findNearbyProfessionals.mockResolvedValue(mockNearbyProfessionals);

      const normalResult = await matchingService.findMatchingProfessionals(baseLat, baseLng, radiusKm, { isRetry: false });
      const retryResult = await matchingService.findMatchingProfessionals(baseLat, baseLng, radiusKm, { isRetry: true });

      expect(retryResult[0].totalScore).toBeLessThan(normalResult[0].totalScore);
    });

    test('should limit number of candidates', async () => {
      const mockNearbyProfessionals = Array.from({ length: 10 }, (_, i) => ({
        usuario: {
          id: `prof-${i}`,
          nombre: `Professional ${i}`,
          calificacion_promedio: 4.0,
          total_resenas: 10,
          esta_disponible: true
        },
        especialidades: [{ especialidad: { nombre: 'Plomero' } }],
        distance_km: i + 1
      }));

      mockGeolocationService.findNearbyProfessionals.mockResolvedValue(mockNearbyProfessionals);

      const result = await matchingService.findMatchingProfessionals(baseLat, baseLng, radiusKm, {
        maxCandidates: 3
      });

      expect(result).toHaveLength(3);
    });

    test('should prioritize distance when enabled', async () => {
      const mockNearbyProfessionals = [
        {
          usuario: { id: 'prof-1', nombre: 'Far Professional', calificacion_promedio: 5.0, total_resenas: 50, esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          distance_km: 4.5
        },
        {
          usuario: { id: 'prof-2', nombre: 'Close Professional', calificacion_promedio: 3.0, total_resenas: 5, esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          distance_km: 1.0
        }
      ];

      mockGeolocationService.findNearbyProfessionals.mockResolvedValue(mockNearbyProfessionals);

      const result = await matchingService.findMatchingProfessionals(baseLat, baseLng, radiusKm, {
        prioritizeDistance: true
      });

      expect(result[0].professionalId).toBe('prof-2'); // Closer professional first
      expect(result[0].distance).toBe(1.0);
    });
  });

  describe('findNearbyAvailableProfessionals', () => {
    test('should use geolocation service when available', async () => {
      const expectedResult = [{ id: 'prof-1' }];
      mockGeolocationService.findNearbyProfessionals.mockResolvedValue(expectedResult);

      const result = await matchingService.findNearbyAvailableProfessionals(0, 0, 5, 'plomero');

      expect(result).toEqual(expectedResult);
      expect(mockGeolocationService.findNearbyProfessionals).toHaveBeenCalledWith(0, 0, 5, {
        esta_disponible: true,
        serviceCategory: 'plomero',
        latitud: { not: null },
        longitud: { not: null }
      });
    });

    test('should fallback to direct database query', async () => {
      matchingService.setGeolocationService(null);

      const mockProfessionals = [
        {
          usuario: {
            id: 'prof-1',
            nombre: 'Test Professional',
            calificacion_promedio: 4.0,
            total_resenas: 10,
            esta_disponible: true
          },
          especialidades: [{ especialidad: { nombre: 'Plomero', categoria: 'Hogar' } }],
          latitud: -34.6118,
          longitud: -58.3960
        }
      ];

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue(mockProfessionals);

      const result = await matchingService.findNearbyAvailableProfessionals(-34.6118, -58.3960, 5, 'plomero');

      expect(result).toHaveLength(1);
      expect(result[0].usuario.id).toBe('prof-1');
      expect(mockPrisma.perfiles_profesionales.findMany).toHaveBeenCalled();
    });

    test('should filter by service category', async () => {
      matchingService.setGeolocationService(null);

      const mockProfessionals = [
        {
          usuario: { id: 'prof-1', esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero', categoria: 'Hogar' } }],
          latitud: -34.6118,
          longitud: -58.3960
        },
        {
          usuario: { id: 'prof-2', esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Pintor', categoria: 'Hogar' } }],
          latitud: -34.6118,
          longitud: -58.3960
        }
      ];

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue(mockProfessionals);

      const result = await matchingService.findNearbyAvailableProfessionals(-34.6118, -58.3960, 5, 'plomero');

      expect(result).toHaveLength(1);
      expect(result[0].usuario.id).toBe('prof-1');
    });
  });

  describe('calculateMatchingScores', () => {
    test('should calculate comprehensive scores for candidates', async () => {
      const professionals = [
        {
          usuario: {
            id: 'prof-1',
            calificacion_promedio: 4.5,
            total_resenas: 25,
            esta_disponible: true
          },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          distance_km: 2.0
        }
      ];

      const result = await matchingService.calculateMatchingScores(
        professionals, -34.6118, -58.3960,
        { serviceCategory: 'plomero' }
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('professionalId', 'prof-1');
      expect(result[0]).toHaveProperty('totalScore');
      expect(result[0]).toHaveProperty('scores');
      expect(result[0].scores).toHaveProperty('distance');
      expect(result[0].scores).toHaveProperty('rating');
      expect(result[0].scores).toHaveProperty('experience');
      expect(result[0].scores).toHaveProperty('availability');
      expect(result[0].scores).toHaveProperty('categoryMatch');
    });

    test('should filter by minimum rating', async () => {
      const professionals = [
        {
          usuario: { id: 'prof-1', calificacion_promedio: 4.5, total_resenas: 10, esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          distance_km: 2.0
        },
        {
          usuario: { id: 'prof-2', calificacion_promedio: 2.5, total_resenas: 10, esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          distance_km: 2.0
        }
      ];

      const result = await matchingService.calculateMatchingScores(
        professionals, -34.6118, -58.3960,
        { minRating: 3.0 }
      );

      expect(result).toHaveLength(1);
      expect(result[0].professionalId).toBe('prof-1');
    });

    test('should calculate distance score correctly', async () => {
      const professionals = [
        {
          usuario: { id: 'prof-1', calificacion_promedio: 4.0, total_resenas: 10, esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          distance_km: 0 // Very close
        },
        {
          usuario: { id: 'prof-2', calificacion_promedio: 4.0, total_resenas: 10, esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          distance_km: 50 // Far
        }
      ];

      const result = await matchingService.calculateMatchingScores(
        professionals, -34.6118, -58.3960
      );

      expect(result[0].scores.distance).toBeGreaterThan(result[1].scores.distance);
    });

    test('should boost category matching', async () => {
      const professionals = [
        {
          usuario: { id: 'prof-1', calificacion_promedio: 4.0, total_resenas: 10, esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero', categoria: 'Hogar' } }],
          distance_km: 2.0
        },
        {
          usuario: { id: 'prof-2', calificacion_promedio: 4.0, total_resenas: 10, esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Pintor', categoria: 'Hogar' } }],
          distance_km: 2.0
        }
      ];

      const result = await matchingService.calculateMatchingScores(
        professionals, -34.6118, -58.3960,
        { serviceCategory: 'plomero' }
      );

      expect(result[0].scores.categoryMatch).toBe(100); // Exact match
      expect(result[1].scores.categoryMatch).toBe(0); // No match
    });
  });

  describe('getUrgentPricing', () => {
    test('should return specific pricing rule', async () => {
      const mockRule = {
        service_category: 'plomero',
        base_multiplier: 2.0,
        min_price: 500
      };

      mockPrisma.urgent_pricing_rules.findFirst.mockResolvedValue(mockRule);

      const result = await matchingService.getUrgentPricing('plomero');

      expect(result).toEqual({
        multiplier: 2.0,
        minPrice: 500,
        category: 'plomero'
      });
    });

    test('should return default pricing when no rule exists', async () => {
      mockPrisma.urgent_pricing_rules.findFirst.mockResolvedValue(null);

      const result = await matchingService.getUrgentPricing('nonexistent');

      expect(result).toEqual({
        multiplier: 1.5,
        minPrice: 0,
        category: 'general'
      });
    });
  });

  describe('updateUrgentPricingRules', () => {
    test('should update multiple pricing rules', async () => {
      const rules = [
        { service_category: 'plomero', base_multiplier: 2.0, min_price: 500 },
        { service_category: 'electricista', base_multiplier: 1.8, min_price: 400 }
      ];

      mockPrisma.urgent_pricing_rules.upsert
        .mockResolvedValueOnce({ service_category: 'plomero' })
        .mockResolvedValueOnce({ service_category: 'electricista' });

      const result = await matchingService.updateUrgentPricingRules(rules);

      expect(result).toHaveLength(2);
      expect(mockPrisma.urgent_pricing_rules.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculateDistance', () => {
    test('should calculate distance using Haversine formula', () => {
      // Buenos Aires to Mendoza (approximate)
      const distance = matchingService.calculateDistance(-34.6118, -58.3960, -32.8908, -68.8272);

      expect(distance).toBeGreaterThan(950);
      expect(distance).toBeLessThan(1050);
    });

    test('should return 0 for same coordinates', () => {
      const distance = matchingService.calculateDistance(-34.6118, -58.3960, -34.6118, -58.3960);

      expect(distance).toBe(0);
    });
  });

  describe('getMatchingStats', () => {
    test('should return comprehensive matching statistics', async () => {
      mockPrisma.urgent_requests.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80); // matched

      mockPrisma.urgent_requests.findMany
        .mockResolvedValueOnce([]) // avg candidates
        .mockResolvedValueOnce([]) // avg time
        .mockResolvedValueOnce([]); // success rate

      const result = await matchingService.getMatchingStats();

      expect(result).toHaveProperty('totalRequests', 100);
      expect(result).toHaveProperty('matchedRequests', 80);
      expect(result).toHaveProperty('matchingRate', 80);
      expect(result).toHaveProperty('avgCandidatesPerRequest');
      expect(result).toHaveProperty('avgMatchingTime');
      expect(result).toHaveProperty('successRateByCategory');
    });
  });

  describe('getAverageCandidatesPerRequest', () => {
    test('should calculate average candidates correctly', async () => {
      const mockRequests = [
        { _count: { candidates: 3 } },
        { _count: { candidates: 5 } },
        { _count: { candidates: 2 } }
      ];

      mockPrisma.urgent_requests.findMany.mockResolvedValue(mockRequests);

      const result = await matchingService.getAverageCandidatesPerRequest({});

      expect(result).toBe(3.33); // (3+5+2)/3 rounded
    });
  });

  describe('getAverageMatchingTime', () => {
    test('should calculate average matching time', async () => {
      const mockRequests = [
        {
          assignments: [{ assigned_at: new Date(Date.now() + 30 * 60 * 1000) }], // 30 min later
          created_at: new Date()
        },
        {
          assignments: [{ assigned_at: new Date(Date.now() + 60 * 60 * 1000) }], // 1 hour later
          created_at: new Date()
        }
      ];

      mockPrisma.urgent_requests.findMany.mockResolvedValue(mockRequests);

      const result = await matchingService.getAverageMatchingTime({});

      expect(result).toBe(45); // Average of 30 and 60 minutes
    });
  });

  describe('getSuccessRateByCategory', () => {
    test('should calculate success rates by category', async () => {
      const mockCategories = [
        { categoria: 'plomero' },
        { categoria: 'electricista' }
      ];

      mockPrisma.servicios.findMany.mockResolvedValue(mockCategories);
      mockPrisma.urgent_requests.count
        .mockResolvedValueOnce(10) // plomero total
        .mockResolvedValueOnce(8)  // plomero successful
        .mockResolvedValueOnce(5)  // electricista total
        .mockResolvedValueOnce(3); // electricista successful

      const result = await matchingService.getSuccessRateByCategory({});

      expect(result.plomero).toBe(80); // 8/10 * 100
      expect(result.electricista).toBe(60); // 3/5 * 100
    });
  });

  describe('optimizeMatchingAlgorithm', () => {
    test('should analyze successful matches for optimization', async () => {
      const mockMatches = [
        {
          professional: {
            calificacion_promedio: 4.5,
            total_resenas: 25
          },
          urgent_request: {
            candidates: [
              { professional_id: 'prof-1', distance_km: 2.5 },
              { professional_id: 'prof-2', distance_km: 3.1 }
            ]
          }
        }
      ];

      mockPrisma.urgent_assignments.findMany.mockResolvedValue(mockMatches);

      const result = await matchingService.optimizeMatchingAlgorithm();

      expect(result).toHaveProperty('avgRating', 4.5);
      expect(result).toHaveProperty('avgExperience', 25);
      expect(result).toHaveProperty('avgDistance', 2.5);
      expect(result).toHaveProperty('totalMatches', 1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle geolocation service unavailability', async () => {
      matchingService.setGeolocationService(null);

      const mockProfessionals = [
        {
          usuario: { id: 'prof-1', esta_disponible: true },
          especialidades: [{ especialidad: { nombre: 'Plomero' } }],
          latitud: -34.6118,
          longitud: -58.3960
        }
      ];

      mockPrisma.perfiles_profesionales.findMany.mockResolvedValue(mockProfessionals);

      const result = await matchingService.findNearbyAvailableProfessionals(-34.6118, -58.3960, 5);

      expect(result).toHaveLength(1);
    });

    test('should handle database errors gracefully', async () => {
      mockGeolocationService.findNearbyProfessionals.mockRejectedValue(new Error('DB Error'));

      await expect(matchingService.findMatchingProfessionals(0, 0, 5))
        .resolves.toEqual([]);
    });

    test('should handle empty results', async () => {
      mockGeolocationService.findNearbyProfessionals.mockResolvedValue([]);

      const result = await matchingService.findMatchingProfessionals(0, 0, 5);

      expect(result).toEqual([]);
    });

    test('should handle invalid coordinates', () => {
      expect(() => {
        matchingService.calculateDistance(91, 0, 0, 0);
      }).not.toThrow(); // Haversine handles invalid coords

      expect(() => {
        matchingService.calculateDistance(0, 0, 91, 0);
      }).not.toThrow();
    });

    test('should handle division by zero in statistics', async () => {
      mockPrisma.urgent_requests.findMany.mockResolvedValue([]);

      const result = await matchingService.getAverageCandidatesPerRequest({});

      expect(result).toBe(0);
    });

    test('should handle missing assignments in time calculation', async () => {
      const mockRequests = [
        { assignments: [], created_at: new Date() },
        { assignments: [], created_at: new Date() }
      ];

      mockPrisma.urgent_requests.findMany.mockResolvedValue(mockRequests);

      const result = await matchingService.getAverageMatchingTime({});

      expect(result).toBe(0);
    });

    test('should handle concurrent matching requests', async () => {
      const promises = [
        matchingService.findMatchingProfessionals(-34.6118, -58.3960, 5),
        matchingService.findMatchingProfessionals(-34.6118, -58.3960, 5),
        matchingService.findMatchingProfessionals(-34.6118, -58.3960, 5)
      ];

      mockGeolocationService.findNearbyProfessionals.mockResolvedValue([]);

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});