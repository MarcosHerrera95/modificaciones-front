/**
 * Controlador de Chat - Funcionalidad de Conversaciones
 * Implementa el sistema de chat bidireccional entre cliente y profesional
 * REQUERIMIENTO: Botón "Chat con el Cliente" en modal de cotizaciones
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Crea o obtiene una conversación entre dos usuarios
 * POST /api/chat/open-or-create
 */
exports.openOrCreateConversation = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { clientId, professionalId } = req.body;

  try {
    // Validar parámetros
    if (!clientId || !professionalId) {
      return res.status(400).json({ 
        error: 'Se requieren clientId y professionalId' 
      });
    }

    // Verificar que el usuario actual está autorizado
    if (currentUserId !== clientId && currentUserId !== professionalId) {
      return res.status(403).json({ 
        error: 'No tienes permiso para crear esta conversación' 
      });
    }

    // Determinar los dos participantes de la conversación (orden alfabético para strings)
    const participants = [clientId, professionalId].sort();
    const participant1 = participants[0];
    const participant2 = participants[1];
    
    // Crear conversationId único basado en los participantes
    const conversationId = `${participant1}-${participant2}`;

    // Verificar si existe al menos un mensaje entre estos usuarios
    const existingMessages = await prisma.mensajes.findFirst({
      where: {
        OR: [
          { remitente_id: clientId, destinatario_id: professionalId },
          { remitente_id: professionalId, destinatario_id: clientId }
        ]
      },
      orderBy: { creado_en: 'desc' }
    });

    // Verificar que ambos usuarios existen y tienen roles válidos
    const [user1, user2] = await Promise.all([
      prisma.usuarios.findUnique({ 
        where: { id: clientId }, 
        select: { id: true, rol: true, nombre: true } 
      }),
      prisma.usuarios.findUnique({ 
        where: { id: professionalId }, 
        select: { id: true, rol: true, nombre: true } 
      })
    ]);

    if (!user1 || !user2) {
      return res.status(404).json({ 
        error: 'Uno o ambos usuarios no existen' 
      });
    }

    // Verificar que uno es cliente y otro es profesional
    const isValidCombination = 
      (user1.rol === 'cliente' && user2.rol === 'profesional') ||
      (user1.rol === 'profesional' && user2.rol === 'cliente');

    if (!isValidCombination) {
      return res.status(400).json({ 
        error: 'La conversación debe ser entre un cliente y un profesional' 
      });
    }

    // Obtener información de la conversación
    const client = user1.rol === 'cliente' ? user1 : user2;
    const professional = user1.rol === 'profesional' ? user1 : user2;

    // Verificar si hay mensajes recientes (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentMessages = await prisma.mensajes.findMany({
      where: {
        OR: [
          { remitente_id: clientId, destinatario_id: professionalId },
          { remitente_id: professionalId, destinatario_id: clientId }
        ],
        creado_en: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: { creado_en: 'desc' },
      take: 1
    });

    // Información sobre el último mensaje
    const lastMessage = recentMessages[0] || null;
    const hasRecentActivity = !!lastMessage;

    res.status(200).json({
      conversationId,
      client: {
        id: client.id,
        nombre: client.nombre,
        rol: client.rol
      },
      professional: {
        id: professional.id,
        nombre: professional.nombre,
        rol: professional.rol
      },
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        contenido: lastMessage.contenido,
        remitente_id: lastMessage.remitente_id,
        created_at: lastMessage.creado_en
      } : null,
      hasRecentActivity,
      created: !existingMessages,
      message: existingMessages 
        ? 'Conversación existente encontrada' 
        : 'Nueva conversación creada'
    });

  } catch (error) {
    console.error('Error al abrir/crear conversación:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al procesar la conversación' 
    });
  }
};

/**
 * Valida y parsea el conversationId soportando múltiples formatos
 */
function parseConversationId(conversationId) {
  // Formato esperado: userId1-userId2 (ej: "123-456")
  const parts = conversationId.split('-');
  
  if (parts.length === 2) {
    return {
      format: 'userId1-userId2',
      participant1: parts[0],
      participant2: parts[1],
      isValid: true
    };
  }
  
  // Si es un UUID individual, intentamos extraer información adicional
  if (parts.length > 2) {
    // Verificar si parece un UUID
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
  }
  
  return {
    format: 'unknown',
    isValid: false,
    error: 'Formato de conversationId no reconocido'
  };
}

/**
 * Obtiene información de una conversación específica
 * GET /api/chat/conversation/:conversationId
 */
