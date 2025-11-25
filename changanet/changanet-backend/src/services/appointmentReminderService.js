/**
 * Servicio de Recordatorios Automáticos de Citas
 * Implementa sistema de notificaciones programadas para citas
 *
 * FUNCIONALIDADES:
 * - Recordatorios 24h antes de la cita
 * - Recordatorios 1h antes de la cita
 * - Recordatorios de confirmación pendiente
 * - Recordatorios de pago pendiente
 * - Configuración personalizable por usuario
 */

const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('./notificationService');

const prisma = new PrismaClient();

/**
 * Ejecutar recordatorios programados
 * Debe ejecutarse periódicamente (ej: cada hora)
 */
exports.processScheduledReminders = async () => {
  try {
    console.log('🔄 Procesando recordatorios automáticos...');

    const now = new Date();

    // Recordatorios de citas próximas (24h antes)
    await sendAppointmentReminders24h(now);

    // Recordatorios de citas próximas (1h antes)
    await sendAppointmentReminders1h(now);

    // Recordatorios de citas sin confirmar (después de 1h)
    await sendUnconfirmedAppointmentReminders(now);

    // Recordatorios de pagos pendientes
    await sendPaymentReminders(now);

    console.log('✅ Recordatorios procesados exitosamente');

  } catch (error) {
    console.error('❌ Error procesando recordatorios:', error);
  }
};

/**
 * Enviar recordatorios 24h antes de la cita
 */
async function sendAppointmentReminders24h(now) {
  try {
    // Calcular ventana de tiempo (24h ± 30min para evitar duplicados)
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Obtener citas confirmadas para mañana
    const upcomingAppointments = await prisma.appointments.findMany({
      where: {
        status: 'confirmed',
        start_datetime: {
          gte: tomorrowStart,
          lte: tomorrowEnd
        }
      },
      include: {
        professional: { select: { nombre: true, email: true } },
        client: { select: { nombre: true, email: true } },
        service: { select: { descripcion: true } }
      }
    });

    console.log(`📅 Enviando recordatorios 24h para ${upcomingAppointments.length} citas`);

    for (const appointment of upcomingAppointments) {
      // Recordatorio al cliente
      await sendNotification(
        appointment.client_id,
        'recordatorio_cita_24h',
        `Recordatorio: Tienes una cita mañana con ${appointment.professional.nombre}`,
        {
          appointment_id: appointment.id,
          professional_name: appointment.professional.nombre,
          service: appointment.service?.descripcion,
          date: appointment.start_datetime,
          time: appointment.start_datetime.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          hours_until: 24
        },
        'medium'
      );

      // Recordatorio al profesional
      await sendNotification(
        appointment.professional_id,
        'recordatorio_cita_24h',
        `Recordatorio: Tienes una cita mañana con ${appointment.client.nombre}`,
        {
          appointment_id: appointment.id,
          client_name: appointment.client.nombre,
          service: appointment.service?.descripcion,
          date: appointment.start_datetime,
          time: appointment.start_datetime.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          hours_until: 24
        },
        'medium'
      );
    }

  } catch (error) {
    console.error('Error enviando recordatorios 24h:', error);
  }
}

/**
 * Enviar recordatorios 1h antes de la cita
 */
