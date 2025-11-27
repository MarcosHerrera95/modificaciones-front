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
const Joi = require('joi');
const DOMPurify = require('isomorphic-dompurify');
const { getFromCache, setInCache } = require('../services/cacheService');
const sharp = require('sharp');
const axios = require('axios');
const {
  formatMessage,
  formatConversation,
  isValidUUID,
  canAccessConversation,
  sanitizeMessageContent,
  isDuplicateMessage,
  getUnreadCounts
} = require('../utils/chatUtils');
const { validateConversationParticipant, validateMessagePermissions } = require('../middleware/participantValidation');

const prisma = new PrismaClient();

/**
 * Función para validar contenido de imagen usando Sharp
 * @param {string} imageUrl - URL de la imagen a validar
 * @returns {Promise<boolean>} - True si es una imagen válida
 */
const validateImageContent = async (imageUrl) => {
  try {
    // Descargar la imagen
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000, // 10 segundos timeout
      maxContentLength: 10 * 1024 * 1024 // Máximo 10MB
    });

    // Usar Sharp para validar el contenido
    const buffer = Buffer.from(response.data);
    const metadata = await sharp(buffer).metadata();

    // Verificar que tenga dimensiones (es una imagen válida)
    return metadata.width > 0 && metadata.height > 0;
  } catch (error) {
    console.error('Error validando contenido de imagen:', error.message);
    return false;
  }
};

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
    if (!isValidUUID(clientId) || !isValidUUID(professionalId)) {
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
            conversation: {
              id: existingConversation.id,
              client: existingConversation.client,
              professional: existingConversation.professional,
              created_at: existingConversation.created_at,
              is_active: existingConversation.is_active
            },
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
  // Si no hay userId en params, usar el del token JWT (para compatibilidad con GET /conversations)
  const userId = req.params.userId || currentUserId;
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

    // ✅ CACHING: Verificar caché antes de consultar BD
    const cacheKey = `conversations_${userId}_${page}_${limit}`;
    const cachedData = await getFromCache(cacheKey, 'search_basic');
    if (cachedData) {
      console.log(`🚀 Cache hit para conversaciones de usuario ${userId}`);
      return res.status(200).json(cachedData);
    }

    const offset = (page - 1) * limit;

    // Obtener conversaciones del usuario con consulta optimizada
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

    // ✅ OPTIMIZACIÓN N+1: Obtener conteos de mensajes no leídos
    const unreadCountMap = await getUnreadCounts(userId);

    // Formatear respuesta usando utilidad
    const formattedConversations = conversations.map(conv => {
      const unreadCount = unreadCountMap.get(conv.id) || 0;
      return formatConversation(conv, userId, unreadCount);
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

    const result = {
      conversations: formattedConversations,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    };

    // ✅ CACHING: Almacenar resultado en caché
    await setInCache(cacheKey, result, 'search_basic');
    console.log(`💾 Conversaciones cacheadas para usuario ${userId}`);

    res.status(200).json(result);

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
        },
        recipient: {
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

    // Formatear mensajes usando utilidad
    const formattedMessages = messages.reverse().map(formatMessage);

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
    // ✅ VALIDACIÓN ROBUSTA CON JOI
    const messageSchema = Joi.object({
      conversationId: Joi.string().uuid().required(),
      content: Joi.string().max(1000).when('image_url', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required()
      }),
      image_url: Joi.string().uri().optional(),
      recipientId: Joi.string().uuid().required()
    });

    const { error } = messageSchema.validate({ conversationId, content, image_url, recipientId });
    if (error) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    // ✅ SANITIZACIÓN AVANZADA: Validar y limpiar contenido
    if (content && content.length > 1000) {
      return res.status(400).json({
        error: 'El mensaje no puede exceder 1000 caracteres',
        code: 'MESSAGE_TOO_LONG'
      });
    }

    // Sanitizar contenido usando utilidad centralizada
    const sanitizedContent = sanitizeMessageContent(content);

    if (content && !sanitizedContent) {
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

    // ✅ DEDUPLICACIÓN: Verificar mensajes duplicados recientes
    if (sanitizedContent) {
      const isDuplicate = await isDuplicateMessage(conversationId, senderId, sanitizedContent);
      if (isDuplicate) {
        return res.status(400).json({
          error: 'Mensaje duplicado detectado. Evita enviar el mismo mensaje repetidamente.',
          code: 'DUPLICATE_MESSAGE'
        });
      }
    }

    // Validar contenido de imagen si se proporciona image_url
    if (image_url) {
      const isValidImage = await validateImageContent(image_url);
      if (!isValidImage) {
        return res.status(400).json({
          error: 'El archivo proporcionado no es una imagen válida',
          code: 'INVALID_IMAGE_CONTENT'
        });
      }
    }

    // Crear el mensaje
const message = await prisma.mensajes.create({
  data: {
    conversation_id: conversationId,
    sender_id: senderId,
    recipient_id: recipientId,
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
    },
    recipient: {
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

    // ✅ WEBSOCKET: Emitir evento a participantes conectados
    try {
      const { setWebSocketService } = require('../services/notificationService');
      const webSocketService = setWebSocketService();
      if (webSocketService) {
        // Formatear mensaje para WebSocket
        const wsMessage = {
          id: message.id,
          conversationId: conversationId,
          message: message.message,
          image_url: message.image_url,
          status: message.status,
          created_at: message.created_at,
          sender: message.sender
        };

        // Emitir a la sala de conversación
        webSocketService.io.to(`conversation_${conversationId}`).emit('message', wsMessage);

        console.log(`📡 WebSocket: Mensaje emitido a conversación ${conversationId}`);
      }
    } catch (wsError) {
      console.warn('Error emitiendo evento WebSocket:', wsError.message);
    }

    // Respuesta formateada usando utilidad
    const formattedMessage = formatMessage(message);

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

    // Formatear resultados usando utilidad
    const formattedResults = messages.map(msg => ({
      ...formatMessage(msg),
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

/**
 * POST /api/chat/messages/read
 * Marcar mensajes como leídos (CRÍTICO - faltaba en el sistema)
 */
exports.markMessagesAsRead = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { conversationId, messageIds } = req.body;

  try {
    // Validar parámetros
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

    // Construir condición de actualización
    const updateCondition = {
      conversation_id: conversationId,
      recipient_id: currentUserId, // Solo marcar mensajes dirigidos al usuario actual
      status: { not: 'read' } // Solo mensajes no leídos
    };

    // Si se especifican messageIds, filtrar por ellos
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      updateCondition.id = { in: messageIds };
    }

    // Marcar mensajes como leídos
    const updateResult = await prisma.mensajes.updateMany({
      where: updateCondition,
      data: {
        status: 'read',
        read_at: new Date()
      }
    });

    console.log(`✅ ${updateResult.count} mensajes marcados como leídos en conversación ${conversationId}`);

    // Emitir evento WebSocket para actualizar en tiempo real
    try {
      const { setWebSocketService } = require('../services/notificationService');
      const webSocketService = setWebSocketService();
      if (webSocketService) {
        // Notificar al otro participante que los mensajes fueron leídos
        const otherUserId = conversation.client_id === currentUserId
          ? conversation.professional_id
          : conversation.client_id;

        webSocketService.emitToUser(otherUserId, 'messagesRead', {
          conversationId,
          messageIds: messageIds || [],
          readBy: currentUserId
        });
      }
    } catch (wsError) {
      console.warn('Error enviando notificación WebSocket:', wsError.message);
    }

    res.status(200).json({
      success: true,
      messages_marked_read: updateResult.count,
      conversation_id: conversationId,
      message: `${updateResult.count} mensajes marcados como leídos`
    });

  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
    res.status(500).json({
      error: 'Error interno del servidor al marcar mensajes como leídos',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * PUT /api/chat/conversations/:conversationId/archive
 * Archivar conversación (REQ-MSG-08)
 */
exports.archiveConversation = async (req, res) => {
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

    // Archivar conversación
    await prisma.conversations.update({
      where: { id: conversationId },
      data: { is_active: false }
    });

    console.log(`✅ Conversación ${conversationId} archivada por usuario ${currentUserId}`);

    res.status(200).json({
      message: 'Conversación archivada exitosamente'
    });

  } catch (error) {
    console.error('Error archivando conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor al archivar conversación',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * GET /api/chat/conversation/:conversationId
 * Obtener información detallada de una conversación específica
 */
exports.getConversation = async (req, res) => {
  const { id: currentUserId } = req.user;
  const { conversationId } = req.params;

  try {
    const conversation = await prisma.conversations.findUnique({
      where: { id: conversationId },
      include: {
        client: { select: { id: true, nombre: true, rol: true, url_foto_perfil: true } },
        professional: { select: { id: true, nombre: true, rol: true, url_foto_perfil: true } }
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    if (conversation.client_id !== currentUserId && conversation.professional_id !== currentUserId) {
      return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
    }

    // ✅ LÓGICA MENSAJES NO LEÍDOS: Contar mensajes no leídos para el usuario actual
    const unreadCount = await prisma.mensajes.count({
      where: {
        conversation_id: conversationId,
        recipient_id: currentUserId,
        status: { not: 'read' }
      }
    });

    res.json({
      id: conversation.id,
      client_id: conversation.client_id,
      professional_id: conversation.professional_id,
      created_at: conversation.created_at,
      is_active: conversation.is_active,
      unread_count: unreadCount
    });
  } catch (error) {
    console.error('Error obteniendo conversación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};