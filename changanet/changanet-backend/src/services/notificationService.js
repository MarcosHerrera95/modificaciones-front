const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getTemplate, processTemplate, generateNotification } = require('./notificationTemplatesService');
const { getUserPreferences, shouldSendNotification } = require('./notificationPreferencesService');
const { getCachedNotificationCount, cacheNotificationCount, invalidateNotificationCache } = require('./cacheService');
const rateLimiterService = require('./rateLimiterService');

// WebSocket service para notificaciones en tiempo real
let webSocketService = null;

function setWebSocketService(service) {
  webSocketService = service;
}

// Tipos de notificaciones según PRD
const NOTIFICATION_TYPES = {
  SYSTEM: 'system',
  MESSAGE: 'message',
  PAYMENT: 'payment',
  URGENT: 'urgent',
  REVIEW: 'review',
  ADMIN: 'admin',
  MARKETING: 'marketing',
  SECURITY: 'security'
};

// Canales de notificación
const NOTIFICATION_CHANNELS = {
  INAPP: 'inapp',
  PUSH: 'push',
  EMAIL: 'email',
  SMS: 'sms'
};

// Estados de notificación
const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  READ: 'read',
  DELIVERED: 'delivered',
  FAILED: 'failed'
};

// Niveles de prioridad
const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Mapear tipos a prioridades por defecto
const DEFAULT_TYPE_PRIORITY = {
  [NOTIFICATION_TYPES.SYSTEM]: NOTIFICATION_PRIORITY.MEDIUM,
  [NOTIFICATION_TYPES.MESSAGE]: NOTIFICATION_PRIORITY.MEDIUM,
  [NOTIFICATION_TYPES.PAYMENT]: NOTIFICATION_PRIORITY.HIGH,
  [NOTIFICATION_TYPES.URGENT]: NOTIFICATION_PRIORITY.CRITICAL,
  [NOTIFICATION_TYPES.REVIEW]: NOTIFICATION_PRIORITY.LOW,
  [NOTIFICATION_TYPES.ADMIN]: NOTIFICATION_PRIORITY.HIGH,
  [NOTIFICATION_TYPES.MARKETING]: NOTIFICATION_PRIORITY.LOW,
  [NOTIFICATION_TYPES.SECURITY]: NOTIFICATION_PRIORITY.CRITICAL
};

