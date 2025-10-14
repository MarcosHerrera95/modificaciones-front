// src/services/emailService.js
const sgMail = require('@sendgrid/mail');

// Configurar SendGrid con la API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Función para enviar email de verificación
exports.sendVerificationEmail = async (to, token) => {
  const msg = {
    to,
    from: 'noreply@changanet.com', // Debe ser un email verificado en SendGrid
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
    from: 'noreply@changanet.com',
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