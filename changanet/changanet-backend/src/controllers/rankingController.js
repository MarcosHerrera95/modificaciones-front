/**
 * Controlador de rankings y reputación
 * REQ-39: Sistema de rankings basado en reputación
 */

const { PrismaClient } = require('@prisma/client');
const {
  getCachedRanking,
  cacheRanking,
  invalidateRankingCache,
  getCachedProfessionalRanking,
  cacheProfessionalRanking,
  invalidateProfessionalRankingCache
} = require('../services/cacheService');
const prisma = new PrismaClient();

/**
 * Calcular porcentaje de puntualidad
 */
const calculateOnTimePercentage = async (professionalId) => {
  try {
    const services = await prisma.servicios.findMany({
      where: {
        profesional_id: professionalId,
        estado: 'COMPLETADO'
      }
    });

    if (services.length === 0) return 0;

    const onTimeServices = services.filter(service => {
      if (!service.fecha_agendada || !service.completado_en) return false;
      const scheduledDate = new Date(service.fecha_agendada);
      const completedDate = new Date(service.completado_en);
      return completedDate <= scheduledDate;
    });

    return Math.round((onTimeServices.length / services.length) * 100);
  } catch (error) {
    console.error('Error calculating on-time percentage:', error);
    return 0;
  }
};

/**
 * Calcular el ranking score según fórmula requerida
 * ranking_score = (average_rating * 0.6) + (completed_jobs * 0.3) + (on_time_percentage * 0.1)
 */
const calculateProfessionalRanking = async (professionalId) => {
  try {
    // Obtener datos del profesional
    const professional = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: professionalId },
      include: {
        usuarios: {
          include: {
            servicios_servicios_profesional_idTousuarios: {
              where: { estado: 'COMPLETADO' }
            }
          }
        }
      }
    });

    if (!professional) return 0;

    const user = professional.usuarios;

    // Obtener métricas según fórmula requerida
    const averageRating = professional.calificacion_promedio || 0;
    const completedJobs = user.servicios_servicios_profesional_idTousuarios.length;
    const onTimePercentage = await calculateOnTimePercentage(professionalId);

    // Calcular ranking score
    const rankingScore = (averageRating * 0.6) + (completedJobs * 0.3) + (onTimePercentage * 0.1);

    return Math.round(rankingScore * 100) / 100; // Redondear a 2 decimales
  } catch (error) {
    console.error('Error calculating professional ranking:', error);
    return 0;
  }
};

/**
 * Obtener ranking de todos los profesionales
 */
