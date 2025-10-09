// src/controllers/quoteController.js
const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('../services/notificationService');
const { sendQuoteRequestEmail } = require('../services/emailService');

const prisma = new PrismaClient();

exports.createQuoteRequest = async (req, res) => {
  const { id: clientId } = req.user;
  const { profesional_id, descripcion, zona_cobertura } = req.body;

  try {
    const quote = await prisma.cotizaciones.create({
      data: {
        cliente_id: clientId,
        profesional_id,
        descripcion,
        estado: 'pendiente'
      },
      include: {
        cliente: { select: { nombre: true, email: true } },
        profesional: { select: { nombre: true, email: true } }
      }
    });

    // Enviar notificación al profesional
    await sendNotification(profesional_id, 'nueva_cotizacion', `Nueva solicitud de presupuesto de ${quote.cliente.nombre}`);

    // Enviar email al profesional
    await sendQuoteRequestEmail(quote.profesional, quote.cliente, quote);

    res.status(201).json(quote);
  } catch (error) {
    console.error('Error al crear solicitud de cotización:', error);
    res.status(500).json({ error: 'Error al crear la solicitud de cotización.' });
  }
};

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

    // Enviar notificación al cliente
    const notificationType = action === 'accept' ? 'servicio_agendado' : 'nueva_cotizacion';
    const message = action === 'accept'
      ? `Tu cotización ha sido aceptada por ${quote.profesional.nombre}`
      : `Tu cotización ha sido rechazada por ${quote.profesional.nombre}`;

    await sendNotification(quote.cliente_id, notificationType, message);

    res.status(200).json(updatedQuote);
  } catch (error) {
    console.error('Error al responder cotización:', error);
    res.status(500).json({ error: 'Error al procesar la respuesta.' });
  }
};

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