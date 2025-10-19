// src/controllers/messageController.js
const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('../services/notificationService');
const prisma = new PrismaClient();

exports.getMessageHistory = async (req, res) => {
  const { id: userId } = req.user;
  const { with: otherUserId } = req.query;

  try {
    const messages = await prisma.mensajes.findMany({
      where: {
        OR: [
          { remitente_id: userId, destinatario_id: otherUserId },
          { remitente_id: otherUserId, destinatario_id: userId },
        ],
      },
      orderBy: { creado_en: 'asc' },
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el historial.' });
  }
};

// VERIFICACIÓN: Función para enviar mensaje con notificación push usando VAPID key
exports.sendMessage = async (req, res) => {
  const { id: senderId } = req.user;
  const { recipientId, content } = req.body;

  try {
    const message = await prisma.mensajes.create({
      data: {
        remitente_id: senderId,
        destinatario_id: recipientId,
        contenido: content,
        esta_leido: false,
      },
    });

    // VERIFICACIÓN: Enviar notificación push al destinatario usando VAPID key verificada
    await sendNotification(recipientId, 'nuevo_mensaje', `Nuevo mensaje recibido`);

    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar el mensaje.' });
  }
};