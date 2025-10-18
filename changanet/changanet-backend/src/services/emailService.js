// src/services/emailService.js
const nodemailer = require('nodemailer');

// Configurar transporte (usando Gmail SMTP o servicio similar)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email enviado:', info.response);
    return info;
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw error;
  }
};

exports.sendWelcomeEmail = async (user) => {
  const subject = '¡Bienvenido a Changánet!';
  const html = `
    <h1>¡Hola, ${user.nombre}!</h1>
    <p>Gracias por unirte a Changánet. Estamos emocionados de tenerte con nosotros.</p>
    <p>Para comenzar, verifica tu email haciendo clic en el siguiente enlace:</p>
    <a href="${process.env.FRONTEND_URL}/verificar-email?token=TOKEN_DE_VERIFICACION">Verificar Email</a>
    <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
    <p>Saludos,<br>El equipo de Changánet</p>
  `;

  await exports.sendEmail(user.email, subject, html);
};

exports.sendQuoteRequestEmail = async (professional, client, quoteRequest) => {
  const subject = `Nueva solicitud de presupuesto de ${client.nombre}`;
  const html = `
    <h1>Hola, ${professional.nombre}!</h1>
    <p>Has recibido una nueva solicitud de presupuesto de ${client.nombre}.</p>
    <p><strong>Descripción del trabajo:</strong> ${quoteRequest.descripción}</p>
    <p><strong>Zona:</strong> ${quoteRequest.zona_cobertura}</p>
    <a href="${process.env.FRONTEND_URL}/mi-cuenta/presupuestos">Ver detalles y responder</a>
    <p>Saludos,<br>El equipo de Changánet</p>
  `;

  await exports.sendEmail(professional.email, subject, html);
};