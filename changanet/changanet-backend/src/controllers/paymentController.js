const paymentService = require('../services/paymentsService');
const logger = require('../services/logger');

/**
 * Crea una preferencia de pago con custodia de fondos
 */
async function createPaymentPreference(req, res) {
  try {
    const { serviceId, amount, professionalEmail, specialty } = req.body;
    const clientId = req.user.id; // Obtenido del middleware de autenticación

    // Validar campos requeridos
    if (!serviceId || !amount || !professionalEmail || !specialty) {
      logger.warn('Payment preference creation failed: missing required fields', {
        service: 'payments',
        userId: clientId,
        serviceId,
        amount,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Faltan campos requeridos: serviceId, amount, professionalEmail, specialty',
      });
    }

    // Validar que amount sea un número positivo
    if (typeof amount !== 'number' || amount <= 0) {
      logger.warn('Payment preference creation failed: invalid amount', {
        service: 'payments',
        userId: clientId,
        serviceId,
        amount,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'El monto debe ser un número positivo',
      });
    }

    const preference = await paymentService.createPaymentPreference({
      serviceId,
      amount,
      professionalEmail,
      specialty,
      clientId,
    });

    logger.info('Payment preference created successfully', {
      service: 'payments',
      userId: clientId,
      serviceId,
      amount,
      preferenceId: preference.id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: preference,
    });
  } catch (error) {
    logger.error('Payment preference creation error', {
      service: 'payments',
      userId: req.user?.id,
      serviceId: req.body.serviceId,
      amount: req.body.amount,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Libera los fondos de un pago completado
 */
async function releaseFunds(req, res) {
  try {
    const { paymentId, serviceId } = req.body;
    const clientId = req.user.id; // Obtenido del middleware de autenticación

    // Validar campos requeridos
    if (!paymentId || !serviceId) {
      logger.warn('Funds release failed: missing required fields', {
        service: 'payments',
        userId: clientId,
        paymentId,
        serviceId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Faltan campos requeridos: paymentId, serviceId',
      });
    }

    const result = await paymentService.releaseFunds(paymentId, serviceId, clientId);

    logger.info('Funds released successfully', {
      service: 'payments',
      userId: clientId,
      paymentId,
      serviceId,
      amount: result.amount,
      ip: req.ip
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Funds release error', {
      service: 'payments',
      userId: req.user?.id,
      paymentId: req.body.paymentId,
      serviceId: req.body.serviceId,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Obtiene el estado de un pago
 */
async function getPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        error: 'Se requiere el paymentId',
      });
    }

    const status = await paymentService.getPaymentStatus(paymentId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error en getPaymentStatus:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Maneja webhooks de Mercado Pago
 */
async function handleWebhook(req, res) {
  try {
    const { type, data } = req.body;

    logger.info('Payment webhook received', {
      service: 'payments',
      type,
      paymentId: data?.id,
      ip: req.ip
    });

    // Verificar que sea una notificación de pago
    if (type === 'payment') {
      const paymentId = data.id;

      // Obtener detalles del pago
      const paymentStatus = await paymentService.getPaymentStatus(paymentId);

      if (paymentStatus.status === 'approved') {
        logger.info('Payment approved via webhook', {
          service: 'payments',
          paymentId,
          amount: paymentStatus.amount,
          userId: paymentStatus.userId
        });
        // Aquí podrías actualizar el estado del servicio o enviar notificaciones
      } else if (paymentStatus.status === 'rejected') {
        logger.warn('Payment rejected via webhook', {
          service: 'payments',
          paymentId,
          amount: paymentStatus.amount,
          userId: paymentStatus.userId
        });
      }
    }

    // Responder a Mercado Pago
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Payment webhook processing error', {
      service: 'payments',
      type: req.body?.type,
      paymentId: req.body?.data?.id,
      error,
      ip: req.ip
    });
    res.status(500).send('Error procesando webhook');
  }
}

module.exports = {
  createPaymentPreference,
  releaseFunds,
  getPaymentStatus,
  handleWebhook,
};