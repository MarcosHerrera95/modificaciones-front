// src/services/emailService.js
const sgMail = require('@sendgrid/mail');

// Configurar SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendEmail = async (to, subject, html) => {
  try {
    const msg = {
      to,
      from: process.env.FROM_EMAIL || 'noreply@changanet.com',
      subject,
      html
    };

    const info = await sgMail.send(msg);
    console.log('📧 Email enviado con SendGrid:', info[0].statusCode);
    return info;
  } catch (error) {
    console.error('❌ Error al enviar email con SendGrid:', error);
    throw error;
  }
};

exports.sendWelcomeEmail = async (user) => {
  const subject = '¡Bienvenido a Changánet!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: #10B981; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Bienvenido a Changánet!</h1>
      </div>
      <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${user.nombre}!</h2>
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Gracias por unirte a Changánet. Estamos emocionados de tenerte con nosotros en esta plataforma que conecta a los mejores profesionales con quienes los necesitan.
        </p>
        <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
          Tu cuenta ha sido verificada automáticamente. Ya puedes comenzar a explorar servicios o publicar tu propio servicio si eres profesional.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/"
             style="background-color: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Explorar Servicios
          </a>
        </div>
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Si tienes alguna pregunta, no dudes en contactarnos respondiendo a este email.
        </p>
        <p style="color: #666; line-height: 1.6;">
          Saludos,<br>
          <strong>El equipo de Changánet</strong>
        </p>
      </div>
    </div>
  `;

  await exports.sendEmail(user.email, subject, html);
};

exports.sendQuoteRequestEmail = async (professional, client, quoteRequest) => {
  const subject = `Nueva solicitud de presupuesto de ${client.nombre}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: #10B981; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Nueva Solicitud de Presupuesto</h1>
      </div>
      <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${professional.nombre}!</h2>
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Has recibido una nueva solicitud de presupuesto de <strong>${client.nombre}</strong>.
        </p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 10px;">Detalles del trabajo:</h3>
          <p style="color: #666; margin-bottom: 10px;"><strong>Descripción:</strong> ${quoteRequest.descripción}</p>
          <p style="color: #666; margin-bottom: 10px;"><strong>Zona:</strong> ${quoteRequest.zona_cobertura}</p>
          <p style="color: #666;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mi-cuenta"
             style="background-color: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Ver detalles y responder
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          Saludos,<br>
          <strong>El equipo de Changánet</strong>
        </p>
      </div>
    </div>
  `;

  await exports.sendEmail(professional.email, subject, html);
};