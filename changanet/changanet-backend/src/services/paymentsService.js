/**
 * Servicio de pagos integrados con Mercado Pago
 * Implementa sección 7.9 del PRD: Pagos Integrados y Comisiones
 * REQ-41: Integración con pasarelas de pago
 * REQ-42: Custodia de fondos
 * REQ-43: Comisión configurable
 * REQ-44: Retiro de fondos
 * REQ-45: Comprobantes de pago
 */

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurar Mercado Pago con el access token
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

/**
 * Crea una preferencia de pago con custodia de fondos para un servicio
 * @param {Object} paymentData - Datos del pago
 * @param {string} paymentData.serviceId - ID del servicio
 * @param {number} paymentData.amount - Monto en ARS
 * @param {string} paymentData.professionalEmail - Email del profesional
 * @param {string} paymentData.specialty - Especialidad del servicio
 * @param {string} paymentData.clientId - ID del cliente (para validación)
 * @returns {Object} Preferencia de pago creada
 */
async function createPaymentPreference({ serviceId, amount, professionalEmail, specialty, clientId }) {
  try {
    // Validar que el servicio pertenece al cliente
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: {
        cliente: true,
        profesional: true,
      },
    });

    if (!service) {
      throw new Error('Servicio no encontrado');
    }

    if (service.cliente_id !== clientId) {
      throw new Error('No tienes permiso para crear un pago para este servicio');
    }

    if (service.estado !== 'PENDIENTE') {
      throw new Error('El servicio debe estar en estado pendiente para crear un pago');
    }

    // Validar que el profesional existe y está verificado
    if (!service.profesional || service.profesional.rol !== 'profesional') {
      throw new Error('El profesional asignado no es válido');
    }

    // Validar montos razonables
    if (amount <= 0 || amount > 1000000) { // Máximo $1M ARS
      throw new Error('Monto de pago inválido');
    }

    // Según RB-03: La comisión se cobra solo si el servicio se completa
    // En la creación del pago, no deducimos comisión aún
    // La comisión se calculará al liberar fondos cuando el servicio se complete

    // Crear registro de pago en base de datos (sin comisión inicial)
    const paymentRecord = await prisma.pagos.create({
      data: {
        servicio_id: serviceId,
        cliente_id: clientId,
        profesional_id: service.profesional_id,
        monto_total: amount,
        comision_plataforma: 0, // Se calculará al completar el servicio
        monto_profesional: amount, // Monto completo inicialmente
        estado: 'pendiente',
        metodo_pago: 'mercado_pago',
      },
    });

    // Crear preferencia de pago
    // Según RB-03: No cobramos comisión hasta que el servicio se complete
    const preference = {
      items: [
        {
          id: serviceId,
          title: `Servicio de ${specialty}`,
          description: `Servicio de ${specialty} - Changánet`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: amount,
        },
      ],
      payer: {
        email: professionalEmail,
      },
      binary_mode: true, // Custodia de fondos según REQ-42
      // marketplace_fee se aplicará al liberar fondos cuando el servicio se complete
      back_urls: {
        success: `${process.env.FRONTEND_URL}/payments/success?serviceId=${serviceId}`,
        failure: `${process.env.FRONTEND_URL}/payments/failure`,
        pending: `${process.env.FRONTEND_URL}/payments/pending`,
      },
      auto_return: 'approved',
      external_reference: serviceId,
      notification_url: `${process.env.BACKEND_URL}/api/payments/webhook`,
    };

    const preferenceClient = new Preference(client);
    const response = await preferenceClient.create({ body: preference });

    // Actualizar registro con ID de Mercado Pago
    await prisma.pagos.update({
      where: { id: paymentRecord.id },
      data: { mercado_pago_id: response.body.id },
    });

    return {
      preferenceId: response.body.id,
      initPoint: response.body.init_point,
      sandboxInitPoint: response.body.sandbox_init_point,
      paymentRecordId: paymentRecord.id,
    };
  } catch (error) {
    console.error('Error creando preferencia de pago:', error);
    throw error;
  }
}

/**
 * Libera los fondos de un pago completado
 * Implementa RB-03: La comisión se cobra solo si el servicio se completa
 * @param {string} paymentId - ID del pago en Mercado Pago
 * @param {string} serviceId - ID del servicio
 * @param {string} clientId - ID del cliente (para validación)
 * @returns {Object} Resultado de la liberación
 */
