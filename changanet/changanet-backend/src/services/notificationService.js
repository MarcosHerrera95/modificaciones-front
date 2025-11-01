// src/services/notificationService.js
// FUNCIÓN: Envía notificaciones automáticas a los usuarios y las almacena en la base de datos para su posterior consulta.
// RELACIÓN PRD: REQ-19 (Notificaciones automáticas por actividad: nuevas solicitudes, mensajes, pagos, reseñas).
// TARJETA BACKEND: Tarjeta 4: [Backend] Implementar API de Chat en Tiempo Real (parte de notificaciones) y Tarjeta 9: [Backend] Implementar API de Notificaciones Automáticas.
// SPRINT: Sprint 1 (Primera Entrega) - "Implementación del producto de software".

const { PrismaClient } = require('@prisma/client');
const { sendPushNotification } = require('../config/firebaseAdmin');
const prisma = new PrismaClient();

// Función para enviar una notificación
exports.sendNotification = async (userId, type, message) => {
  try {
    // Guardar la notificación en la base de datos (tabla 'notificaciones')
    // Esto permite que el usuario pueda ver su historial de notificaciones incluso si no estaba conectado en el momento del evento.
    await prisma.notificaciones.create({
      data: {
        usuario_id: userId, // ID del usuario que recibirá la notificación
        tipo: type, // Tipo de notificación (ej: 'nuevo_mensaje', 'nueva_cotización', 'servicio_agendado')
        mensaje: message, // Contenido textual de la notificación
        esta_leido: false, // La notificación se marca como no leída por defecto
      },
    });

    // VERIFICACIÓN: Enviar notificación push usando Firebase Cloud Messaging con VAPID key verificada
    try {
      // Obtener token FCM del usuario desde la base de datos
      const user = await prisma.usuarios.findUnique({
        where: { id: userId },
        select: { fcm_token: true }
      });

      if (user && user.fcm_token) {
        const pushResult = await sendPushNotification(user.fcm_token, `Changánet - ${type}`, message);
        if (pushResult) {
          console.log(`📬 Notificación push enviada para ${userId}`);
        }
      } else {
        console.log(`⚠️ Usuario ${userId} no tiene token FCM registrado`);
      }
    } catch (pushError) {
      console.error('Error al enviar notificación push:', pushError);
      // No fallar la notificación general si falla el push
    }

    console.log(`🔔 Notificación enviada a ${userId}: ${message}`);
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    // En un entorno de producción, aquí se podría integrar un servicio de monitoreo (como Sentry) o reintentar el envío.
  }
};