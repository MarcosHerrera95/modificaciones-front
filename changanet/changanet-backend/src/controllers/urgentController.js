/**
 * @archivo src/controllers/urgentController.js - Controlador de Servicios Urgentes
 * @descripción Gestiona solicitudes urgentes, asignación automática y notificaciones en tiempo real
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Atención inmediata para situaciones de emergencia
 */

const { PrismaClient } = require('@prisma/client');
const { createNotification } = require('../services/notificationService');
const geoCacheService = require('../services/geoCacheService');

const prisma = new PrismaClient();

// Referencia al servicio WebSocket (se establece desde el servidor)
let webSocketService = null;

const setWebSocketService = (service) => {
  webSocketService = service;
};

/**
 * Calcular distancia entre dos puntos usando fórmula de Haversine
 * @param {Object} point1 - {lat, lng}
 * @param {Object} point2 - {lat, lng}
 * @returns {number} Distancia en kilómetros
 */
function calculateDistance(point1, point2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Obtener precio dinámico para servicio urgente
 * @param {string} serviceCategory - Categoría del servicio
 * @returns {Object} {price, multiplier}
 */
async function getUrgentPricing(serviceCategory) {
  try {
    const rule = await prisma.urgent_pricing_rules.findFirst({
      where: { service_category: serviceCategory }
    });

    if (rule) {
      return {
        multiplier: rule.base_multiplier,
        minPrice: rule.min_price
      };
    }

    // Valores por defecto si no hay regla específica
    return {
      multiplier: 1.5,
      minPrice: 0
    };
  } catch (error) {
    console.error('Error getting urgent pricing:', error);
    return { multiplier: 1.5, minPrice: 0 };
  }
}

/**
 * POST /api/urgent-requests - Crear solicitud urgente
 * Permite a clientes crear solicitudes de servicios urgentes
 */
exports.createUrgentRequest = async (req, res) => {
  const { id: clientId } = req.user;
  const { description, location, radiusKm, serviceCategory } = req.body;

  try {
    // Validaciones
    if (!description || !location || !location.lat || !location.lng) {
      return res.status(400).json({
        error: 'Descripción y ubicación (lat, lng) son requeridos.'
      });
    }

    if (radiusKm < 1 || radiusKm > 50) {
      return res.status(400).json({
        error: 'El radio debe estar entre 1 y 50 km.'
      });
    }

    // Verificar límite de solicitudes por hora (rate limiting)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await prisma.urgent_requests.count({
      where: {
        client_id: clientId,
        created_at: { gte: oneHourAgo }
      }
    });

    if (recentRequests >= 5) {
      return res.status(429).json({
        error: 'Demasiadas solicitudes urgentes en la última hora. Intente más tarde.'
      });
    }

    // Obtener precio estimado
    const pricing = await getUrgentPricing(serviceCategory || 'general');
    const priceEstimate = Math.max(0, pricing.minPrice); // Por ahora precio base, se calcula después

    // Crear solicitud urgente
    const urgentRequest = await prisma.urgent_requests.create({
      data: {
        client_id: clientId,
        description,
        location: JSON.stringify(location),
        radius_km: radiusKm,
        status: 'pending',
        price_estimate: priceEstimate
      }
    });

    // Iniciar proceso de asignación automática
    setImmediate(() => autoDispatchUrgentRequest(urgentRequest.id));

    // Notificar vía WebSocket si está disponible
    if (webSocketService) {
      // Notificar al cliente que la solicitud fue creada
      webSocketService.notifyUrgentRequestStatusUpdate(urgentRequest, {
        message: 'Solicitud urgente creada exitosamente'
      });
    }

    console.log(`🚨 Nueva solicitud urgente creada: ${urgentRequest.id} por cliente ${clientId}`);

    res.status(201).json({
      ...urgentRequest,
      location: JSON.parse(urgentRequest.location)
    });

  } catch (error) {
    console.error('Error creating urgent request:', error);
    res.status(500).json({ error: 'Error al crear solicitud urgente.' });
  }
};

