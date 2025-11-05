const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// POST /api/payments/create-preference
// Crea una preferencia de pago con custodia de fondos
router.post('/create-preference', authenticateToken, paymentController.createPaymentPreference);

// POST /api/payments/release-funds
// Libera los fondos de un pago completado
router.post('/release-funds', authenticateToken, paymentController.releaseFunds);

// GET /api/payments/status/:paymentId
// Obtiene el estado de un pago
router.get('/status/:paymentId', authenticateToken, paymentController.getPaymentStatus);

// POST /api/payments/webhook
// Webhook para notificaciones de Mercado Pago (sin autenticación)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;