/**
 * @archivo src/services/notificationService.js - Servicio de notificaciones
 * @descripción Gestiona creación y operaciones de notificaciones (REQ-19, REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar Servicio de Notificaciones
 * @impacto Social: Sistema de notificaciones inclusivo y accesible
 * @mejora Sistema de plantillas y prioridades implementado
 */

const { PrismaClient } = require('@prisma/client');
const { sendPushNotification, sendMulticastPushNotification } = require('../config/firebaseAdmin');
const { sendEmail } = require('./emailService');
const notificationTemplates = require('./notificationTemplatesService');
const notificationPreferences = require('./notificationPreferencesService');

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
 * Niveles de prioridad para notificaciones
 */
const NOTIFICATION_PRIORITIES = {
  CRITICAL: 'critical',     // Urgente: servicios urgentes, pagos, verificaciones
  HIGH: 'high',            // Alta: servicios agendados, cotizaciones aceptadas/rechazadas
  MEDIUM: 'medium',        // Media: mensajes, reseñas
  LOW: 'low'              // Baja: recordatorios, bienvenida
};

/**
 * Crear una nueva notificación respetando las preferencias del usuario
 * @param {string} userId - ID del usuario destinatario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje de la notificación
 * @param {Object} metadata - Datos adicionales (opcional)
 * @param {string} priority - Prioridad de la notificación (critical, high, medium, low)
 */
