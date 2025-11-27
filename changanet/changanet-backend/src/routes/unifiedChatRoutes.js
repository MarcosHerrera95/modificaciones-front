/**
 * Rutas Unificadas de Chat - Implementación Completa según PRD
 * 
 * ENDPOINTS OBLIGATORIOS IMPLEMENTADOS:
 * POST /api/chat/conversations - Crear conversación cliente ↔ profesional
 * GET /api/chat/conversations/:userId - Listar conversaciones del usuario
 * GET /api/chat/conversations - Listar conversaciones del usuario actual (compatibilidad)
 * GET /api/chat/conversation/:conversationId - Obtener metadata de conversación
 * GET /api/chat/messages/:conversationId - Obtener historial paginado
 * POST /api/chat/messages - Enviar mensaje (texto o imagen)
 * POST /api/chat/messages/read - Marcar mensajes como leídos
 * POST /api/chat/upload-image - Obtener presigned URL → subir imagen
 * DELETE /api/chat/conversations/:conversationId - Cerrar conversación
 * 
 * SEGURIDAD:
 * - Todas las rutas requieren autenticación JWT
 * - Validación de permisos en cada endpoint
 * - Rate limiting específico para chat
 * - Sanitización de datos
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/authenticate');
const { chatRateLimiter } = require('../middleware/advancedRateLimiting');
const {
  createConversation,
  getUserConversations,
  getMessageHistory,
  sendMessage,
  getUploadUrl,
  searchMessages,
  closeConversation,
  markMessagesAsRead,
  getConversation,
  archiveConversation
} = require('../controllers/unifiedChatController');

const prisma = new PrismaClient();

const router = express.Router();

// Middleware de autenticación obligatorio para todas las rutas
router.use(authenticateToken);

// ✅ ENDPOINT ADICIONAL: GET /api/chat/ping
// Endpoint de verificación para testing
router.get('/ping', (req, res) => {
  res.status(200).json({
    message: 'Chat API funcionando correctamente',
    user_id: req.user.id,
    timestamp: new Date().toISOString(),
    endpoints_available: [
      'POST /conversations',
      'GET /conversations/:userId',
      'GET /conversations',
      'GET /conversation/:conversationId',
      'GET /messages/:conversationId',
      'POST /messages',
      'POST /messages/read',
      'POST /upload-image',
      'GET /search/:conversationId',
      'DELETE /conversations/:conversationId'
    ]
  });
});

// ✅ ENDPOINT ADICIONAL: GET /api/chat/health
// Health check para monitoreo
router.get('/health', async (req, res) => {
  try {
    // Verificar conexión a base de datos
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      service: 'chat-api'
    });
  } catch (error) {
    console.error('Health check fallido:', error);
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware de rate limiting específico para chat (aplicado solo a endpoints de chat)
router.use(chatRateLimiter);

// ✅ REQ-16: POST /api/chat/conversations
// Crear conversación cliente ↔ profesional
// Uso: Botón "Chat con el Cliente" en modal de cotizaciones
router.post('/conversations', createConversation);

// ✅ REQ-20: GET /api/chat/conversations/:userId
// Listar conversaciones del usuario (historial de chats)
// Uso: Página de mensajes del usuario
router.get('/conversations/:userId', getUserConversations);

// ✅ COMPATIBILIDAD: GET /api/chat/conversations
// Listar conversaciones del usuario actual (sin userId en URL)
// Uso: Frontend usa esta ruta para obtener conversaciones del usuario autenticado
router.get('/conversations', getUserConversations);

// ✅ COMPATIBILIDAD: GET /api/chat/conversation/:conversationId
// Obtener información detallada de una conversación específica
// Uso: Obtener metadata de conversación sin mensajes
router.get('/conversation/:conversationId', getConversation);

// ✅ REQ-20: GET /api/chat/messages/:conversationId
// Obtener historial paginado de una conversación
// Uso: Cargar mensajes al abrir una conversación
router.get('/messages/:conversationId', getMessageHistory);

// ✅ REQ-17, REQ-18: POST /api/chat/messages
// Enviar mensaje (texto o imagen)
// Uso: WebSocket en tiempo real + REST API para respaldo
router.post('/messages', sendMessage);

// ✅ CRÍTICO: POST /api/chat/messages/read
// Marcar mensajes como leídos
// Uso: Frontend marca mensajes como leídos en conversaciones
router.post('/messages/read', markMessagesAsRead);

// ✅ REQ-18: POST /api/chat/upload-image
// Obtener presigned URL para subir imagen
// Uso: Antes de enviar imagen, obtener URL para subir
router.post('/upload-image', getUploadUrl);

// ✅ FUNCIONALIDAD ADICIONAL: GET /api/chat/search/:conversationId
// Buscar en el historial de mensajes
// Uso: Barra de búsqueda en el chat
router.get('/search/:conversationId', searchMessages);

// DELETE /api/chat/conversations/:conversationId
// Cerrar/desactivar conversación
// Uso: Opción para cerrar conversaciones inactivas
router.delete('/conversations/:conversationId', closeConversation);

// PUT /api/chat/conversations/:conversationId/archive
// Archivar conversación (REQ-MSG-08)
// Uso: Archivar conversaciones para ocultarlas de la lista principal
router.put('/conversations/:conversationId/archive', archiveConversation);

module.exports = router;