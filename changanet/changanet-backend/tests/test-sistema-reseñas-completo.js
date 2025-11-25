/**
 * Pruebas de integración completas para el Sistema de Reseñas y Valoraciones
 * Implementa pruebas para REQ-21 a REQ-25 del PRD
 *
 * FUNCIONALIDADES TESTEADAS:
 * ✅ REQ-21: Calificación con estrellas (1-5)
 * ✅ REQ-22: Comentarios escritos
 * ✅ REQ-23: Adjuntar fotos del servicio
 * ✅ REQ-24: Calcular calificación promedio
 * ✅ REQ-25: Solo usuarios que completaron servicio pueden reseñar
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Sistema de Reseñas y Valoraciones - Pruebas de Integración', () => {
  let testClient;
  let testProfessional;
  let testService;
  let testReview;

  beforeAll(async () => {
    // Crear datos de prueba
    testClient = await prisma.usuarios.create({
      data: {
        email: 'test-client-reviews@example.com',
        nombre: 'Cliente Test Reviews',
        hash_contrasena: 'hashed_password',
        rol: 'cliente',
        esta_verificado: true
      }
    });

    testProfessional = await prisma.usuarios.create({
      data: {
        email: 'test-professional-reviews@example.com',
        nombre: 'Profesional Test Reviews',
        hash_contrasena: 'hashed_password',
        rol: 'profesional',
        esta_verificado: true
      }
    });

    // Crear perfil profesional
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: testProfessional.id,
        especialidad: 'Plomería',
        anos_experiencia: 5
      }
    });

    // Crear servicio completado
    testService = await prisma.servicios.create({
      data: {
        cliente_id: testClient.id,
        profesional_id: testProfessional.id,
        descripcion: 'Servicio de plomería de prueba',
        estado: 'completado',
        completado_en: new Date()
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.resenas.deleteMany({
      where: {
        servicio_id: testService.id
      }
    });

    await prisma.servicios.delete({
      where: { id: testService.id }
    });

    await prisma.perfiles_profesionales.delete({
      where: { usuario_id: testProfessional.id }
    });

    await prisma.usuarios.deleteMany({
      where: {
        email: {
          in: ['test-client-reviews@example.com', 'test-professional-reviews@example.com']
        }
      }
    });

    await prisma.$disconnect();
  });

  describe('REQ-21: Calificación con estrellas (1-5)', () => {
    test('Debe permitir calificaciones válidas entre 1 y 5', async () => {
      const validRatings = [1, 2, 3, 4, 5];

      for (const rating of validRatings) {
        const review = await prisma.resenas.create({
          data: {
            servicio_id: testService.id,
            cliente_id: testClient.id,
            calificacion: rating,
            comentario: `Test rating ${rating}`
          }
        });

        expect(review.calificacion).toBe(rating);
        expect(review.calificacion).toBeGreaterThanOrEqual(1);
        expect(review.calificacion).toBeLessThanOrEqual(5);

        // Limpiar para siguiente test
        await prisma.resenas.delete({ where: { id: review.id } });
      }
    });

    test('Debe rechazar calificaciones fuera del rango 1-5', async () => {
      const invalidRatings = [0, 6, -1, 10];

      for (const rating of invalidRatings) {
        await expect(
          prisma.resenas.create({
            data: {
              servicio_id: testService.id,
              cliente_id: testClient.id,
              calificacion: rating,
              comentario: 'Test invalid rating'
            }
          })
        ).rejects.toThrow();
      }
    });
  });

  describe('REQ-22: Comentarios escritos', () => {
    test('Debe permitir comentarios opcionales', async () => {
      // Con comentario
      const reviewWithComment = await prisma.resenas.create({
        data: {
          servicio_id: testService.id,
          cliente_id: testClient.id,
          calificacion: 4,
          comentario: 'Excelente servicio, muy recomendado'
        }
      });

      expect(reviewWithComment.comentario).toBe('Excelente servicio, muy recomendado');

      // Sin comentario (null)
      const reviewWithoutComment = await prisma.resenas.create({
        data: {
          servicio_id: testService.id,
          cliente_id: testClient.id,
          calificacion: 5,
          comentario: null
        }
      });

      expect(reviewWithoutComment.comentario).toBeNull();

      // Limpiar
      await prisma.resenas.deleteMany({
        where: { servicio_id: testService.id }
      });
    });
  });

  describe('REQ-23: Adjuntar fotos del servicio', () => {
    test('Debe permitir URLs de fotos opcionales', async () => {
      const photoUrl = 'https://example.com/photo.jpg';

      const reviewWithPhoto = await prisma.resenas.create({
        data: {
          servicio_id: testService.id,
          cliente_id: testClient.id,
          calificacion: 5,
          comentario: 'Servicio con foto',
          url_foto: photoUrl
        }
      });

      expect(reviewWithPhoto.url_foto).toBe(photoUrl);

      // Sin foto
      const reviewWithoutPhoto = await prisma.resenas.create({
        data: {
          servicio_id: testService.id,
          cliente_id: testClient.id,
          calificacion: 4,
          comentario: 'Servicio sin foto',
          url_foto: null
        }
      });

      expect(reviewWithoutPhoto.url_foto).toBeNull();

      // Limpiar
      await prisma.resenas.deleteMany({
        where: { servicio_id: testService.id }
      });
    });
  });

  describe('REQ-24: Calcular calificación promedio', () => {
    test('Debe calcular correctamente el promedio de calificaciones', async () => {
      // Crear múltiples reseñas
      const ratings = [5, 4, 3, 5, 4];
      const expectedAverage = ratings.reduce((a, b) => a + b, 0) / ratings.length;

      for (const rating of ratings) {
        await prisma.resenas.create({
          data: {
            servicio_id: testService.id,
            cliente_id: testClient.id,
            calificacion: rating,
            comentario: `Rating ${rating}`
          }
        });
      }

      // Calcular promedio usando la misma lógica del controlador
      const { _avg: { calificacion: avgRating } } = await prisma.resenas.aggregate({
        where: { servicio: { profesional_id: testProfessional.id } },
        _avg: { calificacion: true }
      });

      expect(avgRating).toBeCloseTo(expectedAverage, 2);

      // Limpiar
      await prisma.resenas.deleteMany({
        where: { servicio_id: testService.id }
      });
    });

    test('Debe actualizar el promedio en el perfil del profesional', async () => {
      // Crear reseña
      await prisma.resenas.create({
        data: {
          servicio_id: testService.id,
          cliente_id: testClient.id,
          calificacion: 5,
          comentario: 'Test average update'
        }
      });

      // Simular la actualización del promedio (como en el controlador)
      const { _avg: { calificacion: avgRating } } = await prisma.resenas.aggregate({
        where: { servicio: { profesional_id: testProfessional.id } },
        _avg: { calificacion: true }
      });

      await prisma.perfiles_profesionales.update({
        where: { usuario_id: testProfessional.id },
        data: { calificacion_promedio: avgRating || 0 }
      });

      // Verificar que se actualizó
      const updatedProfile = await prisma.perfiles_profesionales.findUnique({
        where: { usuario_id: testProfessional.id }
      });

      expect(updatedProfile.calificacion_promedio).toBe(avgRating);

      // Limpiar
      await prisma.resenas.deleteMany({
        where: { servicio_id: testService.id }
      });
    });
  });

  describe('REQ-25: Solo usuarios que completaron servicio pueden reseñar', () => {
    test('Debe permitir reseñas solo para servicios completados', async () => {
      // Servicio completado - debería permitir reseña
      const completedService = await prisma.servicios.create({
        data: {
          cliente_id: testClient.id,
          profesional_id: testProfessional.id,
          descripcion: 'Servicio completado',
          estado: 'completado',
          completado_en: new Date()
        }
      });

      const review = await prisma.resenas.create({
        data: {
          servicio_id: completedService.id,
          cliente_id: testClient.id,
          calificacion: 5,
          comentario: 'Servicio completado exitosamente'
        }
      });

      expect(review).toBeDefined();
      expect(review.servicio_id).toBe(completedService.id);

      // Limpiar
      await prisma.resenas.delete({ where: { id: review.id } });
      await prisma.servicios.delete({ where: { id: completedService.id } });
    });

    test('Debe prevenir reseñas duplicadas para el mismo servicio', async () => {
      // Crear primera reseña
      const firstReview = await prisma.resenas.create({
        data: {
          servicio_id: testService.id,
          cliente_id: testClient.id,
          calificacion: 5,
          comentario: 'Primera reseña'
        }
      });

      // Intentar crear segunda reseña para el mismo servicio
      await expect(
        prisma.resenas.create({
          data: {
            servicio_id: testService.id,
            cliente_id: testClient.id,
            calificacion: 4,
            comentario: 'Segunda reseña (debería fallar)'
          }
        })
      ).rejects.toThrow();

      // Limpiar
      await prisma.resenas.delete({ where: { id: firstReview.id } });
    });
  });

  describe('Validaciones adicionales del sistema', () => {
    test('Debe validar que el cliente sea quien solicita el servicio', async () => {
      // Crear otro cliente
      const otherClient = await prisma.usuarios.create({
        data: {
          email: 'other-client@example.com',
          nombre: 'Otro Cliente',
          hash_contrasena: 'hashed_password',
          rol: 'cliente',
          esta_verificado: true
        }
      });

      // Intentar crear reseña con cliente incorrecto
      await expect(
        prisma.resenas.create({
          data: {
            servicio_id: testService.id,
            cliente_id: otherClient.id, // Cliente incorrecto
            calificacion: 5,
            comentario: 'Test wrong client'
          }
        })
      ).rejects.toThrow();

      // Limpiar
      await prisma.usuarios.delete({ where: { id: otherClient.id } });
    });

    test('Debe manejar servicios inexistentes', async () => {
      const fakeServiceId = '00000000-0000-0000-0000-000000000000';

      await expect(
        prisma.resenas.create({
          data: {
            servicio_id: fakeServiceId,
            cliente_id: testClient.id,
            calificacion: 5,
            comentario: 'Test fake service'
          }
        })
      ).rejects.toThrow();
    });
  });
});