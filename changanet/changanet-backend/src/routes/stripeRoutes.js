// src/routes/stripeRoutes.js
const express = require('express');
const { authenticateToken } = require('../middleware/authenticate');
const stripeService = require('../services/stripeService');

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

/**
 * POST /api/stripe/create-session
 * Crea una sesión de pago con Stripe
 */
router.post('/create-session', async (req, res) => {
  try {
    const { serviceId, amount, professionalEmail, specialty } = req.body;
    const clientId = req.user.id;

    if (!serviceId || !amount || !professionalEmail || !specialty) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: serviceId, amount, professionalEmail, specialty'
      });
    }

    const result = await stripeService.createPaymentSession({
      serviceId,
      amount,
      professionalEmail,
      specialty,
      clientId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creando sesión de Stripe:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/stripe/session/:sessionId
 * Obtiene el estado de una sesión de pago
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await stripeService.getSessionStatus(sessionId);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error obteniendo sesión de Stripe:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/stripe/account-link
 * Crea un enlace para que el profesional configure su cuenta de Stripe
 */
router.post('/account-link', async (req, res) => {
  try {
    // Solo profesionales pueden crear enlaces de cuenta
    if (req.user.rol !== 'profesional') {
      return res.status(403).json({
        error: 'Solo los profesionales pueden configurar cuentas de pago'
      });
    }

    const accountLink = await stripeService.createAccountLink(req.user.id);

    res.json({
      success: true,
      data: { url: accountLink }
    });
  } catch (error) {
    console.error('Error creando enlace de cuenta:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/stripe/webhook
 * Webhook para manejar eventos de Stripe
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.warn('STRIPE_WEBHOOK_SECRET no configurado');
      return res.status(500).json({ error: 'Webhook no configurado' });
    }

    // Verificar firma del webhook
    let event;
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Error verificando webhook:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Manejar el evento
    await stripeService.handleWebhook(event);

    res.json({ received: true });
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;