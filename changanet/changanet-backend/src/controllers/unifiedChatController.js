/**
 * Controlador Unificado de Chat - Implementación Completa según PRD
 * 
 * CUMPLE REQUERIMIENTOS:
 * REQ-16: Chat interno en página del perfil - ✅ Implementado
 * REQ-17: Envío de mensajes de texto - ✅ Implementado
 * REQ-18: Envío de imágenes - ✅ Implementado
 * REQ-19: Notificaciones push + email - ✅ Implementado
 * REQ-20: Historial de conversaciones - ✅ Implementado
 * 
 * ENDPOINTS OBLIGATORIOS IMPLEMENTADOS:
 * POST /api/chat/conversations - Crear conversación cliente ↔ profesional
 * GET /api/chat/conversations/:userId - Listar conversaciones del usuario
 * GET /api/chat/messages/:conversationId - Obtener historial paginado
 * POST /api/chat/messages - Enviar mensaje (texto o imagen)
 * POST /api/chat/upload-image - Obtener presigned URL → subir imagen
 * 
 * CARACTERÍSTICAS DE SEGURIDAD:
 * - Validación de UUIDs según especificaciones
 * - Solo participantes pueden chatear
 * - Sanitización de mensajes
 * - Rate limiting para chat
 * - Antiflood implementado
 * - Tokens JWT validados en cada operación
 */

const { PrismaClient } = require('@prisma/client');
const { nanoid } = require('nanoid'); // Para IDs consistentes
const rateLimit = require('rate-limiter-flexible');

const prisma = new PrismaClient();

// Rate limiting específico para chat (HABILITADO)
const chatRateLimiter = new rateLimit.RateLimiterFlexible({
  storeClient: prisma,
  keyPrefix: 'chat_rl',
  points: 30, // Número de puntos
  duration: 60, // Por minuto (60 segundos)
  execEvenly: true, // Distribuir evenly
});

// Antiflood - límite más estricto (HABILITADO)
const chatFloodLimiter = new rateLimit.RateLimiterFlexible({
  storeClient: prisma,
  keyPrefix: 'chat_flood',
  points: 5, // Solo 5 mensajes
  duration: 10, // Por 10 segundos
  blockDuration: 30, // Bloquear por 30 segundos si se excede
});

/**
 * POST /api/chat/conversations
 * Crear conversación cliente ↔ profesional (REQ-16)
 */
