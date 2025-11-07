// src/controllers/rankingController.js
const { PrismaClient } = require('@prisma/client');
const { getCachedProfessionalRankings, cacheProfessionalRankings } = require('../services/cacheService');
const prisma = new PrismaClient();

exports.getRanking = async (req, res) => {
  try {
    // Intentar obtener rankings del caché
    const cachedRankings = await getCachedProfessionalRankings();
    if (cachedRankings) {
      console.log('🏆 Rankings obtenidos del caché');
      return res.status(200).json(cachedRankings);
    }

    // Calcular ranking basado en calificación promedio y número de reseñas
    const professionals = await prisma.$queryRaw`
      SELECT
        pp.*,
        u.nombre,
        u.email,
        u.estado_verificacion,
        AVG(r.calificacion) as calificacion_promedio,
        COUNT(r.id) as total_resenas,
        CASE
          WHEN COUNT(s.id) >= 10 AND AVG(r.calificacion) >= 4.8 THEN 'oro'
          WHEN COUNT(s.id) >= 5 AND AVG(r.calificacion) >= 4.5 THEN 'plata'
          WHEN COUNT(s.id) >= 2 AND AVG(r.calificacion) >= 4.0 THEN 'bronce'
          ELSE NULL
        END as medalla_calidad,
        CASE
          WHEN COUNT(s.id) >= 10 THEN 'oro'
          WHEN COUNT(s.id) >= 5 THEN 'plata'
          WHEN COUNT(s.id) >= 2 THEN 'bronce'
          ELSE NULL
        END as medalla_experiencia
      FROM perfiles_profesionales pp
      JOIN usuarios u ON pp.usuario_id = u.id
      LEFT JOIN servicios s ON s.profesional_id = pp.usuario_id AND s.estado = 'completado'
      LEFT JOIN resenas r ON r.servicio_id = s.id
      WHERE u.rol = 'profesional'
      GROUP BY pp.id, u.id, u.nombre, u.email, u.estado_verificacion
      HAVING COUNT(r.id) > 0 OR COUNT(s.id) > 0
      ORDER BY
        AVG(r.calificacion) DESC,
        COUNT(r.id) DESC,
        COUNT(s.id) DESC
      LIMIT 50
    `;

    const ranking = professionals.map((prof, index) => ({
      posicion: index + 1,
      profesional: {
        id: prof.usuario_id,
        nombre: prof.nombre,
        email: prof.email,
        estado_verificacion: prof.estado_verificacion,
        especialidad: prof.especialidad,
        zona_cobertura: prof.zona_cobertura,
        tarifa_hora: prof.tarifa_hora,
        url_foto_perfil: prof.url_foto_perfil,
        calificacion_promedio: parseFloat(prof.calificacion_promedio) || 0,
        total_resenas: parseInt(prof.total_resenas) || 0
      },
      calificacion: parseFloat(prof.calificacion_promedio) || 0,
      total_resenas: parseInt(prof.total_resenas) || 0,
      medallas: {
        calidad: prof.medalla_calidad,
        experiencia: prof.medalla_experiencia
      }
    }));

    // Almacenar en caché
    await cacheProfessionalRankings(ranking);
    console.log('💾 Rankings almacenados en caché');

    res.status(200).json(ranking);
  } catch (error) {
    console.error('Error en getRanking:', error);
    res.status(500).json({ error: 'Error al obtener ranking.' });
  }
};

exports.getProfessionalRanking = async (req, res) => {
  const { professionalId } = req.params;

  try {
    const professional = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: professionalId },
      include: {
        usuario: {
          select: { nombre: true, email: true }
        }
      }
    });

    if (!professional) {
      return res.status(404).json({ error: 'Profesional no encontrado.' });
    }

    // Calcular posición en el ranking
    const higherRated = await prisma.perfiles_profesionales.count({
      where: {
        calificacion_promedio: {
          gt: professional.calificacion_promedio || 0
        }
      }
    });

    const ranking = {
      posicion: higherRated + 1,
      profesional,
      calificacion: professional.calificacion_promedio || 0
    };

    res.status(200).json(ranking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener ranking del profesional.' });
  }
};