/**
 * Servicio de liberación automática de fondos
 * Implementa RB-04: Liberación automática después de X días
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('./logger');

/**
 * Libera automáticamente fondos de pagos aprobados que han pasado el período de custodia
 * Se ejecuta periódicamente (cada hora) según RB-04
 */
async function autoReleaseFunds() {
  try {
    const now = new Date();

    // Buscar pagos aprobados que han pasado 24 horas desde la aprobación
    // RB-04: Los pagos en custodia se liberan tras 24h de inactividad o confirmación manual
    const paymentsToRelease = await prisma.pagos.findMany({
      where: {
        estado: 'aprobado',
        fecha_liberacion_programada: {
          lte: now // Fecha programada <= ahora
        }
      },
      include: {
        servicio: {
          include: {
            cliente: true,
            profesional: true
          }
        }
      }
    });

    let releasedCount = 0;
    let errors = [];

    for (const payment of paymentsToRelease) {
      try {
        await releasePaymentFunds(payment);
        releasedCount++;
      } catch (error) {
        errors.push({
          paymentId: payment.id,
          error: error.message
        });
        logger.error('Error liberando fondos automáticamente', {
          service: 'auto_release',
          paymentId: payment.id,
          error: error.message
        });
      }
    }

    logger.info('Liberación automática de fondos completada', {
      service: 'auto_release',
      paymentsFound: paymentsToRelease.length,
      paymentsReleased: releasedCount,
      errors: errors.length
    });

    return {
      success: true,
      paymentsProcessed: paymentsToRelease.length,
      paymentsReleased: releasedCount,
      errors
    };

  } catch (error) {
    logger.error('Error en liberación automática de fondos', {
      service: 'auto_release',
      error: error.message
    });
    throw error;
  }
}

/**
 * Libera fondos de un pago específico
 */
async function releasePaymentFunds(payment) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // Verificar que el servicio esté completado
    if (payment.servicio.estado !== 'completado') {
      throw new Error('El servicio debe estar completado para liberar fondos');
    }

    // Calcular comisión usando el servicio de comisiones
    const { calculateCommission } = require('./commissionService');
    const commissionCalc = await calculateCommission(payment.monto_total);

    const commission = commissionCalc.commission_amount;
    const professionalAmount = commissionCalc.professional_amount;

    // Actualizar estado a liberado con comisión calculada
    await prisma.pagos.update({
      where: { id: payment.id },
      data: {
        estado: 'liberado',
        fecha_liberacion: new Date(),
        comision_plataforma: commission,
        monto_profesional: professionalAmount
      }
    });

    // Actualizar servicio a pagado
    await prisma.servicios.update({
      where: { id: payment.servicio.id },
      data: {
        estado: 'pagado',
        completado_en: new Date()
      }
    });

    // Notificar al profesional
    const { createNotification } = require('./notificationService');
    await createNotification(
      payment.profesional_id,
      'fondos_liberados_auto',
      `¡Fondos liberados automáticamente! Recibiste $${professionalAmount} (comisión $${commission} deducida). Servicio completado.`,
      {
        payment_id: payment.id,
        amount: professionalAmount,
        commission,
        auto_released: true
      }
    );

    // Registrar en auditoría
    await prisma.audit_log.create({
      data: {
        user_id: null, // Sistema automático
        action: 'auto_fund_release',
        resource: 'pagos',
        resource_id: payment.id,
        details: JSON.stringify({
          commission_applied: commission,
          professional_amount: professionalAmount,
          auto_release: true
        })
      }
    });

    logger.info('Fondos liberados automáticamente', {
      service: 'auto_release',
      paymentId: payment.id,
      professionalAmount,
      commission
    });

    return {
      success: true,
      paymentId: payment.id,
      professionalAmount,
      commission
    };

  } catch (error) {
    logger.error('Error liberando fondos de pago', {
      service: 'auto_release',
      paymentId: payment.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Verifica pagos próximos a liberar (para notificaciones)
 */
async function checkUpcomingReleases() {
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Pagos que se liberarán en las próximas 24 horas
    const upcomingReleases = await prisma.pagos.findMany({
      where: {
        estado: 'aprobado',
        fecha_liberacion_programada: {
          gte: now,
          lte: in24Hours
        }
      },
      include: {
        servicio: {
          include: {
            cliente: true,
            profesional: true
          }
        }
      }
    });

    // Notificar a profesionales sobre liberación próxima
    for (const payment of upcomingReleases) {
      const hoursLeft = Math.round((payment.fecha_liberacion_programada - now) / (1000 * 60 * 60));

      const { createNotification } = require('./notificationService');
      await createNotification(
        payment.profesional_id,
        'fondos_liberacion_proxima',
        `Los fondos de $${payment.monto_total} se liberarán automáticamente en ${hoursLeft} horas.`,
        {
          payment_id: payment.id,
          release_date: payment.fecha_liberacion_programada,
          hours_left: hoursLeft
        }
      );
    }

    logger.info('Notificaciones de liberación próxima enviadas', {
      service: 'auto_release',
      notificationsSent: upcomingReleases.length
    });

    return {
      success: true,
      notificationsSent: upcomingReleases.length
    };

  } catch (error) {
    logger.error('Error verificando liberaciones próximas', {
      service: 'auto_release',
      error: error.message
    });
    throw error;
  }
}

/**
 * Función para ser llamada por el scheduler/cron
 */
async function scheduledAutoRelease() {
  try {
    // Ejecutar liberación automática
    const releaseResult = await autoReleaseFunds();

    // Verificar liberaciones próximas
    const upcomingResult = await checkUpcomingReleases();

    return {
      releaseResult,
      upcomingResult
    };

  } catch (error) {
    logger.error('Error en liberación automática programada', {
      service: 'auto_release',
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  autoReleaseFunds,
  releasePaymentFunds,
  checkUpcomingReleases,
  scheduledAutoRelease
};