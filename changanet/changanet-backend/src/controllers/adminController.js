/**
 * Controlador de administración
 * REQ-40: Panel admin para gestión de verificaciones
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../services/logger');

/**
 * Obtener solicitudes de verificación pendientes
 */
exports.getPendingVerifications = async (req, res) => {
  try {
    const pendingRequests = await prisma.verification_requests.findMany({
      where: {
        estado: 'pendiente'
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            telefono: true,
            rol: true
          }
        }
      },
      orderBy: {
        fecha_solicitud: 'asc'
      }
    });

    res.json({
      success: true,
      data: pendingRequests
    });
  } catch (error) {
    logger.error('Error obteniendo verificaciones pendientes', {
      service: 'admin',
      error,
      userId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Aprobar una solicitud de verificación
 */
exports.approveVerification = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user.id;

    // Obtener la solicitud
    const request = await prisma.verification_requests.findUnique({
      where: { id: requestId },
      include: { usuario: true }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud de verificación no encontrada'
      });
    }

    if (request.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        error: 'Esta solicitud ya ha sido procesada'
      });
    }

    // Actualizar solicitud
    await prisma.verification_requests.update({
      where: { id: requestId },
      data: {
        estado: 'aprobado',
        revisado_por: adminId,
        fecha_revision: new Date()
      }
    });

    // Actualizar usuario como verificado
    await prisma.usuarios.update({
      where: { id: request.usuario_id },
      data: {
        esta_verificado: true,
        verificado_en: new Date()
      }
    });

    // Otorgar logro de verificación
    const { checkAndAwardAchievements } = require('./achievementsController');
    await checkAndAwardAchievements(request.usuario_id, 'verification_approved');

    // Notificar al usuario
    const { createNotification } = require('../services/notificationService');
    await createNotification(
      request.usuario_id,
      'verificacion_aprobada',
      '¡Felicitaciones! Tu identidad ha sido verificada exitosamente.',
      { verification_request_id: requestId }
    );

    logger.info('Verification approved', {
      service: 'admin',
      adminId,
      userId: request.usuario_id,
      requestId
    });

    res.json({
      success: true,
      message: 'Verificación aprobada exitosamente'
    });

  } catch (error) {
    logger.error('Error aprobando verificación', {
      service: 'admin',
      error,
      requestId: req.params.requestId,
      userId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Rechazar una solicitud de verificación
 */
exports.rejectVerification = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { motivo_rechazo } = req.body;
    const adminId = req.user.id;

    // Obtener la solicitud
    const request = await prisma.verification_requests.findUnique({
      where: { id: requestId },
      include: { usuario: true }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud de verificación no encontrada'
      });
    }

    if (request.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        error: 'Esta solicitud ya ha sido procesada'
      });
    }

    // Actualizar solicitud
    await prisma.verification_requests.update({
      where: { id: requestId },
      data: {
        estado: 'rechazado',
        motivo_rechazo: motivo_rechazo || 'Documentación insuficiente',
        revisado_por: adminId,
        fecha_revision: new Date()
      }
    });

    // Notificar al usuario
    const { createNotification } = require('../services/notificationService');
    await createNotification(
      request.usuario_id,
      'verificacion_rechazada',
      `Tu solicitud de verificación ha sido rechazada. Motivo: ${motivo_rechazo || 'Documentación insuficiente'}`,
      { verification_request_id: requestId }
    );

    logger.info('Verification rejected', {
      service: 'admin',
      adminId,
      userId: request.usuario_id,
      requestId,
      reason: motivo_rechazo
    });

    res.json({
      success: true,
      message: 'Verificación rechazada'
    });

  } catch (error) {
    logger.error('Error rechazando verificación', {
      service: 'admin',
      error,
      requestId: req.params.requestId,
      userId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener estadísticas del sistema
 */
exports.getSystemStats = async (req, res) => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      pendingVerifications,
      totalServices,
      completedServices,
      totalPayments
    ] = await Promise.all([
      prisma.usuarios.count(),
      prisma.usuarios.count({ where: { esta_verificado: true } }),
      prisma.verification_requests.count({ where: { estado: 'pendiente' } }),
      prisma.servicios.count(),
      prisma.servicios.count({ where: { estado: 'COMPLETADO' } }),
      prisma.pagos.count({ where: { estado: 'liberado' } })
    ]);

    // Calcular ingresos totales
    const paymentsResult = await prisma.pagos.aggregate({
      where: { estado: 'liberado' },
      _sum: { comision_plataforma: true }
    });

    const totalRevenue = paymentsResult._sum.comision_plataforma || 0;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          pendingVerifications: pendingVerifications
        },
        services: {
          total: totalServices,
          completed: completedServices,
          completionRate: totalServices > 0 ? (completedServices / totalServices * 100).toFixed(1) : 0
        },
        payments: {
          totalProcessed: totalPayments,
          totalRevenue: totalRevenue
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas del sistema', {
      service: 'admin',
      error,
      userId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Liberar fondos manualmente (para administradores)
 */
exports.manualReleaseFunds = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const adminId = req.user.id;

    const { releaseFunds } = require('../services/mercadoPagoService');
    await releaseFunds(paymentId);

    logger.info('Manual funds release', {
      service: 'admin',
      adminId,
      paymentId
    });

    res.json({
      success: true,
      message: 'Fondos liberados manualmente'
    });

  } catch (error) {
    logger.error('Error liberando fondos manualmente', {
      service: 'admin',
      error,
      paymentId: req.params.paymentId,
      userId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
};

/**
 * Obtener lista de usuarios con filtros
 */
exports.getUsersList = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, verified, search } = req.query;

    const where = {};
    if (role) where.rol = role;
    if (verified !== undefined) where.esta_verificado = verified === 'true';
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

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
            servicios_como_profesional: true
          }
        }
      },
      orderBy: { creado_en: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.usuarios.count({ where });

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error obteniendo lista de usuarios', {
      service: 'admin',
      error,
      userId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

module.exports = exports;