/**
 * Servicio de integración con Mercado Pago
 * REQ-41: Integración real con pasarelas de pago
 */

const mercadopago = require('mercadopago');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurar Mercado Pago con access token
let isConfigured = null;
const configureMercadoPago = () => {
  if (isConfigured !== null) return isConfigured;

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    console.warn('⚠️ MERCADO_PAGO_ACCESS_TOKEN no configurado - pagos simulados');
    isConfigured = false;
    return false;
  }

  try {
    mercadopago.configure({
      access_token: accessToken
    });
    console.log('✅ Mercado Pago configurado correctamente');
    isConfigured = true;
    return true;
  } catch (error) {
    console.error('❌ Error configurando Mercado Pago:', error.message);
    isConfigured = false;
    return false;
  }
};

/**
 * Crear preferencia de pago para un servicio
 * @param {Object} paymentData - Datos del pago
 * @param {string} paymentData.serviceId - ID del servicio
 * @param {number} paymentData.amount - Monto total
 * @param {string} paymentData.description - Descripción del servicio
 * @param {Object} paymentData.client - Datos del cliente
 * @param {Object} paymentData.professional - Datos del profesional
 */
exports.createPaymentPreference = async (paymentData) => {
  try {
    const { serviceId, amount, description, client, professional } = paymentData;

    if (!configureMercadoPago()) {
      // Modo simulado para desarrollo
      console.log('🧪 MODO SIMULADO: Creando preferencia de pago simulada');
      return {
        id: `sim_${Date.now()}`,
        init_point: `http://localhost:5173/payment/success?payment_id=sim_${Date.now()}`,
        sandbox_init_point: `http://localhost:5173/payment/success?payment_id=sim_${Date.now()}`,
        simulated: true
      };
    }

    // Según RB-03: La comisión se cobra solo si el servicio se completa
    // No deducimos comisión en la creación del pago, se calculará al liberar fondos
    const commission = 0; // Se calculará al completar el servicio
    const professionalAmount = amount; // Monto completo inicialmente

    // Crear preferencia de pago
    const preference = {
      items: [
        {
          id: serviceId,
          title: description,
          description: `Servicio profesional: ${description}`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: amount
        }
      ],
      payer: {
        name: client.nombre,
        email: client.email,
        identification: {
          type: 'DNI',
          number: client.dni || '12345678'
        }
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success`,
        failure: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/failure`,
        pending: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/pending`
      },
      auto_return: 'approved',
      external_reference: serviceId,
      notification_url: `${process.env.BACKEND_URL || 'http://localhost:3002'}/api/payments/webhook`,
      metadata: {
        service_id: serviceId,
        client_id: client.id,
        professional_id: professional.id,
        commission: commission,
        professional_amount: professionalAmount
      }
    };

    const response = await mercadopago.preferences.create(preference);

    console.log(`💳 Preferencia de pago creada: ${response.body.id} para servicio ${serviceId}`);

    return {
      id: response.body.id,
      init_point: response.body.init_point,
      sandbox_init_point: response.body.sandbox_init_point,
      simulated: false
    };

  } catch (error) {
    console.error('Error creando preferencia de pago:', error);
    throw new Error('No se pudo crear la preferencia de pago');
  }
};

/**
 * Procesar webhook de Mercado Pago con manejo mejorado de estados
 * @param {Object} paymentData - Datos del pago desde webhook
 */
exports.processPaymentWebhook = async (paymentData) => {
  try {
    const { id, status, external_reference, transaction_amount, status_detail, date_approved, payment_type_id } = paymentData;

    console.log(`💳 Webhook recibido - Pago ${id}: ${status} (${status_detail})`);

    // Mapear estados de MercadoPago a nuestros enums
    const statusMapping = {
      'approved': 'APROBADO',
      'pending': 'PENDIENTE',
      'in_process': 'PENDIENTE',
      'rejected': 'FALLIDO',
      'cancelled': 'CANCELADO',
      'refunded': 'REEMBOLSADO',
      'charged_back': 'FALLIDO',
      'expired': 'EXPIRADO'
    };

    const mappedStatus = statusMapping[status] || 'FALLIDO';

    // Buscar pago por servicio_id (external_reference)
    const payment = await prisma.pagos.findUnique({
      where: { servicio_id: external_reference },
      include: {
        servicios: {
          include: {
            cliente: true,
            profesional: true
          }
        }
      }
    });

    if (!payment) {
      console.warn(`Pago no encontrado para servicio ${external_reference}`);
      return { success: false, error: 'Payment not found' };
    }

    // Actualizar pago con información detallada
    const updateData = {
      estado: mappedStatus,
      mercado_pago_id: id.toString(),
      metodo_pago: payment_type_id || 'mercadopago',
      webhook_procesado: true,
      ultimo_webhook_procesado_en: new Date(),
      intentos_webhook: { increment: 1 }
    };

    // Agregar fecha de pago si está aprobado
    if (status === 'approved' && date_approved) {
      updateData.fecha_pago = new Date(date_approved);

      // Programar liberación automática de fondos en 24 horas (RB-04)
      const releaseDate = new Date();
      releaseDate.setHours(releaseDate.getHours() + 24);
      updateData.fecha_liberacion_programada = releaseDate;
    }

    // Agregar metadata adicional del webhook
    updateData.metadata = {
      webhook_status: status,
      webhook_status_detail: status_detail,
      webhook_transaction_amount: transaction_amount,
      webhook_date_approved: date_approved,
      processed_at: new Date().toISOString()
    };

    await prisma.pagos.update({
      where: { id: payment.id },
      data: updateData
    });

    // Crear evento de pago para auditoría
    await prisma.eventos_pagos.create({
      data: {
        pago_id: payment.id,
        tipo_evento: `webhook_${status}`,
        datos: paymentData,
        procesado: true,
        procesado_en: new Date()
      }
    });

    // Manejar notificaciones según estado
    await handlePaymentStatusNotification(payment, mappedStatus, updateData.fecha_liberacion_programada);

    console.log(`✅ Pago procesado: ${payment.id} - Estado: ${mappedStatus}`);
    return { success: true, status: mappedStatus };

  } catch (error) {
    console.error('Error procesando webhook de pago:', error);
    throw error;
  }
};

/**
 * Manejar notificaciones según estado del pago
 */
async function handlePaymentStatusNotification(payment, status, releaseDate) {
  const { createNotification } = require('./notificationService');

  switch (status) {
    case 'APROBADO':
      // Notificar profesional - fondos en custodia
      await createNotification(
        payment.profesional_id,
        'pago_aprobado',
        `¡Pago aprobado! Los fondos estarán disponibles automáticamente en 24 horas. Monto total: $${payment.monto_total}`,
        {
          payment_id: payment.id,
          release_date: releaseDate,
          amount: payment.monto_total
        }
      );

      // Notificar cliente
      await createNotification(
        payment.cliente_id,
        'pago_confirmado',
        `Tu pago ha sido aprobado. El profesional comenzará a trabajar pronto.`,
        {
          payment_id: payment.id,
          service_id: payment.servicio_id
        }
      );
      break;

    case 'FALLIDO':
      // Notificar cliente del fallo
      await createNotification(
        payment.cliente_id,
        'pago_fallido',
        `Tu pago no pudo ser procesado. Por favor, intenta nuevamente.`,
        {
          payment_id: payment.id,
          service_id: payment.servicio_id
        }
      );
      break;

    case 'CANCELADO':
      // Notificar ambas partes
      await createNotification(
        payment.cliente_id,
        'pago_cancelado',
        `Tu pago ha sido cancelado.`,
        { payment_id: payment.id, service_id: payment.servicio_id }
      );

      await createNotification(
        payment.profesional_id,
        'pago_cancelado',
        `El pago del servicio ha sido cancelado.`,
        { payment_id: payment.id, service_id: payment.servicio_id }
      );
      break;

    case 'EXPIRADO':
      // Notificar cliente
      await createNotification(
        payment.cliente_id,
        'pago_expirado',
        `Tu pago ha expirado. Crea un nuevo pago para continuar.`,
        { payment_id: payment.id, service_id: payment.servicio_id }
      );
      break;
  }
}

/**
 * Obtener estado de un pago
 * @param {string} paymentId - ID del pago en Mercado Pago
 */
exports.getPaymentStatus = async (paymentId) => {
  try {
    if (!configureMercadoPago()) {
      return { status: 'simulated', simulated: true };
    }

    const response = await mercadopago.payment.get(paymentId);

    return {
      id: response.body.id,
      status: response.body.status,
      status_detail: response.body.status_detail,
      transaction_amount: response.body.transaction_amount,
      date_approved: response.body.date_approved,
      simulated: false
    };

  } catch (error) {
    console.error('Error obteniendo estado del pago:', error);
    throw error;
  }
};

/**
 * Reembolsar un pago
 * @param {string} paymentId - ID del pago a reembolsar
 */
exports.refundPayment = async (paymentId) => {
  try {
    if (!configureMercadoPago()) {
      console.log('🧪 MODO SIMULADO: Reembolso simulado');
      return { success: true, simulated: true };
    }

    const response = await mercadopago.refund.create({ payment_id: paymentId });

    // Buscar y actualizar pago en base de datos
    const payment = await prisma.pagos.findFirst({
      where: { mercado_pago_id: paymentId },
      include: { servicios: true }
    });

    if (payment) {
      await prisma.pagos.update({
        where: { id: payment.id },
        data: {
          estado: 'REEMBOLSADO',
          fecha_liberacion: new Date(),
          actualizado_en: new Date()
        }
      });

      // Registrar reembolso en historial de comisiones
      if (payment.comision_plataforma > 0) {
        await prisma.comisiones_historial.create({
          data: {
            pago_id: payment.id,
            servicio_id: payment.servicio_id,
            tipo: 'PLATAFORMA',
            evento: 'REEMBOLSADA',
            monto: -payment.comision_plataforma, // Monto negativo para reembolso
            descripcion: `Comisión reembolsada por cancelación del pago - Servicio ${payment.servicios?.descripcion || 'N/A'}`,
            aplicado_por: payment.profesional_id,
            referencia: `REFUND_${paymentId}_${Date.now()}`
          }
        });
      }

      // Crear evento de pago para auditoría
      await prisma.eventos_pagos.create({
        data: {
          pago_id: payment.id,
          tipo_evento: 'payment_refunded',
          datos: { refund_id: response.body.id, original_payment_id: paymentId },
          procesado: true,
          procesado_en: new Date()
        }
      });
    }

    console.log(`💸 Reembolso procesado: ${paymentId}`);
    return { success: true, refund_id: response.body.id };

  } catch (error) {
    console.error('Error procesando reembolso:', error);
    throw error;
  }
};

/**
 * Liberar fondos manualmente (para administradores)
 * Implementa RB-03: Comisión se cobra solo al liberar fondos
 * @param {string} paymentId - ID del pago
 */
exports.releaseFunds = async (paymentId) => {
  try {
    const payment = await prisma.pagos.findUnique({
      where: { id: paymentId },
      include: {
        servicio: {
          include: {
            cliente: true,
            profesional: true
          }
        }
      }
    });

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    // Verificar que el servicio esté completado
    if (payment.servicio.estado !== 'completado') {
      throw new Error('El servicio debe estar completado para liberar fondos');
    }

    // Calcular comisión al liberar fondos (RB-03)
    const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.05');
    
    // REQ-43: Validar que la comisión esté entre 5-10% según PRD
    if (commissionRate < 0.05 || commissionRate > 0.10) {
      throw new Error('La comisión debe estar entre 5% y 10% según configuración del sistema');
    }
    
    const totalAmount = payment.monto_total;
    const commission = Math.round(totalAmount * commissionRate);
    const professionalAmount = totalAmount - commission;

    // Actualizar estado a liberado con comisión calculada
    await prisma.pagos.update({
      where: { id: paymentId },
      data: {
        estado: 'LIBERADO',
        fecha_liberacion: new Date(),
        comision_plataforma: commission,
        monto_profesional: professionalAmount,
        actualizado_en: new Date()
      }
    });

    // Registrar comisión en historial
    await prisma.comisiones_historial.create({
      data: {
        pago_id: paymentId,
        servicio_id: payment.servicio.id,
        tipo: 'PLATAFORMA',
        evento: 'APLICADA',
        monto: commission,
        porcentaje: commissionRate,
        descripcion: `Comisión aplicada por liberación manual de fondos - Servicio ${payment.servicio.descripcion}`,
        aplicado_por: payment.profesional_id, // Quien libera los fondos
        referencia: `RELEASE_${paymentId}_${Date.now()}`
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
      'fondos_liberados_manual',
      `¡Fondos liberados manualmente! Recibiste $${professionalAmount} (comisión $${commission} deducida).`,
      { payment_id: paymentId, amount: professionalAmount, commission }
    );

    console.log(`💰 Fondos liberados manualmente: ${paymentId} - Monto profesional: $${professionalAmount}`);
    return { success: true, professionalAmount, commission };

  } catch (error) {
    console.error('Error liberando fondos:', error);
    throw error;
  }
};

/**
 * Procesar liberación automática de fondos (cron job)
 * Libera fondos automáticamente después del período de custodia
 */
exports.processAutomaticFundReleases = async () => {
  try {
    const now = new Date();

    // Buscar pagos aprobados listos para liberación automática
    const paymentsToRelease = await prisma.pagos.findMany({
      where: {
        estado: 'APROBADO',
        fecha_liberacion_programada: {
          lte: now
        },
        webhook_procesado: true
      },
      include: {
        servicios: {
          include: {
            cliente: true,
            profesional: true
          }
        }
      }
    });

    console.log(`🔄 Procesando liberación automática de ${paymentsToRelease.length} pagos`);

    let processedCount = 0;
    let errorCount = 0;

    for (const payment of paymentsToRelease) {
      try {
        // Calcular comisión
        const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.05');
        const commission = Math.round(payment.monto_total * commissionRate);
        const professionalAmount = payment.monto_total - commission;

        // Liberar fondos
        await prisma.pagos.update({
          where: { id: payment.id },
          data: {
            estado: 'LIBERADO',
            fecha_liberacion: now,
            comision_plataforma: commission,
            monto_profesional: professionalAmount,
            actualizado_en: now
          }
        });

        // Registrar comisión en historial
        await prisma.comisiones_historial.create({
          data: {
            pago_id: payment.id,
            servicio_id: payment.servicio_id,
            tipo: 'PLATAFORMA',
            evento: 'APLICADA',
            monto: commission,
            porcentaje: commissionRate,
            descripcion: `Comisión aplicada por liberación automática de fondos - Servicio ${payment.servicios.descripcion}`,
            aplicado_por: null, // Sistema automático
            referencia: `AUTO_RELEASE_${payment.id}_${Date.now()}`
          }
        });

        // Actualizar servicio
        await prisma.servicios.update({
          where: { id: payment.servicio_id },
          data: {
            estado: 'PAGADO',
            completado_en: now
          }
        });

        // Notificar al profesional
        const { createNotification } = require('./notificationService');
        await createNotification(
          payment.profesional_id,
          'fondos_liberados_automatico',
          `¡Fondos liberados automáticamente! Recibiste $${professionalAmount} (comisión $${commission} deducida).`,
          {
            payment_id: payment.id,
            amount: professionalAmount,
            commission,
            auto_release: true
          }
        );

        processedCount++;
        console.log(`✅ Fondos liberados automáticamente: ${payment.id}`);

      } catch (error) {
        console.error(`❌ Error liberando fondos automáticamente para pago ${payment.id}:`, error);
        errorCount++;
      }
    }

    return {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total: paymentsToRelease.length
    };

  } catch (error) {
    console.error('Error en liberación automática de fondos:', error);
    throw error;
  }
};

/**
 * Validar estado de pago antes de operaciones
 */
exports.validatePaymentState = async (paymentId, requiredStates = []) => {
  const payment = await prisma.pagos.findUnique({
    where: { id: paymentId }
  });

  if (!payment) {
    throw new Error('Pago no encontrado');
  }

  if (requiredStates.length > 0 && !requiredStates.includes(payment.estado)) {
    throw new Error(`Estado de pago inválido. Estado actual: ${payment.estado}. Estados permitidos: ${requiredStates.join(', ')}`);
  }

  return payment;
};

/**
 * Obtener estadísticas de pagos
 */
exports.getPaymentStats = async (dateRange = null) => {
  const whereClause = dateRange ? {
    creado_en: {
      gte: dateRange.start,
      lte: dateRange.end
    }
  } : {};

  const stats = await prisma.pagos.groupBy({
    by: ['estado'],
    where: whereClause,
    _count: {
      id: true
    },
    _sum: {
      monto_total: true,
      comision_plataforma: true
    }
  });

  return stats;
};

module.exports = exports;