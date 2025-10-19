const { PrismaClient } = require('@prisma/client');
const admin = require('firebase-admin');

const prisma = new PrismaClient();

// Obtener notificaciones del usuario
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await prisma.notificaciones.findMany({
      where: { usuario_id: userId },
      orderBy: { fecha_creacion: 'desc' },
      take: 50 // Limitar a las últimas 50 notificaciones
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Marcar notificación como leída
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notificaciones.updateMany({
      where: {
        id: parseInt(id),
        usuario_id: userId
      },
      data: { leida: true }
    });

    if (notification.count === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Marcar todas las notificaciones como leídas
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notificaciones.updateMany({
      where: { usuario_id: userId },
      data: { leida: true }
    });

    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('Error al marcar todas las notificaciones como leídas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar notificación
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notificaciones.deleteMany({
      where: {
        id: parseInt(id),
        usuario_id: userId
      }
    });

    if (notification.count === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Enviar notificación push a un usuario específico
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    // Obtener el token FCM del usuario
    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { fcm_token: true }
    });

    if (!user || !user.fcm_token) {
      console.log(`Usuario ${userId} no tiene token FCM registrado`);
      return;
    }

    // Crear mensaje FCM
    const message = {
      token: user.fcm_token,
      notification: {
        title,
        body
      },
      data: {
        ...data,
        userId: userId.toString()
      },
      webpush: {
        fcmOptions: {
          link: process.env.FRONTEND_URL || 'http://localhost:5173'
        }
      }
    };

    // Enviar notificación
    const response = await admin.messaging().send(message);
    console.log('Notificación FCM enviada:', response);

    // Guardar notificación en la base de datos
    await prisma.notificaciones.create({
      data: {
        usuario_id: userId,
        titulo: title,
        mensaje: body,
        tipo: data.tipo || 'general',
        datos: data,
        leida: false
      }
    });

    return response;
  } catch (error) {
    console.error('Error al enviar notificación FCM:', error);
    throw error;
  }
};

// Actualizar token FCM del usuario
const updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user.id;

    await prisma.usuarios.update({
      where: { id: userId },
      data: { fcm_token: fcmToken }
    });

    res.json({ message: 'Token FCM actualizado' });
  } catch (error) {
    console.error('Error al actualizar token FCM:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendPushNotification,
  updateFCMToken
};