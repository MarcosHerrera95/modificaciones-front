/**
 * @archivo src/controllers/quoteController.js - Controlador de cotizaciones
 * @descripción Gestiona solicitudes de presupuesto entre clientes y profesionales (REQ-31, REQ-32, REQ-33, REQ-34, REQ-35)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Económico: Transparencia en precios y eficiencia en la conexión comercial
 */

const { PrismaClient } = require('@prisma/client');
const { createNotification, NOTIFICATION_TYPES } = require('../services/notificationService');
const { sendPushNotification } = require('../services/pushNotificationService');
const { sendQuoteRequestEmail } = require('../services/emailService');

const prisma = new PrismaClient();

/**
 * @función createQuoteRequest - Crear solicitud de cotización
 * @descripción Crea nueva solicitud de presupuesto y notifica al profesional (REQ-31, REQ-32)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Económico: Conexión directa entre demanda y oferta de servicios profesionales
 * @param {Object} req - Request con datos de la solicitud
 * @param {Object} res - Response con datos de la cotización creada
 */
exports.createQuoteRequest = async (req, res) => {
  const { id: clientId } = req.user;
  const { profesional_id, descripcion, zona_cobertura } = req.body;

  try {
    // Validar que el profesional existe y está verificado
    const professional = await prisma.usuarios.findUnique({
      where: { id: parseInt(profesional_id) },
      select: { id: true, nombre: true, email: true, esta_verificado: true, rol: true }
    });

    if (!professional) {
      return res.status(404).json({ error: 'Profesional no encontrado.' });
    }

    if (professional.rol !== 'profesional') {
      return res.status(400).json({ error: 'El usuario especificado no es un profesional.' });
    }

    if (!professional.esta_verificado) {
      return res.status(400).json({ error: 'Solo puedes solicitar cotizaciones a profesionales verificados.' });
    }

    const quote = await prisma.cotizaciones.create({
      data: {
        cliente_id: clientId,
        profesional_id: parseInt(profesional_id),
        descripcion,
        zona_cobertura,
        estado: 'pendiente'
      },
      include: {
        cliente: { select: { nombre: true, email: true } },
        profesional: { select: { nombre: true, email: true } }
      }
    });

    // Enviar notificación push al profesional (REQ-35)
    try {
      await sendPushNotification(
        parseInt(profesional_id),
        'Nueva solicitud de presupuesto',
        `Tienes una nueva solicitud de presupuesto de ${quote.cliente.nombre}`,
        {
          type: 'cotizacion',
          quoteId: quote.id,
          cliente_id: clientId
        }
      );
    } catch (pushError) {
      console.warn('Error enviando push notification de cotización:', pushError.message);
    }

    // Enviar notificación en base de datos al profesional (REQ-35)
    await createNotification(
      parseInt(profesional_id),
      NOTIFICATION_TYPES.COTIZACION,
      `Nueva solicitud de presupuesto de ${quote.cliente.nombre}`,
      { quoteId: quote.id }
    );

    console.log({ event: 'quote_request_created', clientId, professionalId: profesional_id, quoteId: quote.id });

    // Enviar email al profesional
    try {
      const { sendEmail } = require('../services/emailService');
      await sendEmail(
        quote.profesional.email,
        'Nueva solicitud de presupuesto en Changánet',
        `Hola ${quote.profesional.nombre},\n\nHas recibido una nueva solicitud de presupuesto de ${quote.cliente.nombre}:\n\n"${quote.descripcion}"\n\nZona: ${quote.zona_cobertura || 'No especificada'}\n\nPuedes responder desde tu panel profesional.\n\nSaludos,\nEquipo Changánet`
      );
    } catch (emailError) {
      console.warn('Error enviando email de cotización:', emailError);
    }

    res.status(201).json(quote);
  } catch (error) {
    console.error('Error al crear solicitud de cotización:', error);
    res.status(500).json({ error: 'Error al crear la solicitud de cotización.' });
  }
};

/**
 * @función getQuotesForProfessional - Obtener cotizaciones para profesional
 * @descripción Lista todas las solicitudes de presupuesto dirigidas al profesional (REQ-32)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Económico: Acceso a oportunidades comerciales para profesionales independientes
 * @param {Object} req - Request del profesional autenticado
 * @param {Object} res - Response con lista de cotizaciones
 */
exports.getQuotesForProfessional = async (req, res) => {
  const { id: professionalId } = req.user;

  try {
    const quotes = await prisma.cotizaciones.findMany({
      where: { profesional_id: professionalId },
      include: {
        cliente: { select: { nombre: true, email: true } }
      },
      orderBy: { creado_en: 'desc' }
    });

    res.status(200).json(quotes);
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error);
    res.status(500).json({ error: 'Error al obtener las cotizaciones.' });
  }
};

