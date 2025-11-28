/**
 * Controlador de administración
 * REQ-40: Panel admin para gestión de verificaciones
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../services/logger');
const auditService = require('../services/auditService');
const { hasPermission } = require('../middleware/rbac');

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
    const adminId = req.adminUser.id;

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

    // Registrar en auditoría
    await auditService.logAction({
      adminId,
      action: auditService.AUDIT_ACTIONS.VERIFICATION_APPROVED,
      targetType: auditService.AUDIT_TARGET_TYPES.VERIFICATION,
      targetId: requestId,
      details: {
        userId: request.usuario_id,
        userEmail: request.usuario.email
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

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
    const adminId = req.adminUser.id;

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
      totalPayments,
      activeDisputes,
      pendingModerationReports,
      totalAdmins
    ] = await Promise.all([
      prisma.usuarios.count(),
      prisma.usuarios.count({ where: { esta_verificado: true } }),
      prisma.verification_requests.count({ where: { estado: 'pendiente' } }),
      prisma.servicios.count(),
      prisma.servicios.count({ where: { estado: 'COMPLETADO' } }),
      prisma.pagos.count({ where: { estado: 'liberado' } }),
      prisma.disputas_pagos.count({ where: { estado: 'abierta' } }),
      prisma.moderation_reports.count({ where: { status: 'open' } }),
      prisma.admin_profile.count({ where: { is_active: true } })
    ]);

    // Calcular ingresos totales
    const paymentsResult = await prisma.pagos.aggregate({
      where: { estado: 'liberado' },
      _sum: { comision_plataforma: true }
    });

    const totalRevenue = paymentsResult._sum.comision_plataforma || 0;

    // Calificación promedio
    const ratingResult = await prisma.resenas.aggregate({
      _avg: { calificacion: true },
      _count: { calificacion: true }
    });

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
        },
        moderation: {
          activeDisputes,
          pendingReports: pendingModerationReports
        },
        reviews: {
          averageRating: ratingResult._avg.calificacion ? ratingResult._avg.calificacion.toFixed(1) : 0,
          totalReviews: ratingResult._count.calificacion
        },
        admins: {
          total: totalAdmins
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
    const adminId = req.adminUser.id;

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
    const adminId = req.adminUser.id;

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
    const adminId = req.adminUser.id;

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
 * Actualizar estado de un usuario (PATCH /api/admin/users/:id/status)
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    const adminId = req.adminUser.id;

    // Validar estado
    const validStatuses = ['active', 'inactive', 'suspended', 'banned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido. Estados válidos: active, inactive, suspended, banned'
      });
    }

    // Obtener usuario actual
    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { nombre: true, email: true, bloqueado: true, rol: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Determinar si debe estar bloqueado basado en el estado
    const shouldBeBlocked = ['suspended', 'banned'].includes(status);

    // Actualizar estado del usuario
    await prisma.usuarios.update({
      where: { id: userId },
      data: {
        bloqueado: shouldBeBlocked,
        bloqueado_en: shouldBeBlocked ? new Date() : null,
        bloqueado_por: shouldBeBlocked ? adminId : null,
        motivo_bloqueo: shouldBeBlocked ? reason : null,
        actualizado_en: new Date()
      }
    });

    // Registrar en auditoría
    await auditService.logAction({
      adminId,
      action: 'user_status_updated',
      targetType: 'user',
      targetId: userId,
      details: {
        newStatus: status,
        reason,
        wasBlocked: user.bloqueado,
        nowBlocked: shouldBeBlocked
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Notificar al usuario (solo si no está baneado)
    if (status !== 'banned') {
      const { createNotification } = require('../services/notificationService');
      const statusMessages = {
        active: 'Tu cuenta ha sido activada',
        inactive: 'Tu cuenta ha sido desactivada temporalmente',
        suspended: 'Tu cuenta ha sido suspendida',
        banned: 'Tu cuenta ha sido bloqueada permanentemente'
      };

      await createNotification(
        userId,
        'cuenta_estado_cambiado',
        `${statusMessages[status]}${reason ? `. Motivo: ${reason}` : ''}`,
        { adminId, newStatus: status, reason }
      );
    }

    logger.info('User status updated', {
      service: 'admin',
      adminId,
      userId,
      oldStatus: user.bloqueado ? 'blocked' : 'active',
      newStatus: status,
      reason
    });

    // Emitir notificación WebSocket a administradores
    try {
      const { unifiedWebSocketService } = require('../services/unifiedWebSocketService');
      if (unifiedWebSocketService) {
        unifiedWebSocketService.emitAdminNotification('user_status_changed', {
          userId,
          adminId,
          oldStatus: user.bloqueado ? 'blocked' : 'active',
          newStatus: status,
          reason,
          userEmail: user.email,
          userName: user.nombre
        });
      }
    } catch (wsError) {
      console.warn('Could not emit WebSocket notification:', wsError.message);
    }

    res.json({
      success: true,
      message: `Estado del usuario actualizado a ${status}`,
      data: {
        userId,
        newStatus: status,
        blocked: shouldBeBlocked
      }
    });

  } catch (error) {
    logger.error('Error actualizando estado del usuario', {
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
    const adminId = req.adminUser.id;

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

/**
 * Obtener reportes de moderación
 */