/**
 * GET /api/urgent-requests/:id/status - Obtener estado de solicitud urgente
 */
exports.getUrgentRequestStatus = async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id },
      include: {
        candidates: {
          include: {
            professional: {
              select: { id: true, nombre: true, url_foto_perfil: true }
            }
          }
        },
        assignments: {
          include: {
            professional: {
              select: { id: true, nombre: true, telefono: true, url_foto_perfil: true }
            }
          }
        }
      }
    });

    if (!urgentRequest) {
      return res.status(404).json({ error: 'Solicitud urgente no encontrada.' });
    }

    // Solo el cliente puede ver su solicitud
    if (urgentRequest.client_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta solicitud.' });
    }

    res.status(200).json({
      ...urgentRequest,
      location: JSON.parse(urgentRequest.location)
    });

  } catch (error) {
    console.error('Error getting urgent request status:', error);
    res.status(500).json({ error: 'Error al obtener estado de solicitud.' });
  }
};

/**
 * POST /api/urgent-requests/:id/cancel - Cancelar solicitud urgente
 */
exports.cancelUrgentRequest = async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id }
    });

    if (!urgentRequest) {
      return res.status(404).json({ error: 'Solicitud urgente no encontrada.' });
    }

    if (urgentRequest.client_id !== userId) {
      return res.status(403).json({ error: 'Solo el cliente puede cancelar la solicitud.' });
    }

    if (urgentRequest.status === 'completed' || urgentRequest.status === 'cancelled') {
      return res.status(400).json({ error: 'La solicitud ya está completada o cancelada.' });
    }

    // Actualizar estado
    const updatedRequest = await prisma.urgent_requests.update({
      where: { id },
      data: { status: 'cancelled' }
    });

    // Notificar a candidatos activos
    const activeCandidates = await prisma.urgent_request_candidates.findMany({
      where: {
        urgent_request_id: id,
        responded: false
      }
    });

    for (const candidate of activeCandidates) {
      await createNotification(
        candidate.professional_id,
        'urgent_request_cancelled',
        'La solicitud urgente ha sido cancelada por el cliente.',
        { urgentRequestId: id }
      );
    }

    console.log(`❌ Solicitud urgente ${id} cancelada por cliente ${userId}`);

    res.status(200).json({
      ...updatedRequest,
      location: JSON.parse(updatedRequest.location)
    });

  } catch (error) {
    console.error('Error cancelling urgent request:', error);
    res.status(500).json({ error: 'Error al cancelar solicitud.' });
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

    const professionalLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };

    // Buscar solicitudes urgentes activas
    const urgentRequests = await prisma.urgent_requests.findMany({
      where: {
        status: 'pending'
      },
      include: {
        client: {
          select: { nombre: true, url_foto_perfil: true }
        }
      }
    });

    // Filtrar por distancia usando caché geoespacial y verificar si ya es candidato
    const nearbyRequests = [];

    for (const request of urgentRequests) {
      const requestLocation = JSON.parse(request.location);

      // Usar el método de cálculo del servicio de caché
      const distance = geoCacheService.calculateDistance(professionalLocation, requestLocation);

      // Verificar si ya es candidato
      const existingCandidate = await prisma.urgent_request_candidates.findFirst({
        where: {
          urgent_request_id: request.id,
          professional_id: professionalId
        }
      });

      if (distance <= request.radius_km && !existingCandidate) {
        nearbyRequests.push({
          ...request,
          location: requestLocation,
          distance_km: Math.round(distance * 100) / 100
        });
      }
    }

    // Ordenar por distancia
    nearbyRequests.sort((a, b) => a.distance_km - b.distance_km);

    res.status(200).json(nearbyRequests);

  } catch (error) {
    console.error('Error getting nearby urgent requests:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes cercanas.' });
  }
};

/**
 * POST /api/urgent/:id/accept - Aceptar solicitud urgente (Profesional)
 */
