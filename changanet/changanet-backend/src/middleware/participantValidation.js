/**
 * Middleware de validación de participantes en conversaciones
 * Verifica que el usuario actual sea participante válido de la conversación
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware para validar que el usuario es participante de la conversación
 * @param {string} conversationIdParam - Nombre del parámetro que contiene el conversationId (default: 'conversationId')
 */
exports.validateConversationParticipant = (conversationIdParam = 'conversationId') => {
  return async (req, res, next) => {
    try {
      const { id: currentUserId } = req.user;
      const conversationId = req.params[conversationIdParam] || req.body[conversationIdParam];

      if (!conversationId) {
        return res.status(400).json({
          error: 'conversationId es requerido',
          code: 'MISSING_CONVERSATION_ID'
        });
      }

      // Verificar que la conversación existe
      const conversation = await prisma.conversations.findUnique({
        where: { id: conversationId },
        include: {
          client: { select: { id: true } },
          professional: { select: { id: true } }
        }
      });

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada',
          code: 'CONVERSATION_NOT_FOUND'
        });
      }

      // Verificar que el usuario actual es participante
      if (conversation.client_id !== currentUserId &&
          conversation.professional_id !== currentUserId) {
        return res.status(403).json({
          error: 'No tienes acceso a esta conversación',
          code: 'UNAUTHORIZED'
        });
      }

      // Agregar conversación al request para uso posterior
      req.conversation = conversation;
      next();

    } catch (error) {
      console.error('Error en validación de participante:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware para validar que el usuario puede enviar mensajes
 * Verifica permisos adicionales como bloqueos, etc.
 */
exports.validateMessagePermissions = async (req, res, next) => {
  try {
    const { id: currentUserId } = req.user;

    // Verificar si el usuario está bloqueado
    const user = await prisma.usuarios.findUnique({
      where: { id: currentUserId },
      select: {
        bloqueado: true,
        bloqueado_hasta: true,
        esta_verificado: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.bloqueado) {
      return res.status(403).json({
        error: 'Tu cuenta está bloqueada. Contacta al soporte.',
        code: 'ACCOUNT_BLOCKED'
      });
    }

    // Verificar si el bloqueo temporal ha expirado
    if (user.bloqueado_hasta && new Date() < new Date(user.bloqueado_hasta)) {
      return res.status(403).json({
        error: `Tu cuenta está bloqueada hasta ${user.bloqueado_hasta}`,
        code: 'ACCOUNT_TEMPORARILY_BLOCKED'
      });
    }

    next();

  } catch (error) {
    console.error('Error en validación de permisos de mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};