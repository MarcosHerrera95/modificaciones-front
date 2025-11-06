const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurar Mercado Pago con el access token
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

/**
 * Crea una preferencia de pago con custodia de fondos para un servicio
 * @param {Object} paymentData - Datos del pago
 * @param {string} paymentData.serviceId - ID del servicio
 * @param {number} paymentData.amount - Monto en ARS
 * @param {string} paymentData.professionalEmail - Email del profesional
 * @param {string} paymentData.specialty - Especialidad del servicio
 * @param {string} paymentData.clientId - ID del cliente (para validación)
 * @returns {Object} Preferencia de pago creada
 */
async function createPaymentPreference({ serviceId, amount, professionalEmail, specialty, clientId }) {
  try {
    // Validar que el servicio pertenece al cliente
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: {
        cliente: true,
        profesional: true,
      },
    });

    if (!service) {
      throw new Error('Servicio no encontrado');
    }

    if (service.cliente_id !== clientId) {
      throw new Error('No tienes permiso para crear un pago para este servicio');
    }

    if (service.estado !== 'pendiente') {
      throw new Error('El servicio debe estar en estado pendiente para crear un pago');
    }

<<<<<<< HEAD
    // Validar que el profesional existe y está verificado
    if (!service.profesional || service.profesional.rol !== 'profesional') {
      throw new Error('El profesional asignado no es válido');
    }

    // Validar montos razonables
    if (amount <= 0 || amount > 1000000) { // Máximo $1M ARS
      throw new Error('Monto de pago inválido');
    }

=======
>>>>>>> 7adf1cea4c40cf2dec1bc402fffa6bc1d5cc2acc
    // Calcular comisión del 10%
    const marketplaceFee = Math.round(amount * 0.1);

    // Crear preferencia de pago
    const preference = {
      items: [
        {
          id: serviceId,
          title: `Servicio de ${specialty}`,
          description: `Servicio de ${specialty} - Changánet`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: amount,
        },
      ],
      payer: {
        email: professionalEmail,
      },
      binary_mode: true, // Custodia de fondos
      marketplace_fee: marketplaceFee,
      back_urls: {
        success: `${process.env.FRONTEND_URL}/payments/success?serviceId=${serviceId}`,
        failure: `${process.env.FRONTEND_URL}/payments/failure`,
        pending: `${process.env.FRONTEND_URL}/payments/pending`,
      },
      auto_return: 'approved',
      external_reference: serviceId,
      notification_url: `${process.env.BACKEND_URL}/api/payments/webhook`,
    };

    const preferenceClient = new Preference(client);
    const response = await preferenceClient.create({ body: preference });

    return {
      preferenceId: response.body.id,
      initPoint: response.body.init_point,
      sandboxInitPoint: response.body.sandbox_init_point,
    };
  } catch (error) {
    console.error('Error creando preferencia de pago:', error);
    throw error;
  }
}

/**
 * Libera los fondos de un pago completado
 * @param {string} paymentId - ID del pago en Mercado Pago
 * @param {string} serviceId - ID del servicio
 * @param {string} clientId - ID del cliente (para validación)
 * @returns {Object} Resultado de la liberación
 */
async function releaseFunds(paymentId, serviceId, clientId) {
  try {
    // Validar que el servicio pertenece al cliente
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: {
        cliente: true,
      },
    });

    if (!service) {
      throw new Error('Servicio no encontrado');
    }

    if (service.cliente_id !== clientId) {
      throw new Error('No tienes permiso para liberar fondos de este servicio');
    }

    if (service.estado !== 'completado') {
      throw new Error('El servicio debe estar completado para liberar fondos');
    }

    // Liberar fondos usando la API de Mercado Pago
    const paymentClient = new Payment(client);
    const response = await paymentClient.update({
      id: paymentId,
      updatePaymentRequest: {
        status: 'approved', // Esto libera los fondos en el modelo marketplace
      },
    });

    // Actualizar estado del servicio si es necesario
    await prisma.servicios.update({
      where: { id: serviceId },
      data: {
        estado: 'pagado',
        completado_en: new Date(),
      },
    });

    return {
      success: true,
      paymentId,
      serviceId,
      releasedAt: new Date(),
    };
  } catch (error) {
    console.error('Error liberando fondos:', error);
    throw error;
  }
}

/**
 * Obtiene el estado de un pago
 * @param {string} paymentId - ID del pago en Mercado Pago
 * @returns {Object} Estado del pago
 */
async function getPaymentStatus(paymentId) {
  try {
    const paymentClient = new Payment(client);
    const response = await paymentClient.get({ id: paymentId });
    return response;
  } catch (error) {
    console.error('Error obteniendo estado del pago:', error);
    throw error;
  }
}

module.exports = {
  createPaymentPreference,
  releaseFunds,
  getPaymentStatus,
};