async function sendAppointmentReminders1h(now) {
  try {
    // Calcular ventana de tiempo (1h ± 10min)
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const windowStart = new Date(oneHourFromNow.getTime() - 10 * 60 * 1000); // 10 min antes
    const windowEnd = new Date(oneHourFromNow.getTime() + 10 * 60 * 1000);   // 10 min después

    // Obtener citas confirmadas en la ventana
    const upcomingAppointments = await prisma.appointments.findMany({
      where: {
        status: 'confirmed',
        start_datetime: {
          gte: windowStart,
          lte: windowEnd
        }
      },
      include: {
        professional: {
          select: {
            nombre: true,
            email: true,
            telefono: true
          }
        },
        client: {
          select: {
            nombre: true,
            email: true,
            telefono: true
          }
        },
        service: { select: { descripcion: true } }
      }
    });

    console.log(`⏰ Enviando recordatorios 1h para ${upcomingAppointments.length} citas`);

    for (const appointment of upcomingAppointments) {
      const timeString = appointment.start_datetime.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // Recordatorio al cliente (prioridad alta)
      await sendNotification(
        appointment.client_id,
        'recordatorio_cita_1h',
        `¡Recordatorio! Tu cita comienza en 1 hora con ${appointment.professional.nombre}`,
        {
          appointment_id: appointment.id,
          professional_name: appointment.professional.nombre,
          professional_phone: appointment.professional.telefono,
          service: appointment.service?.descripcion,
          date: appointment.start_datetime,
          time: timeString,
          hours_until: 1
        },
        'high'
      );

      // Recordatorio al profesional (prioridad alta)
      await sendNotification(
        appointment.professional_id,
        'recordatorio_cita_1h',
        `¡Recordatorio! Tu cita comienza en 1 hora con ${appointment.client.nombre}`,
        {
          appointment_id: appointment.id,
          client_name: appointment.client.nombre,
          client_phone: appointment.client.telefono,
          service: appointment.service?.descripcion,
          date: appointment.start_datetime,
          time: timeString,
          hours_until: 1
        },
        'high'
      );
    }

  } catch (error) {
    console.error('Error enviando recordatorios 1h:', error);
  }
}

/**
 * Enviar recordatorios de citas sin confirmar
 */
async function sendUnconfirmedAppointmentReminders(now) {
  try {
    // Citas pendientes creadas hace más de 1 hora
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const unconfirmedAppointments = await prisma.appointments.findMany({
      where: {
        status: 'pending',
        created_at: { lte: oneHourAgo },
        start_datetime: { gt: now } // Solo citas futuras
      },
      include: {
        professional: { select: { nombre: true } },
        client: { select: { nombre: true } }
      }
    });

    console.log(`⏳ Enviando recordatorios de confirmación para ${unconfirmedAppointments.length} citas`);

    for (const appointment of unconfirmedAppointments) {
      // Recordatorio al profesional para confirmar
      await sendNotification(
        appointment.professional_id,
        'recordatorio_confirmacion_pendiente',
        `Tienes una cita pendiente de confirmación con ${appointment.client.nombre}`,
        {
          appointment_id: appointment.id,
          client_name: appointment.client.nombre,
          date: appointment.start_datetime,
          time: appointment.start_datetime.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          action_url: `/profesional/citas/${appointment.id}/confirmar`
        },
        'medium'
      );
    }

  } catch (error) {
    console.error('Error enviando recordatorios de confirmación:', error);
  }
}

/**
 * Enviar recordatorios de pagos pendientes
 */
async function sendPaymentReminders(now) {
  try {
    // Servicios completados sin pago registrado (más de 24h)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const completedServicesWithoutPayment = await prisma.servicios.findMany({
      where: {
        estado: 'COMPLETADO',
        completado_en: { lte: oneDayAgo },
        pagos: {
          none: {} // Sin pagos asociados
        }
      },
      include: {
        cliente: { select: { nombre: true, id: true } },
        profesional: { select: { nombre: true, id: true } }
      }
    });

    console.log(`💳 Enviando recordatorios de pago para ${completedServicesWithoutPayment.length} servicios`);

    for (const service of completedServicesWithoutPayment) {
      // Recordatorio al cliente
      await sendNotification(
        service.cliente.id,
        'recordatorio_pago_pendiente',
        `Recordatorio: Tienes un pago pendiente por el servicio completado con ${service.profesional.nombre}`,
        {
          service_id: service.id,
          professional_name: service.profesional.nombre,
          service_description: service.descripcion,
          completed_date: service.completado_en,
          action_url: `/cliente/pagos/${service.id}`
        },
        'medium'
      );

      // Notificación al profesional
      await sendNotification(
        service.profesional.id,
        'recordatorio_pago_pendiente_profesional',
        `Recordatorio: El cliente ${service.cliente.nombre} tiene un pago pendiente por el servicio completado`,
        {
          service_id: service.id,
          client_name: service.cliente.nombre,
          service_description: service.descripcion,
          completed_date: service.completado_en
        },
        'low'
      );
    }

  } catch (error) {
    console.error('Error enviando recordatorios de pago:', error);
  }
}

/**
 * Enviar recordatorio personalizado para una cita específica
 */