/**
 * @función respondToQuote - Responder a solicitud de cotización
 * @descripción Permite al profesional aceptar o rechazar cotización con precio (REQ-33, REQ-35)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Económico: Negociación transparente y eficiente de servicios profesionales
 * @param {Object} req - Request con acción (accept/reject) y datos opcionales
 * @param {Object} res - Response con cotización actualizada
 */
exports.respondToQuote = async (req, res) => {
  const { id: professionalId } = req.user;
  const { quoteId, action, precio, comentario } = req.body;

  try {
    const quote = await prisma.cotizaciones.findUnique({
      where: { id: quoteId },
      include: { cliente: true, profesional: true }
    });

    if (!quote || quote.profesional_id !== professionalId) {
      return res.status(403).json({ error: 'No tienes permiso para responder a esta cotización.' });
    }

    if (quote.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Esta cotización ya ha sido respondida.' });
    }

    const updateData = {
      estado: action === 'accept' ? 'aceptado' : 'rechazado'
    };

    if (action === 'accept') {
      updateData.precio = parseFloat(precio);
      updateData.comentario = comentario;
      updateData.aceptado_en = new Date();
    } else {
      updateData.rechazado_en = new Date();
    }

    const updatedQuote = await prisma.cotizaciones.update({
      where: { id: quoteId },
      data: updateData,
      include: {
        cliente: { select: { nombre: true, email: true } },
        profesional: { select: { nombre: true, email: true } }
      }
    });

    // Enviar notificación push al cliente
    const pushTitle = action === 'accept' ? 'Cotización aceptada' : 'Cotización rechazada';
    const pushMessage = action === 'accept'
      ? `Tu cotización ha sido aceptada por ${quote.profesional.nombre}. Precio: $${precio}`
      : `Tu cotización ha sido rechazada por ${quote.profesional.nombre}`;

    try {
      await sendPushNotification(
        quote.cliente_id,
        pushTitle,
        pushMessage,
        {
          type: action === 'accept' ? 'cotizacion_aceptada' : 'cotizacion_rechazada',
          quoteId: quoteId,
          profesional_id: professionalId,
          precio: action === 'accept' ? precio : null
        }
      );
    } catch (pushError) {
      console.warn('Error enviando push notification de respuesta a cotización:', pushError.message);
    }

    // Enviar notificación en base de datos al cliente
    const notificationType = action === 'accept' ? NOTIFICATION_TYPES.COTIZACION_ACEPTADA : NOTIFICATION_TYPES.COTIZACION_RECHAZADA;
    const message = action === 'accept'
      ? `Tu cotización ha sido aceptada por ${quote.profesional.nombre}. Precio: $${precio}`
      : `Tu cotización ha sido rechazada por ${quote.profesional.nombre}`;

    await createNotification(quote.cliente_id, notificationType, message);

    // Enviar email al cliente
    try {
      const { sendEmail } = require('../services/emailService');
      const emailSubject = action === 'accept' ? 'Cotización aceptada en Changánet' : 'Cotización rechazada en Changánet';
      const emailBody = action === 'accept'
        ? `Hola ${quote.cliente.nombre},\n\n¡Buenas noticias! Tu cotización ha sido aceptada por ${quote.profesional.nombre}.\n\nPrecio acordado: $${precio}\nComentario: ${comentario || 'Sin comentario adicional'}\n\nYa puedes agendar tu servicio desde la plataforma.\n\nSaludos,\nEquipo Changánet`
        : `Hola ${quote.cliente.nombre},\n\nTu cotización ha sido rechazada por ${quote.profesional.nombre}.\n\nPuedes buscar otros profesionales o contactar directamente a este profesional para negociar.\n\nSaludos,\nEquipo Changánet`;

      await sendEmail(quote.cliente.email, emailSubject, emailBody);
    } catch (emailError) {
      console.warn('Error enviando email de respuesta a cotización:', emailError);
    }

    res.status(200).json(updatedQuote);
  } catch (error) {
    console.error('Error al responder cotización:', error);
    res.status(500).json({ error: 'Error al procesar la respuesta.' });
  }
};

/**
 * @función getClientQuotes - Obtener cotizaciones del cliente
 * @descripción Lista todas las cotizaciones enviadas por el cliente (REQ-34)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Social: Seguimiento transparente de solicitudes para consumidores informados
 * @param {Object} req - Request del cliente autenticado
 * @param {Object} res - Response con lista de cotizaciones del cliente
 */
exports.getClientQuotes = async (req, res) => {
  const { id: clientId } = req.user;

  try {
    const quotes = await prisma.cotizaciones.findMany({
      where: { cliente_id: clientId },
      include: {
        profesional: { select: { nombre: true, email: true } }
      },
      orderBy: { creado_en: 'desc' }
    });

    res.status(200).json(quotes);
  } catch (error) {
    console.error('Error al obtener cotizaciones del cliente:', error);
    res.status(500).json({ error: 'Error al obtener las cotizaciones.' });
  }
};