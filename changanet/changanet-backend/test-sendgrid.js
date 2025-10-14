// test-sendgrid.js
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'tu-email-de-prueba@ejemplo.com', // Cambia esto por tu email real
  from: 'noreply@changanet.com', // Debe ser un email verificado en SendGrid
  subject: '📧 Prueba de SendGrid - Changánet',
  text: '¡Hola! Este es un email de prueba para verificar que SendGrid funciona correctamente en Changánet.',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #10B981;">🚀 ¡Éxito!</h1>
      <p>¡Hola!</p>
      <p>Este es un <strong>email de prueba</strong> para verificar que <span style="color: #10B981;">SendGrid</span> funciona correctamente en <span style="color: #F59E0B;">Changánet</span>.</p>
      <div style="background-color: #F0FDF4; border: 1px solid #10B981; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0;"><strong>✅ Resultado:</strong> SendGrid está funcionando correctamente.</p>
      </div>
      <p>¡Felicitaciones! Tu sistema de notificaciones está listo para enviar emails transaccionales a los usuarios.</p>
      <p>Saludos,<br>Equipo Changánet</p>
    </div>
  `,
};

sgMail
  .send(msg)
  .then(() => {
    console.log('✅ ¡Éxito! Email de prueba enviado con SendGrid.');
    console.log('📧 Revisa tu buzón de correo (incluyendo Spam).');
  })
  .catch((error) => {
    console.error('❌ Error al enviar email con SendGrid:', error);
    if (error.response) {
      console.error(' Detalles:', error.response.body);
    }
  });