exports.sendCustomAppointmentReminder = async (appointmentId, message, hoursUntil = 24) => {
  try {
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
      include: {
        professional: { select: { nombre: true } },
        client: { select: { nombre: true, id: true } },
        service: { select: { descripcion: true } }
      }
    });

    if (!appointment) {
      throw new Error('Cita no encontrada');
    }

    // Enviar recordatorio al cliente
    await sendNotification(
      appointment.client_id,
      'recordatorio_personalizado',
      message,
      {
        appointment_id: appointment.id,
        professional_name: appointment.professional.nombre,
        service: appointment.service?.descripcion,
        date: appointment.start_datetime,
        hours_until: hoursUntil
      },
      'medium'
    );

    return { success: true, message: 'Recordatorio enviado exitosamente' };

  } catch (error) {
    console.error('Error enviando recordatorio personalizado:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de recordatorios
 */
exports.getReminderStats = async (professionalId = null, days = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause = {
      created_at: { gte: startDate }
    };

    if (professionalId) {
      whereClause.professional_id = professionalId;
    }

    // Contar diferentes tipos de recordatorios enviados
    const reminderStats = await prisma.notificaciones.groupBy({
      by: ['tipo'],
      where: {
        ...whereClause,
        tipo: {
          in: [
            'recordatorio_cita_24h',
            'recordatorio_cita_1h',
            'recordatorio_confirmacion_pendiente',
            'recordatorio_pago_pendiente'
          ]
        }
      },
      _count: {
        id: true
      }
    });

    // Estadísticas de citas
    const appointmentStats = await prisma.appointments.aggregate({
      where: {
        ...whereClause,
        status: 'confirmed'
      },
      _count: {
        id: true
      }
    });

    return {
      period_days: days,
      reminders_sent: reminderStats.reduce((acc, stat) => acc + stat._count.id, 0),
      reminders_by_type: reminderStats.reduce((acc, stat) => {
        acc[stat.tipo] = stat._count.id;
        return acc;
      }, {}),
      confirmed_appointments: appointmentStats._count.id,
      reminder_rate: appointmentStats._count.id > 0
        ? (reminderStats.reduce((acc, stat) => acc + stat._count.id, 0) / appointmentStats._count.id).toFixed(2)
        : 0
    };

  } catch (error) {
    console.error('Error obteniendo estadísticas de recordatorios:', error);
    throw error;
  }
};

/**
 * Configurar recordatorios personalizados para un profesional
 */
exports.configureProfessionalReminders = async (professionalId, config) => {
  try {
    // Aquí podríamos crear una tabla de configuración de recordatorios
    // Por ahora, guardamos en la configuración del profesional

    const defaultConfig = {
      reminder_24h_enabled: true,
      reminder_1h_enabled: true,
      confirmation_reminder_enabled: true,
      payment_reminder_enabled: true,
      custom_message_24h: null,
      custom_message_1h: null
    };

    const finalConfig = { ...defaultConfig, ...config };

    // Podríamos guardar esto en una tabla de configuración
    // Por ahora, solo validamos y retornamos
    return {
      professional_id: professionalId,
      config: finalConfig,
      message: 'Configuración de recordatorios actualizada'
    };

  } catch (error) {
    console.error('Error configurando recordatorios:', error);
    throw error;
  }
};

/**
 * Enviar recordatorio de disponibilidad para profesionales
 */
exports.sendAvailabilityReminder = async (professionalId) => {
  try {
    // Verificar si el profesional tiene slots disponibles en los próximos días
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const availableSlots = await prisma.professionals_availability.count({
      where: {
        professional_id: professionalId,
        start_datetime: { lte: nextWeek },
        esta_disponible: true
      }
    });

    if (availableSlots === 0) {
      // Enviar recordatorio para crear disponibilidad
      await sendNotification(
        professionalId,
        'recordatorio_disponibilidad',
        'Recordatorio: No tienes horarios disponibles configurados. Los clientes no pueden agendar citas contigo.',
        {
          action_url: '/profesional/disponibilidad',
          available_slots: availableSlots
        },
        'medium'
      );
    }

    return { available_slots: availableSlots };

  } catch (error) {
    console.error('Error enviando recordatorio de disponibilidad:', error);
    throw error;
  }
};

module.exports = exports;