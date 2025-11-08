/**
 * @archivo src/services/notificationService.js - Servicio de notificaciones
 * @descripción Gestiona creación y operaciones de notificaciones (REQ-19, REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar Servicio de Notificaciones
 * @impacto Social: Sistema de notificaciones inclusivo y accesible
 */

const { PrismaClient } = require('@prisma/client');
const { sendPushNotification, sendMulticastPushNotification } = require('../config/firebaseAdmin');
const { sendEmail } = require('./emailService');

const prisma = new PrismaClient();

/**
 * Tipos de notificaciones soportados
 */
const NOTIFICATION_TYPES = {
  BIENVENIDA: 'bienvenida',
  COTIZACION: 'cotizacion',
  COTIZACION_ACEPTADA: 'cotizacion_aceptada',
  COTIZACION_RECHAZADA: 'cotizacion_rechazada',
  SERVICIO_AGENDADO: 'servicio_agendado',
  MENSAJE: 'mensaje',
  TURNO_AGENDADO: 'turno_agendado',
  RESENA_RECIBIDA: 'resena_recibida',
  PAGO_LIBERADO: 'pago_liberado',
  VERIFICACION_APROBADA: 'verificacion_aprobada'
};

/**
 * Crear una nueva notificación
 * @param {string} userId - ID del usuario destinatario
 * @param {string} type - Tipo de notificación
 * @param {string} message - Mensaje de la notificación
 * @param {Object} metadata - Datos adicionales (opcional)
 */
exports.createNotification = async (userId, type, message, metadata = {}) => {
  try {
    // Validar tipo de notificación
    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
      throw new Error(`Tipo de notificación inválido: ${type}`);
    }

    // Crear notificación en base de datos
    const notification = await prisma.notificaciones.create({
      data: {
        usuario_id: userId,
        tipo: type,
        mensaje: message,
        esta_leido: false
      }
    });

    console.log(`Notificación creada: ${type} para usuario ${userId}`);

    // Enviar notificación push si el usuario tiene FCM token
    try {
      const user = await prisma.usuarios.findUnique({
        where: { id: userId },
        select: { fcm_token: true, email: true, nombre: true }
      });

      if (user?.fcm_token) {
        await sendPushNotification(user.fcm_token, getNotificationTitle(type), message);
      }

      // Enviar email inmediatamente
      try {
        await sendEmail(
          user.email,
          getNotificationTitle(type),
          `Hola ${user.nombre},\n\n${message}\n\nPuedes revisar esta notificación desde la plataforma.\n\nSaludos,\nEquipo Changánet`
        );
      } catch (emailError) {
        console.warn('Error enviando email de notificación:', emailError);
      }

    } catch (pushError) {
      console.error('Error enviando notificación push:', pushError);
    }

    return notification;
  } catch (error) {
    console.error('Error creando notificación:', error);
    throw error;
  }
};

/**
 * Obtener notificaciones de un usuario con filtros
 * @param {string} userId - ID del usuario
 * @param {string} filter - Filtro: 'all', 'unread', 'read'
 */
exports.getUserNotifications = async (userId, filter = 'all') => {
  try {
    const whereClause = { usuario_id: userId };

    if (filter === 'unread') {
      whereClause.esta_leido = false;
    } else if (filter === 'read') {
      whereClause.esta_leido = true;
    }

    const notifications = await prisma.notificaciones.findMany({
      where: whereClause,
      orderBy: { creado_en: 'desc' },
      take: 50 // Limitar a 50 notificaciones más recientes
    });

    const unreadCount = await prisma.notificaciones.count({
      where: {
        usuario_id: userId,
        esta_leido: false
      }
    });

    return {
      notifications,
      unreadCount
    };
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    throw error;
  }
};

/**
 * Obtener una notificación por ID
 * @param {string} notificationId - ID de la notificación
 */
exports.getNotificationById = async (notificationId) => {
  try {
    return await prisma.notificaciones.findUnique({
      where: { id: notificationId }
    });
  } catch (error) {
    console.error('Error obteniendo notificación:', error);
    throw error;
  }
};

/**
 * Marcar notificación como leída
 * @param {string} notificationId - ID de la notificación
 */
exports.markAsRead = async (notificationId) => {
  try {
    await prisma.notificaciones.update({
      where: { id: notificationId },
      data: { esta_leido: true }
    });
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
    throw error;
  }
};

/**
 * Marcar todas las notificaciones de un usuario como leídas
 * @param {string} userId - ID del usuario
 */
exports.markAllAsRead = async (userId) => {
  try {
    await prisma.notificaciones.updateMany({
      where: {
        usuario_id: userId,
        esta_leido: false
      },
      data: { esta_leido: true }
    });
  } catch (error) {
    console.error('Error marcando todas las notificaciones como leídas:', error);
    throw error;
  }
};

/**
 * Eliminar una notificación
 * @param {string} notificationId - ID de la notificación
 */
exports.deleteNotification = async (notificationId) => {
  try {
    await prisma.notificaciones.delete({
      where: { id: notificationId }
    });
  } catch (error) {
    console.error('Error eliminando notificación:', error);
    throw error;
  }
};

/**
 * Función auxiliar para obtener título de notificación según tipo
 * @param {string} type - Tipo de notificación
 */
function getNotificationTitle(type) {
  const titles = {
    [NOTIFICATION_TYPES.BIENVENIDA]: '¡Bienvenido a Changánet!',
    [NOTIFICATION_TYPES.COTIZACION]: 'Nueva solicitud de presupuesto',
    [NOTIFICATION_TYPES.COTIZACION_ACEPTADA]: 'Cotización aceptada',
    [NOTIFICATION_TYPES.COTIZACION_RECHAZADA]: 'Cotización rechazada',
    [NOTIFICATION_TYPES.SERVICIO_AGENDADO]: 'Servicio agendado',
    [NOTIFICATION_TYPES.MENSAJE]: 'Nuevo mensaje',
    [NOTIFICATION_TYPES.TURNO_AGENDADO]: 'Servicio agendado',
    [NOTIFICATION_TYPES.RESENA_RECIBIDA]: 'Nueva reseña',
    [NOTIFICATION_TYPES.PAGO_LIBERADO]: 'Pago liberado',
    [NOTIFICATION_TYPES.VERIFICACION_APROBADA]: 'Verificación aprobada'
  };
  return titles[type] || 'Nueva notificación';
}

module.exports = {
  createNotification: exports.createNotification,
  getUserNotifications: exports.getUserNotifications,
  getNotificationById: exports.getNotificationById,
  markAsRead: exports.markAsRead,
  markAllAsRead: exports.markAllAsRead,
  deleteNotification: exports.deleteNotification,
  NOTIFICATION_TYPES
};