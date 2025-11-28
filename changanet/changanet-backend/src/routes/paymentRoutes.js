/**
 * Rutas para sistema de pagos integrados
 * Implementa sección 7.9 del PRD: Pagos Integrados y Comisiones
 */

const express = require('express');
const crypto = require('crypto');
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authenticate');
const { paymentRateLimiter, webhookRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Middleware para verificar HMAC de MercadoPago webhooks
function verifyMercadoPagoWebhook(req, res, next) {
  try {
    const signature = req.headers['x-signature'] || req.headers['x-mp-signature'];
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.warn('Missing webhook signature or secret');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // MercadoPago envía la firma en formato x-signature: ts=123456789,id=abc123,...
    const signatureParts = signature.split(',');
    let timestamp = '';
    let receivedSignature = '';

    signatureParts.forEach(part => {
      const [key, value] = part.split('=');
      if (key === 'ts') timestamp = value;
      if (key === 'v1') receivedSignature = value;
    });

    if (!timestamp || !receivedSignature) {
      console.warn('Invalid signature format');
      return res.status(400).json({ error: 'Invalid signature format' });
    }

    // Crear el string a firmar
    const body = JSON.stringify(req.body);
    const manifest = `id:${req.headers['x-request-id'] || ''};request-id:${req.headers['x-request-id'] || ''};ts:${timestamp};`;
    const payload = manifest + body;

    // Calcular HMAC
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Verificar firma
    if (!crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
      console.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Verificar timestamp (no más de 5 minutos de antigüedad)
    const now = Math.floor(Date.now() / 1000);
    const sigTimestamp = parseInt(timestamp);
    if (Math.abs(now - sigTimestamp) > 300) { // 5 minutos
      console.warn('Webhook timestamp too old');
      return res.status(400).json({ error: 'Webhook timestamp too old' });
    }

    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).json({ error: 'Webhook verification failed' });
  }
}

// POST /api/payments/create-preference
// Crea una preferencia de pago con custodia de fondos
router.post('/create-preference', paymentRateLimiter, authenticateToken, paymentController.createPaymentPreference);

// POST /api/payments/release-funds
// Libera los fondos de un pago completado
router.post('/release-funds', authenticateToken, paymentController.releaseFunds);

// GET /api/payments/status/:paymentId
// Obtiene el estado de un pago
router.get('/status/:paymentId', authenticateToken, paymentController.getPaymentStatus);

// POST /api/payments/webhook
// Webhook para notificaciones de Mercado Pago (con verificación HMAC y rate limiting)
router.post('/webhook', webhookRateLimiter, verifyMercadoPagoWebhook, paymentController.handleWebhook);

// POST /api/payments/withdraw
// Permite a profesionales retirar fondos a su cuenta bancaria
router.post('/withdraw', paymentRateLimiter, authenticateToken, paymentController.withdrawFunds);

// GET /api/payments/receipt/:paymentId
// Genera y obtiene comprobante de pago
router.get('/receipt/:paymentId', authenticateToken, paymentController.generateReceipt);

// GET /api/payments/receipts/:fileName
// Descarga un comprobante de pago
router.get('/receipts/:fileName', authenticateToken, paymentController.downloadReceipt);

// POST /api/payments/:paymentId/dispute
// Crea una disputa para un pago
router.post('/:paymentId/dispute', paymentRateLimiter, authenticateToken, paymentController.createDispute);

// POST /api/payments/:paymentId/refund
// Procesa un reembolso
router.post('/:paymentId/refund', paymentRateLimiter, authenticateToken, paymentController.processRefund);

// GET /api/payments/:paymentId/events
// Obtiene el historial de eventos de un pago
router.get('/:paymentId/events', authenticateToken, paymentController.getPaymentEvents);

// GET /api/payments/disputes
// Obtiene disputas del usuario autenticado
router.get('/disputes', authenticateToken, paymentController.getUserDisputes);

// POST /api/payments/auto-release
// Liberación automática de fondos (para cron jobs - sin autenticación requerida)
router.post('/auto-release', async (req, res) => {
  try {
    const { autoReleaseFunds } = require('../services/paymentsService');
    const result = await autoReleaseFunds();
    res.json(result);
  } catch (error) {
    console.error('Error en auto-release:', error);
    res.status(500).json({ error: 'Error en liberación automática' });
  }
});

module.exports = router;