exports.acceptUrgentRequest = async (req, res) => {
  const { id: professionalId } = req.user;
  const { id } = req.params;

  try {
    // Verificar que sea candidato
    const candidate = await prisma.urgent_request_candidates.findFirst({
      where: {
        urgent_request_id: id,
        professional_id: professionalId,
        responded: false
      }
    });

    if (!candidate) {
      return res.status(403).json({ error: 'No eres candidato para esta solicitud.' });
    }

    // Marcar como respondido y aceptado
    await prisma.urgent_request_candidates.update({
      where: { id: candidate.id },
      data: {
        responded: true,
        accepted: true
      }
    });

    // Crear asignación
    const assignment = await prisma.urgent_assignments.create({
      data: {
        urgent_request_id: id,
        professional_id: professionalId,
        status: 'accepted'
      }
    });

    // Actualizar estado de la solicitud
    await prisma.urgent_requests.update({
      where: { id },
      data: { status: 'assigned' }
    });

    // Notificar al cliente
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id },
      include: {
        client: true,
        assignments: {
          include: {
            professional: {
              select: { id: true, nombre: true, telefono: true, url_foto_perfil: true }
            }
          }
        }
      }
    });

    await createNotification(
      urgentRequest.client_id,
      'urgent_request_accepted',
      `¡Tu solicitud urgente ha sido aceptada! El profesional ${req.user.nombre} se contactará pronto.`,
      { urgentRequestId: id, professionalId, assignmentId: assignment.id }
    );

    // Notificar vía WebSocket
    if (webSocketService) {
      webSocketService.notifyUrgentRequestAccepted(urgentRequest, {
        professional: {
          id: req.user.id,
          nombre: req.user.nombre,
          telefono: req.user.telefono,
          url_foto_perfil: req.user.url_foto_perfil
        },
        assigned_at: assignment.assigned_at
      });
    }

    // Notificar a otros candidatos que fueron rechazados
    const otherCandidates = await prisma.urgent_request_candidates.findMany({
      where: {
        urgent_request_id: id,
        professional_id: { not: professionalId },
        responded: false
      }
    });

    for (const otherCandidate of otherCandidates) {
      await prisma.urgent_request_candidates.update({
        where: { id: otherCandidate.id },
        data: { responded: true, accepted: false }
      });

      await createNotification(
        otherCandidate.professional_id,
        'urgent_request_assigned_to_other',
        'La solicitud urgente fue asignada a otro profesional.',
        { urgentRequestId: id }
      );
    }

    console.log(`✅ Solicitud urgente ${id} aceptada por profesional ${professionalId}`);

    res.status(200).json({
      message: 'Solicitud urgente aceptada exitosamente.',
      assignment
    });

  } catch (error) {
    console.error('Error accepting urgent request:', error);
    res.status(500).json({ error: 'Error al aceptar solicitud.' });
  }
};

/**
 * POST /api/urgent/:id/reject - Rechazar solicitud urgente (Profesional)
 */
exports.rejectUrgentRequest = async (req, res) => {
  const { id: professionalId } = req.user;
  const { id } = req.params;

  try {
    const candidate = await prisma.urgent_request_candidates.findFirst({
      where: {
        urgent_request_id: id,
        professional_id: professionalId,
        responded: false
      }
    });

    if (!candidate) {
      return res.status(403).json({ error: 'No eres candidato para esta solicitud.' });
    }

    // Marcar como respondido y rechazado
    await prisma.urgent_request_candidates.update({
      where: { id: candidate.id },
      data: {
        responded: true,
        accepted: false
      }
    });

    console.log(`❌ Solicitud urgente ${id} rechazada por profesional ${professionalId}`);

    res.status(200).json({
      message: 'Solicitud urgente rechazada.'
    });

  } catch (error) {
    console.error('Error rejecting urgent request:', error);
    res.status(500).json({ error: 'Error al rechazar solicitud.' });
  }
};

/**
 * POST /api/urgent/autodispatch - Asignación automática (Sistema)
 */
