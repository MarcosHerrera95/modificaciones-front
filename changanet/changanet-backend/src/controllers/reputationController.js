/**
 * Controlador de reputación y medallas
 * REQ-36 a REQ-40: Sistema de verificación de identidad y reputación
 */

const { PrismaClient } = require('@prisma/client');
const { logReputationUpdated, logMedalAwarded } = require('../services/auditService');
const { getCachedReputation, cacheReputation, invalidateReputationCache } = require('../services/cacheService');
const prisma = new PrismaClient();

/**
 * Calcular porcentaje de puntualidad basado en servicios completados
 */
const calculateOnTimePercentage = async (userId) => {
  try {
    // Obtener servicios completados con fechas
    const services = await prisma.servicios.findMany({
      where: {
        profesional_id: userId,
        estado: 'COMPLETADO'
      },
      include: {
        disponibilidad: true
      }
    });

    if (services.length === 0) return 0;

    // Contar servicios completados a tiempo (antes o en la fecha agendada)
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
 * Calcular medallas automáticas según criterios del PRD
 */
const calculateAutomaticMedals = async (userId, averageRating, completedJobs, onTimePercentage, rankingScore) => {
  const medals = [];

  try {
    // Medalla "Puntualidad" → on_time_percentage ≥ 95
    if (onTimePercentage >= 95) {
      medals.push('puntualidad');
    }

    // Medalla "Excelencia" → average_rating ≥ 4.7
    if (averageRating >= 4.7) {
      medals.push('excelencia');
    }

    // Medalla "Experto" → completed_jobs ≥ 100
    if (completedJobs >= 100) {
      medals.push('experto');
    }

    // Medalla "Top" → ranking_score en top 10%
    // Obtener el percentil 90 del ranking_score
    const top10Percentile = await prisma.professional_reputation.findMany({
      select: { ranking_score: true },
      orderBy: { ranking_score: 'desc' },
      take: Math.ceil(await prisma.professional_reputation.count() * 0.1) || 1
    });

    const minTopScore = top10Percentile.length > 0 ? top10Percentile[top10Percentile.length - 1].ranking_score : 0;

    if (rankingScore >= minTopScore && rankingScore > 0) {
      medals.push('top');
    }

    return medals;
  } catch (error) {
    console.error('Error calculating automatic medals:', error);
    return medals; // Retornar medallas calculadas hasta el error
  }
};

/**
 * Actualizar reputación de un profesional
 */
const updateProfessionalReputation = async (userId) => {
  try {
    // Obtener datos del profesional
    const professional = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: userId },
      include: {
        usuario: {
          include: {
            servicios_como_profesional: {
              where: { estado: 'COMPLETADO' }
            },
            resenas_escritas: true // Reseñas recibidas
          }
        }
      }
    });

    if (!professional) {
      throw new Error('Profesional no encontrado');
    }

    const user = professional.usuario;

    // Calcular métricas
    const averageRating = professional.calificacion_promedio || 0;
    const completedJobs = user.servicios_como_profesional.length;
    const onTimePercentage = await calculateOnTimePercentage(userId);

    // Calcular ranking score según fórmula requerida
    const rankingScore = (averageRating * 0.6) + (completedJobs * 0.3) + (onTimePercentage * 0.1);

    // Calcular medallas automáticas
    const automaticMedals = await calculateAutomaticMedals(userId, averageRating, completedJobs, onTimePercentage, rankingScore);

    // Obtener medallas existentes (para preservar medallas manuales)
    const existingReputation = await prisma.professional_reputation.findUnique({
      where: { user_id: userId }
    });

    const existingMedals = existingReputation ? JSON.parse(existingReputation.medals || '[]') : [];

    // Combinar medallas automáticas con manuales existentes
    const allMedals = [...new Set([...automaticMedals, ...existingMedals])];

    // Actualizar o crear registro de reputación
    const reputation = await prisma.professional_reputation.upsert({
      where: { user_id: userId },
      update: {
        average_rating: averageRating,
        completed_jobs: completedJobs,
        on_time_percentage: onTimePercentage,
        ranking_score: rankingScore,
        medals: JSON.stringify(allMedals),
        updated_at: new Date()
      },
      create: {
        user_id: userId,
        average_rating: averageRating,
        completed_jobs: completedJobs,
        on_time_percentage: onTimePercentage,
        ranking_score: rankingScore,
        medals: JSON.stringify(automaticMedals)
      }
    });

    // Registrar en historial
    await prisma.reputation_history.create({
      data: {
        user_id: userId,
        event_type: 'reputation_updated',
        value: JSON.stringify({
          average_rating: averageRating,
          completed_jobs: completedJobs,
          on_time_percentage: onTimePercentage,
          ranking_score: rankingScore,
          medals: allMedals
        })
      }
    });

    // Invalidar caché de reputación
    invalidateReputationCache(userId);

    // Registrar en auditoría
    const changes = {
      average_rating: averageRating,
      completed_jobs: completedJobs,
      on_time_percentage: onTimePercentage,
      ranking_score: rankingScore,
      medals: allMedals
    };
    await logReputationUpdated(userId, changes, 'automatic');

    return reputation;
  } catch (error) {
    console.error('Error updating professional reputation:', error);
    throw error;
  }
};

