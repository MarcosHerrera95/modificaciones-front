// src/services/chatService.js
// Servicio para manejar la lógica del chat en tiempo real con Socket.IO

const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('./notificationService');
const prisma = new PrismaClient();

// Función para guardar mensaje en la base de datos
const saveMessage = async (remitente_id, destinatario_id, contenido, url_imagen = null) => {
  try {
    const message = await prisma.mensajes.create({
      data: {
        remitente_id,
        destinatario_id,
        contenido,
        url_imagen,
        esta_leido: false,
      },
    });
    return message;
  } catch (error) {
    console.error('Error al guardar mensaje:', error);
    throw error;
  }
};

// Función para obtener historial de mensajes entre dos usuarios
const getMessageHistory = async (userId1, userId2, limit = 50) => {
  try {
    const messages = await prisma.mensajes.findMany({
      where: {
        OR: [
          { remitente_id: userId1, destinatario_id: userId2 },
          { remitente_id: userId2, destinatario_id: userId1 },
        ],
      },
      orderBy: { creado_en: 'desc' },
      take: limit,
    });
    return messages.reverse(); // Devolver en orden cronológico
  } catch (error) {
    console.error('Error al obtener historial de mensajes:', error);
    throw error;
  }
};

// Función para marcar mensajes como leídos
const markMessagesAsRead = async (remitente_id, destinatario_id) => {
  try {
    await prisma.mensajes.updateMany({
      where: {
        remitente_id,
        destinatario_id,
        esta_leido: false,
      },
      data: { esta_leido: true },
    });
  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
    throw error;
  }
};

// Función para enviar notificación de nuevo mensaje
const notifyNewMessage = async (destinatario_id, remitente_id) => {
  try {
    await sendNotification(destinatario_id, 'nuevo_mensaje', `Nuevo mensaje de usuario ${remitente_id}`);
  } catch (error) {
    console.error('Error al enviar notificación de mensaje:', error);
  }
};

module.exports = {
  saveMessage,
  getMessageHistory,
  markMessagesAsRead,
  notifyNewMessage,
};