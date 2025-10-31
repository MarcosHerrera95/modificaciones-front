// src/services/emailService.js
const sgMail = require('@sendgrid/mail');

// Configurar SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendEmail = async (to, subject, html, from = process.env.FROM_EMAIL) => {
  try {
    const msg = {
      to,
      from: {
        email: from,
        name: 'Changánet'
      },
      subject,
      html
    };

    const info = await sgMail.send(msg);
    console.log('📧 Email enviado:', info[0].statusCode);
    return info;
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw error;
  }
};

exports.sendWelcomeEmail = async (user) => {
  const subject = '¡Bienvenido a Changánet!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #10B981;">¡Hola, ${user.nombre}!</h1>
      <p>Gracias por unirte a Changánet. Estamos emocionados de tenerte con nosotros.</p>
      <p>Para comenzar, verifica tu email haciendo clic en el siguiente enlace:</p>
      <a href="${process.env.FRONTEND_URL}/verificar-email?token=TOKEN_DE_VERIFICACION" style="background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verificar Email</a>
      <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
      <p>Saludos,<br>El equipo de Changánet</p>
    </div>
  `;

  await exports.sendEmail(user.email, subject, html);
};

exports.sendQuoteRequestEmail = async (professional, client, quoteRequest) => {
  const subject = `Nueva solicitud de presupuesto de ${client.nombre}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #10B981;">Hola, ${professional.nombre}!</h1>
      <p>Has recibido una nueva solicitud de presupuesto de ${client.nombre}.</p>
      <div style="background-color: #F0FDF4; border: 1px solid #10B981; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>Descripción del trabajo:</strong> ${quoteRequest.descripción}</p>
        <p><strong>Zona:</strong> ${quoteRequest.zona_cobertura}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/mi-cuenta/presupuestos" style="background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver detalles y responder</a>
      <p>Saludos,<br>El equipo de Changánet</p>
    </div>
  `;

  await exports.sendEmail(professional.email, subject, html);
};

exports.sendSupportEmail = async (to, subject, html) => {
  await exports.sendEmail(to, subject, html, process.env.SUPPORT_EMAIL);
};