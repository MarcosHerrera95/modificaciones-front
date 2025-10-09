// src/controllers/messageController.js
const { PrismaClient } = require('@prisma/client');
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