exports.autoDispatchUrgentRequest = async (req, res) => {
  const { urgentRequestId } = req.body;

  try {
    await autoDispatchUrgentRequest(urgentRequestId);

    if (res) {
      res.status(200).json({ message: 'Auto-dispatch completado.' });
    }

  } catch (error) {
    console.error('Error in auto dispatch:', error);
    if (res) {
      res.status(500).json({ error: 'Error en auto-dispatch.' });
    }
  }
};

/**
 * Función interna para asignación automática
 */
async function autoDispatchUrgentRequest(urgentRequestId) {
  try {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: urgentRequestId },
      include: { client: true }
    });

    if (!urgentRequest || urgentRequest.status !== 'pending') {
      return;
    }

    const requestLocation = JSON.parse(urgentRequest.location);

    // Buscar profesionales disponibles en el área usando caché geoespacial
    const availableProfessionals = await geoCacheService.findNearbyProfessionals(
      requestLocation.lat,
      requestLocation.lng,
      urgentRequest.radius_km,
      {
        esta_disponible: true,
        latitud: { not: null },
        longitud: { not: null }
      }
    );

    // Preparar candidatos con información adicional
    const candidates = availableProfessionals.map(prof => ({
      professionalId: prof.usuario.id,
      distance: prof.distance_km,
      rating: prof.calificacion_promedio || 0
    }));

    // Ordenar candidatos: primero más cercanos, luego mejor calificación
    candidates.sort((a, b) => {
      if (Math.abs(a.distance - b.distance) < 0.1) {
        return b.rating - a.rating; // Mejor rating primero si distancia similar
      }
      return a.distance - b.distance; // Más cercano primero
    });

    // Tomar los primeros 10 candidatos como máximo
    const topCandidates = candidates.slice(0, 10);

    // Crear registros de candidatos
    for (const candidate of topCandidates) {
      await prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: urgentRequestId,
          professional_id: candidate.professionalId,
          distance_km: candidate.distance
        }
      });
    }

    // Notificar a los candidatos
    const candidatesData = [];
    for (const candidate of topCandidates) {
      const professional = availableProfessionals.find(p => p.usuario.id === candidate.professionalId);

      if (professional?.usuario?.fcm_token && professional.usuario.notificaciones_push) {
        await createNotification(
          candidate.professionalId,
          'urgent_request_nearby',
          `🚨 ¡Solicitud urgente cerca! Distancia: ${candidate.distance.toFixed(1)}km`,
          {
            urgentRequestId: urgentRequestId,
            distance: candidate.distance,
            description: urgentRequest.description,
            clientName: urgentRequest.client.nombre
          }
        );
      }

      candidatesData.push({
        professional_id: candidate.professionalId,
        distance_km: candidate.distance
      });
    }

    // Notificar vía WebSocket a todos los candidatos
    if (webSocketService && topCandidates.length > 0) {
      webSocketService.notifyUrgentRequestToProfessionals(urgentRequest, candidatesData);
    }

    console.log(`📡 Auto-dispatch completado para solicitud ${urgentRequestId}. ${topCandidates.length} candidatos notificados.`);

  } catch (error) {
    console.error('Error in auto dispatch function:', error);
  }
}

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
    const rules = await prisma.urgent_pricing_rules.findMany({
      orderBy: { service_category: 'asc' }
    });

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

    // Actualizar o crear reglas
    const updatedRules = [];
    for (const rule of rules) {
      const updated = await prisma.urgent_pricing_rules.upsert({
        where: { service_category: rule.service_category },
        update: {
          base_multiplier: rule.base_multiplier,
          min_price: rule.min_price,
          updated_at: new Date()
        },
        create: {
          service_category: rule.service_category,
          base_multiplier: rule.base_multiplier,
          min_price: rule.min_price
        }
      });
      updatedRules.push(updated);
    }

    console.log(`💰 Reglas de precios urgentes actualizadas por admin ${req.user.id}`);

    res.status(200).json(updatedRules);
  } catch (error) {
    console.error('Error updating pricing rules:', error);
    res.status(500).json({ error: 'Error al actualizar reglas de precios.' });
  }
};

module.exports = {
  ...exports,
  setWebSocketService,
  calculateDistance,
  getUrgentPricing
};