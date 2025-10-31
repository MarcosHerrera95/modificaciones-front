// src/routes/messageRoutes.js
const express = require('express');
const { authenticateToken } = require('../middleware/authenticate');
const {
  getMessageHistory,
  sendMessage,
  markMessagesAsRead
} = require('../controllers/messageController');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Obtener historial de mensajes con otro usuario
router.get('/', getMessageHistory);

// Enviar mensaje (usado principalmente por Socket.IO, pero disponible como REST API)
router.post('/', sendMessage);

// Marcar mensajes como leídos
router.put('/read', markMessagesAsRead);

module.exports = router;