exports.getProfessionalsRanking = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Intentar obtener desde caché primero
    const cachedRanking = await getCachedRanking(limit, offset);
    if (cachedRanking) {
      return res.json({
        success: true,
        data: cachedRanking,
        cached: true
      });
    }

    const professionals = await prisma.perfiles_profesionales.findMany({
      include: {
        usuarios: {
          include: {
            servicios_servicios_profesional_idTousuarios: {
              where: { estado: 'COMPLETADO' }
            },
            resenas: true,
            logros_usuario: { include: { logros: true } } // REQ-38: Sistema de medallas
          }
        }
      }
    });

    // Calcular rankings para todos los profesionales
    const rankings = await Promise.all(
      professionals.map(async (prof) => {
        const score = await calculateProfessionalRanking(prof.usuario_id);
        return {
          id: prof.usuario_id,
          nombre: prof.usuarios.nombre,
          especialidad: prof.especialidad,
          zona_cobertura: prof.zona_cobertura,
          calificacion_promedio: prof.calificacion_promedio || 0,
          servicios_completados: prof.usuarios.servicios_servicios_profesional_idTousuarios.length,
          esta_verificado: prof.usuarios.esta_verificado,
          anos_experiencia: prof.anos_experiencia || 0,
          score: score,
          ranking: 0 // Se asignará después del sort
        };
      })
    );

    // Ordenar por score descendente
    rankings.sort((a, b) => b.score - a.score);

    // Asignar posiciones y aplicar paginación
    const paginatedRankings = rankings.slice(offset, offset + limit);
    paginatedRankings.forEach((ranking, index) => {
      ranking.ranking = offset + index + 1;
    });

    // Almacenar en caché
    await cacheRanking(limit, offset, paginatedRankings);

    res.json({
      success: true,
      data: paginatedRankings,
      cached: false
    });
  } catch (error) {
    console.error('Error obteniendo rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener ranking de un profesional específico
 */
exports.getProfessionalRanking = async (req, res) => {
  try {
    const { professionalId } = req.params;

    // Intentar obtener desde caché primero
    const cachedRanking = await getCachedProfessionalRanking(professionalId);
    if (cachedRanking) {
      return res.json({
        success: true,
        data: cachedRanking,
        cached: true
      });
    }

    const score = await calculateProfessionalRanking(professionalId);

    // Obtener posición en el ranking general
    const allRankings = await getAllRankingsData();
    const position = allRankings.findIndex(r => r.id === professionalId) + 1;

    // Obtener datos detallados del profesional
    const professional = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: professionalId },
      include: {
        usuarios: {
          include: {
            servicios_servicios_profesional_idTousuarios: {
              where: { estado: 'COMPLETADO' }
            },
            resenas: true,
            logros_usuario: { include: { logros: true } } // REQ-38: Sistema de medallas
          }
        }
      }
    });

    if (!professional) {
      return res.status(404).json({
        success: false,
        error: 'Profesional no encontrado'
      });
    }

    const user = professional.usuarios;
    const achievementPoints = user.logros_usuario.reduce((total, la) => total + la.logros.puntos, 0); // REQ-38: Sistema de medallas
    const positiveReviews = user.resenas.filter(r => r.calificacion >= 4).length;

    const rankingData = {
      id: professionalId,
      nombre: professional.usuarios.nombre,
      especialidad: professional.especialidad,
      zona_cobertura: professional.zona_cobertura,
      score: score,
      ranking: position,
      detalles: {
        calificacion_promedio: professional.calificacion_promedio || 0,
        servicios_completados: user.servicios_servicios_profesional_idTousuarios.length,
        esta_verificado: user.esta_verificado,
        anos_experiencia: professional.anos_experiencia || 0,
        logros_puntos: achievementPoints,
        resenas_positivas: positiveReviews
      }
    };

    // Almacenar en caché
    await cacheProfessionalRanking(professionalId, rankingData);

    res.json({
      success: true,
      data: rankingData,
      cached: false
    });
  } catch (error) {
    console.error('Error obteniendo ranking del profesional:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Función auxiliar para obtener datos de rankings
 */
const getAllRankingsData = async () => {
  const professionals = await prisma.perfiles_profesionales.findMany({
    include: {
      usuarios: {
        include: {
          servicios_servicios_profesional_idTousuarios: {
            where: { estado: 'COMPLETADO' }
          },
          resenas: true,
          logros_usuario: { include: { logros: true } } // REQ-38: Sistema de medallas
        }
      }
    }
  });

  const rankings = await Promise.all(
    professionals.map(async (prof) => {
      const score = await calculateProfessionalRanking(prof.usuario_id);
      return {
        id: prof.usuario_id,
        score: score
      };
    })
  );

  rankings.sort((a, b) => b.score - a.score);
  return rankings;
};

/**
 * Obtener top profesionales por especialidad
 */
exports.getTopProfessionalsBySpecialty = async (req, res) => {
  try {
    const { specialty } = req.params;

    const professionals = await prisma.perfiles_profesionales.findMany({
      where: {
        especialidad: {
          contains: specialty,
          mode: 'insensitive'
        }
      },
      include: {
        usuarios: {
          include: {
            servicios_servicios_profesional_idTousuarios: {
              where: { estado: 'COMPLETADO' }
            },
            resenas: true,
            logros_usuario: { include: { logros: true } } // REQ-38: Sistema de medallas
          }
        }
      }
    });

    const rankings = await Promise.all(
      professionals.map(async (prof) => {
        const score = await calculateProfessionalRanking(prof.usuario_id);
        return {
          id: prof.usuario_id,
          nombre: prof.usuarios.nombre,
          especialidad: prof.especialidad,
          zona_cobertura: prof.zona_cobertura,
          calificacion_promedio: prof.calificacion_promedio || 0,
          score: score
        };
      })
    );

    rankings.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      data: rankings.slice(0, 10) // Top 10
    });
  } catch (error) {
    console.error('Error obteniendo top profesionales por especialidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

module.exports = exports;