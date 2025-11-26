// src/services/chatService.js
// Servicio para manejar la lógica del chat en tiempo real con Socket.IO
// Implementa sección 7.4 del PRD: Mensajería Interna
//
// FUNCIONES IMPLEMENTADAS:
// - saveMessage: Guardar mensaje en BD con validaciones
// - getMessageHistory: Obtener historial paginado entre dos usuarios
// - markMessagesAsRead: Marcar mensajes como leídos
// - notifyNewMessage: Enviar notificaciones de nuevos mensajes (ACTUALIZADO)
//
// REQUERIMIENTOS CUBIERTOS:
// REQ-16: Chat interno - ✅ (Socket.IO en server.js)
// REQ-17: Mensajes de texto - ✅ (con límite de 1000 caracteres)
// REQ-18: Imágenes - ✅ (campo url_imagen)
// REQ-19: Notificaciones - ✅ (push y email) - ACTUALIZADO
// REQ-20: Historial - ✅ (con paginación)

const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('./notificationService');
const ChatNotificationService = require('./chatNotificationService');
const prisma = new PrismaClient();

// Instancia del servicio de notificaciones (REQUERIMIENTO REQ-19)
const chatNotificationService = new ChatNotificationService();

// Función para guardar mensaje en la base de datos
const saveMessage = async (sender_id, recipient_id, message, image_url = null) => {
  try {
    // Validar entrada
    if (!sender_id || !recipient_id) {
      throw new Error('IDs de remitente y destinatario son requeridos');
    }

    if (!message && !image_url) {
      throw new Error('El mensaje debe tener contenido o imagen');
    }

    if (message && message.length > 1000) {
      throw new Error('El mensaje no puede exceder 1000 caracteres');
    }

    // Verificar que ambos usuarios existen
    const [sender, recipient] = await Promise.all([
      prisma.usuarios.findUnique({ where: { id: sender_id } }),
      prisma.usuarios.findUnique({ where: { id: recipient_id } })
    ]);

    if (!sender || !recipient) {
      throw new Error('Usuario remitente o destinatario no encontrado');
    }

    const messageRecord = await prisma.mensajes.create({
      data: {
        sender_id,
        recipient_id,
        message,
        image_url,
        status: 'sent',
      },
    });
    return messageRecord;
  } catch (error) {
    console.error('Error al guardar mensaje:', error);
    throw error;
  }
};

// Función para obtener historial de mensajes entre dos usuarios
const getMessageHistory = async (userId1, userId2, limit = 50) => {
  try {
    // Validar parámetros
    if (!userId1 || !userId2) {
      throw new Error('IDs de usuario son requeridos');
    }

    if (limit < 1 || limit > 100) {
      limit = 50; // Valor por defecto razonable
    }

    const messages = await prisma.mensajes.findMany({
      where: {
        OR: [
          { sender_id: userId1, recipient_id: userId2 },
          { sender_id: userId2, recipient_id: userId1 },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, nombre: true }
        },
        recipient: {
          select: { id: true, nombre: true }
        }
      }
    });
    return messages.reverse(); // Devolver en orden cronológico
  } catch (error) {
    console.error('Error al obtener historial de mensajes:', error);
    throw error;
  }
};

// Función para marcar mensajes como leídos
const markMessagesAsRead = async (sender_id, recipient_id) => {
  try {
    await prisma.mensajes.updateMany({
      where: {
        sender_id,
        recipient_id,
        read_at: null,
      },
      data: { read_at: new Date() },
    });
  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
    throw error;
  }
};

// Función para enviar notificación de nuevo mensaje (ACTUALIZADA para REQ-19)
const notifyNewMessage = async (recipient_id, sender_id, message_content = '') => {
  try {
    console.log(`🔔 Enviando notificaciones de mensaje de ${sender_id} a ${recipient_id}`);

    // Obtener información del remitente para la notificación
    const sender = await prisma.usuarios.findUnique({
      where: { id: sender_id },
      select: { nombre: true }
    });

    const sender_name = sender?.nombre || 'Usuario desconocido';

    // Preparar preview del mensaje (máximo 100 caracteres)
    const message_preview = message_content.length > 100
      ? message_content.substring(0, 97) + '...'
      : message_content;

    // Enviar notificación usando el nuevo servicio (push + email)
    const notificationResult = await chatNotificationService.sendComprehensiveNotification(
      recipient_id,
      sender_name,
      message_preview
    );

    // Log del resultado
    if (notificationResult.overall.success) {
      console.log(`✅ Notificaciones enviadas exitosamente a ${recipient_id}:`, {
        push: notificationResult.push?.success ? 'OK' : 'FAILED',
        email: notificationResult.email?.success ? 'OK' : 'FAILED'
      });
    } else {
      console.warn(`⚠️ Notificaciones parciales para ${recipient_id}:`, notificationResult.overall.errors);
    }

    // También mantener la notificación original en BD para compatibilidad
    try {
      await sendNotification(recipient_id, 'nuevo_mensaje', `Nuevo mensaje de ${sender_name}`);
    } catch (dbError) {
      console.warn('Error guardando notificación en BD:', dbError.message);
    }

    return notificationResult;

  } catch (error) {
    console.error('❌ Error al enviar notificación de mensaje:', {
      error: error.message,
      stack: error.stack,
      recipient_id,
      sender_id,
      content_length: message_content?.length || 0
    });

    // No lanzar error para no interrumpir el flujo principal del chat
    return {
      success: false,
      error: error.message,
      recipient_id,
      sender_id
    };
  }
};

module.exports = {
  saveMessage,
  getMessageHistory,
  markMessagesAsRead,
  notifyNewMessage,
};