/**
 * @archivo src/services/notificationService.js - Servicio de notificaciones
 * @descripción Gestiona creación y operaciones de notificaciones (REQ-19, REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar Servicio de Notificaciones
 * @impacto Social: Sistema de notificaciones inclusivo y accesible
 */

const { PrismaClient } = require('@prisma/client');
const { sendPushNotification, sendMulticastPushNotification } = require('../config/firebaseAdmin');
const { sendEmail } = require('./emailService');

const prisma = new PrismaClient();

/**
 * Tipos de notificaciones soportados
 */
const NOTIFICATION_TYPES = {
  BIENVENIDA: 'bienvenida',
  COTIZACION: 'cotizacion',
  COTIZACION_ACEPTADA: 'cotizacion_aceptada',
  COTIZACION_RECHAZADA: 'cotizacion_rechazada',
  SERVICIO_AGENDADO: 'servicio_agendado',
  MENSAJE: 'mensaje',
  TURNO_AGENDADO: 'turno_agendado',
  RESENA_RECIBIDA: 'resena_recibida',
  PAGO_LIBERADO: 'pago_liberado',
  VERIFICACION_APROBADA: 'verificacion_aprobada'
};

/**
 * Crear una nueva notificación respetando las preferencias del usuario
 * @param {string} userId - ID del usuario destinatario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje de la notificación
 * @param {Object} metadata - Datos adicionales (opcional)
 */
exports.createNotification = async (userId, type, message, metadata = {}) => {
  try {
    // Validar tipo de notificación
    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
      throw new Error(`Tipo de notificación inválido: ${type}`);
    }

    // Obtener preferencias del usuario
    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        fcm_token: true,
        email: true,
        nombre: true,
        telefono: true,
        sms_enabled: true,
        notificaciones_push: true,
        notificaciones_email: true,
        notificaciones_sms: true,
        notificaciones_servicios: true,
        notificaciones_mensajes: true,
        notificaciones_pagos: true,
        notificaciones_marketing: true
      }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar si el usuario quiere recibir este tipo de notificación
    if (!shouldSendNotification(user, type)) {
      console.log(`Notificación ${type} omitida por preferencias del usuario ${userId}`);
      return null; // No crear notificación si el usuario no la quiere
    }

    // Crear notificación en base de datos
    const notification = await prisma.notificaciones.create({
      data: {
        usuario_id: userId,
        tipo: type,
        mensaje: message,
        esta_leido: false
      }
    });

    console.log(`Notificación creada: ${type} para usuario ${userId}`);

    // Enviar notificación push si el usuario tiene FCM token y permite push
    if (user.fcm_token && user.notificaciones_push) {
      try {
        await sendPushNotification(user.fcm_token, getNotificationTitle(type), message);
      } catch (pushError) {
        console.error('Error enviando notificación push:', pushError);
      }
    }

    // Enviar email si el usuario permite emails
    if (user.notificaciones_email) {
      try {
        await sendEmail(
          user.email,
          getNotificationTitle(type),
          `Hola ${user.nombre},\n\n${message}\n\nPuedes revisar esta notificación desde la plataforma.\n\nSaludos,\nEquipo Changánet`
        );
      } catch (emailError) {
        console.warn('Error enviando email de notificación:', emailError);
      }
    }

    // Enviar SMS para notificaciones críticas si está habilitado
    if (shouldSendSMS(user, type)) {
      try {
        const { sendSMS } = require('./smsService');
        const smsMessage = `Changánet: ${getNotificationTitle(type)} - ${message.substring(0, 100)}...`;
        await sendSMS(user.telefono, smsMessage);
      } catch (smsError) {
        console.warn('Error enviando SMS de notificación:', smsError);
      }
    }

    return notification;
  } catch (error) {
    console.error('Error creando notificación:', error);
    throw error;
  }
};

/**
 * Obtener notificaciones de un usuario con filtros
 * @param {string} userId - ID del usuario
 * @param {string} filter - Filtro: 'all', 'unread', 'read'
 */
exports.getUserNotifications = async (userId, filter = 'all') => {
  try {
    const whereClause = { usuario_id: userId };

    if (filter === 'unread') {
      whereClause.esta_leido = false;
    } else if (filter === 'read') {
      whereClause.esta_leido = true;
    }

    const notifications = await prisma.notificaciones.findMany({
      where: whereClause,
      orderBy: { creado_en: 'desc' },
      take: 50 // Limitar a 50 notificaciones más recientes
    });

    const unreadCount = await prisma.notificaciones.count({
      where: {
        usuario_id: userId,
        esta_leido: false
      }
    });

    return {
      notifications,
      unreadCount
    };
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    throw error;
  }
};

/**
 * Obtener una notificación por ID
 * @param {string} notificationId - ID de la notificación
 */
