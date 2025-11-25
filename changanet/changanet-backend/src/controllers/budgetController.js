// src/controllers/budgetController.js
/**
 * @archivo src/controllers/budgetController.js - Controlador del Sistema de Solicitud de Presupuestos
 * @descripción Lógica de negocio para el módulo de solicitud de presupuestos (REQ-31 a REQ-35)
 * @versión Versión 2.0 - Sistema robusto con PostgreSQL
 * 
 * RESPONSABILIDADES:
 * - Gestión completa del ciclo de vida de solicitudes de presupuesto
 * - Distribución inteligente a profesionales basados en criterios
 * - Sistema de respuestas y comparaciones
 * - Notificaciones automáticas (REQ-35)
 * - Validaciones y reglas de negocio
 * - Manejo de errores y auditoría
 */

const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const logger = require('../services/loggerService');
const { sendBudgetNotifications } = require('../services/notificationService');
const { calculateDistance, selectOptimalProfessionals } = require('../services/professionalSelectionService');

const prisma = new PrismaClient();

/**
 * ==================================================
 * FUNCIONES DE UTILIDAD INTERNAS
 * ==================================================
 */

/**
 * Verificar que el usuario es propietario o participante en la solicitud
 */
const verifyBudgetRequestAccess = async (userId, requestId) => {
  const request = await prisma.budgetRequest.findUnique({
    where: { id: requestId },
    include: {
      client: true,
      distributions: {
        include: {
          professional: {
            include: {
              usuarios: true
            }
          }
        }
      }
    }
  });

  if (!request) {
    throw new Error('Solicitud de presupuesto no encontrada');
  }

  // Verificar acceso del cliente
  if (request.clientId === userId) {
    return { request, userRole: 'client' };
  }

  // Verificar acceso del profesional
  const professionalAccess = request.distributions.find(d => d.professional.usuarios.id === userId);
  if (professionalAccess) {
    return { request, userRole: 'professional', distribution: professionalAccess };
  }

  throw new Error('No tienes permisos para acceder a esta solicitud');
};

/**
 * Validar estado de solicitud para operaciones
 */
const validateRequestState = (request, requiredStates = []) => {
  if (!requiredStates.includes(request.status)) {
    throw new Error(`Operación no permitida. Estado actual: ${request.status}. Estados requeridos: ${requiredStates.join(', ')}`);
  }
};

/**
 * Generar ID único para la solicitud
 */
