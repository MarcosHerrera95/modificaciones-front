const { NotificationService, NOTIFICATION_TYPES } = require('./notificationService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class NotificationEventHandler {
  constructor() {
    this.notificationService = new NotificationService();
  }

  // Evento: Nuevo mensaje
  async handleNewMessage(messageId) {
    try {
      await this.notificationService.triggerMessageNotification(messageId);
    } catch (error) {
      console.error('Error handling new message notification:', error);
    }
  }

  // Evento: Servicio aceptado
  async handleServiceAccepted(serviceId) {
    try {
      await this.notificationService.triggerServiceNotification(serviceId, 'accepted');
    } catch (error) {
      console.error('Error handling service accepted notification:', error);
    }
  }

  // Evento: Servicio completado
  async handleServiceCompleted(serviceId) {
    try {
      await this.notificationService.triggerServiceNotification(serviceId, 'completed');
    } catch (error) {
      console.error('Error handling service completed notification:', error);
    }
  }

  // Evento: Pago confirmado
  async handlePaymentConfirmed(serviceId) {
    try {
      await this.notificationService.triggerPaymentNotification(serviceId, 'confirmed');
    } catch (error) {
      console.error('Error handling payment confirmed notification:', error);
    }
  }

  // Evento: Pago liberado
  async handlePaymentReleased(serviceId) {
    try {
      await this.notificationService.triggerPaymentNotification(serviceId, 'released');
    } catch (error) {
      console.error('Error handling payment released notification:', error);
    }
  }

  // Evento: Nueva reseña
  async handleNewReview(serviceId) {
    try {
      await this.notificationService.triggerReviewNotification(serviceId);
    } catch (error) {
      console.error('Error handling new review notification:', error);
    }
  }

  // Evento: Servicio urgente solicitado
  async handleUrgentServiceRequested(urgentRequestId) {
    try {
      await this.notificationService.triggerUrgentServiceNotification(urgentRequestId);
    } catch (error) {
      console.error('Error handling urgent service notification:', error);
    }
  }

  // Evento: Recordatorio de agenda (se ejecuta periódicamente)
  async handleAppointmentReminder() {
    try {
      // Buscar citas en las próximas 2 horas
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const upcomingAppointments = await prisma.appointments.findMany({
        where: {
          start_datetime: {
            gte: now,
            lte: twoHoursFromNow
          },
          status: 'confirmed'
        },
        include: {
          professional: { select: { id: true, nombre: true } },
          client: { select: { id: true, nombre: true } }
        }
      });

      for (const appointment of upcomingAppointments) {
        // Notificar al profesional
        await this.notificationService.createNotification(
          appointment.professional_id,
          NOTIFICATION_TYPES.SYSTEM,
          'Recordatorio de Cita',
          `Tienes una cita programada en 2 horas con ${appointment.client.nombre}`,
          { appointmentId: appointment.id }
        );

        // Notificar al cliente
        await this.notificationService.createNotification(
          appointment.client_id,
          NOTIFICATION_TYPES.SYSTEM,
          'Recordatorio de Cita',
          `Tu cita con ${appointment.professional.nombre} es en 2 horas`,
          { appointmentId: appointment.id }
        );
      }
    } catch (error) {
      console.error('Error handling appointment reminders:', error);
    }
  }

  // Evento: Nueva solicitud de presupuesto
  async handleNewQuoteRequest(quoteId) {
    try {
      const quote = await prisma.cotizaciones.findUnique({
        where: { id: quoteId },
        include: {
          usuarios: { select: { id: true, nombre: true } }
        }
      });

      if (!quote) return;

      // Notificar al cliente que su solicitud fue enviada
      await this.notificationService.createNotification(
        quote.cliente_id,
        NOTIFICATION_TYPES.SYSTEM,
        'Solicitud de Presupuesto Enviada',
        'Tu solicitud de presupuesto ha sido enviada a los profesionales seleccionados',
        { quoteId }
      );

      // Aquí se podría notificar a los profesionales preseleccionados
      // (depende de cómo esté implementado el sistema de distribución)
    } catch (error) {
      console.error('Error handling new quote request notification:', error);
    }
  }

  // Evento: Nueva oferta de presupuesto
  async handleNewQuoteOffer(offerId) {
    try {
      // Dependiendo del modelo BudgetOffer
      const offer = await prisma.BudgetOffer.findUnique({
        where: { id: offerId },
        include: {
          request: {
            include: {
              client: { select: { id: true, nombre: true } }
            }
          },
          professional: {
            include: {
              usuarios: { select: { id: true, nombre: true } }
            }
          }
        }
      });

      if (!offer) return;

      // Notificar al cliente
      await this.notificationService.createNotification(
        offer.request.clientId,
        NOTIFICATION_TYPES.SYSTEM,
        'Nueva Oferta de Presupuesto',
        `${offer.professional.usuarios.nombre} ha enviado una oferta para tu solicitud`,
        { offerId, requestId: offer.requestId }
      );
    } catch (error) {
      console.error('Error handling new quote offer notification:', error);
    }
  }

  // Evento: Verificación de identidad aprobada
  async handleIdentityVerificationApproved(userId) {
    try {
      const user = await prisma.usuarios.findUnique({
        where: { id: userId },
        select: { nombre: true }
      });

      if (!user) return;

      await this.notificationService.createNotification(
        userId,
        NOTIFICATION_TYPES.SYSTEM,
        'Verificación Aprobada',
        '¡Felicitaciones! Tu verificación de identidad ha sido aprobada',
        {}
      );
    } catch (error) {
      console.error('Error handling identity verification approved notification:', error);
    }
  }

  // Método genérico para crear notificaciones del sistema
  async createSystemNotification(userId, title, message, data = {}) {
    try {
      await this.notificationService.createNotification(
        userId,
        NOTIFICATION_TYPES.SYSTEM,
        title,
        message,
        data
      );
    } catch (error) {
      console.error('Error creating system notification:', error);
    }
  }

  // Método para notificaciones administrativas
  async createAdminNotification(userIds, title, message, data = {}) {
    try {
      if (Array.isArray(userIds)) {
        for (const userId of userIds) {
          await this.notificationService.createNotification(
            userId,
            NOTIFICATION_TYPES.ADMIN,
            title,
            message,
            data
          );
        }
      } else {
        await this.notificationService.createNotification(
          userIds,
          NOTIFICATION_TYPES.ADMIN,
          title,
          message,
          data
        );
      }
    } catch (error) {
      console.error('Error creating admin notification:', error);
    }
  }
}

module.exports = new NotificationEventHandler();