exports.getNotificationById = async (notificationId) => {
  try {
    return await prisma.notificaciones.findUnique({
      where: { id: notificationId }
    });
  } catch (error) {
    console.error('Error obteniendo notificación:', error);
    throw error;
  }
};

/**
 * Marcar notificación como leída
 * @param {string} notificationId - ID de la notificación
 */
exports.markAsRead = async (notificationId) => {
  try {
    await prisma.notificaciones.update({
      where: { id: notificationId },
      data: { esta_leido: true }
    });
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
    throw error;
  }
};

/**
 * Marcar todas las notificaciones de un usuario como leídas
 * @param {string} userId - ID del usuario
 */
exports.markAllAsRead = async (userId) => {
  try {
    await prisma.notificaciones.updateMany({
      where: {
        usuario_id: userId,
        esta_leido: false
      },
      data: { esta_leido: true }
    });
  } catch (error) {
    console.error('Error marcando todas las notificaciones como leídas:', error);
    throw error;
  }
};

/**
 * Eliminar una notificación
 * @param {string} notificationId - ID de la notificación
 */
exports.deleteNotification = async (notificationId) => {
  try {
    await prisma.notificaciones.delete({
      where: { id: notificationId }
    });
  } catch (error) {
    console.error('Error eliminando notificación:', error);
    throw error;
  }
};

/**
 * Verificar si se debe enviar una notificación según las preferencias del usuario
 * @param {Object} user - Datos del usuario con preferencias
 * @param {string} type - Tipo de notificación
 * @returns {boolean} Si se debe enviar la notificación
 */
function shouldSendNotification(user, type) {
  // Tipos críticos que siempre se envían (independientemente de preferencias)
  const criticalTypes = [
    NOTIFICATION_TYPES.BIENVENIDA,
    NOTIFICATION_TYPES.VERIFICACION_APROBADA
  ];

  if (criticalTypes.includes(type)) {
    return true;
  }

  // Verificar preferencias específicas por tipo
  switch (type) {
    case NOTIFICATION_TYPES.COTIZACION:
    case NOTIFICATION_TYPES.COTIZACION_ACEPTADA:
    case NOTIFICATION_TYPES.COTIZACION_RECHAZADA:
    case NOTIFICATION_TYPES.SERVICIO_AGENDADO:
    case NOTIFICATION_TYPES.TURNO_AGENDADO:
    case NOTIFICATION_TYPES.RESENA_RECIBIDA:
      return user.notificaciones_servicios;

    case NOTIFICATION_TYPES.MENSAJE:
      return user.notificaciones_mensajes;

    case NOTIFICATION_TYPES.PAGO_LIBERADO:
      return user.notificaciones_pagos;

    default:
      return true; // Por defecto, enviar si no hay preferencia específica
  }
}

/**
 * Verificar si se debe enviar SMS para una notificación crítica
 * @param {Object} user - Datos del usuario
 * @param {string} type - Tipo de notificación
 * @returns {boolean} Si se debe enviar SMS
 */
function shouldSendSMS(user, type) {
  // Solo enviar SMS si el usuario tiene SMS habilitado y el teléfono configurado
  if (!user.sms_enabled || !user.telefono) {
    return false;
  }

  // Tipos de notificación que justifican envío por SMS (críticos)
  const smsTypes = [
    NOTIFICATION_TYPES.SERVICIO_AGENDADO,
    NOTIFICATION_TYPES.PAGO_LIBERADO,
    'servicio_urgente_agendado', // Servicios urgentes
    'fondos_liberados'
  ];

  return smsTypes.includes(type);
}

/**
 * Función auxiliar para obtener título de notificación según tipo
 * @param {string} type - Tipo de notificación
 */
function getNotificationTitle(type) {
  const titles = {
    [NOTIFICATION_TYPES.BIENVENIDA]: '¡Bienvenido a Changánet!',
    [NOTIFICATION_TYPES.COTIZACION]: 'Nueva solicitud de presupuesto',
    [NOTIFICATION_TYPES.COTIZACION_ACEPTADA]: 'Cotización aceptada',
    [NOTIFICATION_TYPES.COTIZACION_RECHAZADA]: 'Cotización rechazada',
    [NOTIFICATION_TYPES.SERVICIO_AGENDADO]: 'Servicio agendado',
    [NOTIFICATION_TYPES.MENSAJE]: 'Nuevo mensaje',
    [NOTIFICATION_TYPES.TURNO_AGENDADO]: 'Servicio agendado',
    [NOTIFICATION_TYPES.RESENA_RECIBIDA]: 'Nueva reseña',
    [NOTIFICATION_TYPES.PAGO_LIBERADO]: 'Pago liberado',
    [NOTIFICATION_TYPES.VERIFICACION_APROBADA]: 'Verificación aprobada',
    'servicio_urgente_agendado': '¡Servicio Urgente Agendado!',
    'fondos_liberados': 'Fondos Liberados',
    'fondos_liberados_auto': 'Fondos Liberados Automáticamente'
  };
  return titles[type] || 'Nueva notificación';
}

