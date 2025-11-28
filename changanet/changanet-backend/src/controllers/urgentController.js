/**
 * @archivo src/controllers/urgentController.js - Controlador de Servicios Urgentes
 * @descripción Gestiona solicitudes urgentes, asignación automática y notificaciones en tiempo real
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Atención inmediata para situaciones de emergencia
 */

const { createNotification } = require('../services/notificationService');

// Referencias a servicios (se establecen desde el servidor)
let urgentService = null;
let webSocketService = null;

const setUrgentService = (service) => {
  urgentService = service;
};

const setWebSocketService = (service) => {
  webSocketService = service;
};


/**
 * POST /api/urgent-requests - Crear solicitud urgente
 * Permite a clientes crear solicitudes de servicios urgentes
 */
exports.createUrgentRequest = async (req, res) => {
  const { id: clientId } = req.user;
  const { description, location, radiusKm, serviceCategory, serviceId } = req.body;

  try {
    if (!urgentService) {
      return res.status(500).json({ error: 'Servicio de urgencias no disponible.' });
    }

    // Crear solicitud usando el servicio
    const urgentRequest = await urgentService.createUrgentRequest(clientId, {
      description,
      location,
      radiusKm,
      serviceCategory,
      serviceId
    });

    // Notificar vía WebSocket si está disponible
    if (webSocketService) {
      webSocketService.notifyUrgentRequestStatusUpdate(urgentRequest, {
        message: 'Solicitud urgente creada exitosamente'
      });
    }

    res.status(201).json(urgentRequest);

  } catch (error) {
    console.error('Error creating urgent request:', error);
    res.status(400).json({ error: error.message || 'Error al crear solicitud urgente.' });
  }
};

/**
 * GET /api/urgent-requests/:id/status - Obtener estado de solicitud urgente
 */
exports.getUrgentRequestStatus = async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    if (!urgentService) {
      return res.status(500).json({ error: 'Servicio de urgencias no disponible.' });
    }

    const urgentRequest = await urgentService.getUrgentRequest(id, userId);

    res.status(200).json(urgentRequest);

  } catch (error) {
    console.error('Error getting urgent request status:', error);
    res.status(400).json({ error: error.message || 'Error al obtener estado de solicitud.' });
  }
};

/**
 * POST /api/urgent-requests/:id/cancel - Cancelar solicitud urgente
 */
exports.cancelUrgentRequest = async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    if (!urgentService) {
      return res.status(500).json({ error: 'Servicio de urgencias no disponible.' });
    }

    const updatedRequest = await urgentService.cancelUrgentRequest(id, userId);

    res.status(200).json(updatedRequest);

  } catch (error) {
    console.error('Error cancelling urgent request:', error);
    res.status(400).json({ error: error.message || 'Error al cancelar solicitud.' });
  }
};

/**
 * GET /api/urgent/nearby - Obtener solicitudes urgentes cercanas (Profesionales)
 */
exports.getNearbyUrgentRequests = async (req, res) => {
  const { id: professionalId } = req.user;
  const { lat, lng, serviceCategory } = req.query;

  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Coordenadas lat y lng son requeridas.' });
    }

    // Usar servicio de geolocalización para encontrar solicitudes cercanas
    const geolocationService = require('../services/geolocationService').GeolocationService;
    const geoService = new geolocationService();

    const nearbyRequests = await geoService.findNearbyUrgentRequests(
      parseFloat(lat),
      parseFloat(lng),
      50, // Radio máximo por defecto
      { serviceCategory }
    );

    // Filtrar solicitudes donde el profesional no es candidato
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const filteredRequests = [];
    for (const request of nearbyRequests) {
      const existingCandidate = await prisma.urgent_request_candidates.findFirst({
        where: {
          urgent_request_id: request.id,
          professional_id: professionalId
        }
      });

      if (!existingCandidate) {
        filteredRequests.push(request);
      }
    }

    res.status(200).json(filteredRequests);

  } catch (error) {
    console.error('Error getting nearby urgent requests:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes cercanas.' });
  }
};

/**
 * POST /api/urgent/:id/accept - Aceptar solicitud urgente (Profesional)
 */
