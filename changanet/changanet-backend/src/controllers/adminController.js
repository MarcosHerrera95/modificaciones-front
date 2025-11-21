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
        creado_en: 'asc'
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
    const { page = 1, limit = 20, role, verified, search, blocked } = req.query;

    const where = {};
    if (role) where.rol = role;
    if (verified !== undefined) where.esta_verificado = verified === 'true';
    if (blocked !== undefined) where.bloqueado = blocked === 'true';
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
        ultima_conexion: true,
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

/**
 * Bloquear o desbloquear un usuario
 */
exports.toggleUserBlock = async (req, res) => {
  try {
    const { userId } = req.params;
    const { blocked, reason } = req.body;
    const adminId = req.user.id;

    // Verificar que no se está bloqueando a sí mismo
    if (userId === adminId) {
      return res.status(400).json({
        success: false,
        error: 'No puedes bloquear tu propia cuenta'
      });
    }

    // Obtener usuario actual
    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { nombre: true, email: true, bloqueado: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Actualizar estado de bloqueo
    await prisma.usuarios.update({
      where: { id: userId },
      data: {
        bloqueado: blocked,
        bloqueado_en: blocked ? new Date() : null,
        bloqueado_por: blocked ? adminId : null,
        motivo_bloqueo: blocked ? reason : null
      }
    });

    // Notificar al usuario
    const { createNotification } = require('../services/notificationService');
    const action = blocked ? 'bloqueada' : 'desbloqueada';
    await createNotification(
      userId,
      blocked ? 'cuenta_bloqueada' : 'cuenta_desbloqueada',
      `Tu cuenta ha sido ${action}${blocked ? `. Motivo: ${reason}` : ''}`,
      { adminId, reason, blocked }
    );

    logger.info('User block status changed', {
      service: 'admin',
      adminId,
      userId,
      blocked,
      reason
    });

    res.json({
      success: true,
      message: `Usuario ${blocked ? 'bloqueado' : 'desbloqueado'} exitosamente`
    });

  } catch (error) {
    logger.error('Error cambiando estado de bloqueo del usuario', {
      service: 'admin',
      error,
      userId: req.params.userId,
      adminId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Cambiar rol de un usuario
 */
exports.changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;
    const adminId = req.user.id;

    // Validar rol
    const validRoles = ['cliente', 'profesional', 'admin'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({
        success: false,
        error: 'Rol inválido'
      });
    }

    // Obtener usuario actual
    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { nombre: true, email: true, rol: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Actualizar rol
    await prisma.usuarios.update({
      where: { id: userId },
      data: {
        rol: newRole,
        rol_cambiado_en: new Date(),
        rol_cambiado_por: adminId
      }
    });

    // Notificar al usuario
    const { createNotification } = require('../services/notificationService');
    await createNotification(
      userId,
      'rol_cambiado',
      `Tu rol ha sido cambiado a: ${newRole}`,
      { adminId, oldRole: user.rol, newRole }
    );

    logger.info('User role changed', {
      service: 'admin',
      adminId,
      userId,
      oldRole: user.rol,
      newRole
    });

    res.json({
      success: true,
      message: `Rol del usuario cambiado a ${newRole}`
    });

  } catch (error) {
    logger.error('Error cambiando rol del usuario', {
      service: 'admin',
      error,
      userId: req.params.userId,
      adminId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener detalles completos de un usuario
 */
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        perfil_profesional: true,
        verification_requests: {
          orderBy: { fecha_solicitud: 'desc' },
          take: 5
        },
        servicios_como_cliente: {
          take: 10,
          orderBy: { creado_en: 'desc' },
          include: {
            profesional: { select: { nombre: true } }
          }
        },
        servicios_como_profesional: {
          take: 10,
          orderBy: { creado_en: 'desc' },
          include: {
            cliente: { select: { nombre: true } }
          }
        },
        _count: {
          select: {
            servicios_como_cliente: true,
            servicios_como_profesional: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    logger.error('Error obteniendo detalles del usuario', {
      service: 'admin',
      error,
      userId: req.params.userId,
      adminId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener lista de servicios con filtros para administración
 */
exports.getServicesList = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, urgent, search } = req.query;

    const where = {};
    if (status) where.estado = status;
    if (urgent !== undefined) where.es_urgente = urgent === 'true';
    if (search) {
      where.OR = [
        { descripcion: { contains: search, mode: 'insensitive' } },
        { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
        { profesional: { nombre: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const services = await prisma.servicios.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, email: true } },
        profesional: { select: { id: true, nombre: true, email: true } },
        pago: { select: { id: true, monto_total: true, estado: true } }
      },
      orderBy: [
        { es_urgente: 'desc' },
        { creado_en: 'desc' }
      ],
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.servicios.count({ where });

    res.json({
      success: true,
      data: services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error obteniendo lista de servicios', {
      service: 'admin',
      error,
      adminId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Actualizar estado de un servicio (para administradores)
 */
exports.updateServiceStatus = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status, notes } = req.body;
    const adminId = req.user.id;

    // Validar estado
    const validStatuses = ['PENDIENTE', 'AGENDADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido'
      });
    }

    // Obtener servicio
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: { cliente: true, profesional: true }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Servicio no encontrado'
      });
    }

    const oldStatus = service.estado;

    // Actualizar servicio
    await prisma.servicios.update({
      where: { id: serviceId },
      data: {
        estado: status,
        completado_en: status === 'COMPLETADO' ? new Date() : undefined,
        cancelado_en: status === 'CANCELADO' ? new Date() : undefined
      }
    });

    // Notificar a ambas partes
    const { createNotification } = require('../services/notificationService');

    const statusMessages = {
      'COMPLETADO': 'ha sido marcado como completado',
      'CANCELADO': 'ha sido cancelado',
      'EN_PROCESO': 'está en proceso'
    };

    if (statusMessages[status]) {
      await createNotification(
        service.cliente_id,
        'servicio_actualizado_admin',
        `El servicio "${service.descripcion}" ${statusMessages[status]} por un administrador.`,
        { serviceId, oldStatus, newStatus: status, adminId, notes }
      );

      await createNotification(
        service.profesional_id,
        'servicio_actualizado_admin',
        `El servicio "${service.descripcion}" ${statusMessages[status]} por un administrador.`,
        { serviceId, oldStatus, newStatus: status, adminId, notes }
      );
    }

    logger.info('Service status updated by admin', {
      service: 'admin',
      adminId,
      serviceId,
      oldStatus,
      newStatus: status,
      notes
    });

    res.json({
      success: true,
      message: `Estado del servicio actualizado a ${status}`
    });

  } catch (error) {
    logger.error('Error actualizando estado del servicio', {
      service: 'admin',
      error,
      serviceId: req.params.serviceId,
      adminId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

module.exports = exports;