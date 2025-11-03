const paymentService = require('../services/paymentsService');

/**
 * Crea una preferencia de pago con custodia de fondos
 */
async function createPaymentPreference(req, res) {
  try {
    const { serviceId, amount, professionalEmail, specialty } = req.body;
    const clientId = req.user.id; // Obtenido del middleware de autenticación

    // Validar campos requeridos
    if (!serviceId || !amount || !professionalEmail || !specialty) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: serviceId, amount, professionalEmail, specialty',
      });
    }

    // Validar que amount sea un número positivo
    if (typeof amount !== 'number' || amount <= 0) {
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

    res.status(201).json({
      success: true,
      data: preference,
    });
  } catch (error) {
    console.error('Error en createPaymentPreference:', error);
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
      return res.status(400).json({
        error: 'Faltan campos requeridos: paymentId, serviceId',
      });
    }

    const result = await paymentService.releaseFunds(paymentId, serviceId, clientId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error en releaseFunds:', error);
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

    // Verificar que sea una notificación de pago
    if (type === 'payment') {
      const paymentId = data.id;
      console.log(`Webhook recibido para pago ${paymentId}`);

      // Aquí puedes implementar lógica adicional según el estado del pago
      // Por ejemplo, actualizar el estado del servicio cuando se apruebe el pago

      // Obtener detalles del pago
      const paymentStatus = await paymentService.getPaymentStatus(paymentId);

      if (paymentStatus.status === 'approved') {
        console.log(`Pago ${paymentId} aprobado`);
        // Aquí podrías actualizar el estado del servicio o enviar notificaciones
      }
    }

    // Responder a Mercado Pago
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Error procesando webhook');
  }
}

module.exports = {
  createPaymentPreference,
  releaseFunds,
  getPaymentStatus,
  handleWebhook,
};