class NotificationService {
  // Crear notificación con sistema de plantillas y prioridades
  async createNotification(userId, type, title, message, data = {}, options = {}) {
    try {
      // Rate limiting para creación de notificaciones
      const rateLimitResult = await rateLimiterService.checkLimit('notifications', userId);
      if (!rateLimitResult.allowed) {
        console.warn(`Rate limit exceeded for user ${userId} creating notifications`);
        return null; // Silently fail for rate limited requests
      }

      // Determinar prioridad
      const priority = options.priority || DEFAULT_TYPE_PRIORITY[type] || NOTIFICATION_PRIORITY.MEDIUM;

      // Obtener preferencias del usuario
      const userPreferences = await getUserPreferences(userId);

      // Verificar si debe enviarse según preferencias
      const shouldSend = shouldSendNotification(userPreferences, type, priority);
      if (!shouldSend.shouldSend) {
        console.log(`Notification blocked by user preferences: ${shouldSend.reason}`);
        return null; // Silently skip if user doesn't want this type
      }

      // Usar sistema de plantillas si no se proporciona título/mensaje personalizado
      let finalTitle = title;
      let finalMessage = message;

      if (!title || !message) {
        try {
          const templateData = generateNotification(type, 'push', data);
          finalTitle = finalTitle || templateData.title;
          finalMessage = finalMessage || templateData.body;
        } catch (templateError) {
          console.warn('Template generation failed, using fallback:', templateError.message);
        }
      }

      // Sanitizar contenido
      finalTitle = this.sanitizeContent(finalTitle);
      finalMessage = this.sanitizeContent(finalMessage);

      const notification = await prisma.notificaciones.create({
        data: {
          usuario_id: userId,
          tipo: type,
          titulo: finalTitle,
          mensaje: finalMessage,
          data: JSON.stringify(data),
          canal: options.channel || 'inapp',
          estado: NOTIFICATION_STATUS.UNREAD,
          prioridad: priority,
          creado_en: new Date()
        }
      });

      // Enviar a canales según preferencias y prioridad
      await this.sendToChannels(notification, shouldSend.recommendedChannels);

      // Invalidar caché de contador
      invalidateNotificationCache(userId);

      // Emitir evento WebSocket para actualización en tiempo real
      if (webSocketService) {
        const unreadCount = await this.getUnreadCount(userId);
        webSocketService.emitNotificationToUser(userId, {
          id: notification.id,
          type: notification.tipo,
          title: notification.titulo,
          message: notification.mensaje,
          data: JSON.parse(notification.data),
          priority: notification.prioridad,
          createdAt: notification.creado_en,
          unreadCount
        });
      }

      // Registrar métrica
      this.recordNotificationMetric(userId, type, priority, shouldSend.recommendedChannels);

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Enviar notificación a múltiples canales con canales recomendados
  async sendToChannels(notification, recommendedChannels = null) {
    try {
      const userPreferences = await getUserPreferences(notification.usuario_id);
      const channelsToUse = recommendedChannels || this.getDefaultChannelsForPriority(notification.prioridad);

      // Verificar canales disponibles según preferencias del usuario
      const availableChannels = channelsToUse.filter(channel => {
        if (channel === 'inapp') return userPreferences.canales?.in_app !== false;
        return userPreferences.canales?.[channel] !== false;
      });

      const results = {
        inapp: false,
        push: false,
        email: false,
        sms: false
      };

      // Enviar a cada canal disponible
      for (const channel of availableChannels) {
        try {
          switch (channel) {
            case 'inapp':
              results.inapp = true; // Ya está en BD
              break;
            case 'push':
              results.push = await this.sendPushNotification(notification);
              break;
            case 'email':
              results.email = await this.sendEmailNotification(notification);
              break;
            case 'sms':
              results.sms = await this.sendSMSNotification(notification);
              break;
          }
        } catch (channelError) {
          console.error(`Error sending to ${channel}:`, channelError);
        }
      }

      return results;
    } catch (error) {
      console.error('Error in sendToChannels:', error);
      return { inapp: false, push: false, email: false, sms: false };
    }
  }

  // Enviar push notification
  async sendPushNotification(notification) {
    try {
      const { sendPushNotification } = require('./pushNotificationService');

      const result = await sendPushNotification(
        notification.usuario_id,
        notification.titulo,
        notification.mensaje,
        JSON.parse(notification.data || '{}')
      );

      if (result.success) {
        await this.updateNotificationStatus(notification.id, NOTIFICATION_STATUS.DELIVERED);
      } else {
        await this.updateNotificationStatus(notification.id, NOTIFICATION_STATUS.FAILED);
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      await this.updateNotificationStatus(notification.id, NOTIFICATION_STATUS.FAILED);
    }
  }

  // Enviar email notification
  async sendEmailNotification(notification) {
    try {
      const { sendNotificationEmail } = require('./emailService');

      const user = await prisma.usuarios.findUnique({
        where: { id: notification.usuario_id },
        select: { email: true, nombre: true }
      });

      if (user?.email) {
        // Mapear tipos de notificación a tipos de email
        const emailTypeMap = {
          [NOTIFICATION_TYPES.SYSTEM]: 'mensaje',
          [NOTIFICATION_TYPES.MESSAGE]: 'mensaje',
          [NOTIFICATION_TYPES.PAYMENT]: 'pago_liberado',
          [NOTIFICATION_TYPES.URGENT]: 'mensaje',
          [NOTIFICATION_TYPES.REVIEW]: 'resena_recibida',
          [NOTIFICATION_TYPES.ADMIN]: 'mensaje'
        };

        const emailType = emailTypeMap[notification.tipo] || 'mensaje';

        await sendNotificationEmail(
          user.email,
          emailType,
          notification.mensaje,
          user.nombre
        );

        await this.updateNotificationStatus(notification.id, NOTIFICATION_STATUS.DELIVERED);
      }
    } catch (error) {
      console.error('Error sending email notification:', error);
      await this.updateNotificationStatus(notification.id, NOTIFICATION_STATUS.FAILED);
    }
  }

  // Obtener notificaciones de usuario
  async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notificaciones.findMany({
        where: { usuario_id: userId },
        orderBy: { creado_en: 'desc' },
        skip,
        take: limit
      }),
      prisma.notificaciones.count({
        where: { usuario_id: userId }
      })
    ]);

    return {
      notifications: notifications.map(n => ({
        ...n,
        data: JSON.parse(n.data)
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Marcar notificación como leída
  async markAsRead(notificationId, userId) {
    const notification = await prisma.notificaciones.findFirst({
      where: {
        id: notificationId,
        usuario_id: userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    const updatedNotification = await prisma.notificaciones.update({
      where: { id: notificationId },
      data: {
        estado: NOTIFICATION_STATUS.READ,
        leido_en: new Date()
      }
    });

    // Emitir evento WebSocket
    if (webSocketService) {
      const unreadCount = await this.getUnreadCount(userId);
      webSocketService.emitToUser(userId, 'notification:read', {
        notificationId,
        unreadCount
      });
    }

    return updatedNotification;
  }

  // Marcar todas como leídas
  async markAllAsRead(userId) {
    const result = await prisma.notificaciones.updateMany({
      where: {
        usuario_id: userId,
        estado: NOTIFICATION_STATUS.UNREAD
      },
      data: {
        estado: NOTIFICATION_STATUS.READ,
        leido_en: new Date()
      }
    });

    // Emitir evento WebSocket
    if (webSocketService) {
      webSocketService.emitToUser(userId, 'notification:all-read', {
        unreadCount: 0
      });
    }

    return result;
  }

  // Contador de notificaciones no leídas con caché
  async getUnreadCount(userId) {
    try {
      // Intentar obtener del caché primero
      const cachedCount = getCachedNotificationCount(userId);
      if (cachedCount !== null) {
        return cachedCount;
      }

      // Calcular y cachear
      const count = await prisma.notificaciones.count({
        where: {
          usuario_id: userId,
          estado: NOTIFICATION_STATUS.UNREAD
        }
      });

      // Cachear por 5 minutos
      cacheNotificationCount(userId, count);

      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Obtener preferencias de usuario
  async getUserPreferences(userId, type = null) {
    const where = type ? { usuario_id: userId, tipo: type } : { usuario_id: userId };

    const preferences = await prisma.notification_preferences.findMany({
      where
    });

    // Si no hay preferencias específicas, usar valores por defecto
    if (preferences.length === 0) {
      return {
        inapp: true,
        push: true,
        email: true
      };
    }

    // Retornar preferencias por tipo o generales
    const prefs = {};
    preferences.forEach(pref => {
      prefs[pref.tipo] = {
        inapp: pref.inapp,
        push: pref.push,
        email: pref.email
      };
    });

    return prefs;
  }

  // Actualizar preferencias
  async updateUserPreferences(userId, preferences) {
    const updates = [];

    for (const [type, prefs] of Object.entries(preferences)) {
      updates.push(
        prisma.notification_preferences.upsert({
          where: {
            usuario_id_tipo: {
              usuario_id: userId,
              tipo: type
            }
          },
          update: {
            inapp: prefs.inapp,
            push: prefs.push,
            email: prefs.email,
            actualizado_en: new Date()
          },
          create: {
            usuario_id: userId,
            tipo: type,
            inapp: prefs.inapp,
            push: prefs.push,
            email: prefs.email
          }
        })
      );
    }

    return await prisma.$transaction(updates);
  }

  // Actualizar estado de notificación
  async updateNotificationStatus(notificationId, status) {
    return await prisma.notificaciones.update({
      where: { id: notificationId },
      data: { estado: status }
    });
  }

  // Eventos automáticos - disparadores de notificaciones
  async triggerPaymentNotification(serviceId, type) {
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: {
        usuarios_servicios_cliente_idTousuarios: true,
        usuarios_servicios_profesional_idTousuarios: true
      }
    });

    if (!service) return;

    const messages = {
      confirmed: {
        client: 'Tu pago fue acreditado',
        professional: 'Pago recibido por servicio completado'
      },
      released: {
        client: 'Pago liberado al profesional',
        professional: 'Pago liberado a tu cuenta'
      }
    };

    if (messages[type]) {
      await this.createNotification(
        service.cliente_id,
        NOTIFICATION_TYPES.PAYMENT,
        'Actualización de Pago',
        messages[type].client,
        { serviceId }
      );

      await this.createNotification(
        service.profesional_id,
        NOTIFICATION_TYPES.PAYMENT,
        'Actualización de Pago',
        messages[type].professional,
        { serviceId }
      );
    }
  }

  async triggerServiceNotification(serviceId, type) {
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: {
        usuarios_servicios_cliente_idTousuarios: true,
        usuarios_servicios_profesional_idTousuarios: true
      }
    });

    if (!service) return;

    const messages = {
      accepted: {
        client: 'Servicio aceptado por el profesional',
        professional: 'Has aceptado el servicio'
      },
      completed: {
        client: 'Servicio completado',
        professional: 'Servicio marcado como completado'
      }
    };

    if (messages[type]) {
      await this.createNotification(
        service.cliente_id,
        NOTIFICATION_TYPES.SYSTEM,
        'Actualización de Servicio',
        messages[type].client,
        { serviceId }
      );

      await this.createNotification(
        service.profesional_id,
        NOTIFICATION_TYPES.SYSTEM,
        'Actualización de Servicio',
        messages[type].professional,
        { serviceId }
      );
    }
  }

  async triggerMessageNotification(messageId) {
    const message = await prisma.mensajes.findUnique({
      where: { id: messageId },
      include: {
        usuarios_mensajes_destinatario_idTousuarios: true
      }
    });

    if (!message) return;

    await this.createNotification(
      message.destinatario_id,
      NOTIFICATION_TYPES.MESSAGE,
      'Nuevo Mensaje',
      `Tienes un nuevo mensaje de ${message.usuarios_mensajes_destinatario_idTousuarios.nombre}`,
      { messageId }
    );
  }

  async triggerReviewNotification(serviceId) {
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: {
        usuarios_servicios_profesional_idTousuarios: true
      }
    });

    if (!service) return;

    await this.createNotification(
      service.profesional_id,
      NOTIFICATION_TYPES.REVIEW,
      'Nueva Reseña',
      'Has recibido una nueva valoración',
      { serviceId }
    );
  }

  async triggerUrgentServiceNotification(urgentRequestId) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: urgentRequestId },
      include: {
        client: true
      }
    });

    if (!urgentRequest) return;

    // Notificar al cliente que la solicitud fue creada
    await this.createNotification(
      urgentRequest.client_id,
      NOTIFICATION_TYPES.URGENT,
      'Servicio Urgente Solicitado',
      'Tu solicitud de servicio urgente ha sido enviada. Buscando profesionales cercanos...',
      {
        urgentRequestId,
        status: 'pending',
        description: urgentRequest.description,
        location: { lat: urgentRequest.latitude, lng: urgentRequest.longitude },
        radiusKm: urgentRequest.radius_km
      }
    );
  }

