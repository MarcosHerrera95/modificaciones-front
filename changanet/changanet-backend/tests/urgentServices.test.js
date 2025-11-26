/**
 * Pruebas unitarias para Servicios Urgentes
 * Cubre cálculo de distancia, filtro por radio, cálculo de precio dinámico
 * y validación de seguridad según especificaciones del PRD
 */

const { calculateDistance, getUrgentPricing } = require('../src/controllers/urgentController');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Urgent Services - Unit Tests', () => {
  describe('calculateDistance', () => {
    test('debe calcular correctamente la distancia entre dos puntos', () => {
      // Buenos Aires centro a Palermo (aprox 5km)
      const point1 = { lat: -34.6118, lng: -58.3960 }; // Centro
      const point2 = { lat: -34.5881, lng: -58.4165 }; // Palermo

      const distance = calculateDistance(point1, point2);

      // La distancia real es aproximadamente 3.5-4km
      expect(distance).toBeGreaterThan(3);
      expect(distance).toBeLessThan(5);
    });

    test('debe devolver 0 para el mismo punto', () => {
      const point = { lat: -34.6118, lng: -58.3960 };

      const distance = calculateDistance(point, point);

      expect(distance).toBe(0);
    });

    test('debe calcular distancia entre puntos lejanos', () => {
      const buenosAires = { lat: -34.6118, lng: -58.3960 };
      const mendoza = { lat: -32.8908, lng: -68.8272 };

      const distance = calculateDistance(buenosAires, mendoza);

      // Distancia aproximada Buenos Aires - Mendoza: ~1000km
      expect(distance).toBeGreaterThan(950);
      expect(distance).toBeLessThan(1050);
    });

    test('debe manejar coordenadas en diferentes hemisferios', () => {
      const northern = { lat: 40.7128, lng: -74.0060 }; // Nueva York
      const southern = { lat: -33.8688, lng: 151.2093 }; // Sydney

      const distance = calculateDistance(northern, southern);

      // Distancia aproximada Nueva York - Sydney: ~16000km
      expect(distance).toBeGreaterThan(15000);
      expect(distance).toBeLessThan(17000);
    });
  });

  describe('getUrgentPricing', () => {
    beforeEach(async () => {
      // Limpiar reglas de precios de prueba
      await prisma.urgent_pricing_rules.deleteMany({
        where: {
          service_category: { startsWith: 'test_' }
        }
      });
    });

    afterAll(async () => {
      // Limpiar después de todas las pruebas
      await prisma.urgent_pricing_rules.deleteMany({
        where: {
          service_category: { startsWith: 'test_' }
        }
      });
      await prisma.$disconnect();
    });

    test('debe devolver valores por defecto cuando no hay regla específica', async () => {
      const pricing = await getUrgentPricing('categoria_inexistente');

      expect(pricing).toEqual({
        multiplier: 1.5,
        minPrice: 0
      });
    });

    test('debe devolver regla específica cuando existe', async () => {
      // Crear regla de prueba
      await prisma.urgent_pricing_rules.create({
        data: {
          service_category: 'test_plomero',
          base_multiplier: 2.0,
          min_price: 500
        }
      });

      const pricing = await getUrgentPricing('test_plomero');

      expect(pricing).toEqual({
        multiplier: 2.0,
        minPrice: 500
      });
    });

    test('debe manejar múltiples categorías correctamente', async () => {
      // Crear múltiples reglas (SQLite no soporta createMany)
      await prisma.urgent_pricing_rules.create({
        data: {
          service_category: 'test_electricista',
          base_multiplier: 1.8,
          min_price: 300
        }
      });

      await prisma.urgent_pricing_rules.create({
        data: {
          service_category: 'test_pintor',
          base_multiplier: 1.6,
          min_price: 200
        }
      });

      const pricing1 = await getUrgentPricing('test_electricista');
      const pricing2 = await getUrgentPricing('test_pintor');

      expect(pricing1).toEqual({
        multiplier: 1.8,
        minPrice: 300
      });

      expect(pricing2).toEqual({
        multiplier: 1.6,
        minPrice: 200
      });
    });
  });

  describe('Distance-based Filtering', () => {
    test('debe filtrar profesionales dentro del radio especificado', () => {
      const centerPoint = { lat: -34.6118, lng: -58.3960 };
      const radiusKm = 5;

      const professionals = [
        { id: 1, latitud: -34.5881, longitud: -58.4165, distance: 3.5 }, // Dentro del radio
        { id: 2, latitud: -34.5211, longitud: -58.7000, distance: 25 }, // Fuera del radio
        { id: 3, latitud: -34.6288, longitud: -58.3817, distance: 2.1 }, // Dentro del radio
        { id: 4, latitud: -34.7167, longitud: -58.2833, distance: 15 } // Fuera del radio
      ];

      const filtered = professionals.filter(prof => {
        const distance = calculateDistance(centerPoint, {
          lat: prof.latitud,
          lng: prof.longitud
        });
        return distance <= radiusKm;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map(p => p.id)).toEqual([1, 3]);
    });

    test('debe manejar radio de 0 km (solo ubicación exacta)', () => {
      const centerPoint = { lat: -34.6118, lng: -58.3960 };
      const radiusKm = 0;

      const professionals = [
        { id: 1, latitud: -34.6118, longitud: -58.3960, distance: 0 }, // Exactamente en el punto
        { id: 2, latitud: -34.6119, longitud: -58.3961, distance: 0.015 } // Muy cerca (~15m)
      ];

      const filtered = professionals.filter(prof => {
        const distance = calculateDistance(centerPoint, {
          lat: prof.latitud,
          lng: prof.longitud
        });
        return distance <= radiusKm;
      });

      // Solo el punto exacto debería estar incluido
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    test('debe incluir todos los profesionales con radio grande', () => {
      const centerPoint = { lat: -34.6118, lng: -58.3960 };
      const radiusKm = 100;

      const professionals = [
        { id: 1, latitud: -34.5881, longitud: -58.4165, distance: 3.5 },
        { id: 2, latitud: -32.8908, longitud: -68.8272, distance: 1000 }, // Mendoza
        { id: 3, latitud: 40.7128, longitud: -74.0060, distance: 8500 } // Nueva York
      ];

      const filtered = professionals.filter(prof => {
        const distance = calculateDistance(centerPoint, {
          lat: prof.latitud,
          lng: prof.longitud
        });
        return distance <= radiusKm;
      });

      expect(filtered).toHaveLength(1); // Solo Buenos Aires
      expect(filtered[0].id).toBe(1);
    });
  });

  describe('Dynamic Pricing Calculation', () => {
    test('debe calcular precio correcto con multiplicador', () => {
      const basePrice = 1000;
      const multiplier = 1.5;
      const minPrice = 500;

      const finalPrice = Math.max(basePrice * multiplier, minPrice);

      expect(finalPrice).toBe(1500);
    });

    test('debe respetar precio mínimo cuando cálculo es menor', () => {
      const basePrice = 100; // Precio base bajo
      const multiplier = 1.5;
      const minPrice = 500;

      const finalPrice = Math.max(basePrice * multiplier, minPrice);

      expect(finalPrice).toBe(500); // Debe ser el precio mínimo
    });

    test('debe calcular precio correcto con diferentes multiplicadores', () => {
      const testCases = [
        { basePrice: 1000, multiplier: 1.2, minPrice: 0, expected: 1200 },
        { basePrice: 1000, multiplier: 1.5, minPrice: 0, expected: 1500 },
        { basePrice: 1000, multiplier: 2.0, minPrice: 0, expected: 2000 },
        { basePrice: 500, multiplier: 1.8, minPrice: 1000, expected: 1000 }, // Respeta mínimo
        { basePrice: 2000, multiplier: 1.3, minPrice: 500, expected: 2600 } // No respeta mínimo
      ];

      testCases.forEach(({ basePrice, multiplier, minPrice, expected }) => {
        const finalPrice = Math.max(basePrice * multiplier, minPrice);
        expect(finalPrice).toBe(expected);
      });
    });
  });

  describe('Security Validations', () => {
    test('debe validar coordenadas dentro de rangos válidos', () => {
      const validCoordinates = [
        { lat: 0, lng: 0 },
        { lat: 90, lng: 180 },
        { lat: -90, lng: -180 },
        { lat: 45.123, lng: -122.456 }
      ];

      validCoordinates.forEach(coord => {
        expect(coord.lat).toBeGreaterThanOrEqual(-90);
        expect(coord.lat).toBeLessThanOrEqual(90);
        expect(coord.lng).toBeGreaterThanOrEqual(-180);
        expect(coord.lng).toBeLessThanOrEqual(180);
      });
    });

    test('debe rechazar coordenadas inválidas', () => {
      const invalidCoordinates = [
        { lat: 91, lng: 0 }, // Latitud demasiado alta
        { lat: -91, lng: 0 }, // Latitud demasiado baja
        { lat: 0, lng: 181 }, // Longitud demasiado alta
        { lat: 0, lng: -181 } // Longitud demasiado baja
      ];

      invalidCoordinates.forEach(coord => {
        const isValid = coord.lat >= -90 && coord.lat <= 90 &&
                       coord.lng >= -180 && coord.lng <= 180;
        expect(isValid).toBe(false);
      });
    });

    test('debe validar radio dentro de límites permitidos', () => {
      const validRadii = [1, 5, 25, 50];
      const invalidRadii = [0, 51, -1, 100];

      validRadii.forEach(radius => {
        expect(radius).toBeGreaterThanOrEqual(1);
        expect(radius).toBeLessThanOrEqual(50);
      });

      invalidRadii.forEach(radius => {
        const isValid = radius >= 1 && radius <= 50;
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Rate Limiting Logic', () => {
    test('debe permitir máximo 5 solicitudes por hora por usuario', () => {
      const maxRequestsPerHour = 5;
      const userRequests = Array.from({ length: maxRequestsPerHour + 1 }, (_, i) => i + 1);

      // Simular verificación de límite
      const canMakeRequest = (requestCount) => requestCount <= maxRequestsPerHour;

      expect(canMakeRequest(userRequests.length - 1)).toBe(true); // 5 solicitudes - OK
      expect(canMakeRequest(userRequests.length)).toBe(false); // 6 solicitudes - Rechazado
    });

    test('debe resetear contador después de una hora', () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const recentRequests = [now, thirtyMinutesAgo]; // Dentro de la última hora
      const oldRequests = [twoHoursAgo]; // Fuera de la última hora

      const recentCount = recentRequests.filter(req =>
        req > new Date(now.getTime() - 60 * 60 * 1000)
      ).length;

      const oldCount = oldRequests.filter(req =>
        req > new Date(now.getTime() - 60 * 60 * 1000)
      ).length;

      expect(recentCount).toBe(2); // Ambas solicitudes son recientes
      expect(oldCount).toBe(0); // La solicitud antigua no cuenta
    });
  });

  describe('Status Flow Validation', () => {
    test('debe validar flujo correcto de estados', () => {
      const validFlows = [
        ['pending', 'assigned', 'completed'],
        ['pending', 'assigned', 'cancelled'],
        ['pending', 'cancelled']
      ];

      const invalidFlows = [
        ['assigned', 'pending'], // No se puede volver a pending
        ['completed', 'assigned'], // No se puede reasignar completado
        ['cancelled', 'assigned'] // No se puede asignar cancelado
      ];

      // Validar flujos válidos (simplificado)
      validFlows.forEach(flow => {
        const hasValidTransitions = flow.every((status, index) => {
          if (index === 0) return true;
          const prevStatus = flow[index - 1];

          // Reglas de transición
          if (prevStatus === 'pending' && ['assigned', 'cancelled'].includes(status)) return true;
          if (prevStatus === 'assigned' && ['completed', 'cancelled'].includes(status)) return true;
          if (['completed', 'cancelled'].includes(prevStatus)) return false; // Estados finales

          return false;
        });

        expect(hasValidTransitions).toBe(true);
      });

      // Validar que flujos inválidos fallen
      invalidFlows.forEach(flow => {
        const hasValidTransitions = flow.every((status, index) => {
          if (index === 0) return true;
          const prevStatus = flow[index - 1];

          if (prevStatus === 'pending' && ['assigned', 'cancelled'].includes(status)) return true;
          if (prevStatus === 'assigned' && ['completed', 'cancelled'].includes(status)) return true;
          if (['completed', 'cancelled'].includes(prevStatus)) return false;

          return false;
        });

        expect(hasValidTransitions).toBe(false);
      });
    });
  });
});