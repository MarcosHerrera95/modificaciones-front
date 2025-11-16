/**
 * Controlador de panel de administración
 * Implementa sección 15 del PRD: Panel de Administración
 * Gestiona usuarios, estadísticas, disputas y operaciones administrativas
 */

// src/controllers/adminController.js
const { PrismaClient } = require('@prisma/client');
const { createNotification, NOTIFICATION_TYPES } = require('../services/notificationService');
const prisma = new PrismaClient();

/**
 * Lista todos los usuarios con filtros opcionales
 */
exports.getUsers = async (req, res) => {
  try {
    const { rol, bloqueado, page = 1, limit = 10 } = req.query;

    const where = {};
    if (rol) where.rol = rol;
    if (bloqueado !== undefined) where.bloqueado = bloqueado === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await prisma.usuarios.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        esta_verificado: true,
        bloqueado: true,
        creado_en: true,
        _count: {
          select: {
            servicios_como_cliente: true,
            servicios_como_profesional: true,
            resenas_escritas: true
          }
        }
      },
      skip,
      take: parseInt(limit),
      orderBy: { creado_en: 'desc' }
    });

    const total = await prisma.usuarios.count({ where });

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Bloquea o desbloquea un usuario
 */
exports.toggleUserBlock = async (req, res) => {
  try {
    const { userId } = req.params;
    const { bloqueado, razon } = req.body;

    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { id: true, nombre: true, email: true, bloqueado: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar estado de bloqueo
    await prisma.usuarios.update({
      where: { id: userId },
      data: { bloqueado }
    });

    // Enviar notificación al usuario
    const notificationType = bloqueado ? 'cuenta_bloqueada' : 'cuenta_desbloqueada';
    const message = bloqueado
      ? `Tu cuenta ha sido bloqueada. Razón: ${razon || 'Violación de términos de servicio'}`
      : 'Tu cuenta ha sido desbloqueada. Ya puedes acceder nuevamente.';

    await createNotification(userId, notificationType, message);

    res.json({
      success: true,
      message: `Usuario ${bloqueado ? 'bloqueado' : 'desbloqueado'} correctamente`,
      data: { userId, bloqueado }
    });
  } catch (error) {
    console.error('Error cambiando estado de bloqueo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Obtiene estadísticas generales de la plataforma
 */
exports.getPlatformStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalProfessionals,
      totalClients,
      totalServices,
      completedServices,
      totalPayments,
      pendingVerifications
    ] = await Promise.all([
      prisma.usuarios.count(),
      prisma.usuarios.count({ where: { rol: 'profesional' } }),
      prisma.usuarios.count({ where: { rol: 'cliente' } }),
      prisma.servicios.count(),
      prisma.servicios.count({ where: { estado: 'COMPLETADO' } }),
      prisma.pagos.count(),
      prisma.verification_requests.count({ where: { estado: 'pendiente' } })
    ]);

    res.json({
      success: true,
      data: {
        usuarios: {
          total: totalUsers,
          profesionales: totalProfessionals,
          clientes: totalClients
        },
        servicios: {
          total: totalServices,
          completados: completedServices,
          tasa_completacion: totalServices > 0 ? (completedServices / totalServices * 100).toFixed(2) : 0
        },
        pagos: {
          total: totalPayments
        },
        verificaciones: {
          pendientes: pendingVerifications
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Lista disputas entre usuarios (servicios con problemas)
 */
exports.getDisputes = async (req, res) => {
  try {
    // Servicios que podrían tener disputas (cancelados o con reseñas negativas)
    const disputes = await prisma.servicios.findMany({
      where: {
        OR: [
          { estado: 'CANCELADO' },
          {
            AND: [
              { estado: 'COMPLETADO' },
              {
                resena: {
                  calificacion: { lte: 2 } // Reseñas muy negativas
                }
              }
            ]
          }
        ]
      },
      include: {
        cliente: { select: { nombre: true, email: true } },
        profesional: { select: { nombre: true, email: true } },
        resena: true
      },
      orderBy: { creado_en: 'desc' },
      take: 50
    });

    res.json({
      success: true,
      data: disputes
    });
  } catch (error) {
    console.error('Error obteniendo disputas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};