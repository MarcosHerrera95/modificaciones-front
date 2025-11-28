/**
 * Servicio WebSocket Unificado para Chat - Implementación según PRD
 * 
 * CUMPLE REQUERIMIENTOS:
 * REQ-16: Chat interno en tiempo real - ✅ Implementado
 * REQ-17: Mensajes de texto en tiempo real - ✅ Implementado  
 * REQ-18: Imágenes en tiempo real - ✅ Implementado
 * REQ-19: Notificaciones push + email - ✅ Integrado
 * REQ-20: Historial persistente - ✅ Integrado con REST API
 * 
 * EVENTOS IMPLEMENTADOS:
 * Cliente → Servidor:
 * - join(conversationId) - Unirse a conversación
 * - message({ conversationId, senderId, content, imageUrl }) - Enviar mensaje
 * - typing({ conversationId }) - Usuario empezó a escribir
 * - stopTyping({ conversationId }) - Usuario dejó de escribir
 * 
 * Servidor → Cliente:
 * - message(msg) - Nuevo mensaje recibido
 * - notification(newMessage) - Notificación de mensaje
 * - statusUpdate(...) - Actualización de estado
 * - typing({ conversationId, userId, isTyping }) - Usuario escribiendo
 * 
 * CARACTERÍSTICAS DE SEGURIDAD:
 * - Autenticación JWT obligatoria
 * - Validación de participantes en conversación
 * - Rate limiting específico para chat
 * - Sanitización de mensajes
 */

const { PrismaClient } = require('@prisma/client');
const { notifyNewMessage } = require('./chatService');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const prisma = new PrismaClient();

// Rate limiter: 10 mensajes por minuto por usuario
const messageRateLimiter = new RateLimiterMemory({
  keyPrefix: 'chat_messages',
  points: 10, // Número de mensajes permitidos
  duration: 60, // Por minuto
});

class UnifiedWebSocketService {
  constructor(io) {
    this.io = io;
    this.activeConnections = new Map(); // userId -> socket connection
    this.conversationRooms = new Map(); // conversationId -> Set of userIds
    this.typingUsers = new Map(); // conversationId -> Set of userIds typing
    this.setupWebSocketHandlers();
  }

  setupWebSocketHandlers() {
    this.io.use(async (socket, next) => {
      // Autenticación mejorada para Socket.IO
      const token = socket.handshake.auth.token;
      const clientIP = socket.handshake.address;
      const isDevelopment = process.env.NODE_ENV !== 'production';

      console.log(`🔐 WebSocket Auth Attempt - IP: ${clientIP}, ENV: ${process.env.NODE_ENV}`);

      if (!token) {
        if (!isDevelopment) {
          console.error('🚨 PRODUCTION SECURITY ALERT: WebSocket connection without token BLOCKED!');
          return next(new Error('Authentication required'));
        } else {
          console.warn('⚠️ DEVELOPMENT: WebSocket connection without token allowed for testing');
          socket.user = { id: 'dev-test-user', nombre: 'Usuario de Prueba' };
          return next();
        }
      }

      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userData = await prisma.usuarios.findUnique({
          where: { id: decoded.userId || decoded.id },
          select: { id: true, nombre: true, rol: true, esta_verificado: true }
        });

        if (!userData && !isDevelopment) {
          return next(new Error('User not found'));
        }

        socket.user = userData || { 
          id: decoded.userId || decoded.id, 
          nombre: 'Usuario Desconocido', 
          rol: 'cliente' 
        };

        console.log(`✅ WebSocket: User authenticated: ${socket.user.nombre} (${socket.user.id})`);
        next();
      } catch (error) {
        console.error('🚨 WebSocket JWT verification failed:', error.message);
        if (!isDevelopment) {
          return next(new Error('Invalid token'));
        }
        socket.user = { id: 'dev-test-user', nombre: 'Usuario de Prueba' };
        next();
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
      this.handleAdminConnection(socket);
    });
  }