async function releaseFunds(paymentId, serviceId, clientId) {
  try {
    // Validar que el servicio pertenece al cliente
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: {
        cliente: true,
        pago: true,
      },
    });

    if (!service) {
      throw new Error('Servicio no encontrado');
    }

    if (service.cliente_id !== clientId) {
      throw new Error('No tienes permiso para liberar fondos de este servicio');
    }

    if (service.estado !== 'COMPLETADO') {
      throw new Error('El servicio debe estar completado para liberar fondos');
    }

    if (!service.pago) {
      throw new Error('No se encontró el registro de pago para este servicio');
    }

    // Calcular comisión al momento de liberar fondos (RB-03)
    const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.05');
    const totalAmount = service.pago.monto_total;
    const commission = Math.round(totalAmount * commissionRate);
    const professionalAmount = totalAmount - commission;

    // Actualizar el registro de pago con la comisión calculada
    await prisma.pagos.update({
      where: { id: service.pago.id },
      data: {
        comision_plataforma: commission,
        monto_profesional: professionalAmount,
        estado: 'liberado',
        fecha_liberacion: new Date(),
      },
    });

    // Liberar fondos usando la API de Mercado Pago con marketplace_fee
    const paymentClient = new Payment(client);
    const response = await paymentClient.update({
      id: paymentId,
      updatePaymentRequest: {
        status: 'approved',
        marketplace_fee: commission, // Aplicar comisión al liberar fondos
      },
    });

    // Actualizar estado del servicio
    await prisma.servicios.update({
      where: { id: serviceId },
      data: {
        estado: 'pagado',
        completado_en: new Date(),
      },
    });

    // Notificar al profesional sobre la liberación de fondos
    const { createNotification } = require('./notificationService');
    await createNotification(
      service.profesional_id,
      'fondos_liberados',
      `¡Fondos liberados! Recibiste $${professionalAmount} (comisión $${commission} deducida).`,
      { serviceId, paymentId, amount: professionalAmount, commission }
    );

    return {
      success: true,
      paymentId,
      serviceId,
      totalAmount,
      commission,
      professionalAmount,
      releasedAt: new Date(),
    };
  } catch (error) {
    console.error('Error liberando fondos:', error);
    throw error;
  }
}

/**
 * Obtiene el estado de un pago
 * @param {string} paymentId - ID del pago en Mercado Pago
 * @returns {Object} Estado del pago
 */
async function getPaymentStatus(paymentId) {
  try {
    const paymentClient = new Payment(client);
    const response = await paymentClient.get({ id: paymentId });
    return response;
  } catch (error) {
    console.error('Error obteniendo estado del pago:', error);
    throw error;
  }
}

/**
 * Libera automáticamente fondos de pagos completados después de 24h de inactividad (RB-04)
 * Esta función debe ser ejecutada periódicamente por un cron job
 * @returns {Object} Resultado de las liberaciones automáticas
 */
