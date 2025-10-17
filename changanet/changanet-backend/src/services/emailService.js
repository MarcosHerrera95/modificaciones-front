// src/services/emailService.js
const sgMail = require('@sendgrid/mail');

// Configurar SendGrid con la API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Función para enviar email de verificación
exports.sendVerificationEmail = async (to, token) => {
  const msg = {
    to,
    from: process.env.FROM_EMAIL, // Debe ser un email verificado en SendGrid
    subject: 'Verifica tu cuenta en Changánet',
    text: `Hola! Por favor, verifica tu cuenta haciendo clic en este enlace: http://localhost:5173/verify?token=${token}`,
    html: `
      <h1>¡Hola!</h1>
      <p>Gracias por registrarte en Changánet.</p>
      <p>Por favor, verifica tu cuenta haciendo clic en el siguiente enlace:</p>
      <a href="http://localhost:5173/verify?token=${token}" 
         style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
        Verificar Cuenta
      </a>
      <p>Si no puedes hacer clic en el enlace, copia y pega esta URL en tu navegador:</p>
      <p>http://localhost:5173/verify?token=${token}</p>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 Email de verificación enviado a: ${to}`);
  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    throw error;
  }
};

// Función para enviar notificaciones
exports.sendNotificationEmail = async (to, subject, message) => {
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject,
    text: message,
    html: `<p>${message}</p>`,
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 Notificación enviada a: ${to}`);
  } catch (error) {
    console.error('❌ Error al enviar notificación:', error);
    throw error;
  }
};

// Función para enviar email de solicitud de cotización
exports.sendQuoteRequestEmail = async (professional, client, quote) => {
  const msg = {
    to: professional.email,
    from: process.env.FROM_EMAIL,
    subject: 'Nueva solicitud de cotización en Changánet',
    text: `Hola ${professional.nombre}, tienes una nueva solicitud de cotización de ${client.nombre}. Descripción: ${quote.descripcion}`,
    html: `
      <h1>¡Nueva solicitud de cotización!</h1>
      <p>Hola <strong>${professional.nombre}</strong>,</p>
      <p>Tienes una nueva solicitud de cotización de <strong>${client.nombre}</strong>.</p>
      <div style="background-color: #F0FDF4; border: 1px solid #10B981; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>Descripción del servicio:</strong></p>
        <p>${quote.descripcion}</p>
      </div>
      <p>Por favor, revisa tu panel de profesional para responder a esta solicitud.</p>
      <p>Saludos,<br>Equipo Changánet</p>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 Email de cotización enviado a: ${professional.email}`);
  } catch (error) {
    console.error('❌ Error al enviar email de cotización:', error);
    throw error;
  }
};

// Función para enviar email de soporte
exports.sendSupportEmail = async (to, subject, message) => {
  const msg = {
    to,
    from: process.env.SUPPORT_EMAIL,
    subject,
    text: message,
    html: `<p>${message}</p>`,
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 Email de soporte enviado a: ${to}`);
  } catch (error) {
    console.error('❌ Error al enviar email de soporte:', error);
    throw error;
  }
};