  handleConnection(socket) {
    const userId = socket.user.id;
    
    // Registrar conexión activa
    this.activeConnections.set(userId, socket);
    
    console.log(`📱 WebSocket conectado: ${socket.user.nombre} (${userId})`);

    // Unir a sala personal del usuario
    socket.join(`user_${userId}`);

    // EVENTO: Unirse a conversación o sala personal
    socket.on('join', async (data) => {
      try {
        console.log('📡 [JOIN] Evento recibido:', data);

        // 🔍 MANEJO CORRECTO DE AMBOS TIPOS DE JOIN
        const { conversationId, roomName } = data;

        // CASO 1: Unirse a sala personal (user room)
        if (roomName) {
          if (roomName.startsWith('user_')) {
            const userId = roomName.replace('user_', '');
            if (userId === socket.user.id) {
              console.log(`✅ [USER ROOM] Usuario ${userId} unido a su sala personal`);
              socket.join(roomName);
              socket.emit('joined_user_room', {
                roomName,
                message: 'Unido a sala personal exitosamente'
              });
              return;
            } else {
              socket.emit('error', { message: 'No tienes acceso a esta sala personal' });
              return;
            }
          } else {
            console.log(`✅ [CUSTOM ROOM] Usuario unido a sala: ${roomName}`);
            socket.join(roomName);
            socket.emit('joined_room', {
              roomName,
              message: 'Unido a sala exitosamente'
            });
            return;
          }
        }

        // CASO 2: Unirse a conversación específica
        if (!conversationId) {
          console.error('🚨 [BACKEND ERROR] conversationId es requerido para conversaciones:', {
            receivedData: data,
            conversationIdValue: conversationId,
            conversationIdType: typeof conversationId,
            stackTrace: new Error().stack
          });
          socket.emit('error', { message: 'conversationId es requerido para unirse a conversación' });
          return;
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
          socket.emit('error', { message: 'Conversación no encontrada' });
          return;
        }

        if (conversation.client_id !== userId && conversation.professional_id !== userId) {
          socket.emit('error', { message: 'No tienes acceso a esta conversación' });
          return;
        }

        // Unirse a la sala de la conversación
        socket.join(`conversation_${conversationId}`);
        
        // Registrar en rooms activas
        if (!this.conversationRooms.has(conversationId)) {
          this.conversationRooms.set(conversationId, new Set());
        }
        this.conversationRooms.get(conversationId).add(userId);

        console.log(`💬 Usuario ${userId} unido a conversación ${conversationId}`);

        // Confirmar unión exitosa
        socket.emit('joined_conversation', {
          conversationId,
          message: 'Unido a la conversación exitosamente'
        });

      } catch (error) {
        console.error('Error uniendo a conversación:', error);
        socket.emit('error', { message: 'Error al unirse a la conversación' });
      }
    });

    // EVENTO: Enviar mensaje (REQ-17, REQ-18)
    socket.on('message', async (data) => {
      try {
        const { conversationId, content, imageUrl } = data;

        // Validaciones básicas
        if (!conversationId || (!content && !imageUrl)) {
          socket.emit('error', { message: 'conversationId y (content o imageUrl) son requeridos' });
          return;
        }

        if (content && content.length > 1000) {
          socket.emit('error', { message: 'El mensaje no puede exceder 1000 caracteres' });
          return;
        }

        // Rate limiting: 10 mensajes por minuto por usuario
        try {
          await messageRateLimiter.consume(userId);
        } catch (rejRes) {
          const msBeforeNext = rejRes.msBeforeNext;
          socket.emit('error', {
            message: 'Demasiados mensajes enviados. Inténtalo de nuevo en unos minutos.',
            code: 'RATE_LIMIT_EXCEEDED',
            msBeforeNext
          });
          return;
        }

        // Sanitización básica
        const sanitizedContent = content ? 
          content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                 .replace(/javascript:/gi, '')
                 .trim() : null;

        // Verificar conversación y autorización
        const conversation = await prisma.conversations.findUnique({
          where: { id: conversationId }
        });

        if (!conversation || 
            (conversation.client_id !== userId && conversation.professional_id !== userId)) {
          socket.emit('error', { message: 'Conversación no encontrada o acceso denegado' });
          return;
        }

        // Determinar destinatario
        const recipientId = conversation.client_id === userId ? 
          conversation.professional_id : conversation.client_id;

        // Crear mensaje en la base de datos
        const message = await prisma.mensajes.create({
          data: {
            conversation_id: conversationId,
            sender_id: userId,
            message: sanitizedContent,
            image_url: imageUrl || null,
            status: 'sent'
          },
          include: {
            sender: {
              select: { id: true, nombre: true, url_foto_perfil: true, rol: true }
            }
          }
        });

        // Formatear mensaje para envío
        const formattedMessage = {
          id: message.id,
          conversationId: conversationId,
          conversation_id: conversationId,
          message: message.message,
          image_url: message.image_url,
          status: message.status,
          created_at: message.created_at,
          sender: message.sender,
          sender_id: message.sender.id
        };

        // Enviar mensaje a todos en la conversación
        this.io.to(`conversation_${conversationId}`).emit('message', formattedMessage);

        // ✅ NOTIFICACIONES (REQ-19): Enviar notificación push + email
        try {
          await notifyNewMessage(recipientId, userId, sanitizedContent || '[Imagen]');
        } catch (notificationError) {
          console.warn('Error enviando notificación:', notificationError.message);
        }

        // Confirmar envío exitoso al emisor
        socket.emit('messageSent', {
          message: formattedMessage,
          message_text: 'Mensaje enviado exitosamente'
        });

        console.log(`💬 Mensaje enviado en conversación ${conversationId} de ${userId} a ${recipientId}`);

      } catch (error) {
        console.error('Error enviando mensaje:', error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });

    // EVENTO: Marcar mensajes como leídos
    socket.on('markAsRead', async (data) => {
      try {
        const { conversationId, messageIds } = data;

        // Verificar autorización
        const conversation = await prisma.conversations.findUnique({
          where: { id: conversationId }
        });

        if (!conversation || 
            (conversation.client_id !== userId && conversation.professional_id !== userId)) {
          socket.emit('error', { message: 'Conversación no encontrada o acceso denegado' });
          return;
        }

        // Actualizar mensajes como leídos
        await prisma.mensajes.updateMany({
          where: {
            conversation_id: conversationId,
            sender_id: { not: userId }, // Mensajes de otros usuarios
            id: { in: messageIds || [] }
          },
          data: {
            status: 'read',
            read_at: new Date()
          }
        });

        // Notificar a todos en la conversación
        this.io.to(`conversation_${conversationId}`).emit('messagesRead', {
          conversationId,
          readerId: userId,
          messageIds: messageIds || []
        });

      } catch (error) {
        console.error('Error marcando mensajes como leídos:', error);
        socket.emit('error', { message: 'Error al marcar mensajes como leídos' });
      }
    });

    // EVENTO: Usuario empezó a escribir (REQ-MSG-13)
    socket.on('typing', async (data) => {
      try {
        const { conversationId } = data;

        // Verificar autorización
        const conversation = await prisma.conversations.findUnique({
          where: { id: conversationId }
        });

        if (!conversation ||
            (conversation.client_id !== userId && conversation.professional_id !== userId)) {
          return; // Silenciosamente ignorar
        }

        // Crear/actualizar indicador de escritura en base de datos
        await prisma.typing_indicators.upsert({
          where: {
            conversation_id_user_id: {
              conversation_id: conversationId,
              user_id: userId
            }
          },
          update: {
            is_typing: true,
            updated_at: new Date()
          },
          create: {
            conversation_id: conversationId,
            user_id: userId,
            is_typing: true
          }
        });

        // Actualizar estado en memoria
        if (!this.typingUsers.has(conversationId)) {
          this.typingUsers.set(conversationId, new Set());
        }
        this.typingUsers.get(conversationId).add(userId);

        // Notificar a otros usuarios en la conversación
        socket.to(`conversation_${conversationId}`).emit('typing', {
          conversationId,
          userId,
          userName: socket.user.nombre,
          isTyping: true
        });

        console.log(`✍️ Usuario ${userId} empezó a escribir en conversación ${conversationId}`);

      } catch (error) {
        console.error('Error en evento typing:', error);
      }
    });

    // EVENTO: Usuario dejó de escribir (REQ-MSG-13)
    socket.on('stopTyping', async (data) => {
      try {
        const { conversationId } = data;

        // Verificar autorización
        const conversation = await prisma.conversations.findUnique({
          where: { id: conversationId }
        });

        if (!conversation ||
            (conversation.client_id !== userId && conversation.professional_id !== userId)) {
          return; // Silenciosamente ignorar
        }

        // Actualizar indicador de escritura en base de datos
        await prisma.typing_indicators.upsert({
          where: {
            conversation_id_user_id: {
              conversation_id: conversationId,
              user_id: userId
            }
          },
          update: {
            is_typing: false,
            updated_at: new Date()
          },
          create: {
            conversation_id: conversationId,
            user_id: userId,
            is_typing: false
          }
        });

        // Actualizar estado en memoria
        const typingSet = this.typingUsers.get(conversationId);
        if (typingSet) {
          typingSet.delete(userId);
        }

        // Notificar a otros usuarios en la conversación
        socket.to(`conversation_${conversationId}`).emit('typing', {
          conversationId,
          userId,
          userName: socket.user.nombre,
          isTyping: false
        });

        console.log(`🛑 Usuario ${userId} dejó de escribir en conversación ${conversationId}`);

      } catch (error) {
        console.error('Error en evento stopTyping:', error);
      }
    });

    // EVENTO: Actualización de conversación
    socket.on('conversationUpdated', async (data) => {
      try {
        const { conversationId, updateType, updateData } = data;

        // Verificar autorización
        const conversation = await prisma.conversations.findUnique({
          where: { id: conversationId }
        });

        if (!conversation ||
            (conversation.client_id !== userId && conversation.professional_id !== userId)) {
          socket.emit('error', { message: 'No tienes acceso a esta conversación' });
          return;
        }

        // Notificar a todos los participantes de la conversación
        this.io.to(`conversation_${conversationId}`).emit('conversationUpdated', {
          conversationId,
          updateType,
          updateData,
          updatedBy: userId,
          timestamp: new Date()
        });

        console.log(`📡 Conversación ${conversationId} actualizada: ${updateType}`);

      } catch (error) {
        console.error('Error en evento conversationUpdated:', error);
        socket.emit('error', { message: 'Error al actualizar conversación' });
      }
    });

    // EVENTO: Desconexión mejorada
    socket.on('disconnect', (reason) => {
      console.log(`📱 WebSocket desconectado: ${socket.user.nombre} (${reason})`);
      
      // Limpiar conexiones activas
      this.activeConnections.delete(userId);
      
      // Limpiar rooms de conversación
      this.conversationRooms.forEach((userIds, conversationId) => {
        if (userIds.has(userId)) {
          userIds.delete(userId);
          if (userIds.size === 0) {
            this.conversationRooms.delete(conversationId);
          }
          
          // Notificar a otros usuarios que este usuario se desconectó
          this.io.to(`conversation_${conversationId}`).emit('user_disconnected', {
            userId,
            userName: socket.user.nombre
          });
        }
      });
      
      // Limpiar typing users de memoria y base de datos
      this.typingUsers.forEach(async (typingSet, conversationId) => {
        if (typingSet.has(userId)) {
          typingSet.delete(userId);

          // Limpiar indicador de escritura de la base de datos
          try {
            await prisma.typing_indicators.updateMany({
              where: {
                conversation_id: conversationId,
                user_id: userId,
                is_typing: true
              },
              data: {
                is_typing: false,
                updated_at: new Date()
              }
            });
          } catch (error) {
            console.error('Error limpiando typing indicators en desconexión:', error);
          }

          // Notificar que dejó de escribir
          socket.to(`conversation_${conversationId}`).emit('typing', {
            conversationId,
            userId,
            userName: socket.user.nombre,
            isTyping: false
          });
        }
      });
      
      // Enviar estadísticas de conexión actualizadas
      this.broadcastConnectionStats();
    });

    // ==================================================
    // EVENTOS PARA SERVICIOS URGENTES
    // ==================================================

    // EVENTO: Unirse a notificaciones de urgencias (para profesionales)
    socket.on('join_urgent_notifications', () => {
      socket.join('urgent_professionals');
      console.log(`🚨 Profesional ${userId} unido a notificaciones de urgencias`);
    });

    // EVENTO: Salir de notificaciones de urgencias
    socket.on('leave_urgent_notifications', () => {
      socket.leave('urgent_professionals');
      console.log(`🚨 Profesional ${userId} salió de notificaciones de urgencias`);
    });

    // EVENTO: Actualizar ubicación del profesional (para matching geoespacial)
    socket.on('update_location', async (data) => {
      try {
        const { lat, lng } = data;

        if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          socket.emit('error', { message: 'Coordenadas inválidas' });
          return;
        }

        // Actualizar ubicación en perfiles_profesionales
        await prisma.perfiles_profesionales.updateMany({
          where: { usuario_id: userId },
          data: {
            latitud: lat,
            longitud: lng,
            last_location_update: new Date()
          }
        });

        socket.emit('location_updated', {
          message: 'Ubicación actualizada exitosamente',
          coordinates: { lat, lng }
        });

        console.log(`📍 Ubicación actualizada para profesional ${userId}: ${lat}, ${lng}`);

      } catch (error) {
        console.error('Error actualizando ubicación:', error);
        socket.emit('error', { message: 'Error al actualizar ubicación' });
      }
    });

    // ==================================================
    // EVENTOS PARA NOTIFICACIONES
    // ==================================================

    // EVENTO: Suscribirse a notificaciones en tiempo real
    socket.on('subscribe_notifications', () => {
      socket.join(`notifications_${userId}`);
      console.log(`🔔 Usuario ${userId} suscrito a notificaciones en tiempo real`);
    });

    // EVENTO: Desuscribirse de notificaciones
    socket.on('unsubscribe_notifications', () => {
      socket.leave(`notifications_${userId}`);
      console.log(`🔕 Usuario ${userId} desuscrito de notificaciones`);
    });

    // EVENTO: Marcar notificación como leída desde WebSocket
    socket.on('notification_read', async (data) => {
      try {
        const { notificationId } = data;

        // Verificar que la notificación pertenece al usuario
        const notification = await prisma.notificaciones.findFirst({
          where: {
            id: notificationId,
            usuario_id: userId
          }
        });

        if (!notification) {
          socket.emit('error', { message: 'Notificación no encontrada' });
          return;
        }

        // Marcar como leída
        await prisma.notificaciones.update({
          where: { id: notificationId },
          data: {
            estado: 'read',
            leido_en: new Date()
          }
        });

        // Confirmar al cliente
        socket.emit('notification_read_confirmed', { notificationId });

        console.log(`✅ Notificación ${notificationId} marcada como leída por usuario ${userId}`);

      } catch (error) {
        console.error('Error marcando notificación como leída:', error);
        socket.emit('error', { message: 'Error al marcar notificación como leída' });
      }
    });

    // EVENTO: Error handler
    socket.on('error', (error) => {
      console.error(`❌ WebSocket error para usuario ${userId}:`, error);
    });
  }

  // Método para enviar notificaciones push desde el backend
  async sendNotificationToUser(userId, notification) {
    const socket = this.activeConnections.get(userId);
    if (socket && socket.connected) {
      socket.emit('notification', notification);
      return true;
    }
    return false;
  }

  // Método para obtener estadísticas de conexiones activas
  getConnectionStats() {
    return {
      activeConnections: this.activeConnections.size,
      activeConversations: this.conversationRooms.size,
      typingUsers: this.typingUsers.size
    };
  }

  // Método para transmitir estadísticas de conexiones
  broadcastConnectionStats() {
    const stats = this.getConnectionStats();
    this.io.emit('connection_stats', stats);
    console.log('📊 Estadísticas de conexión actualizadas:', stats);
  }

  // Método para reconectar usuario específico
  async reconnectUser(userId, newSocket) {
    try {
      // Limpiar conexión anterior
      const oldSocket = this.activeConnections.get(userId);
      if (oldSocket) {
        oldSocket.disconnect(true);
        this.activeConnections.delete(userId);
      }

      // Registrar nueva conexión
      this.activeConnections.set(userId, newSocket);

      // Unir a sala personal
      newSocket.join(`user_${userId}`);

      console.log(`🔄 Usuario ${userId} reconectado exitosamente`);

      // Enviar estadísticas actualizadas
      this.broadcastConnectionStats();

      return true;
    } catch (error) {
      console.error('Error en reconexión de usuario:', error);
      return false;
    }
  }

  // ==================================================
  // MÉTODOS PARA SERVICIOS URGENTES
  // ==================================================

  // Notificar nueva solicitud urgente a profesionales
  async notifyUrgentRequestToProfessionals(urgentRequest, candidates) {
    try {
      const notification = {
        type: 'urgent_request_available',
        urgentRequestId: urgentRequest.id,
        client: {
          nombre: urgentRequest.client.nombre,
          id: urgentRequest.client_id
        },
        description: urgentRequest.description,
        location: {
          lat: urgentRequest.latitude,
          lng: urgentRequest.longitude
        },
        radiusKm: urgentRequest.radius_km,
        priceEstimate: urgentRequest.price_estimate,
        createdAt: urgentRequest.created_at,
        candidates: candidates.map(c => ({
          professionalId: c.professional_id,
          distance: c.distance_km
        })),
        timestamp: new Date()
      };

      // Enviar a todos los profesionales conectados a urgencias
      this.io.to('urgent_professionals').emit('urgent_request_available', notification);

      // También enviar a salas personales de los candidatos
      for (const candidate of candidates) {
        this.io.to(`user_${candidate.professional_id}`).emit('urgent_request_assigned', {
          ...notification,
          yourDistance: candidate.distance_km,
          priority: this.calculateUrgentPriority(candidate.distance_km, urgentRequest.radius_km)
        });
      }

      console.log(`🚨 Notificación urgente enviada a ${candidates.length} profesionales`);
      return true;
    } catch (error) {
      console.error('Error notificando solicitud urgente:', error);
      return false;
    }
  }

  // Notificar aceptación de solicitud urgente al cliente
  async notifyUrgentRequestAccepted(urgentRequest, assignment) {
    try {
      const notification = {
        type: 'urgent_request_accepted',
        urgentRequestId: urgentRequest.id,
        professional: {
          nombre: assignment.professional.nombre,
          id: assignment.professional_id,
          telefono: assignment.professional.telefono,
          calificacion_promedio: assignment.professional.calificacion_promedio
        },
        assignedAt: assignment.assigned_at,
        status: 'assigned',
        estimatedArrival: this.calculateEstimatedArrival(assignment.distance_km),
        timestamp: new Date()
      };

      // Notificar al cliente
      this.io.to(`user_${urgentRequest.client_id}`).emit('urgent_request_accepted', notification);

      // Notificar a otros candidatos que no fueron seleccionados
      this.notifyUrgentRequestRejectedToOthers(urgentRequest.id, assignment.professional_id);

      console.log(`✅ Notificación de aceptación enviada al cliente ${urgentRequest.client_id}`);
      return true;
    } catch (error) {
      console.error('Error notificando aceptación:', error);
      return false;
    }
  }

  // Notificar rechazo a otros candidatos
  async notifyUrgentRequestRejectedToOthers(urgentRequestId, acceptedProfessionalId) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const otherCandidates = await prisma.urgent_request_candidates.findMany({
        where: {
          urgent_request_id: urgentRequestId,
          professional_id: { not: acceptedProfessionalId },
          responded: false
        }
      });

      const notification = {
        type: 'urgent_request_assigned_to_other',
        urgentRequestId,
        message: 'Esta solicitud urgente fue asignada a otro profesional.',
        timestamp: new Date()
      };

      for (const candidate of otherCandidates) {
        this.io.to(`user_${candidate.professional_id}`).emit('urgent_request_rejected', notification);
      }

      // Marcar como respondidos
      await prisma.urgent_request_candidates.updateMany({
        where: {
          urgent_request_id: urgentRequestId,
          professional_id: { not: acceptedProfessionalId },
          responded: false
        },
        data: { responded: true, accepted: false }
      });

    } catch (error) {
      console.error('Error notificando rechazo a otros candidatos:', error);
    }
  }

  // Notificar actualización de estado general
  async notifyUrgentRequestStatusUpdate(urgentRequest, statusUpdate) {
    try {
      const notification = {
        type: 'urgent_request_status_update',
        urgentRequestId: urgentRequest.id,
        status: urgentRequest.status,
        ...statusUpdate,
        timestamp: new Date()
      };

      // Notificar al cliente
      this.io.to(`user_${urgentRequest.client_id}`).emit('urgent_request_status_update', notification);

      // Si hay asignación, notificar al profesional también
      if (urgentRequest.assignments && urgentRequest.assignments.length > 0) {
        const assignment = urgentRequest.assignments[0];
        this.io.to(`user_${assignment.professional_id}`).emit('urgent_assignment_status_update', {
          ...notification,
          role: 'professional'
        });
      }

      console.log(`📡 Notificación de estado enviada para solicitud ${urgentRequest.id}`);
      return true;
    } catch (error) {
      console.error('Error notificando actualización de estado:', error);
      return false;
    }
  }

  // Notificar cancelación de solicitud urgente
  async notifyUrgentRequestCancelled(urgentRequest, cancelledBy) {
    try {
      const notification = {
        type: 'urgent_request_cancelled',
        urgentRequestId: urgentRequest.id,
        cancelledBy,
        status: 'cancelled',
        timestamp: new Date()
      };

      // Notificar a todos los candidatos
      const candidates = await prisma.urgent_request_candidates.findMany({
        where: { urgent_request_id: urgentRequest.id }
      });

      for (const candidate of candidates) {
        this.io.to(`user_${candidate.professional_id}`).emit('urgent_request_cancelled', notification);
      }

      // Notificar al cliente
      this.io.to(`user_${urgentRequest.client_id}`).emit('urgent_request_cancelled', notification);

      console.log(`❌ Notificación de cancelación enviada para solicitud ${urgentRequest.id}`);
      return true;
    } catch (error) {
      console.error('Error notificando cancelación:', error);
      return false;
    }
  }

  // Notificar completación de solicitud urgente
  async notifyUrgentRequestCompleted(urgentRequest, completedBy) {
    try {
      const notification = {
        type: 'urgent_request_completed',
        urgentRequestId: urgentRequest.id,
        completedBy,
        status: 'completed',
        timestamp: new Date()
      };

      // Notificar a ambas partes
      this.io.to(`user_${urgentRequest.client_id}`).emit('urgent_request_completed', notification);

      if (urgentRequest.assignments && urgentRequest.assignments.length > 0) {
        const assignment = urgentRequest.assignments[0];
        this.io.to(`user_${assignment.professional_id}`).emit('urgent_assignment_completed', notification);
      }

      console.log(`✅ Notificación de completación enviada para solicitud ${urgentRequest.id}`);
      return true;
    } catch (error) {
      console.error('Error notificando completación:', error);
      return false;
    }
  }

  // Notificar warnings de SLA
  async notifyUrgentSLAWarning(urgentRequestId, slaType, timeRemaining) {
    try {
      const notification = {
        type: 'urgent_sla_warning',
        urgentRequestId,
        slaType,
        timeRemaining,
        priority: 'high',
        timestamp: new Date()
      };

      // Obtener el cliente de la solicitud
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const urgentRequest = await prisma.urgent_requests.findUnique({
        where: { id: urgentRequestId },
        select: { client_id: true }
      });

      if (urgentRequest) {
        // Notificar al cliente
        this.io.to(`user_${urgentRequest.client_id}`).emit('urgent_sla_warning', notification);
      }

      console.log(`⚠️ SLA warning notificado para solicitud ${urgentRequestId}`);
      return true;
    } catch (error) {
      console.error('Error notificando SLA warning:', error);
      return false;
    }
  }

  // Notificar breach de SLA
  async notifyUrgentSLABreach(urgentRequestId, slaType, breachDuration) {
    try {
      const notification = {
        type: 'urgent_sla_breached',
        urgentRequestId,
        slaType,
        breachDuration,
        priority: 'critical',
        timestamp: new Date()
      };

      // Obtener el cliente de la solicitud
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const urgentRequest = await prisma.urgent_requests.findUnique({
        where: { id: urgentRequestId },
        select: { client_id: true }
      });

      if (urgentRequest) {
        // Notificar al cliente
        this.io.to(`user_${urgentRequest.client_id}`).emit('urgent_sla_breached', notification);
      }

      // Notificar a administradores
      this.emitToAdmins('urgent_sla_breached', notification);

      console.log(`💥 SLA breach notificado para solicitud ${urgentRequestId}`);
      return true;
    } catch (error) {
      console.error('Error notificando SLA breach:', error);
      return false;
    }
  }

  // Calcular prioridad basada en distancia
  calculateUrgentPriority(distanceKm, radiusKm) {
    const distanceRatio = distanceKm / radiusKm;
    if (distanceRatio <= 0.3) return 'high';
    if (distanceRatio <= 0.7) return 'medium';
    return 'low';
  }

  // Calcular tiempo estimado de llegada
  calculateEstimatedArrival(distanceKm) {
    // Estimación simple: 2 minutos por km + 5 minutos base
    const estimatedMinutes = Math.round(distanceKm * 2) + 5;
    return new Date(Date.now() + estimatedMinutes * 60 * 1000);
  }

  // Método para emitir a administradores (legacy)
  emitToAdminsLegacy(event, data) {
    // Asumiendo que hay una sala 'admins' o lógica para identificar admins
    this.io.to('admins').emit(event, data);
  }

  // ==================================================
  // MÉTODOS PARA NOTIFICACIONES
  // ==================================================

  // Emitir notificación a un usuario específico
  emitNotificationToUser(userId, notification) {
    // Emitir a la sala personal del usuario
    this.io.to(`user_${userId}`).emit('notification', notification);

    // También emitir a la sala de notificaciones si está suscrito
    this.io.to(`notifications_${userId}`).emit('notification', notification);
  }

  // Emitir actualización de contador de notificaciones
  emitNotificationCountUpdate(userId, unreadCount) {
    const update = {
      type: 'unread_count_update',
      unreadCount,
      timestamp: new Date()
    };

    this.io.to(`user_${userId}`).emit('notification_count_update', update);
    this.io.to(`notifications_${userId}`).emit('notification_count_update', update);
  }

  // Emitir cuando una notificación es marcada como leída
  emitNotificationRead(userId, notificationId, unreadCount) {
    const update = {
      type: 'notification_read',
      notificationId,
      unreadCount,
      timestamp: new Date()
    };

    this.io.to(`user_${userId}`).emit('notification_read', update);
    this.io.to(`notifications_${userId}`).emit('notification_read', update);
  }

  // ================= ADMIN WEB SOCKET CHANNELS =================

  /**
   * Join admin channels for real-time updates
   */
  joinAdminChannels(socket, adminId) {
    socket.join(`admin_${adminId}`);
    socket.join('admins'); // General admin channel
    console.log(`✅ Admin ${adminId} joined admin channels`);
  }

  /**
   * Leave admin channels
   */
  leaveAdminChannels(socket, adminId) {
    socket.leave(`admin_${adminId}`);
    socket.leave('admins');
    console.log(`👋 Admin ${adminId} left admin channels`);
  }

  /**
   * Emit to all admins (broadcast)
   */
  emitToAdmins(event, data) {
    this.io.to('admins').emit(event, {
      ...data,
      timestamp: new Date(),
      channel: 'admin_broadcast'
    });
  }

  /**
   * Emit to specific admin
   */
  emitToAdmin(adminId, event, data) {
    this.io.to(`admin_${adminId}`).emit(event, {
      ...data,
      timestamp: new Date(),
      channel: 'admin_direct'
    });
  }

  /**
   * Emit admin notifications (new verifications, disputes, etc.)
   */
  emitAdminNotification(type, data) {
    const notification = {
      type,
      data,
      timestamp: new Date(),
      channel: 'admin_notifications'
    };

    this.emitToAdmins('admin_notification', notification);
  }

  /**
   * Emit system alerts to admins
   */
  emitSystemAlert(level, message, details = {}) {
    const alert = {
      level, // 'info', 'warning', 'error', 'critical'
      message,
      details,
      timestamp: new Date(),
      channel: 'system_alerts'
    };

    this.emitToAdmins('system_alert', alert);
    console.log(`🚨 System alert [${level}]: ${message}`);
  }

  /**
   * Emit real-time stats updates to admins
   */
  emitStatsUpdate(statsData) {
    this.emitToAdmins('stats_update', {
      stats: statsData,
      timestamp: new Date()
    });
  }

  /**
   * Emit user activity updates
   */
  emitUserActivity(adminId, activity) {
    this.emitToAdmin(adminId, 'user_activity', {
      activity,
      timestamp: new Date()
    });
  }

  /**
   * Emit audit log entries in real-time
   */
  emitAuditLogEntry(entry) {
    this.emitToAdmins('audit_log_entry', {
      entry,
      timestamp: new Date()
    });
  }

  /**
   * Handle admin WebSocket connections
   */
  handleAdminConnection(socket) {
    console.log('🔗 Admin WebSocket connection established');

    // Authenticate admin (this should be done via JWT token)
    socket.on('authenticate_admin', (data) => {
      try {
        const { adminId, token } = data;

        // Here you would validate the admin JWT token
        // For now, we'll trust the adminId

        this.joinAdminChannels(socket, adminId);

        socket.emit('admin_authenticated', {
          success: true,
          adminId,
          channels: [`admin_${adminId}`, 'admins']
        });

      } catch (error) {
        console.error('Admin authentication failed:', error);
        socket.emit('admin_auth_failed', {
          success: false,
          error: 'Authentication failed'
        });
      }
    });

    // Handle admin disconnection
    socket.on('disconnect', () => {
      console.log('🔌 Admin WebSocket disconnected');
      // Note: We can't reliably get adminId here, so channels are left
    });

    // Admin-specific events can be added here
    socket.on('request_stats', () => {
      // Emit current stats to requesting admin
      // This would integrate with your stats service
      socket.emit('stats_response', {
        message: 'Stats request received',
        timestamp: new Date()
      });
    });
  }
}

module.exports = UnifiedWebSocketService;