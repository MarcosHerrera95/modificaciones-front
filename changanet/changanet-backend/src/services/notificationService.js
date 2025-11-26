const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  ADMIN: 'admin'
};

// Canales de notificación
const NOTIFICATION_CHANNELS = {
  INAPP: 'inapp',
  PUSH: 'push',
  EMAIL: 'email'
};

// Estados de notificación
const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  READ: 'read',
  DELIVERED: 'delivered',
  FAILED: 'failed'
};

class NotificationService {
  // Crear notificación
  async createNotification(userId, type, title, message, data = {}, channel = 'inapp') {
    try {
      const notification = await prisma.notificaciones.create({
        data: {
          usuario_id: userId,
          tipo: type,
          titulo: title,
          mensaje: message,
          data: JSON.stringify(data),
          canal: channel,
          estado: NOTIFICATION_STATUS.UNREAD,
          creado_en: new Date()
        }
      });

      // Enviar a canales según preferencias
      await this.sendToChannels(notification);

      // Emitir evento WebSocket para actualización en tiempo real
      if (webSocketService) {
        const unreadCount = await this.getUnreadCount(userId);
        webSocketService.emitToUser(userId, 'notification:new', {
          notification: {
            ...notification,
            data: JSON.parse(notification.data)
          },
          unreadCount
        });
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Enviar notificación a múltiples canales
  async sendToChannels(notification) {
    const preferences = await this.getUserPreferences(notification.usuario_id, notification.tipo);

    if (preferences.inapp && notification.canal === 'inapp') {
      // Ya está en BD para in-app
    }

    if (preferences.push) {
      await this.sendPushNotification(notification);
    }

    if (preferences.email) {
      await this.sendEmailNotification(notification);
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

  // Contador de notificaciones no leídas
  async getUnreadCount(userId) {
    return await prisma.notificaciones.count({
      where: {
        usuario_id: userId,
        estado: NOTIFICATION_STATUS.UNREAD
      }
    });
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

    // Notificar a profesionales cercanos (lógica simplificada)
    // En implementación real, buscar profesionales por ubicación
    await this.createNotification(
      urgentRequest.client_id,
      NOTIFICATION_TYPES.URGENT,
      'Servicio Urgente',
      'Tu solicitud de servicio urgente ha sido enviada',
      { urgentRequestId }
    );
  }
}

module.exports = {
  NotificationService,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
  setWebSocketService
};