const generateBudgetRequestId = () => {
  return `BR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

/**
 * ==================================================
 * CONTROLADORES DEL CLIENTE
 * ==================================================
 */

/**
 * REQ-31: Crear solicitud de presupuesto con fotos
 */
const createBudgetRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: errors.array()
      });
    }

    const {
      title,
      description,
      category,
      budgetRangeMin,
      budgetRangeMax,
      preferredDate,
      location,
      requirements
    } = req.body;

    const clientId = req.user.id;
    const photos = req.files ? req.files.map(file => ({
      url: file.cloudinaryUrl,
      publicId: file.publicId,
      originalName: file.originalname,
      size: file.size
    })) : [];

    // Validaciones de negocio
    if (budgetRangeMin && budgetRangeMax && parseFloat(budgetRangeMin) > parseFloat(budgetRangeMax)) {
      return res.status(400).json({
        success: false,
        error: 'El presupuesto mínimo no puede ser mayor al máximo'
      });
    }

    // Crear la solicitud
    const budgetRequest = await prisma.budgetRequest.create({
      data: {
        id: generateBudgetRequestId(),
        clientId,
        title: title.trim(),
        description: description.trim(),
        category: category.toLowerCase(),
        budgetRangeMin: budgetRangeMin ? parseFloat(budgetRangeMin) : null,
        budgetRangeMax: budgetRangeMax ? parseFloat(budgetRangeMax) : null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        location: location ? JSON.parse(location) : null,
        requirements: requirements ? JSON.parse(requirements) : {},
        photos: photos,
        status: 'DRAFT'
      },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            email: true,
            url_foto_perfil: true
          }
        }
      }
    });

    logger.info('Solicitud de presupuesto creada', {
      requestId: budgetRequest.id,
      clientId,
      category: budgetRequest.category
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud de presupuesto creada exitosamente',
      data: budgetRequest
    });

  } catch (error) {
    logger.error('Error al crear solicitud de presupuesto', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Error interno al crear la solicitud de presupuesto',
      code: 'CREATE_BUDGET_REQUEST_ERROR'
    });
  }
};

/**
 * Listar solicitudes de presupuesto del cliente
 */
const getClientBudgetRequests = async (req, res) => {
  try {
    const { clientId } = req.params;
    const userId = req.user.id;

    // Verificar que el cliente solo vea sus propias solicitudes
    if (clientId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ver estas solicitudes'
      });
    }

    const { page = 1, limit = 10, status, category } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      clientId,
      ...(status && { status }),
      ...(category && { category })
    };

    const [requests, totalCount] = await Promise.all([
      prisma.budgetRequest.findMany({
        where: whereClause,
        include: {
          client: {
            select: {
              id: true,
              nombre: true,
              email: true,
              url_foto_perfil: true
            }
          },
          offers: {
            include: {
              professional: {
                include: {
                  usuarios: {
                    select: {
                      id: true,
                      nombre: true,
                      email: true,
                      url_foto_perfil: true
                    }
                  }
                }
              }
            }
          },
          selectedOffer: {
            include: {
              professional: {
                include: {
                  usuarios: {
                    select: {
                      id: true,
                      nombre: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.budgetRequest.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNextPage: page * limit < totalCount,
          hasPreviousPage: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error al obtener solicitudes del cliente', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al obtener las solicitudes de presupuesto',
      code: 'GET_CLIENT_BUDGET_REQUESTS_ERROR'
    });
  }
};

/**
 * REQ-34: Vista comparativa de ofertas
 */
const getBudgetRequestWithOffers = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { request, userRole } = await verifyBudgetRequestAccess(userId, id);

    // Solo el cliente puede ver la comparativa completa
    if (userRole !== 'client') {
      return res.status(403).json({
        success: false,
        error: 'Solo el cliente puede ver la vista comparativa completa'
      });
    }

    // Obtener ofertas con información detallada del profesional
    const offers = await prisma.budgetOffer.findMany({
      where: { requestId: id },
      include: {
        professional: {
          include: {
            usuarios: {
              select: {
                id: true,
                nombre: true,
                email: true,
                url_foto_perfil: true,
                telefono: true
              }
            },
            coverage_zones: true
          }
        }
      },
      orderBy: [
        { price: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Calcular estadísticas para comparación
    const prices = offers.map(o => o.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    const days = offers.filter(o => o.estimatedDays).map(o => o.estimatedDays);
    const minDays = days.length > 0 ? Math.min(...days) : null;
    const maxDays = days.length > 0 ? Math.max(...days) : null;

    // Enriquecer ofertas con metadatos de comparación
    const enrichedOffers = offers.map(offer => ({
      ...offer,
      isBestPrice: offer.price === minPrice,
      isFastest: offer.estimatedDays === minDays,
      priceVsAverage: ((offer.price - avgPrice) / avgPrice * 100).toFixed(2),
      priceDifference: offer.price - minPrice,
      daysDifference: offer.estimatedDays && minDays ? offer.estimatedDays - minDays : null,
      professionalDistance: request.location && offer.professional.coverage_zones ? 
        calculateDistance(request.location, offer.professional.coverage_zones) : null
    }));

    const response = {
      success: true,
      data: {
        request: {
          ...request,
          // Ocultar información sensible del cliente en la respuesta
          client: {
            id: request.client.id,
            nombre: request.client.nombre
          }
        },
        offers: enrichedOffers,
        comparisonMetrics: {
          totalOffers: offers.length,
          priceRange: { min: minPrice, max: maxPrice, average: Math.round(avgPrice * 100) / 100 },
          timeRange: { min: minDays, max: maxDays },
          responseRate: request.totalOffers > 0 ? (offers.length / request.totalOffers * 100).toFixed(1) : 0
        }
      }
    };

    res.json(response);

  } catch (error) {
    logger.error('Error al obtener vista comparativa', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al obtener la vista comparativa',
      code: 'GET_BUDGET_COMPARISON_ERROR'
    });
  }
};

/**
 * Actualizar solicitud (solo en estado borrador)
 */
const updateBudgetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const { request, userRole } = await verifyBudgetRequestAccess(userId, id);

    if (userRole !== 'client') {
      return res.status(403).json({
        success: false,
        error: 'Solo el cliente puede actualizar la solicitud'
      });
    }

    validateRequestState(request, ['DRAFT']);

    // Validaciones de actualización
    if (updates.budgetRangeMin && updates.budgetRangeMax && 
        parseFloat(updates.budgetRangeMin) > parseFloat(updates.budgetRangeMax)) {
      return res.status(400).json({
        success: false,
        error: 'El presupuesto mínimo no puede ser mayor al máximo'
      });
    }

    const updatedRequest = await prisma.budgetRequest.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date()
      },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      }
    });

    logger.info('Solicitud de presupuesto actualizada', {
      requestId: id,
      clientId: userId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'Solicitud actualizada exitosamente',
      data: updatedRequest
    });

  } catch (error) {
    logger.error('Error al actualizar solicitud', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al actualizar la solicitud',
      code: 'UPDATE_BUDGET_REQUEST_ERROR'
    });
  }
};

/**
 * Cancelar solicitud
 */
const cancelBudgetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { request, userRole } = await verifyBudgetRequestAccess(userId, id);

    if (userRole !== 'client') {
      return res.status(403).json({
        success: false,
        error: 'Solo el cliente puede cancelar la solicitud'
      });
    }

    // Solo permitir cancelar si aún no se ha seleccionado una oferta
    if (request.status === 'CLOSED' && request.selectedOfferId) {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una solicitud con oferta seleccionada'
      });
    }

    const cancelledRequest = await prisma.budgetRequest.update({
      where: { id },
      data: {
        status: 'EXPIRED',
        updatedAt: new Date()
      }
    });

    // Notificar a profesionales
    await sendBudgetNotifications('REQUEST_CANCELLED', {
      requestId: id,
      clientName: request.client.nombre,
      reason: 'Solicitud cancelada por el cliente'
    });

    logger.info('Solicitud cancelada', {
      requestId: id,
      clientId: userId,
      originalStatus: request.status
    });

    res.json({
      success: true,
      message: 'Solicitud cancelada exitosamente',
      data: cancelledRequest
    });

  } catch (error) {
    logger.error('Error al cancelar solicitud', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al cancelar la solicitud',
      code: 'CANCEL_BUDGET_REQUEST_ERROR'
    });
  }
};

/**
 * REQ-32: Distribuir solicitud a profesionales
 */
const distributeBudgetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { request, userRole } = await verifyBudgetRequestAccess(userId, id);

    if (userRole !== 'client') {
      return res.status(403).json({
        success: false,
        error: 'Solo el cliente puede distribuir la solicitud'
      });
    }

    validateRequestState(request, ['DRAFT', 'SENT']);

    // Obtener profesionales elegibles
    const eligibleProfessionals = await selectOptimalProfessionals({
      category: request.category,
      location: request.location,
      maxDistance: 25, // km
      limit: 10
    });

    if (eligibleProfessionals.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron profesionales elegibles para esta solicitud'
      });
    }

    // Crear distribuciones
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas
    const distributions = [];

    for (const professional of eligibleProfessionals) {
      const distribution = await prisma.budgetRequestProfessional.create({
        data: {
          requestId: id,
          professionalId: professional.professional_id,
          expiresAt,
          status: 'SENT'
        }
      });
      distributions.push(distribution);
    }

    // Actualizar estado de la solicitud
    const updatedRequest = await prisma.budgetRequest.update({
      where: { id },
      data: {
        status: 'DISTRIBUTED',
        totalOffers: distributions.length,
        updatedAt: new Date()
      },
      include: {
        distributions: {
          include: {
            professional: {
              include: {
                usuarios: {
                  select: {
                    id: true,
                    nombre: true,
                    email: true,
                    url_foto_perfil: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Enviar notificaciones a profesionales (REQ-35)
    await sendBudgetNotifications('NEW_BUDGET_REQUEST', {
      requestId: id,
      requestTitle: request.title,
      requestDescription: request.description,
      category: request.category,
      budgetRange: {
        min: request.budgetRangeMin,
        max: request.budgetRangeMax
      },
      clientName: request.client.nombre,
      expiresAt
    });

    logger.info('Solicitud distribuida a profesionales', {
      requestId: id,
      clientId: userId,
      professionalsCount: distributions.length
    });

    res.json({
      success: true,
      message: `Solicitud enviada a ${distributions.length} profesionales`,
      data: {
        request: updatedRequest,
        distributedTo: distributions.length,
        expiresAt
      }
    });

  } catch (error) {
    logger.error('Error al distribuir solicitud', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al distribuir la solicitud',
      code: 'DISTRIBUTE_BUDGET_REQUEST_ERROR'
    });
  }
};

/**
 * Seleccionar oferta ganadora
 */
const selectWinningOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { offerId } = req.body;
    const userId = req.user.id;

    const { request, userRole } = await verifyBudgetRequestAccess(userId, id);

    if (userRole !== 'client') {
      return res.status(403).json({
        success: false,
        error: 'Solo el cliente puede seleccionar una oferta'
      });
    }

    validateRequestState(request, ['DISTRIBUTED', 'RESPONDING']);

    // Verificar que la oferta existe y pertenece a esta solicitud
    const winningOffer = await prisma.budgetOffer.findFirst({
      where: {
        id: offerId,
        requestId: id
      },
      include: {
        professional: {
          include: {
            usuarios: {
              select: {
                id: true,
                nombre: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!winningOffer) {
      return res.status(404).json({
        success: false,
        error: 'Oferta no encontrada'
      });
    }

    // Usar transacción para asegurar consistencia
    await prisma.$transaction(async (tx) => {
      // Marcar todas las ofertas como no seleccionadas
      await tx.budgetOffer.updateMany({
        where: { requestId: id },
        data: { isSelected: false }
      });

      // Marcar la oferta ganadora
      await tx.budgetOffer.update({
        where: { id: offerId },
        data: { 
          isSelected: true,
          offerStatus: 'ACCEPTED',
          updatedAt: new Date()
        }
      });

      // Marcar otras ofertas como rechazadas
      await tx.budgetOffer.updateMany({
        where: { 
          requestId: id,
          id: { not: offerId }
        },
        data: { 
          offerStatus: 'REJECTED',
          updatedAt: new Date()
        }
      });

      // Actualizar estado de la solicitud
      await tx.budgetRequest.update({
        where: { id },
        data: {
          status: 'CLOSED',
          selectedOfferId: offerId,
          updatedAt: new Date()
        }
      });
    });

    // Enviar notificaciones
    await sendBudgetNotifications('OFFER_SELECTED', {
      requestId: id,
      winningOffer,
      clientName: request.client.nombre
    });

    await sendBudgetNotifications('OFFER_REJECTED', {
      requestId: id,
      rejectedOffers: await prisma.budgetOffer.findMany({
        where: { requestId: id, id: { not: offerId } },
        include: {
          professional: {
            include: {
              usuarios: { select: { id: true, nombre: true, email: true } }
            }
          }
        }
      })
    });

    logger.info('Oferta seleccionada como ganadora', {
      requestId: id,
      offerId,
      clientId: userId,
      professionalId: winningOffer.professionalId
    });

    res.json({
      success: true,
      message: 'Oferta seleccionada exitosamente',
      data: {
        winningOffer,
        requestStatus: 'CLOSED'
      }
    });

  } catch (error) {
    logger.error('Error al seleccionar oferta', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al seleccionar la oferta',
      code: 'SELECT_WINNING_OFFER_ERROR'
    });
  }
};

/**
 * ==================================================
 * CONTROLADORES DEL PROFESIONAL
 * ==================================================
 */

/**
 * REQ-32: Bandeja de entrada de profesionales
 */
const getProfessionalInbox = async (req, res) => {
  try {
    const { professionalId } = req.params;
    const userId = req.user.id;

    // Verificar que el profesional solo vea sus propias solicitudes
    if (professionalId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ver esta bandeja de entrada'
      });
    }

    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      professionalId,
      ...(status && { status })
    };

    const [distributions, totalCount] = await Promise.all([
      prisma.budgetRequestProfessional.findMany({
        where: whereClause,
        include: {
          request: {
            include: {
              client: {
                select: {
                  id: true,
                  nombre: true,
                  email: true,
                  url_foto_perfil: true,
                  telefono: true
                }
              },
              offers: {
                where: { professionalId }
              }
            }
          },
          offer: true
        },
        orderBy: { sentAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.budgetRequestProfessional.count({ where: whereClause })
    ]);

    // Enriquecer datos con metadatos
    const enrichedDistributions = distributions.map(distribution => {
      const now = new Date();
      const expiresAt = new Date(distribution.expiresAt);
      const hoursRemaining = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60 * 60)));
      
      return {
        ...distribution,
        isExpired: expiresAt < now,
        hoursRemaining,
        urgencyLevel: hoursRemaining < 6 ? 'URGENT' : hoursRemaining < 24 ? 'HIGH' : 'NORMAL',
        hasResponded: !!distribution.offer
      };
    });

    res.json({
      success: true,
      data: {
        distributions: enrichedDistributions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNextPage: page * limit < totalCount,
          hasPreviousPage: page > 1
        },
        summary: {
          total: totalCount,
          pending: distributions.filter(d => !d.responded).length,
          responded: distributions.filter(d => d.responded).length,
          expired: distributions.filter(d => new Date(d.expiresAt) < new Date()).length
        }
      }
    });

  } catch (error) {
    logger.error('Error al obtener bandeja de entrada', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al obtener la bandeja de entrada',
      code: 'GET_PROFESSIONAL_INBOX_ERROR'
    });
  }
};

/**
 * REQ-33: Responder a solicitud de presupuesto
 */
const respondToBudgetRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: errors.array()
      });
    }

    const { id: requestId } = req.params;
    const {
      price,
      estimatedDays,
      comments,
      availabilityDetails
    } = req.body;
    const professionalId = req.user.id;

    const userId = req.user.id;

    const { request, distribution } = await verifyBudgetRequestAccess(userId, requestId);

    // Verificar que el profesional está autorizado para responder
    if (!distribution) {
      return res.status(403).json({
        success: false,
        error: 'No tienes autorización para responder a esta solicitud'
      });
    }

    // Verificar estado de la solicitud
    if (request.status !== 'DISTRIBUTED') {
      return res.status(400).json({
        success: false,
        error: 'La solicitud ya no está disponible para respuestas'
      });
    }

    // Verificar si ya respondió
    const existingOffer = await prisma.budgetOffer.findFirst({
      where: {
        requestId,
        professionalId
      }
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        error: 'Ya has enviado una respuesta a esta solicitud'
      });
    }

    // Verificar expiración
    if (new Date() > new Date(distribution.expiresAt)) {
      return res.status(400).json({
        success: false,
        error: 'El tiempo límite para responder ha expirado'
      });
    }

    // Procesar fotos si las hay
    const photos = req.files ? req.files.map(file => ({
      url: file.cloudinaryUrl,
      publicId: file.publicId,
      originalName: file.originalname,
      size: file.size
    })) : [];

    // Crear la oferta
    const budgetOffer = await prisma.budgetOffer.create({
      data: {
        requestId,
        professionalId,
        price: parseFloat(price),
        estimatedDays: estimatedDays ? parseInt(estimatedDays) : null,
        comments: comments ? comments.trim() : null,
        photos: photos,
        availabilityDetails: availabilityDetails ? availabilityDetails.trim() : null,
        offerStatus: 'PENDING'
      },
      include: {
        professional: {
          include: {
            usuarios: {
              select: {
                id: true,
                nombre: true,
                email: true,
                url_foto_perfil: true
              }
            }
          }
        }
      }
    });

    // Actualizar distribución como respondida
    await prisma.budgetRequestProfessional.update({
      where: { id: distribution.id },
      data: {
        responded: true,
        respondedAt: new Date(),
        status: 'RESPONDED'
      }
    });

    // Actualizar estado de solicitud si es la primera respuesta
    const totalResponses = await prisma.budgetOffer.count({
      where: { requestId }
    });

    if (totalResponses === 1) {
      await prisma.budgetRequest.update({
        where: { id: requestId },
        data: { status: 'RESPONDING' }
      });
    }

    // Notificar al cliente (REQ-35)
    await sendBudgetNotifications('NEW_BUDGET_OFFER', {
      requestId,
      offer: budgetOffer,
      clientId: request.clientId
    });

    logger.info('Respuesta enviada a solicitud de presupuesto', {
      requestId,
      professionalId,
      offerId: budgetOffer.id,
      price
    });

    res.status(201).json({
      success: true,
      message: 'Respuesta enviada exitosamente',
      data: budgetOffer
    });

  } catch (error) {
    logger.error('Error al responder solicitud', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al enviar la respuesta',
      code: 'RESPOND_TO_BUDGET_REQUEST_ERROR'
    });
  }
};

/**
 * Actualizar oferta enviada
 */
const updateBudgetOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const existingOffer = await prisma.budgetOffer.findUnique({
      where: { id },
      include: {
        request: true
      }
    });

    if (!existingOffer) {
      return res.status(404).json({
        success: false,
        error: 'Oferta no encontrada'
      });
    }

    if (existingOffer.professionalId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para modificar esta oferta'
      });
    }

    if (existingOffer.offerStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'No se puede modificar una oferta que ya fue procesada'
      });
    }

    const updatedOffer = await prisma.budgetOffer.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date()
      },
      include: {
        professional: {
          include: {
            usuarios: {
              select: {
                id: true,
                nombre: true,
                email: true
              }
            }
          }
        }
      }
    });

    logger.info('Oferta actualizada', {
      offerId: id,
      professionalId: userId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'Oferta actualizada exitosamente',
      data: updatedOffer
    });

  } catch (error) {
    logger.error('Error al actualizar oferta', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al actualizar la oferta',
      code: 'UPDATE_BUDGET_OFFER_ERROR'
    });
  }
};

/**
 * Retirar oferta
 */
const withdrawBudgetOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existingOffer = await prisma.budgetOffer.findUnique({
      where: { id },
      include: {
        request: true
      }
    });

    if (!existingOffer) {
      return res.status(404).json({
        success: false,
        error: 'Oferta no encontrada'
      });
    }

    if (existingOffer.professionalId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para retirar esta oferta'
      });
    }

    if (existingOffer.offerStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'No se puede retirar una oferta que ya fue procesada'
      });
    }

    const withdrawnOffer = await prisma.budgetOffer.update({
      where: { id },
      data: {
        offerStatus: 'WITHDRAWN',
        updatedAt: new Date()
      }
    });

    // Actualizar distribución correspondiente
    await prisma.budgetRequestProfessional.updateMany({
      where: {
        requestId: existingOffer.requestId,
        professionalId: userId
      },
      data: {
        responded: false,
        respondedAt: null,
        status: 'SENT'
      }
    });

    logger.info('Oferta retirada', {
      offerId: id,
      professionalId: userId,
      requestId: existingOffer.requestId
    });

    res.json({
      success: true,
      message: 'Oferta retirada exitosamente',
      data: withdrawnOffer
    });

  } catch (error) {
    logger.error('Error al retirar oferta', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al retirar la oferta',
      code: 'WITHDRAW_BUDGET_OFFER_ERROR'
    });
  }
};

/**
 * ==================================================
 * CONTROLADORES UTILITARIOS
 * ==================================================
 */

/**
 * Subir foto para presupuesto
 */
const uploadBudgetPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ningún archivo'
      });
    }

    const photoData = {
      url: req.file.cloudinaryUrl,
      publicId: req.file.publicId,
      originalName: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date()
    };

    res.json({
      success: true,
      message: 'Foto subida exitosamente',
      data: photoData
    });

  } catch (error) {
    logger.error('Error al subir foto', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al subir la foto',
      code: 'UPLOAD_BUDGET_PHOTO_ERROR'
    });
  }
};

/**
 * Obtener estado detallado de solicitud
 */
const getBudgetRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { request, userRole } = await verifyBudgetRequestAccess(userId, id);

    // Obtener métricas detalladas
    const [
      totalOffers,
      respondedOffers,
      pendingOffers,
      expiredOffers,
      avgPrice,
      minPrice,
      maxPrice
    ] = await Promise.all([
      prisma.budgetOffer.count({ where: { requestId: id } }),
      prisma.budgetOffer.count({ where: { requestId: id, offerStatus: { not: 'PENDING' } } }),
      prisma.budgetOffer.count({ where: { requestId: id, offerStatus: 'PENDING' } }),
      prisma.budgetRequestProfessional.count({
        where: { requestId: id, status: 'EXPIRED' }
      }),
      prisma.budgetOffer.aggregate({
        where: { requestId: id },
        _avg: { price: true },
        _min: { price: true },
        _max: { price: true }
      })
    ]);

    const statusData = {
      request: {
        ...request,
        // Simplificar relaciones para la respuesta
        client: userRole === 'client' ? request.client : { id: request.client.id, nombre: request.client.nombre }
      },
      metrics: {
        totalOffers,
        respondedOffers,
        pendingOffers,
        expiredOffers,
        responseRate: request.totalOffers > 0 ? (respondedOffers / request.totalOffers * 100).toFixed(1) : 0,
        priceRange: {
          min: avgPrice._min?.price || null,
          max: avgPrice._max?.price || null,
          average: avgPrice._avg?.price || null
        }
      },
      timeline: {
        created: request.createdAt,
        distributed: request.status !== 'DRAFT' ? request.updatedAt : null,
        lastActivity: request.updatedAt
      }
    };

    res.json({
      success: true,
      data: statusData
    });

  } catch (error) {
    logger.error('Error al obtener estado de solicitud', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al obtener el estado de la solicitud',
      code: 'GET_BUDGET_REQUEST_STATUS_ERROR'
    });
  }
};

/**
 * Obtener estadísticas del sistema (Admin)
 */
const getBudgetAnalytics = async (req, res) => {
  try {
    // Verificar rol de admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo administradores pueden ver estas estadísticas'
      });
    }

    const { period = '30d' } = req.query;
    const now = new Date();
    let startDate;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [
      totalRequests,
      requestsByStatus,
      totalOffers,
      averageResponseTime,
      conversionRate,
      topCategories,
      professionalPerformance
    ] = await Promise.all([
      prisma.budgetRequest.count({
        where: { createdAt: { gte: startDate } }
      }),
      prisma.budgetRequest.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate } },
        _count: { status: true }
      }),
      prisma.budgetOffer.count({
        where: { createdAt: { gte: startDate } }
      }),
      prisma.budgetOffer.aggregate({
        where: { createdAt: { gte: startDate } },
        _avg: {
          // Calcular tiempo de respuesta en horas
          // Esto requeriría datos adicionales en el futuro
        }
      }),
      prisma.budgetRequest.count({
        where: {
          createdAt: { gte: startDate },
          status: 'CLOSED'
        }
      }),
      prisma.budgetRequest.groupBy({
        by: ['category'],
        where: { createdAt: { gte: startDate } },
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
        take: 5
      }),
      prisma.budgetOffer.groupBy({
        by: ['professionalId'],
        where: { createdAt: { gte: startDate } },
        _count: { professionalId: true },
        _avg: { price: true },
        orderBy: { _count: { professionalId: 'desc' } },
        take: 10
      })
    ]);

    const closedRequests = await prisma.budgetRequest.count({
      where: {
        createdAt: { gte: startDate },
        status: 'CLOSED'
      }
    });

    res.json({
      success: true,
      data: {
        period,
        overview: {
          totalRequests,
          totalOffers,
          closedRequests,
          conversionRate: totalRequests > 0 ? ((closedRequests / totalRequests) * 100).toFixed(1) : 0,
          averageOffersPerRequest: totalRequests > 0 ? (totalOffers / totalRequests).toFixed(1) : 0
        },
        statusDistribution: requestsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {}),
        topCategories: topCategories.map(item => ({
          category: item.category,
          count: item._count.category
        })),
        professionalPerformance: await Promise.all(
          professionalPerformance.map(async (perf) => {
            const professional = await prisma.perfiles_profesionales.findUnique({
              where: { usuario_id: perf.professionalId },
              include: {
                usuarios: {
                  select: { nombre: true, email: true }
                }
              }
            });
            return {
              professional: professional?.usuarios?.nombre || 'Usuario no encontrado',
              email: professional?.usuarios?.email,
              totalOffers: perf._count.professionalId,
              averagePrice: perf._avg.price ? Math.round(perf._avg.price * 100) / 100 : 0
            };
          })
        )
      }
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al obtener las estadísticas',
      code: 'GET_BUDGET_ANALYTICS_ERROR'
    });
  }
};

module.exports = {
  // Cliente
  createBudgetRequest,
  getClientBudgetRequests,
  getBudgetRequestWithOffers,
  updateBudgetRequest,
  cancelBudgetRequest,
  distributeBudgetRequest,
  selectWinningOffer,
  
  // Profesional
  getProfessionalInbox,
  respondToBudgetRequest,
  updateBudgetOffer,
  withdrawBudgetOffer,
  
  // Utilidades
  uploadBudgetPhoto,
  getBudgetRequestStatus,
  getBudgetAnalytics
};