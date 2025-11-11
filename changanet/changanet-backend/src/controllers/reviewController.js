// src/controllers/reviewController.js
const { PrismaClient } = require('@prisma/client');
const { uploadImage, deleteImage } = require('../services/storageService');
const { createNotification, NOTIFICATION_TYPES } = require('../services/notificationService');
const { sendPushNotification } = require('../services/pushNotificationService');
const prisma = new PrismaClient();

exports.createReview = async (req, res) => {
  const { id: userId } = req.user;
  const { servicio_id, calificacion, comentario } = req.body;

  try {
    const service = await prisma.servicios.findUnique({
      where: { id: servicio_id },
      include: { cliente: true, profesional: true }
    });

    if (!service || service.estado !== 'completado' || service.cliente_id !== userId) {
      return res.status(403).json({ error: 'No puedes dejar una reseña para este servicio.' });
    }

    // Check if review already exists - RB-02: Solo 1 reseña por servicio
    const existingReview = await prisma.resenas.findUnique({
      where: { servicio_id: servicio_id }
    });
    if (existingReview) {
      return res.status(400).json({ error: 'Ya se ha dejado una reseña para este servicio. Solo se permite una reseña por servicio.' });
    }

    let url_foto = null;

    // Manejar subida de imagen si hay archivo
    if (req.file) {
      try {
        // Subir imagen a Cloudinary
        const result = await uploadImage(req.file.buffer, { folder: 'changanet/reviews' });
        url_foto = result.secure_url;
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        return res.status(500).json({ error: 'Error al subir la imagen.' });
      }
    }

    const review = await prisma.resenas.create({
      data: {
        servicio_id,
        cliente_id: userId,
        calificacion: parseInt(calificacion),
        comentario,
        url_foto
      }
    });

    // ACTUALIZAR CALIFICACIÓN PROMEDIO DEL PROFESIONAL
    const reviews = await prisma.resenas.findMany({
      where: { servicio: { profesional_id: service.profesional_id } }
    });
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.calificacion, 0) / reviews.length : 0;

    await prisma.perfiles_profesionales.update({
      where: { usuario_id: service.profesional_id },
      data: { calificacion_promedio: avgRating }
    });

    // Enviar notificación push al profesional
    try {
      await sendPushNotification(
        service.profesional_id,
        'Nueva reseña recibida',
        `Has recibido una nueva reseña de ${service.cliente.nombre} (${calificacion}⭐)`,
        {
          type: 'resena_recibida',
          servicio_id: servicio_id,
          calificacion: calificacion,
          cliente_id: userId
        }
      );
    } catch (pushError) {
      console.warn('Error enviando push notification de reseña:', pushError.message);
    }

    // Enviar notificación en base de datos al profesional
    await createNotification(
      service.profesional_id,
      NOTIFICATION_TYPES.RESENA_RECIBIDA,
      `Has recibido una nueva reseña de ${service.cliente.nombre} (${calificacion}⭐)`,
      {
        servicio_id: servicio_id,
        calificacion: calificacion,
        cliente_id: userId
      }
    );

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Error al crear la reseña.' });
  }
};

// Nuevo endpoint para verificar si un usuario puede reseñar un servicio
exports.checkReviewEligibility = async (req, res) => {
  const { id: userId } = req.user;
  const { servicioId } = req.params;

  try {
    const service = await prisma.servicios.findUnique({
      where: { id: servicioId },
      include: { cliente: true, profesional: true }
    });

    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado.' });
    }

    // Verificar si el usuario es el cliente del servicio
    if (service.cliente_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para reseñar este servicio.' });
    }

    // Verificar si el servicio está completado
    if (service.estado !== 'completado') {
      return res.json({ canReview: false, reason: 'El servicio debe estar completado para poder reseñar.' });
    }

    // Verificar si ya existe una reseña para este servicio (RB-02)
    const existingReview = await prisma.resenas.findUnique({
      where: { servicio_id: servicioId }
    });

    if (existingReview) {
      return res.json({ canReview: false, reason: 'Ya se ha dejado una reseña para este servicio.' });
    }

    res.json({ canReview: true });
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    res.status(500).json({ error: 'Error al verificar elegibilidad para reseña.' });
  }
};

exports.getReviewsByProfessional = async (req, res) => {
  const { professionalId } = req.params;

  try {
    const reviews = await prisma.resenas.findMany({
      where: {
        servicio: {
          profesional_id: professionalId
        }
      },
      include: {
        servicio: true,
        cliente: {
          select: {
            nombre: true,
            email: true
          }
        }
      },
      orderBy: {
        creado_en: 'desc'
      }
    });

    res.status(200).json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las reseñas.' });
  }
};