exports.createNotification = async (userId, type, message, metadata = {}, priority = 'medium') => {
  try {
    // Validar tipo de notificación
    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
      throw new Error(`Tipo de notificación inválido: ${type}`);
    }

    // Validar prioridad
    if (!Object.values(NOTIFICATION_PRIORITIES).includes(priority)) {
      priority = 'medium'; // Prioridad por defecto
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

    // Obtener preferencias granulares del usuario
    const userPreferences = await notificationPreferences.getUserPreferences(userId);

    // Verificar si el usuario quiere recibir este tipo de notificación usando el nuevo sistema
    const preferenceCheck = notificationPreferences.shouldSendNotification(userPreferences, type, priority);
    if (!preferenceCheck.shouldSend) {
      console.log(`Notificación ${type} omitida por preferencias del usuario ${userId}: ${preferenceCheck.reason}`);
      return {
        skipped: true,
        reason: preferenceCheck.reason,
        recommendedAction: preferenceCheck.recommendedAction
      };
    }

    // Generar contenido usando plantillas
    const variables = extractVariablesFromMetadata(metadata, user);
    const processedNotification = notificationTemplates.generateNotification(type, 'push', variables);
    
    // Usar el mensaje procesado de la plantilla o el mensaje original
    const finalMessage = processedNotification.body || message;

    // Crear notificación en base de datos
    const notification = await prisma.notificaciones.create({
      data: {
        usuario_id: userId,
        tipo: type,
        mensaje: finalMessage,
        esta_leido: false
      }
    });

    console.log(`Notificación creada: ${type} (${priority}) para usuario ${userId}`);

    // Enviar por canales según las preferencias del usuario
    await sendNotificationByPreferences(user, type, finalMessage, metadata, priority, processedNotification, preferenceCheck);

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
 * Extraer variables de metadata para las plantillas
 * @param {Object} metadata - Datos adicionales de la notificación
 * @param {Object} user - Datos del usuario
 * @returns {Object} Variables procesadas para la plantilla
 */
function extractVariablesFromMetadata(metadata = {}, user = {}) {
  return {
    // Variables del usuario
    usuario: user.nombre || 'Usuario',
    
    // Variables del servicio
    servicio: metadata.servicio || metadata.serviceName || 'servicio',
    profesional: metadata.profesional || metadata.professionalName || 'profesional',
    cliente: metadata.cliente || metadata.clientName || 'cliente',
    
    // Variables de tiempo
    fecha: metadata.fecha || metadata.date || new Date().toLocaleDateString('es-AR'),
    hora: metadata.hora || metadata.time || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    
    // Variables monetarias
    monto: metadata.monto || metadata.amount || '0',
    
    // Variables de rating
    rating: metadata.rating || '5',
    
    // Variables de contenido
    contenido_mensaje: metadata.contenido_mensaje || metadata.messageContent || '',
    
    // Variables de comentario
    comentario: metadata.comentario || metadata.comment || '',
    
    // Variables adicionales del metadata
    ...metadata
  };
}

/**
 * Enviar notificación por múltiples canales según la prioridad
 * @param {Object} user - Datos del usuario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje principal
 * @param {Object} metadata - Datos adicionales
 * @param {string} priority - Prioridad de la notificación
 * @param {Object} processedNotification - Notificación procesada con plantillas
 * @param {Object} preferenceCheck - Resultado de verificación de preferencias
 */
async function sendNotificationByPreferences(user, type, message, metadata, priority, processedNotification, preferenceCheck) {
  // Usar canales recomendados por el sistema de preferencias
  const channels = preferenceCheck.recommendedChannels || ['push'];
  
  for (const channel of channels) {
    try {
      switch (channel) {
        case 'push':
          if (user.fcm_token && user.notificaciones_push) {
            await sendPushNotification(user.fcm_token, processedNotification.title || getNotificationTitle(type), message);
          }
          break;
          
        case 'email':
          if (user.notificaciones_email) {
            const emailTemplate = notificationTemplates.generateNotification(type, 'email', extractVariablesFromMetadata(metadata, user));
            await sendEmail(user.email, emailTemplate.subject, emailTemplate.html);
          }
          break;
          
        case 'sms':
          if (user.sms_enabled && user.notificaciones_sms && shouldSendSMS(user, type)) {
            const smsTemplate = notificationTemplates.generateNotification(type, 'sms', extractVariablesFromMetadata(metadata, user));
            const { sendSMS } = require('./smsService');
            await sendSMS(user.telefono, smsTemplate.sms || smsTemplate.body);
          }
          break;
      }
    } catch (channelError) {
      console.warn(`Error enviando notificación por ${channel}:`, channelError);
    }
  }
}

/**
 * Enviar notificación por múltiples canales según la prioridad (legacy)
 * @param {Object} user - Datos del usuario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje principal
 * @param {Object} metadata - Datos adicionales
 * @param {string} priority - Prioridad de la notificación
 * @param {Object} processedNotification - Notificación procesada con plantillas
 */
async function sendNotificationByPriority(user, type, message, metadata, priority, processedNotification) {
  const channels = determineChannelsByPriority(priority, type);
  
  for (const channel of channels) {
    try {
      switch (channel) {
        case 'push':
          if (user.fcm_token && user.notificaciones_push) {
            await sendPushNotification(user.fcm_token, processedNotification.title || getNotificationTitle(type), message);
          }
          break;
          
        case 'email':
          if (user.notificaciones_email) {
            const emailTemplate = notificationTemplates.generateNotification(type, 'email', extractVariablesFromMetadata(metadata, user));
            await sendEmail(user.email, emailTemplate.subject, emailTemplate.html);
          }
          break;
          
        case 'sms':
          if (shouldSendSMS(user, type)) {
            const smsTemplate = notificationTemplates.generateNotification(type, 'sms', extractVariablesFromMetadata(metadata, user));
            const { sendSMS } = require('./smsService');
            await sendSMS(user.telefono, smsTemplate.sms || smsTemplate.body);
          }
          break;
      }
    } catch (channelError) {
      console.warn(`Error enviando notificación por ${channel}:`, channelError);
    }
  }
}

/**
 * Determinar qué canales usar según la prioridad
 * @param {string} priority - Prioridad de la notificación
 * @param {string} type - Tipo de notificación
 * @returns {Array} Lista de canales a usar
 */
function determineChannelsByPriority(priority, type) {
  const channelsByPriority = {
    [NOTIFICATION_PRIORITIES.CRITICAL]: ['push', 'email', 'sms'],
    [NOTIFICATION_PRIORITIES.HIGH]: ['push', 'email'],
    [NOTIFICATION_PRIORITIES.MEDIUM]: ['push'],
    [NOTIFICATION_PRIORITIES.LOW]: ['push']
  };
  
  let channels = channelsByPriority[priority] || channelsByPriority[NOTIFICATION_PRIORITIES.MEDIUM];
  
  // Ajustes específicos por tipo
  if (type === NOTIFICATION_TYPES.BIENVENIDA) {
    channels = ['email']; // Solo email para bienvenida
  }
  
  return channels;
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
    [NOTIFICATION_TYPES.BIENVENIDA]: '¡Bienvenido a ChangAnet!',
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
 * Obtener prioridad por defecto según el tipo de notificación
 * @param {string} type - Tipo de notificación
 * @returns {string} Prioridad recomendada
 */
function getDefaultPriority(type) {
  const priorityMap = {
    // CRÍTICO
    'servicio_urgente_agendado': NOTIFICATION_PRIORITIES.CRITICAL,
    'fondos_liberados': NOTIFICATION_PRIORITIES.CRITICAL,
    'fondos_liberados_auto': NOTIFICATION_PRIORITIES.CRITICAL,
    
    // ALTA
    [NOTIFICATION_TYPES.SERVICIO_AGENDADO]: NOTIFICATION_PRIORITIES.HIGH,
    [NOTIFICATION_TYPES.TURNO_AGENDADO]: NOTIFICATION_PRIORITIES.HIGH,
    [NOTIFICATION_TYPES.COTIZACION_ACEPTADA]: NOTIFICATION_PRIORITIES.HIGH,
    [NOTIFICATION_TYPES.COTIZACION_RECHAZADA]: NOTIFICATION_PRIORITIES.HIGH,
    [NOTIFICATION_TYPES.VERIFICACION_APROBADA]: NOTIFICATION_PRIORITIES.HIGH,
    
    // MEDIA
    [NOTIFICATION_TYPES.COTIZACION]: NOTIFICATION_PRIORITIES.MEDIUM,
    [NOTIFICATION_TYPES.MENSAJE]: NOTIFICATION_PRIORITIES.MEDIUM,
    [NOTIFICATION_TYPES.RESENA_RECIBIDA]: NOTIFICATION_PRIORITIES.MEDIUM,
    [NOTIFICATION_TYPES.PAGO_LIBERADO]: NOTIFICATION_PRIORITIES.MEDIUM,
    
    // BAJA
    [NOTIFICATION_TYPES.BIENVENIDA]: NOTIFICATION_PRIORITIES.LOW,
    'recordatorio_servicio': NOTIFICATION_PRIORITIES.LOW,
    'recordatorio_pago': NOTIFICATION_PRIORITIES.LOW
  };
  
  return priorityMap[type] || NOTIFICATION_PRIORITIES.MEDIUM;
}

/**
 * Crear notificación rápida con prioridad automática
 * @param {string} userId - ID del usuario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje
 * @param {Object} metadata - Datos adicionales
 */
exports.createNotificationQuick = async (userId, type, message, metadata = {}) => {
  // Obtener prioridad automáticamente según el tipo
  const priority = getDefaultPriority(type);
  return await exports.createNotification(userId, type, message, metadata, priority);
};

/**
 * Crear notificación programada para envío futuro
 * @param {string} userId - ID del usuario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje
 * @param {Date} scheduledTime - Fecha y hora programada
 * @param {Object} metadata - Datos adicionales
 * @param {string} priority - Prioridad de la notificación
 */
exports.scheduleNotification = async (userId, type, message, scheduledTime, metadata = {}, priority = 'medium') => {
  try {
    // Validar que la fecha programada sea futura
    if (new Date(scheduledTime) <= new Date()) {
      throw new Error('La fecha programada debe ser futura');
    }

    // Validar prioridad
    if (!Object.values(NOTIFICATION_PRIORITIES).includes(priority)) {
      priority = 'medium';
    }

    // Crear registro de notificación programada (podríamos crear una tabla separada)
    // Por ahora, usamos un tipo especial y metadata
    const scheduledNotification = await prisma.notificaciones.create({
      data: {
        usuario_id: userId,
        tipo: `scheduled_${type}`,
        mensaje: message,
        esta_leido: false
        // Podríamos agregar campos como scheduled_for en el futuro
      }
    });

    // En una implementación completa, aquí se programaría el envío
    // Por ahora, solo registramos la notificación programada
    console.log(`Notificación programada: ${type} (${priority}) para usuario ${userId} en ${scheduledTime}`);

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
  createNotificationQuick: exports.createNotificationQuick,
  getUserNotifications: exports.getUserNotifications,
  getNotificationById: exports.getNotificationById,
  markAsRead: exports.markAsRead,
  markAllAsRead: exports.markAllAsRead,
  deleteNotification: exports.deleteNotification,
  scheduleNotification: exports.scheduleNotification,
  processScheduledNotifications: exports.processScheduledNotifications,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES
};