  /**
   * Notificar cuando una solicitud urgente encuentra candidatos
   */
  async triggerUrgentCandidatesFound(urgentRequestId, candidateCount) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: urgentRequestId },
      include: { client: true }
    });

    if (!urgentRequest) return;

    await this.createNotification(
      urgentRequest.client_id,
      NOTIFICATION_TYPES.URGENT,
      'Profesionales Encontrados',
      `¡Encontramos ${candidateCount} profesional(es) cerca de tu ubicación! Esperando confirmación...`,
      {
        urgentRequestId,
        candidateCount,
        status: 'searching'
      }
    );
  }

  /**
   * Notificar cuando una solicitud urgente es aceptada
   */
  async triggerUrgentRequestAccepted(urgentRequestId, professionalId, assignmentId) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: urgentRequestId },
      include: {
        client: true,
        assignments: {
          where: { id: assignmentId },
          include: { professional: true }
        }
      }
    });

    if (!urgentRequest || !urgentRequest.assignments[0]) return;

    const professional = urgentRequest.assignments[0].professional;

    await this.createNotification(
      urgentRequest.client_id,
      NOTIFICATION_TYPES.URGENT,
      '¡Servicio Urgente Aceptado!',
      `¡Excelente! ${professional.nombre} ha aceptado tu solicitud urgente y se contactará pronto.`,
      {
        urgentRequestId,
        professionalId,
        assignmentId,
        professional: {
          nombre: professional.nombre,
          telefono: professional.telefono,
          calificacion_promedio: professional.calificacion_promedio
        },
        status: 'assigned'
      }
    );
  }

  /**
   * Notificar cuando una solicitud urgente es completada
   */
  async triggerUrgentRequestCompleted(urgentRequestId, completedBy) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: urgentRequestId },
      include: {
        client: true,
        assignments: {
          include: { professional: true }
        }
      }
    });

    if (!urgentRequest) return;

    const clientId = urgentRequest.client_id;
    const professional = urgentRequest.assignments[0]?.professional;

    // Notificar al cliente
    await this.createNotification(
      clientId,
      NOTIFICATION_TYPES.URGENT,
      'Servicio Urgente Completado',
      'Tu servicio urgente ha sido completado exitosamente. ¡Gracias por usar Changanet!',
      {
        urgentRequestId,
        status: 'completed',
        completedBy,
        professional: professional ? {
          nombre: professional.nombre,
          id: professional.id
        } : null
      }
    );

    // Notificar al profesional si fue completado por el cliente
    if (completedBy === clientId && professional) {
      await this.createNotification(
        professional.id,
        NOTIFICATION_TYPES.URGENT,
        'Servicio Urgente Completado',
        'El cliente ha confirmado que el servicio urgente fue completado.',
        {
          urgentRequestId,
          status: 'completed',
          completedBy: 'client'
        }
      );
    }
  }

  /**
   * Notificar cuando una solicitud urgente es cancelada
   */
  async triggerUrgentRequestCancelled(urgentRequestId, cancelledBy, reason = null) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: urgentRequestId },
      include: {
        client: true,
        assignments: {
          include: { professional: true }
        }
      }
    });

    if (!urgentRequest) return;

    const isCancelledByClient = cancelledBy === urgentRequest.client_id;
    const recipients = [];

    if (isCancelledByClient) {
      // Cliente canceló: notificar a profesionales asignados
      urgentRequest.assignments.forEach(assignment => {
        recipients.push(assignment.professional_id);
      });
    } else {
      // Profesional canceló: notificar al cliente
      recipients.push(urgentRequest.client_id);
    }

    const message = isCancelledByClient
      ? 'El cliente ha cancelado la solicitud urgente.'
      : 'El profesional ha cancelado la asignación del servicio urgente.';

    for (const recipientId of recipients) {
      await this.createNotification(
        recipientId,
        NOTIFICATION_TYPES.URGENT,
        'Servicio Urgente Cancelado',
        message + (reason ? ` Razón: ${reason}` : ''),
        {
          urgentRequestId,
          status: 'cancelled',
          cancelledBy,
          reason
        }
      );
    }
  }

  /**
   * Notificar SLA warnings para servicios urgentes
   */
  async triggerUrgentSLAWarning(urgentRequestId, slaType, timeRemaining) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: urgentRequestId },
      include: { client: true }
    });

    if (!urgentRequest) return;

    const slaNames = {
      urgent_response: 'respuesta',
      urgent_assignment: 'asignación',
      urgent_completion: 'completación'
    };

    await this.createNotification(
      urgentRequest.client_id,
      NOTIFICATION_TYPES.URGENT,
      'Advertencia de SLA',
      `Tu solicitud urgente está próxima al límite de tiempo para ${slaNames[slaType] || slaType}. Tiempo restante: ${timeRemaining} minutos.`,
      {
        urgentRequestId,
        slaType,
        timeRemaining,
        priority: 'high'
      }
    );
  }

  /**
   * Notificar breach de SLA para servicios urgentes
   */
  async triggerUrgentSLABreach(urgentRequestId, slaType, breachDuration) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: urgentRequestId },
      include: { client: true }
    });

    if (!urgentRequest) return;

    await this.createNotification(
      urgentRequest.client_id,
      NOTIFICATION_TYPES.URGENT,
      'SLA Excedido - Acción Requerida',
      `Tu solicitud urgente ha excedido el tiempo límite establecido. Contacta al soporte si necesitas asistencia.`,
      {
        urgentRequestId,
        slaType,
        breachDuration,
        priority: 'critical'
      }
    );
  }

  // ===========================================
  // MÉTODOS DE UTILIDAD Y NUEVAS FUNCIONALIDADES
  // ===========================================

  // Sanitizar contenido para prevenir XSS
  sanitizeContent(content) {
    if (!content) return content;

    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .trim();
  }

  // Obtener canales por defecto según prioridad
  getDefaultChannelsForPriority(priority) {
    const channelMap = {
      [NOTIFICATION_PRIORITY.LOW]: ['inapp'],
      [NOTIFICATION_PRIORITY.MEDIUM]: ['inapp', 'push'],
      [NOTIFICATION_PRIORITY.HIGH]: ['inapp', 'push', 'email'],
      [NOTIFICATION_PRIORITY.CRITICAL]: ['inapp', 'push', 'email', 'sms']
    };

    return channelMap[priority] || ['inapp', 'push'];
  }

  // Enviar notificación SMS
  async sendSMSNotification(notification) {
    try {
      const { sendSMS } = require('./smsService');

      const user = await prisma.usuarios.findUnique({
        where: { id: notification.usuario_id },
        select: { telefono: true }
      });

      if (!user?.telefono) {
        console.log(`Usuario ${notification.usuario_id} no tiene teléfono registrado`);
        return false;
      }

      // Generar contenido SMS usando plantilla
      const smsTemplate = generateNotification(notification.tipo, 'sms', JSON.parse(notification.data || '{}'));
      const smsContent = smsTemplate.sms || notification.mensaje;

      await sendSMS(user.telefono, smsContent);

      await this.updateNotificationStatus(notification.id, NOTIFICATION_STATUS.DELIVERED);
      return true;
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      await this.updateNotificationStatus(notification.id, NOTIFICATION_STATUS.FAILED);
      return false;
    }
  }

  // Registrar métricas de notificación
  recordNotificationMetric(userId, type, priority, channels) {
    try {
      // En una implementación completa, esto enviaría métricas a un servicio de analytics
      console.log(`📊 Notification metric: User ${userId}, Type: ${type}, Priority: ${priority}, Channels: ${channels.join(',')}`);
    } catch (error) {
      console.error('Error recording notification metric:', error);
    }
  }

  // Obtener notificaciones con filtros avanzados
  async getFilteredNotifications(userId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      type,
      priority,
      status = NOTIFICATION_STATUS.UNREAD,
      dateFrom,
      dateTo
    } = filters;

    const skip = (page - 1) * limit;
    const where = { usuario_id: userId };

    if (type) where.tipo = type;
    if (priority) where.prioridad = priority;
    if (status) where.estado = status;
    if (dateFrom || dateTo) {
      where.creado_en = {};
      if (dateFrom) where.creado_en.gte = new Date(dateFrom);
      if (dateTo) where.creado_en.lte = new Date(dateTo);
    }

    const [notifications, total] = await Promise.all([
      prisma.notificaciones.findMany({
        where,
        orderBy: { creado_en: 'desc' },
        skip,
        take: limit
      }),
      prisma.notificaciones.count({ where })
    ]);

    return {
      notifications: notifications.map(n => ({
        ...n,
        data: JSON.parse(n.data || '{}')
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Marcar notificaciones como leídas por tipo
  async markTypeAsRead(userId, type) {
    const result = await prisma.notificaciones.updateMany({
      where: {
        usuario_id: userId,
        tipo: type,
        estado: NOTIFICATION_STATUS.UNREAD
      },
      data: {
        estado: NOTIFICATION_STATUS.READ,
        leido_en: new Date()
      }
    });

    // Invalidar caché
    invalidateNotificationCache(userId);

    // Emitir evento WebSocket
    if (webSocketService) {
      const unreadCount = await this.getUnreadCount(userId);
      webSocketService.emitToUser(userId, 'notification:type-read', {
        type,
        unreadCount
      });
    }

    return result;
  }

  // Obtener estadísticas de notificaciones
  async getNotificationStats(userId) {
    const stats = await prisma.notificaciones.groupBy({
      by: ['tipo', 'estado', 'prioridad'],
      where: { usuario_id: userId },
      _count: true
    });

    const result = {
      total: 0,
      byType: {},
      byStatus: {},
      byPriority: {},
      unread: 0
    };

    stats.forEach(stat => {
      result.total += stat._count;

      // Por tipo
      if (!result.byType[stat.tipo]) result.byType[stat.tipo] = 0;
      result.byType[stat.tipo] += stat._count;

      // Por estado
      if (!result.byStatus[stat.estado]) result.byStatus[stat.estado] = 0;
      result.byStatus[stat.estado] += stat._count;

      // Por prioridad
      if (!result.byPriority[stat.prioridad]) result.byPriority[stat.prioridad] = 0;
      result.byPriority[stat.prioridad] += stat._count;

      // Contar no leídas
      if (stat.estado === NOTIFICATION_STATUS.UNREAD) {
        result.unread += stat._count;
      }
    });

    return result;
  }
}

module.exports = {
  NotificationService,
  setWebSocketService,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
  NOTIFICATION_PRIORITY
};