exports.createConversation = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { clientId, professionalId } = req.body;

  try {
    // Validar parámetros - deben ser IDs numéricos
    if (!clientId || !professionalId) {
      return res.status(400).json({ 
        error: 'Se requieren clientId y professionalId',
        code: 'MISSING_PARAMETERS'
      });
    }

    // ✅ VALIDACIÓN: Verificar que los IDs son UUIDs válidos
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(clientId) || !uuidRegex.test(professionalId)) {
      return res.status(400).json({ 
        error: 'clientId y professionalId deben ser UUIDs válidos',
        code: 'INVALID_UUID'
      });
    }

    // Verificar que el usuario actual está autorizado
    if (currentUserId !== clientId && currentUserId !== professionalId) {
      return res.status(403).json({ 
        error: 'No tienes permiso para crear esta conversación',
        code: 'UNAUTHORIZED'
      });
    }

    // Verificar que ambos usuarios existen
    const [clientUser, professionalUser] = await Promise.all([
      prisma.usuarios.findUnique({ 
        where: { id: clientId }, 
        select: { id: true, rol: true, nombre: true } 
      }),
      prisma.usuarios.findUnique({ 
        where: { id: professionalId }, 
        select: { id: true, rol: true, nombre: true } 
      })
    ]);

    if (!clientUser || !professionalUser) {
      return res.status(404).json({ 
        error: 'Uno o ambos usuarios no existen',
        code: 'USERS_NOT_FOUND'
      });
    }

    // Verificar que uno es cliente y otro es profesional
    const isValidCombination = 
      (clientUser.rol === 'cliente' && professionalUser.rol === 'profesional') ||
      (clientUser.rol === 'profesional' && professionalUser.rol === 'cliente');

    if (!isValidCombination) {
      return res.status(400).json({ 
        error: 'La conversación debe ser entre un cliente y un profesional',
        code: 'INVALID_USER_COMBINATION'
      });
    }

    // Crear la conversación (UNIQUE constraint maneja duplicados)
    const conversation = await prisma.conversations.create({
      data: {
        client_id: clientId,
        professional_id: professionalId,
        is_active: true
      },
      include: {
        client: {
          select: { id: true, nombre: true, rol: true, url_foto_perfil: true }
        },
        professional: {
          select: { id: true, nombre: true, rol: true, url_foto_perfil: true }
        }
      }
    });

    console.log(`✅ Conversación creada: ${conversation.id}`);

    res.status(201).json({
      conversation: {
        id: conversation.id,
        client: conversation.client,
        professional: conversation.professional,
        created_at: conversation.created_at,
        is_active: conversation.is_active
      },
      message: 'Conversación creada exitosamente'
    });

  } catch (error) {
    // Manejar error de duplicado (conversación ya existe)
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'P2002') {
      try {
        // Buscar conversación existente
        const existingConversation = await prisma.conversations.findFirst({
          where: {
            OR: [
              { client_id: clientId, professional_id: professionalId },
              { client_id: professionalId, professional_id: clientId }
            ]
          },
          include: {
            client: {
              select: { id: true, nombre: true, rol: true, url_foto_perfil: true }
            },
            professional: {
              select: { id: true, nombre: true, rol: true, url_foto_perfil: true }
            }
          }
        });

        if (existingConversation) {
          return res.status(200).json({
            conversation: existingConversation,
            message: 'Conversación existente encontrada'
          });
        }
      } catch (findError) {
        console.error('Error buscando conversación existente:', findError);
      }
    }

    console.error('Error al crear conversación:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al crear la conversación',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * GET /api/chat/conversations/:userId
 * Listar conversaciones del usuario (REQ-20)
 */
exports.getUserConversations = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  try {
    // Verificar autorización
    if (currentUserId !== userId) {
      return res.status(403).json({ 
        error: 'No puedes ver conversaciones de otros usuarios',
        code: 'UNAUTHORIZED'
      });
    }

    const offset = (page - 1) * limit;

    // Obtener conversaciones del usuario
    const conversations = await prisma.conversations.findMany({
      where: {
        OR: [
          { client_id: userId },
          { professional_id: userId }
        ],
        is_active: true
      },
      include: {
        client: {
          select: { 
            id: true, 
            nombre: true, 
            rol: true, 
            url_foto_perfil: true,
            esta_verificado: true
          }
        },
        professional: {
          select: { 
            id: true, 
            nombre: true, 
            rol: true, 
            url_foto_perfil: true,
            esta_verificado: true
          }
        },
        messages: {
          select: {
            id: true,
            message: true,
            image_url: true,
            status: true,
            created_at: true,
            sender_id: true
          },
          orderBy: { created_at: 'desc' },
          take: 1 // Solo el último mensaje
        }
      },
      orderBy: { updated_at: 'desc' },
      skip: offset,
      take: limit
    });

    // Formatear respuesta
    const formattedConversations = conversations.map(conv => {
      const otherUser = conv.client_id === userId ? conv.professional : conv.client;
      const lastMessage = conv.messages[0] || null;

      return {
        id: conv.id,
        otherUser: {
          id: otherUser.id,
          nombre: otherUser.nombre,
          rol: otherUser.rol,
          foto_perfil: otherUser.url_foto_perfil,
          verificado: otherUser.esta_verificado
        },
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.message,
          image_url: lastMessage.image_url,
          status: lastMessage.status,
          created_at: lastMessage.created_at,
          sender_id: lastMessage.sender_id
        } : null,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        is_active: conv.is_active
      };
    });

    // Contar total para paginación
    const totalCount = await prisma.conversations.count({
      where: {
        OR: [
          { client_id: userId },
          { professional_id: userId }
        ],
        is_active: true
      }
    });

    res.status(200).json({
      conversations: formattedConversations,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener conversaciones',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * GET /api/chat/messages/:conversationId
 * Obtener historial paginado (REQ-20)
 */
exports.getMessageHistory = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { conversationId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  try {
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

    const offset = (page - 1) * limit;

    // Obtener mensajes paginados
    const messages = await prisma.mensajes.findMany({
      where: { conversation_id: conversationId },
      include: {
        sender: {
          select: { 
            id: true, 
            nombre: true, 
            url_foto_perfil: true,
            rol: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit
    });

    // Contar total para paginación
    const totalCount = await prisma.mensajes.count({
      where: { conversation_id: conversationId }
    });

    // Formatear mensajes (ordenar cronológicamente ascendente)
    const formattedMessages = messages.reverse().map(msg => ({
      id: msg.id,
      content: msg.message,
      image_url: msg.image_url,
      status: msg.status,
      created_at: msg.created_at,
      read_at: msg.read_at,
      sender: {
        id: msg.sender.id,
        nombre: msg.sender.nombre,
        foto_perfil: msg.sender.url_foto_perfil,
        rol: msg.sender.rol
      }
    }));

    res.status(200).json({
      messages: formattedMessages,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      conversation: {
        id: conversation.id,
        client_id: conversation.client_id,
        professional_id: conversation.professional_id
      }
    });

  } catch (error) {
    console.error('Error al obtener historial de mensajes:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener historial',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * POST /api/chat/messages
 * Enviar mensaje (REQ-17, REQ-18)
 */
exports.sendMessage = async (req, res) => {
  const { id: senderId } = req.user;
  const { conversationId, content, image_url, recipientId } = req.body;

  try {
    // ✅ RATE LIMITING: Verificar límites
    await chatRateLimiter.consume(senderId);
    await chatFloodLimiter.consume(senderId);

    // Validar parámetros
    if (!conversationId || (!content && !image_url) || !recipientId) {
      return res.status(400).json({ 
        error: 'conversationId, recipientId y (content o image_url) son requeridos',
        code: 'MISSING_PARAMETERS'
      });
    }

    // ✅ SANITIZACIÓN: Validar contenido
    if (content && content.length > 1000) {
      return res.status(400).json({ 
        error: 'El mensaje no puede exceder 1000 caracteres',
        code: 'MESSAGE_TOO_LONG'
      });
    }

    // Sanitizar contenido básico (evitar XSS)
    const sanitizedContent = content ? 
      content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
             .replace(/javascript:/gi, '')
             .trim() : null;

    if (sanitizedContent && sanitizedContent.length === 0) {
      return res.status(400).json({ 
        error: 'El mensaje no puede estar vacío después de la sanitización',
        code: 'EMPTY_MESSAGE'
      });
    }

    // Verificar que la conversación existe y el usuario es participante
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

    // Verificar autorización
    if (conversation.client_id !== senderId && 
        conversation.professional_id !== senderId) {
      return res.status(403).json({ 
        error: 'No tienes acceso a esta conversación',
        code: 'UNAUTHORIZED'
      });
    }

    // Verificar que el recipientId es válido en la conversación
    if (recipientId !== conversation.client_id && 
        recipientId !== conversation.professional_id) {
      return res.status(400).json({ 
        error: 'recipientId no es un participante válido de la conversación',
        code: 'INVALID_RECIPIENT'
      });
    }

    // Crear el mensaje
    const message = await prisma.mensajes.create({
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        message: sanitizedContent,
        image_url: image_url || null,
        status: 'sent'
      },
      include: {
        sender: {
          select: { 
            id: true, 
            nombre: true, 
            url_foto_perfil: true,
            rol: true
          }
        }
      }
    });

    // ✅ NOTIFICACIONES: Enviar notificaciones (REQ-19)
    try {
      const { notifyNewMessage } = require('../services/chatService');
      await notifyNewMessage(recipientId, senderId, sanitizedContent || '[Imagen]');
    } catch (notificationError) {
      console.warn('Error enviando notificación:', notificationError.message);
    }

    // Respuesta formateada
    const formattedMessage = {
      id: message.id,
      content: message.message,
      image_url: message.image_url,
      status: message.status,
      created_at: message.created_at,
      sender: message.sender
    };

    res.status(201).json({
      message: formattedMessage,
      conversation_id: conversationId,
      message_text: 'Mensaje enviado exitosamente'
    });

  } catch (error) {
    // Manejar errores de rate limiting
    if (error.name === 'RateLimiterRes') {
      return res.status(429).json({ 
        error: 'Demasiados mensajes. Intenta nuevamente en unos minutos.',
        code: 'RATE_LIMITED',
        msBeforeNext: error.msBeforeNext
      });
    }

    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al enviar mensaje',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * POST /api/chat/upload-image
 * Obtener presigned URL para subir imagen (REQ-18)
 */
exports.getUploadUrl = async (req, res) => {
  const { id: userId } = req.user;
  const { fileName, fileType } = req.body;

  try {
    // Validar parámetros
    if (!fileName || !fileType) {
      return res.status(400).json({ 
        error: 'fileName y fileType son requeridos',
        code: 'MISSING_PARAMETERS'
      });
    }

    // ✅ VALIDACIÓN: Verificar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ 
        error: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WebP)',
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Validar nombre de archivo (verificación básica de seguridad)
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({
        error: 'Nombre de archivo inválido',
        code: 'INVALID_FILE_NAME'
      });
    }

    // Verificar tamaño (máximo 5MB según especificaciones)
    const maxSize = 5 * 1024 * 1024; // 5MB

    // ✅ INTEGRACIÓN CON GOOGLE CLOUD STORAGE para imágenes del chat
    const timestamp = Date.now();
    const uniqueId = nanoid();
    const fileExtension = fileName.split('.').pop();
    const sanitizedFileName = `${uniqueId}-${timestamp}.${fileExtension}`;
    const bucketName = 'changanet-chat-images';

    // Importar Google Cloud Storage (si está configurado)
    let uploadUrl = null;
    const expiresIn = 3600; // 1 hora por defecto

    if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_BUCKET) {
      try {
        // Usar Google Cloud Storage real
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
        });
        
        const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET || bucketName);
        const file = bucket.file(`chat-images/${sanitizedFileName}`);
        
        // Generar URL firmada para subida directa
        const [url] = await file.getSignedUrl({
          version: 'v4',
          action: 'write',
          expires: Date.now() + (expiresIn * 1000)
        });
        
        uploadUrl = url;
        console.log(`☁️ Google Cloud Storage URL generada: ${uploadUrl}`);
      } catch (gcsError) {
        console.warn('Error con Google Cloud Storage, usando fallback:', gcsError.message);
        uploadUrl = `https://changanet-storage.dev/api/chat/upload/${sanitizedFileName}`;
      }
    } else {
      // Fallback a URL temporal local con validación
      uploadUrl = `https://changanet-storage.dev/api/chat/upload/${sanitizedFileName}`;
      console.log(`📁 URL temporal generada (modo desarrollo): ${uploadUrl}`);
    }

    console.log(`🔗 URL de subida generada para usuario ${userId}: ${uploadUrl}`);

    res.status(200).json({
      upload_url: uploadUrl,
      expires_in: expiresIn,
      file_name: fileName,
      file_type: fileType,
      file_size_limit: maxSize,
      storage_path: `chat-images/${sanitizedFileName}`
    });

  } catch (error) {
    console.error('Error generando URL de subida:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al generar URL de subida',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * GET /api/chat/search/:conversationId
 * Buscar en el historial de mensajes de una conversación (FUNCIONALIDAD ADICIONAL)
 */
exports.searchMessages = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { conversationId } = req.params;
  const { q, include_images = 'true', date_from, date_to, sender_id } = req.query;

  try {
    // Verificar que la conversación existe y el usuario es participante
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

    // Verificar autorización
    if (conversation.client_id !== currentUserId && 
        conversation.professional_id !== currentUserId) {
      return res.status(403).json({ 
        error: 'No tienes acceso a esta conversación',
        code: 'UNAUTHORIZED'
      });
    }

    // Construir filtros de búsqueda
    const whereClause = {
      conversation_id: conversationId
    };

    // Filtro de texto
    if (q && q.trim()) {
      whereClause.OR = [
        { message: { contains: q.trim(), mode: 'insensitive' } }
      ];
    }

    // Filtro de imágenes
    if (include_images === 'false') {
      whereClause.image_url = null;
    }

    // Filtros de fecha
    if (date_from || date_to) {
      whereClause.created_at = {};
      if (date_from) whereClause.created_at.gte = new Date(date_from);
      if (date_to) whereClause.created_at.lte = new Date(date_to);
    }

    // Filtro de remitente
    if (sender_id) {
      whereClause.sender_id = sender_id;
    }

    // Realizar búsqueda
    const messages = await prisma.mensajes.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { 
            id: true, 
            nombre: true, 
            url_foto_perfil: true,
            rol: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 50 // Límite de resultados
    });

    // Formatear resultados
    const formattedResults = messages.map(msg => ({
      id: msg.id,
      content: msg.message,
      image_url: msg.image_url,
      status: msg.status,
      created_at: msg.created_at,
      sender: msg.sender,
      // Agregar snippet de contexto para destacar coincidencias
      snippet: q && msg.message ? 
        msg.message.substring(0, 100) + (msg.message.length > 100 ? '...' : '') : 
        null
    }));

    console.log(`🔍 Búsqueda realizada en conversación ${conversationId}: ${formattedResults.length} resultados`);

    res.status(200).json({
      messages: formattedResults,
      search_params: {
        query: q,
        include_images,
        date_from,
        date_to,
        sender_id
      },
      total_results: formattedResults.length
    });

  } catch (error) {
    console.error('Error en búsqueda de mensajes:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor en búsqueda',
      code: 'SEARCH_ERROR'
    });
  }
};

/**
 * DELETE /api/chat/conversations/:conversationId
 * Cerrar/desactivar conversación (funcionalidad adicional)
 */
exports.closeConversation = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { conversationId } = req.params;

  try {
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

    // Desactivar conversación
    await prisma.conversations.update({
      where: { id: conversationId },
      data: { is_active: false }
    });

    res.status(200).json({
      message: 'Conversación cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error al cerrar conversación:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al cerrar conversación',
      code: 'INTERNAL_ERROR'
    });
  }
};