/**
 * Obtener reputación de un usuario
 */
exports.getUserReputation = async (req, res) => {
  try {
    const { userId } = req.params;

    // Intentar obtener desde caché primero
    const cachedReputation = await getCachedReputation(userId);
    if (cachedReputation) {
      return res.json({
        success: true,
        data: cachedReputation,
        cached: true
      });
    }

    const reputation = await prisma.professional_reputation.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            nombre: true,
            email: true
          }
        }
      }
    });

    let reputationData;
    if (!reputation) {
      // Si no existe, calcular y crear
      const newReputation = await updateProfessionalReputation(userId);
      reputationData = {
        ...newReputation,
        user: { nombre: 'Usuario', email: '' } // Placeholder
      };
    } else {
      reputationData = reputation;
    }

    // Almacenar en caché
    await cacheReputation(userId, reputationData);

    res.json({
      success: true,
      data: reputationData,
      cached: false
    });
  } catch (error) {
    console.error('Error getting user reputation:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener ranking general con paginación
 */
exports.getReputationRanking = async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    // Obtener rankings ordenados por score descendente
    const rankings = await prisma.professional_reputation.findMany({
      take: parseInt(limit),
      skip: offset,
      orderBy: { ranking_score: 'desc' },
      include: {
        user: {
          select: {
            nombre: true,
            esta_verificado: true
          }
        }
      }
    });

    // Agregar posición
    const rankingsWithPosition = rankings.map((ranking, index) => ({
      ...ranking,
      position: offset + index + 1
    }));

    res.json({
      success: true,
      data: rankingsWithPosition,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await prisma.professional_reputation.count()
      }
    });
  } catch (error) {
    console.error('Error getting reputation ranking:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Actualizar reputación manualmente (interno/admin)
 */
exports.updateReputation = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId es requerido'
      });
    }

    const reputation = await updateProfessionalReputation(userId);

    res.json({
      success: true,
      data: reputation
    });
  } catch (error) {
    console.error('Error updating reputation:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Asignar medalla a un profesional
 */
exports.assignMedal = async (req, res) => {
  try {
    const { userId, medalType, reason } = req.body;

    if (!userId || !medalType) {
      return res.status(400).json({
        success: false,
        error: 'userId y medalType son requeridos'
      });
    }

    // Obtener reputación actual
    let reputation = await prisma.professional_reputation.findUnique({
      where: { user_id: userId }
    });

    if (!reputation) {
      reputation = await updateProfessionalReputation(userId);
    }

    // Actualizar medallas
    const currentMedals = JSON.parse(reputation.medals || '[]');
    if (!currentMedals.includes(medalType)) {
      currentMedals.push(medalType);
    }

    const updatedReputation = await prisma.professional_reputation.update({
      where: { user_id: userId },
      data: {
        medals: JSON.stringify(currentMedals),
        updated_at: new Date()
      }
    });

    // Registrar en historial
    await prisma.reputation_history.create({
      data: {
        user_id: userId,
        event_type: 'medal_awarded',
        value: JSON.stringify({
          medal_type: medalType,
          reason: reason || 'Asignada manualmente',
          medals: currentMedals
        })
      }
    });

    // Registrar en auditoría
    await logMedalAwarded(userId, medalType, reason, req.user?.id);

    res.json({
      success: true,
      data: updatedReputation
    });
  } catch (error) {
    console.error('Error assigning medal:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener historial de reputación
 */
exports.getReputationHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const history = await prisma.reputation_history.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting reputation history:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};