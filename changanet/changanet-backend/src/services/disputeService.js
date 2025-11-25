/**
 * Servicio de gestión de disputas y reembolsos
 * Implementa REQ-46: Sistema de disputas y reembolsos
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('./logger');

/**
 * Crea una nueva disputa para un pago
 * @param {string} paymentId - ID del pago
 * @param {string} userId - ID del usuario que crea la disputa
 * @param {string} motivo - Motivo de la disputa
 * @param {string} descripcion - Descripción detallada
 * @returns {Object} Disputa creada
 */
async function createDispute(paymentId, userId, motivo, descripcion) {
  try {
    // Verificar que el pago existe y pertenece al usuario
    const payment = await prisma.pagos.findUnique({
      where: { id: paymentId },
      include: {
        cliente: true,
        profesional: true,
        servicio: true
      }
    });

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    // Verificar que el usuario sea parte del pago
    if (payment.cliente_id !== userId && payment.profesional_id !== userId) {
      throw new Error('No tienes permiso para disputar este pago');
    }

    // Verificar que no haya una disputa activa
    const existingDispute = await prisma.disputas_pagos.findFirst({
      where: {
        pago_id: paymentId,
        estado: { in: ['abierta', 'en_revision'] }
      }
    });

    if (existingDispute) {
      throw new Error('Ya existe una disputa activa para este pago');
    }

    // Crear disputa
    const dispute = await prisma.disputas_pagos.create({
      data: {
        pago_id: paymentId,
        usuario_id: userId,
        motivo,
        descripcion,
        estado: 'abierta'
      }
    });

    // Actualizar estado del pago
    await prisma.pagos.update({
      where: { id: paymentId },
      data: {
        estado: 'en_disputa'
      }
    });

    // Registrar evento
    await prisma.eventos_pagos.create({
      data: {
        pago_id: paymentId,
        tipo_evento: 'dispute_created',
        datos: JSON.stringify({
          disputeId: dispute.id,
          motivo,
          descripcion,
          createdBy: userId
        })
      }
    });

    // Notificar a ambas partes
    await notifyDisputeCreated(payment, dispute, userId);

    // Registrar en auditoría
    await prisma.audit_log.create({
      data: {
        user_id: userId,
        action: 'dispute_created',
        resource: 'disputas_pagos',
        resource_id: dispute.id,
        details: JSON.stringify({
          paymentId,
          motivo,
          descripcion
        })
      }
    });

    logger.info('Disputa creada exitosamente', {
      service: 'disputes',
      disputeId: dispute.id,
      paymentId,
      userId,
      motivo
    });

    return {
      disputeId: dispute.id,
      status: 'created',
      message: 'Disputa creada exitosamente. Un administrador revisará el caso.'
    };

  } catch (error) {
    logger.error('Error creando disputa', {
      service: 'disputes',
      paymentId,
      userId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Procesa un reembolso para una disputa resuelta
 * @param {string} paymentId - ID del pago
 * @param {number} amount - Monto a reembolsar
 * @param {string} reason - Razón del reembolso
 * @param {string} adminId - ID del administrador que procesa
 * @returns {Object} Resultado del reembolso
 */
async function processRefund(paymentId, amount, reason, adminId) {
  try {
    // Verificar que el pago existe
    const payment = await prisma.pagos.findUnique({
      where: { id: paymentId },
      include: {
        cliente: true,
        profesional: true,
        servicio: true
      }
    });

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    // Verificar que el monto no exceda el pago original
    if (amount > payment.monto_total) {
      throw new Error('El monto de reembolso no puede exceder el pago original');
    }

    // Procesar reembolso con Mercado Pago (simulado)
    const refundResult = await processMercadoPagoRefund(payment, amount);

    if (!refundResult.success) {
      throw new Error('Error procesando reembolso con pasarela de pago');
    }

    // Actualizar estado del pago
    await prisma.pagos.update({
      where: { id: paymentId },
      data: {
        estado: 'reembolsado'
      }
    });

    // Crear registro de reembolso en disputa si existe
    const dispute = await prisma.disputas_pagos.findFirst({
      where: {
        pago_id: paymentId,
        estado: { in: ['abierta', 'en_revision'] }
      }
    });

    if (dispute) {
      await prisma.disputas_pagos.update({
        where: { id: dispute.id },
        data: {
          estado: 'resuelto',
          fecha_resolucion: new Date(),
          resolucion: `Reembolso procesado: $${amount}`,
          notas_admin: reason,
          reembolso_monto: amount
        }
      });
    }

    // Registrar evento
    await prisma.eventos_pagos.create({
      data: {
        pago_id: paymentId,
        tipo_evento: 'refund_processed',
        datos: JSON.stringify({
          amount,
          reason,
          processedBy: adminId,
          refundId: refundResult.refundId
        })
      }
    });

    // Notificar al cliente
    await notifyRefundProcessed(payment, amount, reason);

    // Registrar en auditoría
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'refund_processed',
        resource: 'pagos',
        resource_id: paymentId,
        details: JSON.stringify({
          amount,
          reason,
          refundId: refundResult.refundId
        })
      }
    });

    logger.info('Reembolso procesado exitosamente', {
      service: 'disputes',
      paymentId,
      amount,
      adminId,
      refundId: refundResult.refundId
    });

    return {
      success: true,
      refundId: refundResult.refundId,
      amount,
      message: 'Reembolso procesado exitosamente'
    };

  } catch (error) {
    logger.error('Error procesando reembolso', {
      service: 'disputes',
      paymentId,
      amount,
      adminId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Resuelve una disputa sin reembolso
 * @param {string} disputeId - ID de la disputa
 * @param {string} resolution - Resolución
 * @param {string} adminId - ID del administrador
 * @returns {Object} Resultado de la resolución
 */
async function resolveDispute(disputeId, resolution, adminId) {
  try {
    const dispute = await prisma.disputas_pagos.findUnique({
      where: { id: disputeId },
      include: {
        pago: true
      }
    });

    if (!dispute) {
      throw new Error('Disputa no encontrada');
    }

    // Actualizar disputa
    await prisma.disputas_pagos.update({
      where: { id: disputeId },
      data: {
        estado: 'resuelto',
        fecha_resolucion: new Date(),
        resolucion,
        notas_admin: resolution
      }
    });

    // Si no hay reembolso, liberar fondos al profesional
    if (!resolution.toLowerCase().includes('reembolso')) {
      await prisma.pagos.update({
        where: { id: dispute.pago_id },
        data: {
          estado: 'liberado',
          fecha_liberacion: new Date()
        }
      });
    }

    // Notificar resolución
    await notifyDisputeResolved(dispute, resolution);

    // Registrar en auditoría
    await prisma.audit_log.create({
      data: {
        user_id: adminId,
        action: 'dispute_resolved',
        resource: 'disputas_pagos',
        resource_id: disputeId,
        details: JSON.stringify({
          resolution,
          paymentId: dispute.pago_id
        })
      }
    });

    logger.info('Disputa resuelta', {
      service: 'disputes',
      disputeId,
      adminId,
      resolution
    });

    return {
      success: true,
      message: 'Disputa resuelta exitosamente'
    };

  } catch (error) {
    logger.error('Error resolviendo disputa', {
      service: 'disputes',
      disputeId,
      adminId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtiene disputas de un usuario
 * @param {string} userId - ID del usuario
 * @param {string} status - Estado opcional para filtrar
 * @returns {Array} Lista de disputas
 */
async function getUserDisputes(userId, status = null) {
  try {
    const whereClause = {
      usuario_id: userId
    };

    if (status) {
      whereClause.estado = status;
    }

    const disputes = await prisma.disputas_pagos.findMany({
      where: whereClause,
      include: {
        pago: {
          include: {
            servicio: true,
            cliente: { select: { nombre: true, email: true } },
            profesional: { select: { nombre: true, email: true } }
          }
        }
      },
      orderBy: { fecha_apertura: 'desc' }
    });

    return disputes.map(dispute => ({
      id: dispute.id,
      paymentId: dispute.pago_id,
      motivo: dispute.motivo,
      descripcion: dispute.descripcion,
      estado: dispute.estado,
      fechaApertura: dispute.fecha_apertura,
      fechaResolucion: dispute.fecha_resolucion,
      resolucion: dispute.resolucion,
      reembolsoMonto: dispute.reembolso_monto,
      servicio: {
        id: dispute.pago.servicio?.id,
        descripcion: dispute.pago.servicio?.descripcion
      },
      montoPago: dispute.pago.monto_total,
      cliente: dispute.pago.cliente,
      profesional: dispute.pago.profesional
    }));

  } catch (error) {
    logger.error('Error obteniendo disputas del usuario', {
      service: 'disputes',
      userId,
      error: error.message
    });
    return [];
  }
}

/**
 * Obtiene todas las disputas para administradores
 * @param {Object} filters - Filtros opcionales
 * @returns {Array} Lista de disputas
 */
async function getAllDisputes(filters = {}) {
  try {
    const whereClause = {};

    if (filters.status) {
      whereClause.estado = filters.status;
    }

    if (filters.dateFrom) {
      whereClause.fecha_apertura = {
        gte: new Date(filters.dateFrom)
      };
    }

    if (filters.dateTo) {
      whereClause.fecha_apertura = {
        ...whereClause.fecha_apertura,
        lte: new Date(filters.dateTo)
      };
    }

    const disputes = await prisma.disputas_pagos.findMany({
      where: whereClause,
      include: {
        pago: {
          include: {
            servicio: true,
            cliente: { select: { nombre: true, email: true } },
            profesional: { select: { nombre: true, email: true } }
          }
        },
        usuario: { select: { nombre: true, email: true } }
      },
      orderBy: { fecha_apertura: 'desc' },
      take: filters.limit || 50
    });

    return disputes;

  } catch (error) {
    logger.error('Error obteniendo todas las disputas', {
      service: 'disputes',
      filters,
      error: error.message
    });
    return [];
  }
}

// Funciones auxiliares

async function notifyDisputeCreated(payment, dispute, createdBy) {
  const { createNotification } = require('./notificationService');

  const isClient = createdBy === payment.cliente_id;
  const creatorName = isClient ? 'cliente' : 'profesional';
  const otherPartyId = isClient ? payment.profesional_id : payment.cliente_id;

  // Notificar al creador
  await createNotification(
    createdBy,
    'dispute_created',
    `Tu disputa ha sido creada exitosamente. ID: ${dispute.id}`,
    { disputeId: dispute.id, paymentId: payment.id }
  );

  // Notificar a la otra parte
  await createNotification(
    otherPartyId,
    'dispute_opened',
    `Se ha abierto una disputa para el servicio "${payment.servicio.descripcion}". Un administrador revisará el caso.`,
    { disputeId: dispute.id, paymentId: payment.id }
  );
}

async function notifyRefundProcessed(payment, amount, reason) {
  const { createNotification } = require('./notificationService');

  // Notificar al cliente
  await createNotification(
    payment.cliente_id,
    'refund_processed',
    `Se ha procesado un reembolso de $${amount} para el servicio "${payment.servicio.descripcion}". ${reason}`,
    { paymentId: payment.id, amount, reason }
  );

  // Notificar al profesional
  await createNotification(
    payment.profesional_id,
    'refund_notification',
    `Se ha procesado un reembolso de $${amount} para el servicio "${payment.servicio.descripcion}". ${reason}`,
    { paymentId: payment.id, amount, reason }
  );
}

async function notifyDisputeResolved(dispute, resolution) {
  const { createNotification } = require('./notificationService');

  // Notificar al creador de la disputa
  await createNotification(
    dispute.usuario_id,
    'dispute_resolved',
    `Tu disputa ha sido resuelta: ${resolution}`,
    { disputeId: dispute.id, resolution }
  );

  // Obtener IDs de ambas partes del pago
  const payment = await prisma.pagos.findUnique({
    where: { id: dispute.pago_id },
    select: { cliente_id: true, profesional_id: true }
  });

  // Notificar a la otra parte
  const otherPartyId = dispute.usuario_id === payment.cliente_id
    ? payment.profesional_id
    : payment.cliente_id;

  await createNotification(
    otherPartyId,
    'dispute_resolved',
    `La disputa del servicio ha sido resuelta: ${resolution}`,
    { disputeId: dispute.id, resolution }
  );
}

async function processMercadoPagoRefund(payment, amount) {
  // Simulación de procesamiento con Mercado Pago
  // En producción, esto debería integrar con la API real de Mercado Pago
  try {
    // Simular delay de procesamiento
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simular éxito (90% de las veces)
    const success = Math.random() > 0.1;

    if (success) {
      return {
        success: true,
        refundId: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        processedAt: new Date()
      };
    } else {
      return {
        success: false,
        error: 'Error en pasarela de pago'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createDispute,
  processRefund,
  resolveDispute,
  getUserDisputes,
  getAllDisputes
};