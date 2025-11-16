const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Crea una sesión de pago con Stripe para un servicio
 * @param {Object} paymentData - Datos del pago
 * @param {string} paymentData.serviceId - ID del servicio
 * @param {number} paymentData.amount - Monto en USD (Stripe usa centavos)
 * @param {string} paymentData.professionalEmail - Email del profesional
 * @param {string} paymentData.specialty - Especialidad del servicio
 * @param {string} paymentData.clientId - ID del cliente (para validación)
 * @returns {Object} Sesión de pago creada
 */
async function createPaymentSession({ serviceId, amount, professionalEmail, specialty, clientId }) {
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

    // Validar que el profesional existe y está verificado
    if (!service.profesional || service.profesional.rol !== 'profesional') {
      throw new Error('El profesional asignado no es válido');
    }

    // Validar montos razonables (Stripe usa centavos, convertir a dólares)
    const amountInCents = Math.round(amount * 100); // Convertir a centavos
    if (amountInCents <= 0 || amountInCents > 10000000) { // Máximo $100,000 USD
      throw new Error('Monto de pago inválido');
    }

    // Calcular comisión del 10%
    const platformFee = Math.round(amountInCents * 0.1);
    const professionalAmount = amountInCents - platformFee;

    // Crear registro de pago en base de datos
    const paymentRecord = await prisma.pagos.create({
      data: {
        servicio_id: serviceId,
        cliente_id: clientId,
        profesional_id: service.profesional_id,
        monto_total: amount, // Guardar en la moneda original
        comision_plataforma: platformFee / 100, // Convertir de centavos a dólares
        monto_profesional: professionalAmount / 100, // Convertir de centavos a dólares
        estado: 'pendiente',
        metodo_pago: 'stripe',
      },
    });

    // Crear sesión de pago con Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Servicio de ${specialty}`,
              description: `Servicio de ${specialty} - Changánet`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payments/success?serviceId=${serviceId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payments/cancel`,
      metadata: {
        serviceId: serviceId,
        clientId: clientId,
        professionalId: service.profesional_id,
        paymentRecordId: paymentRecord.id,
      },
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: await getOrCreateStripeAccount(service.profesional_id),
        },
      },
    });

    // Actualizar registro con ID de Stripe
    await prisma.pagos.update({
      where: { id: paymentRecord.id },
      data: { mercado_pago_id: session.id }, // Reutilizar campo existente
    });

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      paymentRecordId: paymentRecord.id,
    };
  } catch (error) {
    console.error('Error creando sesión de pago con Stripe:', error);
    throw error;
  }
}

/**
 * Obtiene o crea una cuenta conectada de Stripe para el profesional
 * @param {string} professionalId - ID del profesional
 * @returns {string} Account ID de Stripe
 */
async function getOrCreateStripeAccount(professionalId) {
  try {
    // Buscar si el profesional ya tiene una cuenta de Stripe
    const professional = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: professionalId },
      select: { stripe_account_id: true }
    });

    if (professional?.stripe_account_id) {
      return professional.stripe_account_id;
    }

    // Crear cuenta conectada de Stripe (Express account)
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'AR', // Argentina
      email: await getProfessionalEmail(professionalId),
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Guardar el account ID en la base de datos
    await prisma.perfiles_profesionales.update({
      where: { usuario_id: professionalId },
      data: { stripe_account_id: account.id }
    });

    return account.id;
  } catch (error) {
    console.error('Error creando cuenta de Stripe:', error);
    throw new Error('Error configurando cuenta de pagos');
  }
}

/**
 * Obtiene el email del profesional
 * @param {string} professionalId - ID del profesional
 * @returns {string} Email del profesional
 */
async function getProfessionalEmail(professionalId) {
  const user = await prisma.usuarios.findUnique({
    where: { id: professionalId },
    select: { email: true }
  });
  return user?.email;
}

/**
 * Maneja webhook de Stripe para confirmar pagos
 * @param {Object} event - Evento de Stripe
 */
async function handleWebhook(event) {
  try {
    const { type, data } = event;

    switch (type) {
      case 'checkout.session.completed':
        await handlePaymentSuccess(data.object);
        break;

      case 'payment_intent.succeeded':
        // El pago fue exitoso
        console.log('Pago exitoso:', data.object.id);
        break;

      case 'transfer.created':
        // Transferencia creada al profesional
        console.log('Transferencia creada:', data.object.id);
        break;

      default:
        console.log('Evento no manejado:', type);
    }
  } catch (error) {
    console.error('Error procesando webhook de Stripe:', error);
    throw error;
  }
}

/**
 * Maneja pago exitoso desde webhook
 * @param {Object} session - Sesión de Stripe
 */
async function handlePaymentSuccess(session) {
  try {
    const { serviceId, paymentRecordId } = session.metadata;

    // Actualizar estado del pago
    await prisma.pagos.update({
      where: { id: paymentRecordId },
      data: {
        estado: 'aprobado',
        fecha_pago: new Date(),
      },
    });

    // Actualizar estado del servicio
    await prisma.servicios.update({
      where: { id: serviceId },
      data: {
        estado: 'completado',
        completado_en: new Date(),
      },
    });

    console.log(`Pago completado para servicio ${serviceId}`);
  } catch (error) {
    console.error('Error procesando pago exitoso:', error);
    throw error;
  }
}

/**
 * Obtiene el estado de una sesión de pago
 * @param {string} sessionId - ID de la sesión de Stripe
 * @returns {Object} Estado de la sesión
 */
async function getSessionStatus(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      amount: session.amount_total / 100, // Convertir de centavos a dólares
      currency: session.currency,
    };
  } catch (error) {
    console.error('Error obteniendo estado de sesión:', error);
    throw error;
  }
}

/**
 * Crea un enlace para que el profesional configure su cuenta de Stripe
 * @param {string} professionalId - ID del profesional
 * @returns {string} URL de configuración de cuenta
 */
async function createAccountLink(professionalId) {
  try {
    const accountId = await getOrCreateStripeAccount(professionalId);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/professional/payments`,
      return_url: `${process.env.FRONTEND_URL}/professional/payments`,
      type: 'account_onboarding',
    });

    return accountLink.url;
  } catch (error) {
    console.error('Error creando enlace de cuenta:', error);
    throw new Error('Error configurando cuenta de pagos');
  }
}

module.exports = {
  createPaymentSession,
  handleWebhook,
  getSessionStatus,
  createAccountLink,
  getOrCreateStripeAccount,
};