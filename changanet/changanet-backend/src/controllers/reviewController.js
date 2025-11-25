/**
 * Controlador de reseñas y valoraciones - Optimizado
 * Implementa sección 7.5 del PRD: Sistema de Reseñas y Valoraciones
 *
 * REQUERIMIENTOS FUNCIONALES IMPLEMENTADOS:
 * ✅ REQ-21: Calificación con estrellas (1-5) - Validación estricta de rango
 * ✅ REQ-22: Comentarios escritos - Campo obligatorio opcional
 * ✅ REQ-23: Adjuntar fotos del servicio - Subida a Cloudinary con validación
 * ✅ REQ-24: Calcular calificación promedio - Actualización automática + endpoint de estadísticas
 * ✅ REQ-25: Solo usuarios que completaron servicio pueden reseñar - Validación completa
 *
 * OPTIMIZACIONES IMPLEMENTADAS:
 * - Caché de estadísticas y listas de reseñas
 * - Consultas SQL agregadas para estadísticas
 * - Paginación optimizada
 * - Manejo de errores mejorado
 * - Validación de duplicados mejorada
 */

// src/controllers/reviewController.js
const { PrismaClient } = require('@prisma/client');
const { uploadImage, deleteImage } = require('../services/storageService');
const { createNotification, NOTIFICATION_TYPES } = require('../services/notificationService');
const { sendPushNotification } = require('../services/pushNotificationService');
const { 
  getCachedReviewStats, 
  cacheReviewStats, 
  invalidateReviewStatsCache,
  getCachedReviewsList,
  cacheReviewsList,
  invalidateReviewsListCache,
  invalidateAllProfessionalCaches
} = require('../services/cacheService');
const { logger } = require('../middleware/performanceLogger');

const prisma = new PrismaClient();

/**
 * Crea una nueva reseña para un servicio completado
 * REQ-21: Calificación con estrellas
 * REQ-22: Comentario escrito
 * REQ-23: Adjuntar foto
 * REQ-24: Actualiza calificación promedio del profesional
 * REQ-25: Solo para servicios completados por el cliente
 */
exports.createReview = async (req, res) => {
  const startTime = Date.now();
  const { id: userId } = req.user;
  const { servicio_id, calificacion, comentario } = req.body;

  // Validar calificación (REQ-21: debe ser entre 1 y 5)
  const rating = parseInt(calificacion);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'La calificación debe ser un número entre 1 y 5.' });
  }

  try {
    logger.info('Creating review', { userId, servicio_id, rating });

    // Verificar que el servicio existe y está completado, y que el usuario es el cliente
    const service = await prisma.servicios.findFirst({
      where: {
        id: servicio_id,
        cliente_id: userId,
        estado: 'completado'
      },
      include: { cliente: true, profesional: true }
    });

    if (!service) {
      const notFoundService = await prisma.servicios.findUnique({ where: { id: servicio_id } });
      if (!notFoundService) {
        logger.warn('Service not found', { servicio_id });
        return res.status(404).json({ error: 'Servicio no encontrado.' });
      }
      
      if (notFoundService.cliente_id !== userId) {
        logger.warn('User not authorized to review service', { userId, servicio_id });
        return res.status(403).json({ error: 'No tienes permiso para reseñar este servicio.' });
      }
      
      if (notFoundService.estado !== 'completado') {
        logger.warn('Service not completed', { servicio_id, estado: notFoundService.estado });
        return res.status(400).json({ error: 'Solo se pueden reseñar servicios completados.' });
      }
    }

    // Verificar si ya existe una reseña para este servicio
    const existingReview = await prisma.resenas.findUnique({
      where: { servicio_id: servicio_id }
    });
    
    if (existingReview) {
      logger.warn('Review already exists for service', { servicio_id });
      return res.status(400).json({ error: 'Ya se ha dejado una reseña para este servicio. Solo se permite una reseña por servicio.' });
    }

    let url_foto = null;

    // Manejar subida de imagen si hay archivo (REQ-23)
    if (req.file) {
      try {
        // Validar tamaño del archivo (máximo 5MB ya está en multer)
        if (req.file.size > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'La imagen no puede superar los 5MB.' });
        }

        // Subir imagen a Cloudinary
        const result = await uploadImage(req.file.buffer, { folder: 'changanet/reviews' });
        url_foto = result.secure_url;
        logger.info('Image uploaded successfully', { url_foto });
      } catch (uploadError) {
        logger.error('Error uploading image', { error: uploadError.message });
        return res.status(500).json({ error: 'Error al subir la imagen. Inténtalo de nuevo.' });
      }
    }

    // Crear la reseña en una transacción
    const review = await prisma.$transaction(async (tx) => {
      // Crear la reseña
      const newReview = await tx.resenas.create({
        data: {
          servicio_id,
          cliente_id: userId,
          calificacion: rating,
          comentario,
          url_foto
        }
      });

      // Actualizar calificación promedio del profesional usando agregación SQL
      const { _avg: { calificacion: avgRating } } = await tx.resenas.aggregate({
        where: { servicio: { profesional_id: service.profesional_id } },
        _avg: { calificacion: true }
      });

      // Actualizar el perfil del profesional
      await tx.perfiles_profesionales.update({
        where: { usuario_id: service.profesional_id },
        data: { calificacion_promedio: avgRating || 0 }
      });

      return newReview;
    });

    logger.info('Review created successfully', { 
      reviewId: review.id, 
      professionalId: service.profesional_id,
      duration: `${Date.now() - startTime}ms`
    });

    // Invalidar caché relacionado con el profesional
    invalidateAllProfessionalCaches(service.profesional_id);

    // Enviar notificación push al profesional
    try {
      await sendPushNotification(
        service.profesional_id,
        'Nueva reseña recibida',
        `Has recibido una nueva reseña de ${service.cliente.nombre} (${rating}⭐)`,
        {
          type: 'resena_recibida',
          servicio_id: servicio_id,
          calificacion: rating,
          cliente_id: userId
        }
      );
    } catch (pushError) {
      logger.warn('Error sending push notification', { error: pushError.message });
    }

    // Enviar notificación en base de datos al profesional
    try {
      await createNotification(
        service.profesional_id,
        NOTIFICATION_TYPES.RESENA_RECIBIDA,
        `Has recibido una nueva reseña de ${service.cliente.nombre} (${rating}⭐)`,
        {
          servicio_id: servicio_id,
          calificacion: rating,
          cliente_id: userId
        }
      );
    } catch (notificationError) {
      logger.warn('Error creating notification', { error: notificationError.message });
    }

    res.status(201).json(review);
  } catch (error) {
    logger.error('Error creating review', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Error al crear la reseña.' });
  }
};

