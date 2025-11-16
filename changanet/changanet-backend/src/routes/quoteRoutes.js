// src/routes/quoteRoutes.js
/**
 * @archivo src/routes/quoteRoutes.js - Rutas de cotizaciones
 * @descripción Define endpoints REST para sistema de solicitudes de presupuesto (REQ-31, REQ-32, REQ-33, REQ-34, REQ-35)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Económico: Transparencia en precios y comparación de ofertas
 */

const express = require('express');
const { createQuoteRequest, getQuotesForProfessional, respondToQuote, getClientQuotes } = require('../controllers/quoteController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * @ruta POST / - Crear solicitud de cotización
 * @descripción Permite a clientes crear solicitudes de presupuesto para profesionales (REQ-31)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Económico: Conexión eficiente entre demanda y oferta de servicios
 */
router.post('/', createQuoteRequest);
router.post('/request', createQuoteRequest); // Alias para compatibilidad con frontend

/**
 * @ruta GET /professional - Obtener cotizaciones para profesional
 * @descripción Lista solicitudes de presupuesto pendientes para el profesional (REQ-32)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Económico: Acceso a oportunidades de trabajo para profesionales
 */
router.get('/professional', getQuotesForProfessional);

/**
 * @ruta GET /client - Obtener cotizaciones del cliente
 * @descripción Lista todas las cotizaciones enviadas por el cliente (REQ-34)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Social: Seguimiento transparente de solicitudes enviadas
 */
router.get('/client', getClientQuotes);

/**
 * @ruta POST /respond - Responder a cotización
 * @descripción Permite a profesionales aceptar o rechazar solicitudes de presupuesto (REQ-33)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Backend] Implementar API de Solicitudes de Presupuesto
 * @impacto Económico: Negociación directa y eficiente de precios
 */
router.post('/respond', respondToQuote);

// Obtener servicios para cliente
router.get('/client/services', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const { id: clientId } = req.user;
  try {
    const services = await prisma.servicios.findMany({
      where: { cliente_id: clientId },
      include: {
        profesional: { select: { nombre: true } }
        // servicio_recurrente: true // Commented out due to schema mismatch
      },
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
      include: {
        cliente: { select: { nombre: true } }
        // servicio_recurrente: true // Commented out due to schema mismatch
      },
      orderBy: { creado_en: 'desc' }
    });
    res.status(200).json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener servicios.' });
  }
});

module.exports = router;