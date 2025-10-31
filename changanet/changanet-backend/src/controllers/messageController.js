// src/controllers/messageController.js
const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('../services/notificationService');
const { getMessageHistory: getHistory, markMessagesAsRead } = require('../services/chatService');
const prisma = new PrismaClient();

exports.getMessageHistory = async (req, res) => {
  const { id: userId } = req.user;
  const { with: otherUserId } = req.query;
  const limit = parseInt(req.query.limit) || 50;

  if (!otherUserId) {
    return res.status(400).json({ error: 'Se requiere el ID del otro usuario.' });
  }

  try {
    const messages = await getHistory(userId, otherUserId, limit);
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error al obtener historial de mensajes:', error);
    res.status(500).json({ error: 'Error al obtener el historial de mensajes.' });
  }
};

// VERIFICACIÓN: Función para enviar mensaje con notificación push usando VAPID key
exports.sendMessage = async (req, res) => {
  const { id: senderId } = req.user;
  const { recipientId, content, url_imagen } = req.body;

  if (!recipientId || !content) {
    return res.status(400).json({ error: 'Se requieren recipientId y content.' });
  }

  try {
    const message = await prisma.mensajes.create({
      data: {
        remitente_id: senderId,
        destinatario_id: recipientId,
        contenido: content,
        url_imagen: url_imagen || null,
        esta_leido: false,
      },
    });

    // VERIFICACIÓN: Enviar notificación push al destinatario usando VAPID key verificada
    await sendNotification(recipientId, 'nuevo_mensaje', `Nuevo mensaje recibido`);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error al enviar el mensaje.' });
  }
};

// Marcar mensajes como leídos
exports.markMessagesAsRead = async (req, res) => {
  const { id: userId } = req.user;
  const { senderId } = req.body;

  if (!senderId) {
    return res.status(400).json({ error: 'Se requiere senderId.' });
  }

  try {
    await markMessagesAsRead(senderId, userId);
    res.status(200).json({ message: 'Mensajes marcados como leídos.' });
  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
    res.status(500).json({ error: 'Error al marcar mensajes como leídos.' });
  }
};