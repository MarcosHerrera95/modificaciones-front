// changanet-backend/src/services/chatNotificationService.js
/**
 * Servicio de notificaciones para chat
 * Implementa REQ-19: Notificaciones push y email para nuevos mensajes
 * 
 * FUNCIONALIDADES:
 * - Push notifications usando Firebase Cloud Messaging (FCM)
 * - Email notifications usando SendGrid
 * - Preferencias de usuario configurables
 * - Logging y error handling robusto
 */

const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

class ChatNotificationService {
  constructor() {
    // Configurar SendGrid
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      console.log('✅ SendGrid configurado para notificaciones de email');
    } else {
      console.warn('⚠️ SENDGRID_API_KEY no configurado - emails deshabilitados');
    }
    
    // Firebase Admin ya está inicializado en server.js
    if (admin.apps.length > 0) {
      console.log('✅ Firebase Admin disponible para push notifications');
    } else {
      console.warn('⚠️ Firebase Admin no disponible - push notifications deshabilitadas');
    }
  }

  /**
   * Envía notificación push usando FCM
   */
  async sendPushNotification(destinatario_id, remitente_nombre, mensaje_preview, messageType = 'new_message') {
    try {
      // Obtener FCM token del usuario destinatario
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const usuario = await prisma.usuarios.findUnique({
        where: { id: destinatario_id },
        select: { 
          fcm_token: true, 
          nombre: true, 
          notificaciones_push: true 
        }
      });

      // Verificar preferencias del usuario
      if (!usuario?.notificaciones_push) {
        console.log(`Usuario ${destinatario_id} tiene push notifications deshabilitadas`);
        return { success: false, reason: 'Push notifications deshabilitadas por usuario' };
      }

      if (!usuario?.fcm_token) {
        console.log(`Usuario ${destinatario_id} no tiene FCM token configurado`);
        return { success: false, reason: 'No FCM token disponible' };
      }

      if (admin.apps.length === 0) {
        console.log('Firebase Admin no disponible, skipping push notification');
        return { success: false, reason: 'Firebase Admin no configurado' };
      }

      // Preparar notificación push
      const message = {
        token: usuario.fcm_token,
        notification: {
          title: `💬 Nuevo mensaje de ${remitente_nombre}`,
          body: mensaje_preview || 'Tienes un nuevo mensaje en Changánet',
          icon: '/favicon.ico',
          badge: '/badge-icon.png',
          color: '#10B981',
          sound: 'default'
        },
        data: {
          type: messageType,
          sender_id: destinatario_id, // Nota: Este debería ser el remitente_id real
          sender_name: remitente_nombre,
          timestamp: Date.now().toString(),
          action: 'open_chat',
          chat_id: destinatario_id // ID del remitente para abrir chat
        },
        android: {
          priority: 'high',
          notification: {
            channel_id: 'messages_channel',
            priority: 'high'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              contentAvailable: true
            }
          }
        }
      };

      // Enviar notificación
      const response = await admin.messaging().send(message);
      console.log(`✅ Push notification enviada exitosamente a ${destinatario_id}:`, response);
      
      return { 
        success: true, 
        messageId: response,
        recipient: destinatario_id,
        type: 'push'
      };

    } catch (error) {
      console.error('❌ Error enviando push notification:', {
        error: error.message,
        stack: error.stack,
        recipientId: destinatario_id,
        senderName: remitente_nombre
      });
      
      return { 
        success: false, 
        error: error.message,
        recipient: destinatario_id,
        type: 'push'
      };
    }
  }

  /**
   * Envía notificación por email usando SendGrid
   */
  async sendEmailNotification(destinatario_email, remitente_nombre, mensaje_preview) {
    try {
      // Verificar que SendGrid está configurado
      if (!process.env.SENDGRID_API_KEY) {
        console.log('SendGrid no configurado, skipping email notification');
        return { success: false, reason: 'SendGrid no configurado' };
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(destinatario_email)) {
        throw new Error(`Email inválido: ${destinatario_email}`);
      }

      // Preparar email
      const emailData = {
        to: destinatario_email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@changanet.com',
          name: 'Changánet'
        },
        replyTo: process.env.SENDGRID_REPLY_TO || 'soporte@changanet.com',
        subject: `💬 Nuevo mensaje de ${remitente_nombre} en Changánet`,
        html: this.generateEmailHTML(remitente_nombre, mensaje_preview),
        text: this.generateEmailText(remitente_nombre, mensaje_preview)
      };

      // Enviar email
      const response = await sgMail.send(emailData);
      console.log(`✅ Email notification enviada exitosamente a ${destinatario_email}`);
      
      return { 
        success: true, 
        messageId: response[0]?.headers?.['x-message-id'],
        recipient: destinatario_email,
        type: 'email'
      };

    } catch (error) {
      console.error('❌ Error enviando email notification:', {
        error: error.message,
        stack: error.stack,
        recipientEmail: destinatario_email,
        senderName: remitente_nombre
      });
      
      return { 
        success: false, 
        error: error.message,
        recipient: destinatario_email,
        type: 'email'
      };
    }
  }

  /**
   * Envía notificación combinada (push + email) según preferencias del usuario
   */
  async sendComprehensiveNotification(destinatario_id, remitente_nombre, mensaje_preview) {
    const results = {
      push: null,
      email: null,
      overall: { success: true, errors: [] }
    };

    try {
      // Obtener información del destinatario
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const destinatario = await prisma.usuarios.findUnique({
        where: { id: destinatario_id },
        select: { 
          email: true, 
          notificaciones_push: true, 
          notificaciones_email: true 
        }
      });

      if (!destinatario) {
        throw new Error(`Usuario destinatario no encontrado: ${destinatario_id}`);
      }

      // Enviar push notification si está habilitada
      if (destinatario.notificaciones_push) {
        results.push = await this.sendPushNotification(
          destinatario_id, 
          remitente_nombre, 
          mensaje_preview
        );
        
        if (!results.push.success) {
          results.overall.errors.push(`Push: ${results.push.error}`);
        }
      } else {
        console.log(`Push notifications deshabilitadas para usuario ${destinatario_id}`);
      }

      // Enviar email notification si está habilitado
      if (destinatario.notificaciones_email && destinatario.email) {
        results.email = await this.sendEmailNotification(
          destinatario.email, 
          remitente_nombre, 
          mensaje_preview
        );
        
        if (!results.email.success) {
          results.overall.errors.push(`Email: ${results.email.error}`);
        }
      } else {
        console.log(`Email notifications deshabilitadas para usuario ${destinatario_id}`);
      }

      // Determinar resultado general
      results.overall.success = results.overall.errors.length === 0;
      
      if (!results.overall.success) {
        console.warn(`Notificaciones parciales para ${destinatario_id}:`, results.overall.errors);
      }

      return results;

    } catch (error) {
      console.error('❌ Error en sendComprehensiveNotification:', {
        error: error.message,
        stack: error.stack,
        recipientId: destinatario_id,
        senderName: remitente_nombre
      });
      
      results.overall.success = false;
      results.overall.errors.push(`General: ${error.message}`);
      
      return results;
    }
  }

  /**
   * Genera HTML para email de notificación
   */
  generateEmailHTML(remitente_nombre, mensaje_preview) {
    const currentYear = new Date().getFullYear();
    
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nuevo Mensaje - Changánet</title>
          <style>
              body { 
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                  line-height: 1.6; 
                  color: #333; 
                  margin: 0; 
                  padding: 0; 
                  background-color: #f8fafc;
              }
              .container { 
                  max-width: 600px; 
                  margin: 0 auto; 
                  background-color: white; 
                  border-radius: 8px; 
                  overflow: hidden;
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              }
              .header { 
                  background: linear-gradient(135deg, #10B981 0%, #059669 100%); 
                  color: white; 
                  padding: 32px 24px; 
                  text-align: center; 
              }
              .logo { 
                  font-size: 28px; 
                  font-weight: bold; 
                  margin-bottom: 8px; 
              }
              .subtitle { 
                  font-size: 16px; 
                  opacity: 0.9; 
                  margin: 0; 
              }
              .content { 
                  padding: 32px 24px; 
              }
              .message-box { 
                  background-color: #f0f9ff; 
                  border-left: 4px solid #10B981; 
                  padding: 20px; 
                  margin: 24px 0; 
                  border-radius: 4px; 
              }
              .sender-name { 
                  color: #10B981; 
                  font-weight: 600; 
                  font-size: 16px; 
                  margin: 0 0 8px 0; 
              }
              .message-preview { 
                  color: #374151; 
                  margin: 0; 
                  font-style: italic; 
              }
              .cta-button { 
                  display: inline-block; 
                  background-color: #10B981; 
                  color: white; 
                  padding: 14px 28px; 
                  text-decoration: none; 
                  border-radius: 6px; 
                  font-weight: 600; 
                  margin: 24px 0;
                  transition: background-color 0.2s;
              }
              .cta-button:hover { 
                  background-color: #059669; 
              }
              .footer { 
                  background-color: #f9fafb; 
                  padding: 24px; 
                  text-align: center; 
                  color: #6b7280; 
                  font-size: 14px; 
              }
              .footer a { 
                  color: #10B981; 
                  text-decoration: none; 
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">🏠 Changánet</div>
                  <p class="subtitle">Plataforma Digital de Servicios Profesionales</p>
              </div>
              
              <div class="content">
                  <h2 style="color: #1f2937; margin-top: 0;">💬 Nuevo Mensaje Recibido</h2>
                  
                  <p style="font-size: 16px; color: #4b5563;">Hola,</p>
                  
                  <p style="font-size: 16px; color: #4b5563;">
                      Has recibido un nuevo mensaje de <strong>${remitente_nombre}</strong> en la plataforma Changánet.
                  </p>
                  
                  <div class="message-box">
                      <p class="sender-name">Mensaje de ${remitente_nombre}:</p>
                      <p class="message-preview">"${mensaje_preview || 'Mensaje sin contenido'}"</p>
                  </div>
                  
                  <p style="font-size: 16px; color: #4b5563;">
                      Inicia sesión en la plataforma para ver el mensaje completo y continuar la conversación.
                  </p>
                  
                  <div style="text-align: center; margin: 32px 0;">
                      <a href="${process.env.FRONTEND_URL || 'https://changanet.com'}/chat" class="cta-button">
                          💬 Ver Mensaje
                      </a>
                  </div>
              </div>
              
              <div class="footer">
                  <p>© ${currentYear} Changánet S.A. Todos los derechos reservados.</p>
                  <p>
                      <a href="${process.env.FRONTEND_URL || 'https://changanet.com'}">Visitar plataforma</a> | 
                      <a href="mailto:${process.env.SENDGRID_REPLY_TO || 'soporte@changanet.com'}">Soporte</a>
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera texto plano para email de notificación
   */
  generateEmailText(remitente_nombre, mensaje_preview) {
    return `
NUEVO MENSAJE EN CHANGÁNET

Hola,

Has recibido un nuevo mensaje de ${remitente_nombre} en la plataforma Changánet.

Mensaje: "${mensaje_preview || 'Mensaje sin contenido'}"

Inicia sesión en la plataforma para ver el mensaje completo:
${process.env.FRONTEND_URL || 'https://changanet.com'}/chat

© ${new Date().getFullYear()} Changánet S.A.
    `.trim();
  }

  /**
   * Actualiza las preferencias de notificación de un usuario
   */
  async updateNotificationPreferences(usuario_id, preferences) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const {
        notificaciones_push = true,
        notificaciones_email = true,
        notificaciones_mensajes = true
      } = preferences;
      
      const updatedUser = await prisma.usuarios.update({
        where: { id: usuario_id },
        data: {
          notificaciones_push,
          notificaciones_email,
          notificaciones_mensajes
        },
        select: {
          id: true,
          notificaciones_push: true,
          notificaciones_email: true,
          notificaciones_mensajes: true
        }
      });
      
      console.log(`✅ Preferencias de notificación actualizadas para usuario ${usuario_id}:`, updatedUser);
      
      return { success: true, preferences: updatedUser };
      
    } catch (error) {
      console.error('❌ Error actualizando preferencias de notificación:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene las preferencias de notificación de un usuario
   */
  async getNotificationPreferences(usuario_id) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const user = await prisma.usuarios.findUnique({
        where: { id: usuario_id },
        select: {
          notificaciones_push: true,
          notificaciones_email: true,
          notificaciones_mensajes: true,
          fcm_token: true
        }
      });
      
      if (!user) {
        throw new Error(`Usuario no encontrado: ${usuario_id}`);
      }
      
      return {
        success: true,
        preferences: {
          push_enabled: user.notificaciones_push,
          email_enabled: user.notificaciones_email,
          messages_enabled: user.notificaciones_mensajes,
          has_fcm_token: !!user.fcm_token
        }
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo preferencias de notificación:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ChatNotificationService;