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

    const professionals = await prisma.perfiles_profesionales.findMany({
      include: {
        usuario: {
          select: { nombre: true, email: true }
        }
      },
      orderBy: {
        calificacion_promedio: 'desc'
      },
      take: 50
    });

    const ranking = professionals.map((prof, index) => ({
      posicion: index + 1,
      profesional: prof,
      calificacion: prof.calificacion_promedio || 0
    }));

    // Almacenar en caché
    await cacheProfessionalRankings(ranking);
    console.log('💾 Rankings almacenados en caché');

    res.status(200).json(ranking);
  } catch (error) {
    console.error(error);
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