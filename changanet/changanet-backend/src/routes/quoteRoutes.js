// src/routes/quoteRoutes.js
const express = require('express');
const { createQuoteRequest, getQuotesForProfessional, respondToQuote, getClientQuotes } = require('../controllers/quoteController');

const router = express.Router();

// Crear solicitud de cotización (cliente)
router.post('/', createQuoteRequest);
router.post('/request', createQuoteRequest); // Alias para compatibilidad con frontend

// Obtener cotizaciones para profesional
router.get('/professional', getQuotesForProfessional);

// Obtener cotizaciones para cliente
router.get('/client', getClientQuotes);

// Responder a cotización (profesional)
router.post('/respond', respondToQuote);

// Obtener servicios para cliente
router.get('/client/services', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const { id: clientId } = req.user;
  try {
    const services = await prisma.servicios.findMany({
      where: { cliente_id: clientId },
      include: { profesional: { select: { nombre: true } } },
      orderBy: { creado_en: 'desc' }
    });
    res.status(200).json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener servicios.' });
  }
});

// Obtener servicios para profesional
router.get('/professional/services', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const { id: professionalId } = req.user;
  try {
    const services = await prisma.servicios.findMany({
      where: { profesional_id: professionalId },
      include: { cliente: { select: { nombre: true } } },
      orderBy: { creado_en: 'desc' }
    });
    res.status(200).json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener servicios.' });
  }
});

module.exports = router;