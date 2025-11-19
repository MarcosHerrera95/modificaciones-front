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
 * Procesar webhook de Mercado Pago
 * @param {Object} paymentData - Datos del pago desde webhook
 */
exports.processPaymentWebhook = async (paymentData) => {
  try {
    const { id, status, external_reference, transaction_amount } = paymentData;

    console.log(`💳 Webhook recibido - Pago ${id}: ${status}`);

    if (status === 'approved') {
      // Actualizar pago en base de datos
      const payment = await prisma.pagos.findUnique({
        where: { servicio_id: external_reference }
      });

      if (payment) {
        await prisma.pagos.update({
          where: { id: payment.id },
          data: {
            estado: 'aprobado',
            mercado_pago_id: id.toString(),
            fecha_pago: new Date(),
            metodo_pago: 'mercadopago'
          }
        });

        // Programar liberación automática de fondos en 24 horas (RB-04)
        const releaseDate = new Date();
        releaseDate.setHours(releaseDate.getHours() + 24);

        await prisma.pagos.update({
          where: { id: payment.id },
          data: {
            fecha_liberacion: releaseDate
          }
        });

        // Notificar al profesional - fondos en custodia hasta liberación automática
        const { createNotification } = require('./notificationService');
        await createNotification(
          payment.profesional_id,
          'pago_aprobado',
          `¡Pago aprobado! Los fondos estarán disponibles automáticamente en 24 horas. Monto total: $${payment.monto_total}`,
          { payment_id: payment.id, release_date: releaseDate }
        );

        console.log(`✅ Pago aprobado y programado para liberación automática en 24h: ${payment.id}`);
      }
    }

    return { success: true };

  } catch (error) {
    console.error('Error procesando webhook de pago:', error);
    throw error;
  }
};

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

    // Actualizar estado en base de datos
    await prisma.pagos.updateMany({
      where: { mercado_pago_id: paymentId },
      data: { estado: 'reembolsado' }
    });

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

module.exports = exports;