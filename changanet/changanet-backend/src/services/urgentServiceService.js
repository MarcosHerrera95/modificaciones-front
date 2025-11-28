/**
 * @archivo src/services/urgentServiceService.js - Servicio de Gestión de Servicios Urgentes
 * @descripción Lógica de negocio centralizada para la gestión completa de servicios urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Sistema de atención inmediata para emergencias
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Referencias a otros servicios (se establecen desde el servidor)
let notificationService = null;
let webSocketService = null;
let matchingService = null;
let slaService = null;
let geolocationService = null;

function setNotificationService(service) {
  notificationService = service;
}

function setWebSocketService(service) {
  webSocketService = service;
}

function setMatchingService(service) {
  matchingService = service;
}

function setSlaService(service) {
  slaService = service;
}

function setGeolocationService(service) {
  geolocationService = service;
}

class UrgentServiceService {
  /**
   * Crear una nueva solicitud urgente
   * @param {string} clientId - ID del cliente
   * @param {Object} requestData - Datos de la solicitud
   * @returns {Object} Solicitud creada
   */
  async createUrgentRequest(clientId, requestData) {
    const { description, location, radiusKm, serviceCategory, serviceId } = requestData;

    // Validaciones
    if (!description || !location || !location.lat || !location.lng) {
      throw new Error('Descripción y ubicación (lat, lng) son requeridos.');
    }

    if (radiusKm < 1 || radiusKm > 50) {
      throw new Error('El radio debe estar entre 1 y 50 km.');
    }

    // Verificar límite de solicitudes por hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await prisma.urgent_requests.count({
      where: {
        client_id: clientId,
        created_at: { gte: oneHourAgo }
      }
    });

    if (recentRequests >= 5) {
      throw new Error('Demasiadas solicitudes urgentes en la última hora. Intente más tarde.');
    }

    // Obtener precio estimado usando matching service
    const priceEstimate = await this.calculatePriceEstimate(serviceCategory, location, radiusKm);

    // Crear solicitud urgente con coordenadas separadas
    const urgentRequest = await prisma.urgent_requests.create({
      data: {
        client_id: clientId,
        service_id: serviceId,
        description,
        latitude: location.lat,
        longitude: location.lng,
        radius_km: radiusKm,
        status: 'pending',
        price_estimate: priceEstimate
      }
    });

    // Crear entrada de tracking inicial
    await this.createStatusTracking(urgentRequest.id, 'pending', 'Solicitud creada');

    // Iniciar proceso de asignación automática
    setImmediate(() => this.autoDispatchUrgentRequest(urgentRequest.id));

    console.log(`🚨 Nueva solicitud urgente creada: ${urgentRequest.id} por cliente ${clientId}`);

    return urgentRequest;
  }

  /**
   * Calcular precio estimado para solicitud urgente
   * @param {string} serviceCategory - Categoría del servicio
   * @param {Object} location - Ubicación
   * @param {number} radiusKm - Radio en km
   * @returns {number} Precio estimado
   */
  async calculatePriceEstimate(serviceCategory, location, radiusKm) {
    try {
      if (!matchingService) {
        return 0; // Fallback si no hay servicio de matching
      }

      const pricing = await matchingService.getUrgentPricing(serviceCategory || 'general');

      // Calcular precio base considerando distancia y urgencia
      const basePrice = pricing.minPrice || 0;
      const distanceMultiplier = Math.max(1, radiusKm / 5); // Multiplicador por distancia
      const urgentMultiplier = pricing.multiplier || 1.5;

      return Math.round(basePrice * distanceMultiplier * urgentMultiplier);
    } catch (error) {
      console.error('Error calculating price estimate:', error);
      return 0;
    }
  }

  /**
   * Obtener solicitud urgente por ID con validación de permisos
   * @param {string} requestId - ID de la solicitud
   * @param {string} userId - ID del usuario solicitante
   * @returns {Object} Solicitud encontrada
   */
  async getUrgentRequest(requestId, userId) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: requestId },
      include: {
        candidates: {
          include: {
            professional: {
              select: { id: true, nombre: true, url_foto_perfil: true, calificacion_promedio: true }
            }
          }
        },
        assignments: {
          include: {
            professional: {
              select: { id: true, nombre: true, telefono: true, url_foto_perfil: true, calificacion_promedio: true }
            }
          }
        },
        client: {
          select: { id: true, nombre: true, url_foto_perfil: true }
        },
        service: {
          select: { id: true, nombre: true, categoria: true }
        },
        rejections: {
          include: {
            professional: {
              select: { id: true, nombre: true }
            }
          }
        }
      }
    });

    if (!urgentRequest) {
      throw new Error('Solicitud urgente no encontrada.');
    }

    // Validar permisos: solo cliente, profesional asignado o admin
    const isClient = urgentRequest.client_id === userId;
    const isAssignedProfessional = urgentRequest.assignments.some(a => a.professional_id === userId);
    const isCandidate = urgentRequest.candidates.some(c => c.professional_id === userId);

    if (!isClient && !isAssignedProfessional && !isCandidate) {
      throw new Error('No tienes permiso para ver esta solicitud.');
    }

    return urgentRequest;
  }

  /**
   * Cancelar solicitud urgente
   * @param {string} requestId - ID de la solicitud
   * @param {string} clientId - ID del cliente
   * @returns {Object} Solicitud cancelada
   */
  async cancelUrgentRequest(requestId, clientId) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: requestId }
    });

    if (!urgentRequest) {
      throw new Error('Solicitud urgente no encontrada.');
    }

    if (urgentRequest.client_id !== clientId) {
      throw new Error('Solo el cliente puede cancelar la solicitud.');
    }

    if (urgentRequest.status === 'completed' || urgentRequest.status === 'cancelled') {
      throw new Error('La solicitud ya está completada o cancelada.');
    }

    // Actualizar estado
    const updatedRequest = await prisma.urgent_requests.update({
      where: { id: requestId },
      data: { status: 'cancelled' }
    });

    // Crear tracking
    await this.createStatusTracking(requestId, 'cancelled', 'Cancelada por el cliente');

    // Notificar a candidatos activos
    if (notificationService) {
      const activeCandidates = await prisma.urgent_request_candidates.findMany({
        where: {
          urgent_request_id: requestId,
          responded: false
        }
      });

      for (const candidate of activeCandidates) {
        await notificationService.createNotification(
          candidate.professional_id,
          'urgent_request_cancelled',
          'La solicitud urgente ha sido cancelada por el cliente.',
          { urgentRequestId: requestId }
        );
      }
    }

    // Notificar vía WebSocket
    if (webSocketService) {
      webSocketService.notifyUrgentRequestStatusUpdate(updatedRequest, {
        message: 'Solicitud cancelada por el cliente'
      });
    }

    console.log(`❌ Solicitud urgente ${requestId} cancelada por cliente ${clientId}`);

    return updatedRequest;
  }

  /**
   * Aceptar solicitud urgente (Profesional)
   * @param {string} requestId - ID de la solicitud
   * @param {string} professionalId - ID del profesional
   * @param {Object} professional - Datos del profesional
   * @returns {Object} Resultado de la aceptación
   */
  async acceptUrgentRequest(requestId, professionalId, professional) {
    // Verificar que sea candidato
    const candidate = await prisma.urgent_request_candidates.findFirst({
      where: {
        urgent_request_id: requestId,
        professional_id: professionalId,
        responded: false
      }
    });

    if (!candidate) {
      throw new Error('No eres candidato para esta solicitud.');
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
        urgent_request_id: requestId,
        professional_id: professionalId,
        status: 'accepted'
      }
    });

    // Actualizar estado de la solicitud
    const updatedRequest = await prisma.urgent_requests.update({
      where: { id: requestId },
      data: {
        status: 'assigned',
        assigned_professional_id: professionalId
      }
    });

    // Crear tracking
    await this.createStatusTracking(requestId, 'assigned', `Asignada al profesional ${professional.nombre}`, professionalId);

    // Iniciar SLA si está disponible
    if (slaService) {
      await slaService.startSLA(requestId, 'urgent_response');
    }

    // Notificar al cliente
    if (notificationService) {
      const urgentRequest = await this.getUrgentRequest(requestId, updatedRequest.client_id);

      await notificationService.createNotification(
        urgentRequest.client_id,
        'urgent_request_accepted',
        `¡Tu solicitud urgente ha sido aceptada! El profesional ${professional.nombre} se contactará pronto.`,
        {
          urgentRequestId: requestId,
          professionalId,
          assignmentId: assignment.id,
          professional: {
            nombre: professional.nombre,
            telefono: professional.telefono,
            calificacion_promedio: professional.calificacion_promedio
          }
        }
      );
    }

    // Notificar vía WebSocket
    if (webSocketService) {
      webSocketService.notifyUrgentRequestAccepted(updatedRequest, {
        professional: {
          id: professional.id,
          nombre: professional.nombre,
          telefono: professional.telefono,
          url_foto_perfil: professional.url_foto_perfil,
          calificacion_promedio: professional.calificacion_promedio
        },
        assigned_at: assignment.assigned_at
      });
    }

    // Notificar a otros candidatos que fueron rechazados
    const otherCandidates = await prisma.urgent_request_candidates.findMany({
      where: {
        urgent_request_id: requestId,
        professional_id: { not: professionalId },
        responded: false
      }
    });

    for (const otherCandidate of otherCandidates) {
      await prisma.urgent_request_candidates.update({
        where: { id: otherCandidate.id },
        data: { responded: true, accepted: false }
      });

      // Crear registro de rechazo
      await prisma.urgent_rejections.create({
        data: {
          urgent_request_id: requestId,
          professional_id: otherCandidate.professional_id,
          reason: 'Otro profesional fue asignado'
        }
      });

      if (notificationService) {
        await notificationService.createNotification(
          otherCandidate.professional_id,
          'urgent_request_assigned_to_other',
          'La solicitud urgente fue asignada a otro profesional.',
          { urgentRequestId: requestId }
        );
      }
    }

    console.log(`✅ Solicitud urgente ${requestId} aceptada por profesional ${professionalId}`);

    return { assignment, updatedRequest };
  }

  /**
   * Rechazar solicitud urgente (Profesional)
   * @param {string} requestId - ID de la solicitud
   * @param {string} professionalId - ID del profesional
   * @param {string} reason - Razón del rechazo
   */
  async rejectUrgentRequest(requestId, professionalId, reason = null) {
    const candidate = await prisma.urgent_request_candidates.findFirst({
      where: {
        urgent_request_id: requestId,
        professional_id: professionalId,
        responded: false
      }
    });

    if (!candidate) {
      throw new Error('No eres candidato para esta solicitud.');
    }

    // Marcar como respondido y rechazado
    await prisma.urgent_request_candidates.update({
      where: { id: candidate.id },
      data: {
        responded: true,
        accepted: false
      }
    });

    // Crear registro de rechazo
    await prisma.urgent_rejections.create({
      data: {
        urgent_request_id: requestId,
        professional_id: professionalId,
        reason: reason || 'Rechazada por el profesional'
      }
    });

    console.log(`❌ Solicitud urgente ${requestId} rechazada por profesional ${professionalId}`);

    // Verificar si quedan candidatos, si no, reintentar asignación
    const remainingCandidates = await prisma.urgent_request_candidates.count({
      where: {
        urgent_request_id: requestId,
        responded: false
      }
    });

    if (remainingCandidates === 0) {
      // Reintentar asignación con más profesionales
      setImmediate(() => this.autoDispatchUrgentRequest(requestId, true));
    }
  }

  /**
   * Asignación automática de solicitud urgente
   * @param {string} urgentRequestId - ID de la solicitud
   * @param {boolean} isRetry - Si es un reintento
   */
  async autoDispatchUrgentRequest(urgentRequestId, isRetry = false) {
    try {
      const urgentRequest = await prisma.urgent_requests.findUnique({
        where: { id: urgentRequestId },
        include: { client: true }
      });

      if (!urgentRequest || urgentRequest.status !== 'pending') {
        return;
      }

      if (!matchingService) {
        console.error('Matching service not available for auto dispatch');
        return;
      }

      // Usar servicio de matching para encontrar candidatos
      const candidates = await matchingService.findMatchingProfessionals(
        urgentRequest.latitude,
        urgentRequest.longitude,
        urgentRequest.radius_km,
        {
          serviceCategory: urgentRequest.service?.categoria,
          isRetry
        }
      );

      if (candidates.length === 0) {
        console.log(`⚠️ No se encontraron candidatos para solicitud ${urgentRequestId}`);
        // Crear tracking de fallo
        await this.createStatusTracking(urgentRequestId, 'pending', 'No se encontraron profesionales disponibles');
        return;
      }

      // Crear registros de candidatos
      const candidatesData = [];
      for (const candidate of candidates) {
        // Evitar duplicados
        const existingCandidate = await prisma.urgent_request_candidates.findFirst({
          where: {
            urgent_request_id: urgentRequestId,
            professional_id: candidate.professionalId
          }
        });

        if (!existingCandidate) {
          await prisma.urgent_request_candidates.create({
            data: {
              urgent_request_id: urgentRequestId,
              professional_id: candidate.professionalId,
              distance_km: candidate.distance
            }
          });

          candidatesData.push({
            professional_id: candidate.professionalId,
            distance_km: candidate.distance
          });
        }
      }

      // Notificar candidatos
      if (notificationService && candidatesData.length > 0) {
        for (const candidate of candidates) {
          const professional = await prisma.usuarios.findUnique({
            where: { id: candidate.professionalId },
            select: { fcm_token: true, notificaciones_push: true }
          });

          if (professional?.fcm_token && professional.notificaciones_push) {
            await notificationService.createNotification(
              candidate.professionalId,
              'urgent_request_nearby',
              `🚨 ¡Solicitud urgente cerca! Distancia: ${candidate.distance.toFixed(1)}km`,
              {
                urgentRequestId: urgentRequestId,
                distance: candidate.distance,
                description: urgentRequest.description,
                clientName: urgentRequest.client.nombre,
                location: {
                  lat: urgentRequest.latitude,
                  lng: urgentRequest.longitude
                },
                radiusKm: urgentRequest.radius_km
              }
            );
          }
        }
      }

      // Notificar vía WebSocket
      if (webSocketService && candidatesData.length > 0) {
        webSocketService.notifyUrgentRequestToProfessionals(urgentRequest, candidatesData);
      }

      console.log(`📡 Auto-dispatch completado para solicitud ${urgentRequestId}. ${candidatesData.length} candidatos notificados.`);

    } catch (error) {
      console.error('Error in auto dispatch function:', error);
    }
  }

  /**
   * Crear registro de tracking de estado
   * @param {string} requestId - ID de la solicitud
   * @param {string} newStatus - Nuevo estado
   * @param {string} notes - Notas
   * @param {string} changedBy - Usuario que realizó el cambio
   */
  async createStatusTracking(requestId, newStatus, notes = null, changedBy = null) {
    try {
      // Obtener estado anterior
      const currentRequest = await prisma.urgent_requests.findUnique({
        where: { id: requestId },
        select: { status: true }
      });

      await prisma.urgent_tracking.create({
        data: {
          urgent_request_id: requestId,
          previous_status: currentRequest?.status,
          new_status: newStatus,
          changed_by: changedBy,
          notes
        }
      });
    } catch (error) {
      console.error('Error creating status tracking:', error);
    }
  }

  /**
   * Completar solicitud urgente
   * @param {string} requestId - ID de la solicitud
   * @param {string} userId - ID del usuario que completa
   * @param {Object} completionData - Datos de completación
   */
  async completeUrgentRequest(requestId, userId, completionData = {}) {
    const urgentRequest = await prisma.urgent_requests.findUnique({
      where: { id: requestId },
      include: { assignments: true }
    });

    if (!urgentRequest) {
      throw new Error('Solicitud urgente no encontrada.');
    }

    // Validar que el usuario tenga permisos
    const isClient = urgentRequest.client_id === userId;
    const isAssignedProfessional = urgentRequest.assignments.some(a => a.professional_id === userId);

    if (!isClient && !isAssignedProfessional) {
      throw new Error('No tienes permiso para completar esta solicitud.');
    }

    // Actualizar estado
    const updatedRequest = await prisma.urgent_requests.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completed_at: new Date()
      }
    });

    // Crear tracking
    await this.createStatusTracking(requestId, 'completed', 'Solicitud completada', userId);

    // Detener SLA si está activo
    if (slaService) {
      await slaService.completeSLA(requestId, 'urgent_response');
    }

    // Notificaciones
    if (notificationService) {
      const otherPartyId = isClient ? urgentRequest.assignments[0]?.professional_id : urgentRequest.client_id;

      await notificationService.createNotification(
        otherPartyId,
        'urgent_request_completed',
        'La solicitud urgente ha sido completada.',
        {
          urgentRequestId: requestId,
          completedBy: userId,
          ...completionData
        }
      );
    }

    // WebSocket
    if (webSocketService) {
      webSocketService.notifyUrgentRequestStatusUpdate(updatedRequest, {
        message: 'Solicitud completada',
        completedBy: userId
      });
    }

    console.log(`✅ Solicitud urgente ${requestId} completada por ${userId}`);

    return updatedRequest;
  }

  /**
   * Obtener estadísticas de servicios urgentes
   * @param {Object} filters - Filtros para estadísticas
   * @returns {Object} Estadísticas
   */
  async getUrgentServicesStats(filters = {}) {
    const { startDate, endDate, status, clientId, professionalId } = filters;

    const where = {};
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }
    if (status) where.status = status;
    if (clientId) where.client_id = clientId;
    if (professionalId) where.assigned_professional_id = professionalId;

    const [
      totalRequests,
      completedRequests,
      cancelledRequests,
      pendingRequests,
      assignedRequests,
      avgCompletionTime,
      rejectionStats
    ] = await Promise.all([
      prisma.urgent_requests.count({ where }),
      prisma.urgent_requests.count({ where: { ...where, status: 'completed' } }),
      prisma.urgent_requests.count({ where: { ...where, status: 'cancelled' } }),
      prisma.urgent_requests.count({ where: { ...where, status: 'pending' } }),
      prisma.urgent_requests.count({ where: { ...where, status: 'assigned' } }),
      this.getAverageCompletionTime(where),
      this.getRejectionStats(where)
    ]);

    return {
      total: totalRequests,
      completed: completedRequests,
      cancelled: cancelledRequests,
      pending: pendingRequests,
      assigned: assignedRequests,
      completionRate: totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0,
      averageCompletionTime: avgCompletionTime,
      rejectionStats
    };
  }

  /**
   * Calcular tiempo promedio de completación
   * @param {Object} where - Filtros
   * @returns {number} Tiempo promedio en horas
   */
  async getAverageCompletionTime(where) {
    const completedRequests = await prisma.urgent_requests.findMany({
      where: { ...where, status: 'completed', completed_at: { not: null } },
      select: { created_at: true, completed_at: true }
    });

    if (completedRequests.length === 0) return 0;

    const totalTime = completedRequests.reduce((sum, request) => {
      return sum + (new Date(request.completed_at) - new Date(request.created_at));
    }, 0);

    return Math.round((totalTime / completedRequests.length) / (1000 * 60 * 60)); // Horas
  }

  /**
   * Obtener estadísticas de rechazos
   * @param {Object} where - Filtros
   * @returns {Object} Estadísticas de rechazos
   */
  async getRejectionStats(where) {
    const rejections = await prisma.urgent_rejections.findMany({
      where: {
        urgent_request: where
      },
      include: {
        professional: {
          select: { id: true, nombre: true }
        }
      }
    });

    const totalRejections = rejections.length;
    const rejectionReasons = {};

    rejections.forEach(rejection => {
      const reason = rejection.reason || 'Sin especificar';
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    });

    return {
      total: totalRejections,
      reasons: rejectionReasons,
      topRejectingProfessionals: this.getTopRejectingProfessionals(rejections)
    };
  }

  /**
   * Obtener profesionales que más rechazan
   * @param {Array} rejections - Lista de rechazos
   * @returns {Array} Top rechazadores
   */
  getTopRejectingProfessionals(rejections) {
    const professionalRejections = {};

    rejections.forEach(rejection => {
      const profId = rejection.professional_id;
      if (!professionalRejections[profId]) {
        professionalRejections[profId] = {
          id: profId,
          nombre: rejection.professional.nombre,
          count: 0
        };
      }
      professionalRejections[profId].count++;
    });

    return Object.values(professionalRejections)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

module.exports = {
  UrgentServiceService,
  setNotificationService,
  setWebSocketService,
  setMatchingService,
  setSlaService,
  setGeolocationService
};