exports.getConversation = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { conversationId } = req.params;

  try {
    // Parsear y validar el conversationId
    const parsedId = parseConversationId(conversationId);
    
    if (!parsedId.isValid) {
      return res.status(400).json({ 
        error: parsedId.error || 'Formato de conversationId inválido',
        received: conversationId,
        expectedFormat: 'userId1-userId2',
        examples: ['123-456', 'abc-def', 'user1-user2']
      });
    }
    
    const { participant1, participant2 } = parsedId;

    // Verificar que el usuario actual es participante de la conversación
    if (currentUserId !== participant1 && currentUserId !== participant2) {
      return res.status(403).json({ 
        error: 'No tienes acceso a esta conversación' 
      });
    }

    // Obtener información de los usuarios
    const [user1, user2] = await Promise.all([
      prisma.usuarios.findUnique({ 
        where: { id: participant1 }, 
        select: { id: true, nombre: true, rol: true } 
      }),
      prisma.usuarios.findUnique({ 
        where: { id: participant2 }, 
        select: { id: true, nombre: true, rol: true } 
      })
    ]);

    if (!user1 || !user2) {
      return res.status(404).json({ 
        error: 'Usuarios de la conversación no encontrados' 
      });
    }

    // Verificar que es una combinación válida cliente-profesional
    const isValidCombination = 
      (user1.rol === 'cliente' && user2.rol === 'profesional') ||
      (user1.rol === 'profesional' && user2.rol === 'cliente');

    if (!isValidCombination) {
      return res.status(400).json({ 
        error: 'Conversación inválida - debe ser entre cliente y profesional' 
      });
    }

    const client = user1.rol === 'cliente' ? user1 : user2;
    const professional = user1.rol === 'profesional' ? user1 : user2;

    // Obtener el último mensaje
    const lastMessage = await prisma.mensajes.findFirst({
      where: {
        OR: [
          { remitente_id: participant1, destinatario_id: participant2 },
          { remitente_id: participant2, destinatario_id: participant1 }
        ]
      },
      orderBy: { creado_en: 'desc' },
      include: {
        remitente: {
          select: { id: true, nombre: true }
        }
      }
    });

    res.status(200).json({
      conversationId,
      client: {
        id: client.id,
        nombre: client.nombre,
        rol: client.rol
      },
      professional: {
        id: professional.id,
        nombre: professional.nombre,
        rol: professional.rol
      },
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        contenido: lastMessage.contenido,
        remitente_id: lastMessage.remitente_id,
        remitente_nombre: lastMessage.remitente.nombre,
        created_at: lastMessage.creado_en
      } : null,
      participant1,
      participant2
    });

  } catch (error) {
    console.error('Error al obtener conversación:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener la conversación' 
    });
  }
};

/**
 * Lista todas las conversaciones de un usuario
 * GET /api/chat/conversations
 */
exports.getUserConversations = async (req, res) => {
  const { id: userId } = req.user;

  try {
    // Obtener todos los usuarios con los que ha tenido conversaciones
    const conversations = await prisma.mensajes.groupBy({
      by: ['remitente_id', 'destinatario_id'],
      where: {
        OR: [
          { remitente_id: userId },
          { destinatario_id: userId }
        ]
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    // Procesar cada conversación
    const processedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.remitente_id === userId 
          ? conv.destinatario_id 
          : conv.remitente_id;

        // Obtener información del otro usuario
        const otherUser = await prisma.usuarios.findUnique({
          where: { id: otherUserId },
          select: { 
            id: true, 
            nombre: true, 
            rol: true, 
            url_foto_perfil: true,
            esta_verificado: true
          }
        });

        if (!otherUser) return null;

        // Obtener el último mensaje
        const lastMessage = await prisma.mensajes.findFirst({
          where: {
            OR: [
              { remitente_id: userId, destinatario_id: otherUserId },
              { remitente_id: otherUserId, destinatario_id: userId }
            ]
          },
          orderBy: { creado_en: 'desc' }
        });

        // Determinar los participantes para el conversationId
        const participant1 = Math.min(userId, otherUserId);
        const participant2 = Math.max(userId, otherUserId);
        const conversationId = `${participant1}-${participant2}`;

        return {
          conversationId,
          otherUser: {
            id: otherUser.id,
            nombre: otherUser.nombre,
            rol: otherUser.rol,
            foto_perfil: otherUser.url_foto_perfil,
            verificado: otherUser.esta_verificado
          },
          lastMessage: lastMessage ? {
            contenido: lastMessage.contenido,
            remitente_id: lastMessage.remitente_id,
            created_at: lastMessage.creado_en
          } : null,
          messageCount: conv._count.id,
          isClient: otherUser.rol === 'cliente',
          isProfessional: otherUser.rol === 'profesional'
        };
      })
    );

    // Filtrar nulls y ordenar por último mensaje
    const validConversations = processedConversations
      .filter(conv => conv !== null)
      .sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
      });

    res.status(200).json({
      conversations: validConversations,
      total: validConversations.length
    });

  } catch (error) {
    console.error('Error al obtener conversaciones del usuario:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener conversaciones' 
    });
  }
};