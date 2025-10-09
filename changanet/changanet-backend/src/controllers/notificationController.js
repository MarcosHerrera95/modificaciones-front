// src/controllers/notificationController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getNotifications = async (req, res) => {
  const { id: userId } = req.user;

  try {
    const notifications = await prisma.notificaciones.findMany({
      where: { usuario_id: userId },
      orderBy: { creado_en: 'desc' },
      take: 20 // Limitar a las últimas 20 notificaciones
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener notificaciones.' });
  }
};

exports.markAsRead = async (req, res) => {
  const { id: userId } = req.user;
  const { notificationId } = req.params;

  try {
    const notification = await prisma.notificaciones.update({
      where: {
        id: notificationId,
        usuario_id: userId
      },
      data: { esta_leido: true }
    });

    res.status(200).json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al marcar notificación como leída.' });
  }
};

exports.markAllAsRead = async (req, res) => {
  const { id: userId } = req.user;

  try {
    const result = await prisma.notificaciones.updateMany({
      where: {
        usuario_id: userId,
        esta_leido: false
      },
      data: { esta_leido: true }
    });

    res.status(200).json({ message: `${result.count} notificaciones marcadas como leídas.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al marcar todas las notificaciones como leídas.' });
  }
};