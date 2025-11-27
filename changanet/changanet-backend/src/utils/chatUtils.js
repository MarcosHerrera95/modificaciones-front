/**
 * Utilidades para el sistema de chat
 * Funciones helper para manipulación de datos de chat
 */

/**
 * Formatea un mensaje para respuesta API
 * @param {Object} message - Mensaje de la BD
 * @returns {Object} Mensaje formateado
 */
exports.formatMessage = (message) => {
  return {
    id: message.id,
    message: message.message,
    image_url: message.image_url,
    status: message.status,
    created_at: message.created_at,
    read_at: message.read_at,
    sender: message.sender ? {
      id: message.sender.id,
      nombre: message.sender.nombre,
      foto_perfil: message.sender.url_foto_perfil,
      rol: message.sender.rol
    } : null
  };
};

/**
 * Formatea una conversación para respuesta API
 * @param {Object} conversation - Conversación de la BD
 * @param {string} userId - ID del usuario actual
 * @param {number} unreadCount - Conteo de mensajes no leídos
 * @returns {Object} Conversación formateada
 */
exports.formatConversation = (conversation, userId, unreadCount = 0) => {
  const otherUser = conversation.client_id === userId ? conversation.professional : conversation.client;
  const lastMessage = conversation.messages?.[0] || null;

  return {
    id: conversation.id,
    otherUser: {
      id: otherUser.id,
      nombre: otherUser.nombre,
      rol: otherUser.rol,
      foto_perfil: otherUser.url_foto_perfil,
      verificado: otherUser.esta_verificado
    },
    lastMessage: lastMessage ? exports.formatMessage(lastMessage) : null,
    unread_count: unreadCount,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    is_active: conversation.is_active
  };
};

/**
 * Valida si un UUID es válido
 * @param {string} uuid - UUID a validar
 * @returns {boolean} True si es válido
 */
exports.isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Verifica si un usuario puede acceder a una conversación
 * @param {Object} conversation - Conversación
 * @param {string} userId - ID del usuario
 * @returns {boolean} True si tiene acceso
 */
exports.canAccessConversation = (conversation, userId) => {
  return conversation.client_id === userId || conversation.professional_id === userId;
};

/**
 * Genera un ID único para conversaciones
 * @param {string} clientId - ID del cliente
 * @param {string} professionalId - ID del profesional
 * @returns {string} ID único
 */
exports.generateConversationId = (clientId, professionalId) => {
  // Ordenar IDs para consistencia
  const [id1, id2] = [clientId, professionalId].sort();
  return `${id1}_${id2}`;
};

/**
 * Sanitiza contenido de mensaje
 * @param {string} content - Contenido a sanitizar
 * @returns {string} Contenido sanitizado
 */
exports.sanitizeMessageContent = (content) => {
  if (!content) return null;

  // Remover scripts y contenido peligroso
  const sanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remover event handlers
    .trim();

  return sanitized.length > 0 ? sanitized : null;
};

/**
 * Verifica si un mensaje es duplicado
 * @param {string} conversationId - ID de conversación
 * @param {string} senderId - ID del remitente
 * @param {string} content - Contenido del mensaje
 * @param {number} windowMs - Ventana de tiempo en ms (default: 30 segundos)
 * @returns {Promise<boolean>} True si es duplicado
 */
exports.isDuplicateMessage = async (conversationId, senderId, content, windowMs = 30000) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const recentMessage = await prisma.mensajes.findFirst({
      where: {
        conversation_id: conversationId,
        sender_id: senderId,
        message: content,
        created_at: {
          gte: new Date(Date.now() - windowMs)
        }
      }
    });

    return !!recentMessage;
  } catch (error) {
    console.error('Error verificando mensaje duplicado:', error);
    return false; // En caso de error, permitir el mensaje
  }
};

/**
 * Obtiene conteo de mensajes no leídos para un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Mapa de conversationId -> unreadCount
 */
exports.getUnreadCounts = async (userId) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const unreadCounts = await prisma.mensajes.groupBy({
      by: ['conversation_id'],
      where: {
        recipient_id: userId,
        status: { not: 'read' }
      },
      _count: {
        id: true
      }
    });

    // Convertir a mapa
    const countMap = new Map();
    unreadCounts.forEach(count => {
      countMap.set(count.conversation_id, count._count.id);
    });

    return countMap;
  } catch (error) {
    console.error('Error obteniendo conteos de mensajes no leídos:', error);
    return new Map();
  }
};