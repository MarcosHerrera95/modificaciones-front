/**
 * Envía un mensaje de contacto al equipo de soporte
 * @param {Object} contactData - Datos del formulario de contacto
 * @param {string} contactData.name - Nombre del remitente
 * @param {string} contactData.email - Email del remitente
 * @param {string} contactData.subject - Asunto del mensaje
 * @param {string} contactData.message - Contenido del mensaje
 */
exports.sendContactMessage = async (contactData) => {
  const { name, email, subject, message } = contactData;

  // Email para el equipo de soporte
  const supportSubject = `Nuevo mensaje de contacto: ${subject}`;
  const supportHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Nuevo Mensaje de Contacto</h1>
      </div>
      <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">Detalles del mensaje:</h2>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>Nombre:</strong> ${name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Asunto:</strong> ${subject}</p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Mensaje:</h3>
          <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        </div>
        <p style="color: #666; font-size: 12px; text-align: center;">
          Este mensaje fue enviado desde el formulario de contacto de Changánet.
        </p>
      </div>
    </div>
  `;

  // Enviar email al soporte
  await exports.sendEmail('soporte@changanet.com.ar', supportSubject, supportHtml);

  // Opcional: Enviar email de confirmación al usuario
  const confirmationSubject = 'Hemos recibido tu mensaje - Changánet';
  const confirmationHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Mensaje Recibido</h1>
      </div>
      <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${name}!</h2>
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Gracias por contactarnos. Hemos recibido tu mensaje y nuestro equipo de soporte lo revisará en las próximas 24 horas.
        </p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Resumen de tu consulta:</h3>
          <p style="margin: 5px 0;"><strong>Asunto:</strong> ${subject}</p>
          <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        </div>
        <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
          Si tienes alguna información adicional o necesitas urgente, puedes contactarnos directamente al teléfono +54 9 11 1234-5678 durante nuestro horario de atención.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/"
             style="background-color: #E30613; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Volver a Changánet
          </a>
        </div>
      </div>
    </div>
  `;

  // Enviar confirmación al usuario (opcional, comentado por defecto)
  // await exports.sendEmail(email, confirmationSubject, confirmationHtml);
};

exports.sendNotificationEmail = async (email, type, message, userName) => {
  let subject;
  let html;

  switch (type) {
    case 'bienvenida':
      subject = '¡Bienvenido a Changánet!';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">¡Bienvenido a Changánet!</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Gracias por registrarte en Changánet. Tu cuenta ha sido creada exitosamente.
            </p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              ${message}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/"
                 style="background-color: #E30613; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Explorar Servicios
              </a>
            </div>
          </div>
        </div>
      `;
      break;

    case 'cotizacion':
      subject = 'Nueva solicitud de presupuesto - Changánet';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Nueva Solicitud de Presupuesto</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              ${message}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mi-cuenta"
                 style="background-color: #E30613; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Ver detalles y responder
              </a>
            </div>
          </div>
        </div>
      `;
      break;

    case 'mensaje':
      subject = 'Nuevo mensaje en Changánet';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Nuevo Mensaje</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              ${message}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mensajes"
                 style="background-color: #E30613; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Ver mensaje
              </a>
            </div>
          </div>
        </div>
      `;
      break;

    case 'turno_agendado':
      subject = 'Servicio agendado - Changánet';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Servicio Agendado</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              ${message}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mi-cuenta"
                 style="background-color: #E30613; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Ver detalles del servicio
              </a>
            </div>
          </div>
        </div>
      `;
      break;

    case 'resena_recibida':
      subject = 'Nueva reseña recibida - Changánet';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Nueva Reseña</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              ${message}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mi-cuenta"
                 style="background-color: #E30613; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Ver reseña
              </a>
            </div>
          </div>
        </div>
      `;
      break;

    case 'pago_liberado':
      subject = 'Pago liberado - Changánet';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Pago Liberado</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              ${message}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mi-cuenta"
                 style="background-color: #E30613; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Ver detalles del pago
              </a>
            </div>
          </div>
        </div>
      `;
      break;

    case 'verificacion_aprobada':
      subject = 'Verificación aprobada - Changánet';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Verificación Aprobada</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              ${message}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mi-cuenta"
                 style="background-color: #E30613; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Ver mi perfil verificado
              </a>
            </div>
          </div>
        </div>
      `;
      break;

    default:
      subject = 'Notificación de Changánet';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #E30613; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Notificación</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              ${message}
            </p>
          </div>
        </div>
      `;
  }

  await exports.sendEmail(email, subject, html);
};

/**
 * Envía un email genérico usando SendGrid
 * @param {string} to - Email del destinatario
 * @param {string} subject - Asunto del email
 * @param {string} html - Contenido HTML del email
 */
exports.sendEmail = async (to, subject, html) => {
  const sgMail = require('@sendgrid/mail');

  // Configurar API key
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: to,
    from: {
      email: process.env.FROM_EMAIL,
      name: 'Changánet'
    },
    subject: subject,
    html: html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email enviado exitosamente a ${to}`);
  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    if (error.response) {
      console.error('Detalles del error:', error.response.body);
    }
    throw error;
  }
};