/**
 * Verificar si un usuario puede reseñar un servicio
 * Optimizado con una sola consulta en lugar de múltiples
 */
exports.checkReviewEligibility = async (req, res) => {
  const startTime = Date.now();
  const { id: userId } = req.user;
  const { servicioId } = req.params;

  try {
    logger.info('Checking review eligibility', { userId, servicioId });

    // Usar una sola consulta para verificar todo
    const service = await prisma.servicios.findFirst({
      where: {
        id: servicioId,
        cliente_id: userId,
        estado: 'completado'
      },
      include: {
        resenas: {
          select: { id: true }
        }
      }
    });

    // Determinar el motivo de no elegibilidad si aplica
    if (!service) {
      const notFoundService = await prisma.servicios.findUnique({ where: { id: servicioId } });
      if (!notFoundService) {
        logger.warn('Service not found for eligibility check', { servicioId });
        return res.status(404).json({ error: 'Servicio no encontrado.' });
      }
      
      if (notFoundService.cliente_id !== userId) {
        logger.warn('User not authorized to review service', { userId, servicioId });
        return res.status(403).json({ error: 'No tienes permiso para reseñar este servicio.' });
      }
      
      logger.info('Service not completed', { servicioId, estado: notFoundService.estado });
      return res.json({ canReview: false, reason: 'El servicio debe estar completado para poder reseñar.' });
    }

    // Verificar si ya existe una reseña para este servicio
    if (service.resenas.length > 0) {
      logger.info('Review already exists for service', { servicioId });
      return res.json({ canReview: false, reason: 'Ya se ha dejado una reseña para este servicio.' });
    }

    logger.info('User eligible to review service', { 
      userId, 
      servicioId, 
      duration: `${Date.now() - startTime}ms` 
    });
    
    res.json({ canReview: true });
  } catch (error) {
    logger.error('Error checking review eligibility', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Error al verificar elegibilidad para reseña.' });
  }
};

/**
 * Obtiene estadísticas de reseñas de un profesional
 * REQ-24: Calcular y mostrar calificación promedio
 * Optimizado con caché y agregación SQL
 */
exports.getReviewStats = async (req, res) => {
  const startTime = Date.now();
  const { professionalId } = req.params;

  try {
    logger.info('Getting review stats', { professionalId });

    // Intentar obtener desde caché primero
    const stats = await getCachedReviewStats(professionalId);
    
    // Si no está en caché, calcular y almacenar
    if (!stats) {
      logger.info('Cache miss for review stats', { professionalId });
      
      // Usar agregación SQL para calcular estadísticas eficientemente
      const statsResult = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_reviews,
          AVG(calificacion) as average_rating,
          SUM(CASE WHEN calificacion = 1 THEN 1 ELSE 0 END) as star_1,
          SUM(CASE WHEN calificacion = 2 THEN 1 ELSE 0 END) as star_2,
          SUM(CASE WHEN calificacion = 3 THEN 1 ELSE 0 END) as star_3,
          SUM(CASE WHEN calificacion = 4 THEN 1 ELSE 0 END) as star_4,
          SUM(CASE WHEN calificacion = 5 THEN 1 ELSE 0 END) as star_5,
          SUM(CASE WHEN calificacion >= 4 THEN 1 ELSE 0 END) as positive_reviews,
          MAX(creado_en) as last_review_date
        FROM resenas 
        WHERE servicio_id IN (
          SELECT id FROM servicios WHERE profesional_id = ${professionalId}
        )
      `;

      const statsData = statsResult[0];
      const averageRating = statsData.average_rating || 0;
      const ratingDistribution = {
        1: parseInt(statsData.star_1) || 0,
        2: parseInt(statsData.star_2) || 0,
        3: parseInt(statsData.star_3) || 0,
        4: parseInt(statsData.star_4) || 0,
        5: parseInt(statsData.star_5) || 0
      };
      
      const positivePercentage = statsData.total_reviews > 0 
        ? (statsData.positive_reviews / statsData.total_reviews) * 100 
        : 0;

      const stats = {
        professionalId,
        totalReviews: parseInt(statsData.total_reviews) || 0,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        positivePercentage: Math.round(positivePercentage),
        lastReviewDate: statsData.last_review_date
      };
      
      // Almacenar en caché
      cacheReviewStats(professionalId, stats);
      logger.info('Review stats cached', { professionalId });
    } else {
      logger.info('Cache hit for review stats', { professionalId });
    }

    res.status(200).json(stats);
  } catch (error) {
    logger.error('Error getting review stats', { professionalId, error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Error al obtener estadísticas de reseñas.' });
  } finally {
    logger.info('Review stats request completed', { 
      professionalId, 
      duration: `${Date.now() - startTime}ms` 
    });
  }
};

/**
 * Obtiene las reseñas de un profesional con paginación
 * Optimizado con caché y paginación
 */
exports.getReviewsByProfessional = async (req, res) => {
  const startTime = Date.now();
  const { professionalId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    logger.info('Getting reviews by professional', { professionalId, page, limit });
    
    // Validar parámetros de paginación
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10)); // Máximo 50 items por página
    
    // Intentar obtener desde caché primero
    let reviewsData = await getCachedReviewsList(professionalId, pageNum, limitNum);
    
    if (!reviewsData) {
      logger.info('Cache miss for reviews list', { professionalId, page: pageNum, limit: limitNum });
      
      const offset = (pageNum - 1) * limitNum;
      
      // Obtener reseñas con paginación
      const reviews = await prisma.resenas.findMany({
        where: {
          servicio: {
            profesional_id: professionalId
          }
        },
        include: {
          servicio: {
            select: {
              id: true,
              descripcion: true,
              completado_en: true
            }
          },
          cliente: {
            select: {
              nombre: true,
              email: true,
              url_foto_perfil: true
            }
          }
        },
        orderBy: {
          creado_en: 'desc'
        },
        skip: offset,
        take: limitNum
      });
      
      // Obtener el total para la paginación
      const totalReviews = await prisma.resenas.count({
        where: {
          servicio: {
            profesional_id: professionalId
          }
        }
      });
      
      const totalPages = Math.ceil(totalReviews / limitNum);
      
      reviewsData = {
        reviews,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalReviews,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        }
      };
      
      // Almacenar en caché
      cacheReviewsList(professionalId, pageNum, limitNum, reviewsData);
      logger.info('Reviews list cached', { professionalId, page: pageNum, limit: limitNum });
    } else {
      logger.info('Cache hit for reviews list', { professionalId, page: pageNum, limit: limitNum });
    }

    res.status(200).json(reviewsData);
  } catch (error) {
    logger.error('Error getting reviews', { professionalId, error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Error al obtener las reseñas.' });
  } finally {
    logger.info('Reviews request completed', { 
      professionalId, 
      duration: `${Date.now() - startTime}ms` 
    });
  }
};