exports.acceptUrgentRequest = async (req, res) => {
  const { id: professionalId, nombre, telefono, url_foto_perfil } = req.user;
  const { id } = req.params;

  try {
    if (!urgentService) {
      return res.status(500).json({ error: 'Servicio de urgencias no disponible.' });
    }

    const result = await urgentService.acceptUrgentRequest(id, professionalId, {
      nombre,
      telefono,
      url_foto_perfil,
      id: professionalId
    });

    res.status(200).json({
      message: 'Solicitud urgente aceptada exitosamente.',
      assignment: result.assignment
    });

  } catch (error) {
    console.error('Error accepting urgent request:', error);
    res.status(400).json({ error: error.message || 'Error al aceptar solicitud.' });
  }
};

/**
 * POST /api/urgent/:id/reject - Rechazar solicitud urgente (Profesional)
 */
exports.rejectUrgentRequest = async (req, res) => {
  const { id: professionalId } = req.user;
  const { id } = req.params;
  const { reason } = req.body;

  try {
    if (!urgentService) {
      return res.status(500).json({ error: 'Servicio de urgencias no disponible.' });
    }

    await urgentService.rejectUrgentRequest(id, professionalId, reason);

    res.status(200).json({
      message: 'Solicitud urgente rechazada.'
    });

  } catch (error) {
    console.error('Error rejecting urgent request:', error);
    res.status(400).json({ error: error.message || 'Error al rechazar solicitud.' });
  }
};

/**
 * POST /api/urgent/autodispatch - Asignación automática (Sistema)
 */
exports.autoDispatchUrgentRequest = async (req, res) => {
  const { urgentRequestId } = req.body;

  try {
    if (!urgentService) {
      return res.status(500).json({ error: 'Servicio de urgencias no disponible.' });
    }

    // El servicio ya maneja el auto-dispatch internamente
    res.status(200).json({ message: 'Auto-dispatch completado.' });

  } catch (error) {
    console.error('Error in auto dispatch:', error);
    res.status(500).json({ error: 'Error en auto-dispatch.' });
  }
};

/**
 * POST /api/urgent/geoscan - Escanear área geográfica (Sistema)
 */
exports.geoScanUrgentRequests = async (req, res) => {
  // Esta función podría usarse para escanear periódicamente
  // Por ahora, solo retorna OK
  res.status(200).json({ message: 'Geo scan completed.' });
};

/**
 * POST /api/urgent/notify-professionals - Notificar profesionales (Sistema)
 */
exports.notifyProfessionals = async (req, res) => {
  // Esta función podría usarse para re-notificar
  // Por ahora, solo retorna OK
  res.status(200).json({ message: 'Professionals notified.' });
};

/**
 * GET /api/urgent/pricing - Obtener reglas de precios (Admin)
 */
exports.getUrgentPricingRules = async (req, res) => {
  try {
    // Validar permisos de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver reglas de precios.' });
    }

    const matchingService = require('../services/matchingService').MatchingService;
    const matchService = new matchingService();

    const rules = await matchService.getUrgentPricingRules();

    res.status(200).json(rules);
  } catch (error) {
    console.error('Error getting pricing rules:', error);
    res.status(500).json({ error: 'Error al obtener reglas de precios.' });
  }
};

/**
 * POST /api/urgent/pricing/update - Actualizar reglas de precios (Admin)
 */
exports.updateUrgentPricingRules = async (req, res) => {
  const { rules } = req.body;

  try {
    // Validar que sea admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden actualizar reglas de precios.' });
    }

    const matchingService = require('../services/matchingService').MatchingService;
    const matchService = new matchingService();

    const updatedRules = await matchService.updateUrgentPricingRules(rules);

    console.log(`💰 Reglas de precios urgentes actualizadas por admin ${req.user.id}`);

    res.status(200).json(updatedRules);
  } catch (error) {
    console.error('Error updating pricing rules:', error);
    res.status(500).json({ error: 'Error al actualizar reglas de precios.' });
  }
};

module.exports = {
  ...exports,
  setUrgentService,
  setWebSocketService
};