/**
 * Crear notificación programada para envío futuro
 * @param {string} userId - ID del usuario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje
 * @param {Date} scheduledTime - Fecha y hora programada
 * @param {Object} metadata - Datos adicionales
 */
exports.scheduleNotification = async (userId, type, message, scheduledTime, metadata = {}) => {
  try {
    // Validar que la fecha programada sea futura
    if (new Date(scheduledTime) <= new Date()) {
      throw new Error('La fecha programada debe ser futura');
    }

    // Crear registro de notificación programada (podríamos crear una tabla separada)
    // Por ahora, usamos un tipo especial y metadata
    const scheduledNotification = await prisma.notificaciones.create({
      data: {
        usuario_id: userId,
        tipo: `scheduled_${type}`,
        mensaje: message,
        esta_leido: false,
        // Podríamos agregar campos como scheduled_for en el futuro
      }
    });

    // En una implementación completa, aquí se programaría el envío
    // Por ahora, solo registramos la notificación programada
    console.log(`Notificación programada: ${type} para usuario ${userId} en ${scheduledTime}`);

    return scheduledNotification;
  } catch (error) {
    console.error('Error programando notificación:', error);
    throw error;
  }
};

/**
 * Procesar notificaciones programadas que deben enviarse ahora
 * Esta función debe ejecutarse periódicamente (ej: cada hora)
 */
exports.processScheduledNotifications = async () => {
  try {
    // En una implementación completa, buscaríamos notificaciones con scheduled_for <= now
    // y las enviaríamos. Por ahora, implementamos algunos recordatorios automáticos

    const now = new Date();

    // Recordatorio de servicios próximos (24 horas antes)
    await sendServiceReminders(now);

    // Recordatorio de pagos pendientes
    await sendPaymentReminders(now);

    console.log('✅ Notificaciones programadas procesadas');
  } catch (error) {
    console.error('Error procesando notificaciones programadas:', error);
    throw error;
  }
};

/**
 * Enviar recordatorios de servicios próximos
 */
async function sendServiceReminders(now) {
  try {
    // Servicios que empiezan en las próximas 24 horas
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcomingServices = await prisma.servicios.findMany({
      where: {
        fecha_agendada: {
          gte: now,
          lte: tomorrow
        },
        estado: 'AGENDADO'
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        profesional: { select: { id: true, nombre: true } }
      }
    });

    for (const service of upcomingServices) {
      // Recordatorio al cliente
      await exports.createNotification(
        service.cliente_id,
        'recordatorio_servicio',
        `Recordatorio: Tienes un servicio agendado mañana con ${service.profesional.nombre} a las ${new Date(service.fecha_agendada).toLocaleTimeString('es-AR')}`,
        { serviceId: service.id, type: 'cliente' }
      );

      // Recordatorio al profesional
      await exports.createNotification(
        service.profesional_id,
        'recordatorio_servicio',
        `Recordatorio: Tienes un servicio agendado mañana con ${service.cliente.nombre} a las ${new Date(service.fecha_agendada).toLocaleTimeString('es-AR')}`,
        { serviceId: service.id, type: 'profesional' }
      );
    }

    console.log(`📅 Recordatorios enviados para ${upcomingServices.length} servicios`);
  } catch (error) {
    console.error('Error enviando recordatorios de servicios:', error);
  }
}

/**
 * Enviar recordatorios de pagos pendientes
 */
async function sendPaymentReminders(now) {
  try {
    // Pagos pendientes de más de 3 días
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const pendingPayments = await prisma.pagos.findMany({
      where: {
        estado: 'pendiente',
        creado_en: { lte: threeDaysAgo }
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        servicio: { select: { id: true, descripcion: true } }
      }
    });

    for (const payment of pendingPayments) {
      await exports.createNotification(
        payment.cliente_id,
        'recordatorio_pago',
        `Recordatorio: Tienes un pago pendiente de $${payment.monto_total} por "${payment.servicio.descripcion}". Completa el pago para confirmar el servicio.`,
        { paymentId: payment.id, serviceId: payment.servicio_id }
      );
    }

    console.log(`💳 Recordatorios de pago enviados para ${pendingPayments.length} pagos pendientes`);
  } catch (error) {
    console.error('Error enviando recordatorios de pagos:', error);
  }
}

module.exports = {
  createNotification: exports.createNotification,
  getUserNotifications: exports.getUserNotifications,
  getNotificationById: exports.getNotificationById,
  markAsRead: exports.markAsRead,
  markAllAsRead: exports.markAllAsRead,
  deleteNotification: exports.deleteNotification,
  scheduleNotification: exports.scheduleNotification,
  processScheduledNotifications: exports.processScheduledNotifications,
  NOTIFICATION_TYPES
};