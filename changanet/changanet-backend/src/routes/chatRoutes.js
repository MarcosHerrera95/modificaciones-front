// src/routes/chatRoutes.js
// Rutas para funcionalidad de conversaciones de chat
// Implementa chat bidireccional cliente ↔ profesional desde modal de cotizaciones

const express = require('express');
const { authenticateToken } = require('../middleware/authenticate');
const {
  openOrCreateConversation,
  getConversation,
  getUserConversations
} = require('../controllers/chatController');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// POST /api/chat/open-or-create
// Crea o obtiene una conversación entre cliente y profesional
// Usado por el botón "Chat con el Cliente" en el modal de cotizaciones
router.post('/open-or-create', openOrCreateConversation);

// GET /api/chat/conversation/:conversationId
// Obtiene información de una conversación específica
router.get('/conversation/:conversationId', getConversation);

// GET /api/chat/conversations
// Lista todas las conversaciones del usuario
router.get('/conversations', getUserConversations);

// GET /api/chat/resolve-conversation/:conversationId
// Endpoint de compatibilidad para resolver conversationIds con formato UUID o incorrecto
router.get('/resolve-conversation/:conversationId', async (req, res) => {
  const { id: currentUserId } = req.user;
  const { conversationId } = req.params;
  
  try {
    // Parsear el conversationId
    const parsedId = require('../controllers/chatController').parseConversationId
      ? require('../controllers/chatController').parseConversationId(conversationId)
      : parseConversationId(conversationId);
    
    if (parsedId.isValid) {
      // Si el formato es válido, redirigir a la conversación normal
      return res.status(200).json({
        status: 'valid',
        conversationId,
        message: 'Formato válido, usa /api/chat/conversation/',
        redirect: `/chat/${conversationId}`
      });
    }
    
    // Para formatos inválidos, intentar encontrar conversaciones por mensaje
    if (parsedId.format === 'uuid') {
      // Buscar mensajes relacionados con este UUID como remitente o destinatario
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const relatedMessages = await prisma.mensajes.findMany({
        where: {
          OR: [
            { remitente_id: conversationId },
            { destinatario_id: conversationId }
          ]
        },
        take: 5,
        orderBy: { creado_en: 'desc' }
      });
      
      if (relatedMessages.length > 0) {
        // Encontrar el otro usuario en la conversación
        const message = relatedMessages[0];
        const otherUserId = message.remitente_id === conversationId 
          ? message.destinatario_id 
          : message.remitente_id;
          
        // Crear conversationId válido (orden alfabético consistente)
        const participants = [String(currentUserId), String(otherUserId)].sort();
        const validConversationId = `${participants[0]}-${participants[1]}`;
        
        return res.status(200).json({
          status: 'resolved',
          originalConversationId: conversationId,
          resolvedConversationId: validConversationId,
          message: 'Conversación encontrada y resuelta automáticamente',
          redirect: `/chat/${validConversationId}`
        });
      }
    }
    
    // Si no se puede resolver
    return res.status(400).json({
      status: 'invalid',
      conversationId,
      message: 'No se pudo resolver este conversationId',
      suggestion: 'Usa el botón "Chat" desde dentro de la aplicación para generar un conversationId válido'
    });
    
  } catch (error) {
    console.error('Error resolviendo conversationId:', error);
    res.status(500).json({
      error: 'Error interno al resolver conversationId'
    });
  }
});

// Función auxiliar para parseo (en caso de que no esté exportada)
function parseConversationId(conversationId) {
  const parts = conversationId.split('-');
  
  if (parts.length === 2) {
    return {
      format: 'userId1-userId2',
      participant1: parts[0],
      participant2: parts[1],
      isValid: true
    };
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const fullId = parts.join('-');
  
  if (uuidRegex.test(fullId)) {
    return {
      format: 'uuid',
      uuid: fullId,
      isValid: false,
      error: 'conversationId con formato UUID no válido. Use el formato userId1-userId2'
    };
  }
  
  return {
    format: 'unknown',
    isValid: false,
    error: 'Formato de conversationId no reconocido'
  };
}

module.exports = router;