async function autoReleaseFunds() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Buscar servicios completados hace más de 24h sin liberación manual
    const servicesToRelease = await prisma.servicios.findMany({
      where: {
        estado: 'COMPLETADO',
        completado_en: {
          lt: twentyFourHoursAgo,
        },
        // Nota: En una implementación real, necesitaríamos un campo para trackear si ya se liberaron fondos
        // Por ahora, asumimos que servicios completados necesitan liberación automática
      },
      include: {
        cliente: true,
        profesional: true,
      },
    });

    const results = [];

    for (const service of servicesToRelease) {
      try {
        // Buscar el pago asociado al servicio
        const payment = await prisma.pagos.findUnique({
          where: { servicio_id: service.id }
        });

        if (!payment) {
          console.warn(`No se encontró pago para servicio ${service.id}, saltando liberación automática`);
          results.push({
            serviceId: service.id,
            status: 'skipped',
            reason: 'no payment found'
          });
          continue;
        }

        // Calcular comisión al liberar fondos automáticamente (RB-03)
        const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.05');
        const totalAmount = payment.monto_total;
        const commission = Math.round(totalAmount * commissionRate);
        const professionalAmount = totalAmount - commission;

        // Actualizar el pago con comisión y liberación
        await prisma.pagos.update({
          where: { id: payment.id },
          data: {
            comision_plataforma: commission,
            monto_profesional: professionalAmount,
            estado: 'liberado',
            fecha_liberacion: new Date(),
          },
        });

        // Actualizar estado del servicio
        await prisma.servicios.update({
          where: { id: service.id },
          data: {
            estado: 'pagado',
            completado_en: new Date(),
          },
        });

        // Enviar notificación al profesional
        const { createNotification } = require('./notificationService');
        await createNotification(
          service.profesional_id,
          'fondos_liberados_auto',
          `Los fondos del servicio completado han sido liberados automáticamente. Recibiste $${professionalAmount} (comisión $${commission} deducida).`,
          { serviceId: service.id, amount: professionalAmount, commission }
        );

        results.push({
          serviceId: service.id,
          status: 'released',
          totalAmount,
          commission,
          professionalAmount,
          releasedAt: new Date(),
        });

        console.log(`💰 Fondos liberados automáticamente para servicio ${service.id} - Monto profesional: $${professionalAmount}`);
      } catch (error) {
        console.error(`Error liberando fondos para servicio ${service.id}:`, error);
        results.push({
          serviceId: service.id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      results,
    };
  } catch (error) {
    console.error('Error en liberación automática de fondos:', error);
    throw error;
  }
}

/**
 * Permite a profesionales retirar fondos a su cuenta bancaria (REQ-44)
 * @param {string} professionalId - ID del profesional
 * @param {number} amount - Monto a retirar
 * @param {Object} bankDetails - Datos bancarios
 * @returns {Object} Resultado del retiro
 */
async function withdrawFunds(professionalId, amount, bankDetails) {
  try {
    // Verificar que el usuario sea profesional
    const professional = await prisma.usuarios.findUnique({
      where: { id: professionalId },
      select: { rol: true, nombre: true, email: true }
    });

    if (!professional || professional.rol !== 'profesional') {
      throw new Error('Solo los profesionales pueden retirar fondos');
    }

    // Calcular fondos disponibles (pagos liberados menos retiros previos)
    const availableFunds = await calculateAvailableFunds(professionalId);

    if (availableFunds < amount) {
      throw new Error('Fondos insuficientes para el retiro solicitado');
    }

    // En una implementación real, aquí se integraría con el sistema bancario
    // Por ahora, simulamos el retiro y registramos la transacción

    // Crear registro de retiro (podríamos agregar una tabla de retiros)
    // Por simplicidad, actualizamos un campo en el perfil del profesional

    // Enviar notificación de retiro exitoso
    const { createNotification } = require('./notificationService');
    await createNotification(
      professionalId,
      'retiro_exitoso',
      `Se ha procesado tu retiro de $${amount} a tu cuenta bancaria.`,
      { amount, bankDetails: { ...bankDetails, masked: true } }
    );

    return {
      success: true,
      withdrawalId: `wd_${Date.now()}`,
      amount,
      processedAt: new Date(),
      estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 días hábiles
    };
  } catch (error) {
    console.error('Error en retiro de fondos:', error);
    throw error;
  }
}

/**
 * Genera comprobante de pago (REQ-45)
 * @param {string} paymentId - ID del pago
 * @returns {Object} URL del comprobante generado
 */
async function generatePaymentReceipt(paymentId) {
  try {
    // Buscar el pago
    const payment = await prisma.pagos.findUnique({
      where: { id: paymentId },
      include: {
        servicio: {
          include: {
            cliente: { select: { nombre: true, email: true } },
            profesional: { select: { nombre: true, email: true } }
          }
        }
      }
    });

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    // En una implementación real, aquí se generaría un PDF con los detalles
    // Por ahora, devolvemos una URL simulada

    const receiptUrl = `${process.env.FRONTEND_URL}/receipts/${paymentId}`;

    // Actualizar el pago con la URL del comprobante
    await prisma.pagos.update({
      where: { id: paymentId },
      data: { url_comprobante: receiptUrl }
    });

    return {
      success: true,
      receiptUrl,
      paymentId,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error generando comprobante:', error);
    throw error;
  }
}

/**
 * Calcula fondos disponibles para retiro de un profesional
 * REQ-44: El profesional debe poder retirar fondos a su cuenta bancaria
 * @param {string} professionalId - ID del profesional
 * @returns {number} Fondos disponibles
 */
async function calculateAvailableFunds(professionalId) {
  try {
    // Suma de pagos liberados (con comisión ya deducida) menos retiros previos
    const payments = await prisma.pagos.findMany({
      where: {
        profesional_id: professionalId,
        estado: 'liberado'
      },
      select: { monto_profesional: true }
    });

    const totalEarned = payments.reduce((sum, payment) => sum + payment.monto_profesional, 0);

    // En una implementación completa, restaríamos retiros previos desde una tabla de retiros
    // Por ahora, devolvemos el total disponible para retiro
    return totalEarned;
  } catch (error) {
    console.error('Error calculando fondos disponibles:', error);
    return 0;
  }
}

module.exports = {
  createPaymentPreference,
  releaseFunds,
  getPaymentStatus,
  autoReleaseFunds,
  withdrawFunds,
  generatePaymentReceipt,
  calculateAvailableFunds,
};