exports.getModerationReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, targetType } = req.query;

    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (targetType) where.target_type = targetType;

    const reports = await prisma.moderation_reports.findMany({
      where,
      include: {
        reporter: {
          select: { id: true, nombre: true, email: true }
        },
        assigned_admin: {
          select: { id: true, nombre: true, email: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' }
      ],
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.moderation_reports.count({ where });

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error obteniendo reportes de moderación', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Asignar reporte de moderación a un admin
 */
exports.assignModerationReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { adminId } = req.body;
    const currentAdminId = req.adminUser.id;

    const report = await prisma.moderation_reports.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Reporte no encontrado'
      });
    }

    await prisma.moderation_reports.update({
      where: { id: reportId },
      data: {
        assigned_to: adminId,
        assigned_at: new Date(),
        status: 'in_progress'
      }
    });

    // Auditoría
    await auditService.logAction({
      adminId: currentAdminId,
      action: 'moderation_report_assigned',
      targetType: 'moderation_report',
      targetId: reportId,
      details: { assignedTo: adminId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Reporte asignado exitosamente'
    });
  } catch (error) {
    logger.error('Error asignando reporte de moderación', { error, reportId: req.params.reportId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Resolver reporte de moderación
 */
exports.resolveModerationReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { resolution, notes } = req.body;
    const adminId = req.adminUser.id;

    const report = await prisma.moderation_reports.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Reporte no encontrado'
      });
    }

    await prisma.moderation_reports.update({
      where: { id: reportId },
      data: {
        status: 'resolved',
        resolution,
        resolution_notes: notes,
        resolved_at: new Date()
      }
    });

    // Auditoría
    await auditService.logAction({
      adminId,
      action: 'moderation_report_resolved',
      targetType: 'moderation_report',
      targetId: reportId,
      details: { resolution, notes },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Reporte resuelto exitosamente'
    });
  } catch (error) {
    logger.error('Error resolviendo reporte de moderación', { error, reportId: req.params.reportId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Eliminar reseña (moderación)
 */
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const adminId = req.adminUser.id;

    const review = await prisma.resenas.findUnique({
      where: { id: reviewId },
      include: { cliente: true, profesional: true }
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Reseña no encontrada'
      });
    }

    await prisma.resenas.delete({
      where: { id: reviewId }
    });

    // Auditoría
    await auditService.logAction({
      adminId,
      action: auditService.AUDIT_ACTIONS.REVIEW_DELETED,
      targetType: auditService.AUDIT_TARGET_TYPES.REVIEW,
      targetId: reviewId,
      details: {
        clientId: review.cliente_id,
        professionalId: review.profesional_id,
        rating: review.calificacion
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Reseña eliminada exitosamente'
    });
  } catch (error) {
    logger.error('Error eliminando reseña', { error, reviewId: req.params.reviewId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener disputas de pago
 */
exports.getDisputes = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, userId } = req.query;

    const where = {};
    if (status) where.estado = status;
    if (userId) where.usuario_id = userId;

    const disputes = await prisma.disputas_pagos.findMany({
      where,
      include: {
        usuarios: {
          select: { id: true, nombre: true, email: true }
        },
        pago: {
          select: { id: true, monto_total: true, estado: true }
        }
      },
      orderBy: { fecha_apertura: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.disputas_pagos.count({ where });

    res.json({
      success: true,
      data: disputes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error obteniendo disputas', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener detalles de una disputa
 */
exports.getDisputeDetails = async (req, res) => {
  try {
    const { disputeId } = req.params;

    const dispute = await prisma.disputas_pagos.findUnique({
      where: { id: disputeId },
      include: {
        usuarios: {
          select: { id: true, nombre: true, email: true, telefono: true }
        },
        pago: {
          include: {
            cliente: { select: { id: true, nombre: true, email: true } },
            profesional: { select: { id: true, nombre: true, email: true } },
            servicio: { select: { id: true, descripcion: true } }
          }
        }
      }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Disputa no encontrada'
      });
    }

    res.json({
      success: true,
      data: dispute
    });
  } catch (error) {
    logger.error('Error obteniendo detalles de disputa', { error, disputeId: req.params.disputeId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Resolver disputa
 */
exports.resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, notes } = req.body;
    const adminId = req.adminUser.id;

    const dispute = await prisma.disputas_pagos.findUnique({
      where: { id: disputeId }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Disputa no encontrada'
      });
    }

    await prisma.disputas_pagos.update({
      where: { id: disputeId },
      data: {
        estado: 'resuelta',
        resolucion: resolution,
        notas_admin: notes,
        fecha_resolucion: new Date()
      }
    });

    // Auditoría
    await auditService.logAction({
      adminId,
      action: auditService.AUDIT_ACTIONS.DISPUTE_RESOLVED,
      targetType: auditService.AUDIT_TARGET_TYPES.DISPUTE,
      targetId: disputeId,
      details: { resolution, notes },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Disputa resuelta exitosamente'
    });
  } catch (error) {
    logger.error('Error resolviendo disputa', { error, disputeId: req.params.disputeId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Procesar reembolso
 */
exports.processRefund = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.adminUser.id;

    const dispute = await prisma.disputas_pagos.findUnique({
      where: { id: disputeId },
      include: { pago: true }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Disputa no encontrada'
      });
    }

    // Aquí iría la lógica de reembolso con MercadoPago
    // Por ahora solo registramos

    await prisma.disputas_pagos.update({
      where: { id: disputeId },
      data: {
        reembolso_monto: amount,
        resolucion: `Reembolso procesado: $${amount}`,
        notas_admin: reason,
        fecha_resolucion: new Date()
      }
    });

    // Auditoría
    await auditService.logAction({
      adminId,
      action: auditService.AUDIT_ACTIONS.PAYMENT_REFUNDED,
      targetType: auditService.AUDIT_TARGET_TYPES.PAYMENT,
      targetId: dispute.pago_id,
      details: { amount, reason, disputeId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Reembolso procesado exitosamente'
    });
  } catch (error) {
    logger.error('Error procesando reembolso', { error, disputeId: req.params.disputeId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener configuración del sistema
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await prisma.settings.findMany({
      orderBy: { key: 'asc' }
    });

    // Convertir a objeto
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = {
        value: JSON.parse(setting.value),
        description: setting.description,
        category: setting.category,
        updatedAt: setting.updated_at,
        updatedBy: setting.updated_by
      };
    });

    res.json({
      success: true,
      data: settingsObj
    });
  } catch (error) {
    logger.error('Error obteniendo configuración', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Actualizar configuración del sistema
 */
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    const adminId = req.adminUser.id;

    for (const [key, value] of Object.entries(updates)) {
      await prisma.settings.upsert({
        where: { key },
        update: {
          value: JSON.stringify(value),
          updated_by: adminId,
          updated_at: new Date()
        },
        create: {
          key,
          value: JSON.stringify(value),
          updated_by: adminId
        }
      });

      // Auditoría
      await auditService.logAction({
        adminId,
        action: auditService.AUDIT_ACTIONS.SETTING_CHANGED,
        targetType: auditService.AUDIT_TARGET_TYPES.SETTING,
        targetId: key,
        details: { newValue: value },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente'
    });
  } catch (error) {
    logger.error('Error actualizando configuración', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener logs de auditoría
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      adminId,
      action,
      targetType,
      startDate,
      endDate
    } = req.query;

    const result = await auditService.getAuditLogs({
      adminId,
      action,
      targetType,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error obteniendo logs de auditoría', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener métricas detalladas
 */
exports.getDetailedMetrics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calcular fechas
    const endDate = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(endDate.getDate() - 7);
    else if (period === '30d') startDate.setDate(endDate.getDate() - 30);
    else if (period === '90d') startDate.setDate(endDate.getDate() - 90);

    const [
      userStats,
      serviceStats,
      paymentStats,
      reviewStats
    ] = await Promise.all([
      // Estadísticas de usuarios
      prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as new_users,
          SUM(CASE WHEN esta_verificado THEN 1 ELSE 0 END) as verified_users
        FROM usuarios
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,

      // Estadísticas de servicios
      prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total_services,
          SUM(CASE WHEN estado = 'COMPLETADO' THEN 1 ELSE 0 END) as completed_services
        FROM servicios
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,

      // Estadísticas de pagos
      prisma.$queryRaw`
        SELECT
          DATE(fecha_pago) as date,
          COUNT(*) as total_payments,
          SUM(monto_total) as total_amount,
          SUM(comision_plataforma) as total_commission
        FROM pagos
        WHERE fecha_pago >= ${startDate} AND fecha_pago <= ${endDate} AND estado = 'liberado'
        GROUP BY DATE(fecha_pago)
        ORDER BY date
      `,

      // Estadísticas de reseñas
      prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total_reviews,
          AVG(calificacion) as avg_rating
        FROM resenas
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `
    ]);

    res.json({
      success: true,
      data: {
        period,
        startDate,
        endDate,
        users: userStats,
        services: serviceStats,
        payments: paymentStats,
        reviews: reviewStats
      }
    });
  } catch (error) {
    logger.error('Error obteniendo métricas detalladas', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Exportar métricas
 */
exports.exportMetrics = async (req, res) => {
  try {
    const { format = 'json', type = 'summary' } = req.query;

    // Obtener datos según tipo
    let data;
    if (type === 'users') {
      data = await prisma.usuarios.findMany({
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true,
          esta_verificado: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      });
    } else if (type === 'services') {
      data = await prisma.servicios.findMany({
        include: {
          cliente: { select: { nombre: true, email: true } },
          profesional: { select: { nombre: true, email: true } },
          pago: { select: { monto_total: true, estado: true } }
        },
        orderBy: { created_at: 'desc' }
      });
    }

    if (format === 'csv') {
      // Convertir a CSV (simplificado)
      const csv = data.map(row => Object.values(row).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
      res.send(csv);
    } else {
      res.json({
        success: true,
        data,
        exportedAt: new Date(),
        type
      });
    }
  } catch (error) {
    logger.error('Error exportando métricas', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener lista de administradores
 */
exports.getAdmins = async (req, res) => {
  try {
    const admins = await prisma.admin_profile.findMany({
      include: {
        user: {
          select: { id: true, nombre: true, email: true, created_at: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: admins
    });
  } catch (error) {
    logger.error('Error obteniendo administradores', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Crear nuevo administrador
 */
exports.createAdmin = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const currentAdminId = req.adminUser.id;

    // Verificar que el usuario existe
    const user = await prisma.usuarios.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Verificar que no sea ya admin
    const existingAdmin = await prisma.admin_profile.findUnique({
      where: { user_id: userId }
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: 'El usuario ya es administrador'
      });
    }

    // Crear perfil de admin
    const adminProfile = await prisma.admin_profile.create({
      data: {
        user_id: userId,
        role: role || 'support'
      }
    });

    // Actualizar rol del usuario
    await prisma.usuarios.update({
      where: { id: userId },
      data: { rol: 'admin' }
    });

    // Auditoría
    await auditService.logAction({
      adminId: currentAdminId,
      action: 'admin_created',
      targetType: 'user',
      targetId: userId,
      details: { newRole: role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: adminProfile,
      message: 'Administrador creado exitosamente'
    });
  } catch (error) {
    logger.error('Error creando administrador', { error, userId: req.body.userId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Actualizar rol de administrador
 */
exports.updateAdminRole = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { role } = req.body;
    const currentAdminId = req.adminUser.id;

    const adminProfile = await prisma.admin_profile.findUnique({
      where: { id: adminId }
    });

    if (!adminProfile) {
      return res.status(404).json({
        success: false,
        error: 'Perfil de administrador no encontrado'
      });
    }

    const oldRole = adminProfile.role;

    await prisma.admin_profile.update({
      where: { id: adminId },
      data: { role }
    });

    // Auditoría
    await auditService.logAction({
      adminId: currentAdminId,
      action: auditService.AUDIT_ACTIONS.PERMISSION_CHANGED,
      targetType: 'admin_profile',
      targetId: adminId,
      details: { oldRole, newRole: role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Rol de administrador actualizado exitosamente'
    });
  } catch (error) {
    logger.error('Error actualizando rol de administrador', { error, adminId: req.params.adminId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Cambiar estado de administrador
 */
exports.toggleAdminStatus = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { isActive } = req.body;
    const currentAdminId = req.adminUser.id;

    const adminProfile = await prisma.admin_profile.findUnique({
      where: { id: adminId }
    });

    if (!adminProfile) {
      return res.status(404).json({
        success: false,
        error: 'Perfil de administrador no encontrado'
      });
    }

    await prisma.admin_profile.update({
      where: { id: adminId },
      data: { is_active: isActive }
    });

    // Auditoría
    await auditService.logAction({
      adminId: currentAdminId,
      action: 'admin_status_changed',
      targetType: 'admin_profile',
      targetId: adminId,
      details: { isActive },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: `Administrador ${isActive ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
    logger.error('Error cambiando estado de administrador', { error, adminId: req.params.adminId });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener historial de comisiones
 */
exports.getCommissionHistory = async (req, res) => {
  try {
    const commissions = await prisma.commission_settings.findMany({
      orderBy: { updated_at: 'desc' },
      take: 10
    });

    res.json({
      success: true,
      data: commissions
    });
  } catch (error) {
    logger.error('Error obteniendo historial de comisiones', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Actualizar configuración de comisiones
 */
exports.updateCommissionSettings = async (req, res) => {
  try {
    const { commission_percentage, minimum_fee } = req.body;
    const adminId = req.adminUser.id;

    // Obtener configuración actual
    const currentSettings = await prisma.commission_settings.findFirst({
      where: { active: true }
    });

    // Desactivar configuración anterior
    if (currentSettings) {
      await prisma.commission_settings.update({
        where: { id: currentSettings.id },
        data: { active: false }
      });
    }

    // Crear nueva configuración
    const newSettings = await prisma.commission_settings.create({
      data: {
        commission_percentage: commission_percentage / 100, // Guardar como decimal
        minimum_fee,
        updated_by: adminId
      }
    });

    // Auditoría
    await auditService.logAction({
      adminId,
      action: auditService.AUDIT_ACTIONS.COMMISSION_CHANGED,
      targetType: auditService.AUDIT_TARGET_TYPES.SETTING,
      targetId: 'commission_settings',
      details: {
        newPercentage: commission_percentage,
        newMinimumFee: minimum_fee
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: newSettings,
      message: 'Configuración de comisiones actualizada exitosamente'
    });
  } catch (error) {
    logger.error('Error actualizando configuración de comisiones', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Generar reporte de usuarios
 */
exports.generateUserReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const users = await prisma.usuarios.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        esta_verificado: true,
        bloqueado: true,
        created_at: true,
        ultima_conexion: true,
        _count: {
          select: {
            servicios_como_cliente: true,
            servicios_como_profesional: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    if (format === 'csv') {
      const csvHeader = 'ID,Nombre,Email,Rol,Verificado,Bloqueado,Fecha Creación,Ultima Conexión,Servicios como Cliente,Servicios como Profesional\n';
      const csvData = users.map(user =>
        `${user.id},${user.nombre},${user.email},${user.rol},${user.esta_verificado},${user.bloqueado},${user.created_at},${user.ultima_conexion || ''},${user._count.servicios_como_cliente},${user._count.servicios_como_profesional}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte-usuarios.csv"');
      res.send(csvHeader + csvData);
    } else {
      res.json({
        success: true,
        data: users,
        generatedAt: new Date(),
        total: users.length
      });
    }
  } catch (error) {
    logger.error('Error generando reporte de usuarios', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Generar reporte de servicios
 */
exports.generateServiceReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const services = await prisma.servicios.findMany({
      include: {
        cliente: { select: { nombre: true, email: true } },
        profesional: { select: { nombre: true, email: true } },
        pago: { select: { monto_total: true, comision_plataforma: true, estado: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    if (format === 'csv') {
      const csvHeader = 'ID,Cliente,Profesional,Descripción,Estado,Monto Total,Comisión,Fecha Creación\n';
      const csvData = services.map(service =>
        `${service.id},"${service.cliente.nombre}","${service.profesional.nombre}","${service.descripcion}",${service.estado},${service.pago?.monto_total || 0},${service.pago?.comision_plataforma || 0},${service.created_at}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte-servicios.csv"');
      res.send(csvHeader + csvData);
    } else {
      res.json({
        success: true,
        data: services,
        generatedAt: new Date(),
        total: services.length
      });
    }
  } catch (error) {
    logger.error('Error generando reporte de servicios', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Generar reporte financiero
 */
exports.generateFinancialReport = async (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;

    const whereClause = {};
    if (startDate && endDate) {
      whereClause.fecha_pago = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const payments = await prisma.pagos.findMany({
      where: {
        ...whereClause,
        estado: 'liberado'
      },
      include: {
        cliente: { select: { nombre: true } },
        profesional: { select: { nombre: true } }
      },
      orderBy: { fecha_pago: 'desc' }
    });

    const summary = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.monto_total, 0),
      totalCommission: payments.reduce((sum, p) => sum + p.comision_plataforma, 0),
      totalPaidToProfessionals: payments.reduce((sum, p) => sum + p.monto_profesional, 0)
    };

    if (format === 'csv') {
      const csvHeader = 'ID,Servicio ID,Cliente,Profesional,Monto Total,Comisión,Monto Profesional,Fecha Pago\n';
      const csvData = payments.map(payment =>
        `${payment.id},${payment.servicio_id},"${payment.cliente.nombre}","${payment.profesional.nombre}",${payment.monto_total},${payment.comision_plataforma},${payment.monto_profesional},${payment.fecha_pago}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte-financiero.csv"');
      res.send(csvHeader + csvData);
    } else {
      res.json({
        success: true,
        data: payments,
        summary,
        generatedAt: new Date(),
        filters: { startDate, endDate }
      });
    }
  } catch (error) {
    logger.error('Error generando reporte financiero', { error, adminId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

module.exports = exports;