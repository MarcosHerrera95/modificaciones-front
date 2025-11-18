/**
 * Controlador de logros y gamificación
 * REQ-38: Sistema de medallas por logros
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Obtener todos los logros disponibles
 */
exports.getAllAchievements = async (req, res) => {
  try {
    const achievements = await prisma.logros.findMany({
      where: { activo: true },
      orderBy: { puntos: 'asc' }
    });

    res.json({
      success: true,
      data: achievements
    });
  } catch (error) {
    console.error('Error obteniendo logros:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener logros de un usuario específico
 */
exports.getUserAchievements = async (req, res) => {
  try {
    const { userId } = req.params;

    const userAchievements = await prisma.logros_usuario.findMany({
      where: { usuario_id: userId },
      include: {
        logro: true
      },
      orderBy: { obtenido_en: 'desc' }
    });

    res.json({
      success: true,
      data: userAchievements
    });
  } catch (error) {
    console.error('Error obteniendo logros del usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Verificar y otorgar logros automáticamente
 * Se llama después de completar acciones importantes
 */
exports.checkAndAwardAchievements = async (userId, actionType, metadata = {}) => {
  try {
    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        perfil_profesional: true,
        servicios_como_profesional: {
          where: { estado: 'COMPLETADO' }
        },
        servicios_como_cliente: {
          where: { estado: 'COMPLETADO' }
        },
        resenas_escritas: true,
        logros_obtenidos: {
          include: { logro: true }
        }
      }
    });

    if (!user) return;

    // Obtener logros ya obtenidos
    const obtainedAchievementIds = user.logros_obtenidos.map(la => la.logro_id);

    // Obtener logros disponibles que no ha obtenido
    const availableAchievements = await prisma.logros.findMany({
      where: {
        activo: true,
        id: { notIn: obtainedAchievementIds }
      }
    });

    const newAchievements = [];

    for (const achievement of availableAchievements) {
      let shouldAward = false;

      switch (achievement.criterio) {
        case 'primer_servicio_completado':
          shouldAward = user.servicios_como_profesional.length >= 1;
          break;

        case 'cinco_servicios_completados':
          shouldAward = user.servicios_como_profesional.length >= 5;
          break;

        case 'primer_cliente':
          shouldAward = user.servicios_como_cliente.length >= 1;
          break;

        case 'cliente_recurrente':
          shouldAward = user.servicios_como_cliente.length >= 3;
          break;

        case 'primera_resena':
          shouldAward = user.resenas_escritas.length >= 1;
          break;

        case 'resenas_positivas': {
          const positiveReviews = user.resenas_escritas.filter(r => r.calificacion >= 4).length;
          shouldAward = positiveReviews >= 5;
          break;
        }

        case 'perfil_verificado':
          shouldAward = user.esta_verificado;
          break;

        case 'experiencia_5_anos':
          shouldAward = user.perfil_profesional?.anos_experiencia >= 5;
          break;

        case 'calificacion_perfecta':
          shouldAward = user.perfil_profesional?.calificacion_promedio === 5.0;
          break;

        default:
          continue;
      }

      if (shouldAward) {
        // Otorgar el logro
        await prisma.logros_usuario.create({
          data: {
            usuario_id: userId,
            logro_id: achievement.id
          }
        });

        newAchievements.push(achievement);

        console.log(`🏆 Logro otorgado: ${achievement.nombre} para usuario ${userId}`);
      }
    }

    return newAchievements;
  } catch (error) {
    console.error('Error verificando logros:', error);
    return [];
  }
};

/**
 * Crear un nuevo logro (solo administradores)
 */
exports.createAchievement = async (req, res) => {
  try {
    const { nombre, descripcion, icono, categoria, criterio, puntos } = req.body;

    const achievement = await prisma.logros.create({
      data: {
        nombre,
        descripcion,
        icono,
        categoria,
        criterio,
        puntos: puntos || 0
      }
    });

    res.status(201).json({
      success: true,
      data: achievement
    });
  } catch (error) {
    console.error('Error creando logro:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Inicializar logros por defecto
 */
exports.initializeDefaultAchievements = async () => {
  try {
    const defaultAchievements = [
      {
        nombre: 'Primer Servicio',
        descripcion: 'Completa tu primer servicio como profesional',
        icono: '🎯',
        categoria: 'servicios',
        criterio: 'primer_servicio_completado',
        puntos: 10
      },
      {
        nombre: 'Profesional Estrella',
        descripcion: 'Completa 5 servicios exitosamente',
        icono: '⭐',
        categoria: 'servicios',
        criterio: 'cinco_servicios_completados',
        puntos: 50
      },
      {
        nombre: 'Primer Cliente',
        descripcion: 'Contrata tu primer servicio',
        icono: '🤝',
        categoria: 'cliente',
        criterio: 'primer_cliente',
        puntos: 5
      },
      {
        nombre: 'Cliente Recurrente',
        descripcion: 'Contrata 3 servicios o más',
        icono: '🔄',
        categoria: 'cliente',
        criterio: 'cliente_recurrente',
        puntos: 25
      },
      {
        nombre: 'Crítico Constructivo',
        descripcion: 'Deja tu primera reseña',
        icono: '📝',
        categoria: 'resenas',
        criterio: 'primera_resena',
        puntos: 5
      },
      {
        nombre: 'Reseñador Activo',
        descripcion: 'Deja 5 reseñas positivas o más',
        icono: '🌟',
        categoria: 'resenas',
        criterio: 'resenas_positivas',
        puntos: 30
      },
      {
        nombre: 'Verificado',
        descripcion: 'Completa la verificación de identidad',
        icono: '✅',
        categoria: 'verificacion',
        criterio: 'perfil_verificado',
        puntos: 20
      },
      {
        nombre: 'Experiencia Comprobada',
        descripcion: 'Más de 5 años de experiencia',
        icono: '👨‍🔧',
        categoria: 'experiencia',
        criterio: 'experiencia_5_anos',
        puntos: 40
      },
      {
        nombre: 'Excelencia Total',
        descripcion: 'Mantén una calificación perfecta de 5 estrellas',
        icono: '🏆',
        categoria: 'calidad',
        criterio: 'calificacion_perfecta',
        puntos: 100
      }
    ];

    for (const achievement of defaultAchievements) {
      const exists = await prisma.logros.findFirst({
        where: { criterio: achievement.criterio }
      });

      if (!exists) {
        await prisma.logros.create({
          data: achievement
        });
        console.log(`✅ Logro creado: ${achievement.nombre}`);
      }
    }

    console.log('🎯 Logros por defecto inicializados');
  } catch (error) {
    console.error('Error inicializando logros:', error);
  }
};

module.exports = exports;