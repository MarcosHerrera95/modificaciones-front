/**
 * Controlador de pagos integrados
 * Implementa sección 7.9 del PRD: Pagos Integrados y Comisiones
 * REQ-41: Integración con pasarelas de pago
 * REQ-42: Custodia de fondos hasta aprobación
 * REQ-43: Comisión configurable (5-10%)
 * REQ-44: Retiro de fondos por profesionales
 * REQ-45: Generación de comprobantes
 */

const paymentService = require('../services/paymentsService');
const mercadoPagoService = require('../services/mercadoPagoService');
const receiptService = require('../services/receiptService');
const logger = require('../services/logger');

/**
 * Crea una preferencia de pago con custodia de fondos
 * REQ-41: Integración con pasarelas de pago
 * REQ-42: Custodia de fondos hasta aprobación
 * REQ-43: Comisión configurable (10%)
 */
async function createPaymentPreference(req, res) {
  try {
    const { serviceId } = req.body;
    const clientId = req.user.id; // Obtenido del middleware de autenticación

    // Validar campos requeridos
    if (!serviceId) {
      logger.warn('Payment preference creation failed: missing serviceId', {
        service: 'payments',
        userId: clientId,
        serviceId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Falta campo requerido: serviceId',
      });
    }

    // Obtener detalles del servicio
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: {
        cliente: true,
        profesional: {
          include: {
            perfil_profesional: true
          }
        },
        pago: true
      }
    });

    if (!service) {
      return res.status(404).json({
        error: 'Servicio no encontrado',
      });
    }

    // Verificar que el cliente sea el propietario del servicio
    if (service.cliente_id !== clientId) {
      return res.status(403).json({
        error: 'No tienes permiso para pagar este servicio',
      });
    }

    // Verificar que no haya un pago ya creado
    if (service.pago) {
      return res.status(400).json({
        error: 'Ya existe un pago para este servicio',
      });
    }

    // Calcular monto total (debe venir del frontend o calcularse)
    let amount = req.body.amount || service.profesional.perfil_profesional?.tarifa_hora || 1000;

    // Aplicar recargo por servicio urgente - Sección 10 del PRD
    if (service.es_urgente) {
      const urgentSurcharge = parseFloat(process.env.URGENT_SERVICE_SURCHARGE || '0.2'); // 20% por defecto
      amount = amount * (1 + urgentSurcharge);
      console.log(`🔥 Servicio urgente detectado - Aplicando recargo del ${urgentSurcharge * 100}%: $${amount}`);
    }

    // Crear preferencia de pago con Mercado Pago
    const preference = await mercadoPagoService.createPaymentPreference({
      serviceId,
      amount,
      description: service.descripcion,
      client: {
        id: service.cliente.id,
        nombre: service.cliente.nombre,
        email: service.cliente.email
      },
      professional: {
        id: service.profesional.id,
        nombre: service.profesional.nombre,
        email: service.profesional.email
      }
    });

    // Crear registro de pago en custodia
    // Según RB-03: Comisión se calcula al liberar fondos, no aquí
    const commission = 0; // Se calculará al completar el servicio
    const professionalAmount = amount; // Monto completo inicialmente

    const payment = await prisma.pagos.create({
      data: {
        servicio_id: serviceId,
        cliente_id: clientId,
        profesional_id: service.profesional.id,
        monto_total: amount,
        comision_plataforma: commission,
        monto_profesional: professionalAmount,
        estado: 'pendiente',
        mercado_pago_preference_id: preference.id
      }
    });

    logger.info('Payment preference created successfully', {
      service: 'payments',
      userId: clientId,
      serviceId,
      amount,
      preferenceId: preference.id,
      paymentId: payment.id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        ...preference,
        paymentId: payment.id
      },
    });
  } catch (error) {
    logger.error('Payment preference creation error', {
      service: 'payments',
      userId: req.user?.id,
      serviceId: req.body.serviceId,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Libera los fondos de un pago completado
 */
async function releaseFunds(req, res) {
  try {
    const { paymentId, serviceId } = req.body;
    const clientId = req.user.id; // Obtenido del middleware de autenticación

    // Validar campos requeridos
    if (!paymentId || !serviceId) {
      logger.warn('Funds release failed: missing required fields', {
        service: 'payments',
        userId: clientId,
        paymentId,
        serviceId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Faltan campos requeridos: paymentId, serviceId',
      });
    }

    const result = await paymentService.releaseFunds(paymentId, serviceId, clientId);

    logger.info('Funds released successfully', {
      service: 'payments',
      userId: clientId,
      paymentId,
      serviceId,
      amount: result.amount,
      ip: req.ip
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Funds release error', {
      service: 'payments',
      userId: req.user?.id,
      paymentId: req.body.paymentId,
      serviceId: req.body.serviceId,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Obtiene el estado de un pago
 */
async function getPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        error: 'Se requiere el paymentId',
      });
    }

    const status = await paymentService.getPaymentStatus(paymentId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error en getPaymentStatus:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Maneja webhooks de Mercado Pago
 * REQ-41: Integración real con Mercado Pago
 */
async function handleWebhook(req, res) {
  try {
    const { type, data } = req.body;

    logger.info('Payment webhook received', {
      service: 'payments',
      type,
      paymentId: data?.id,
      ip: req.ip
    });

    // Verificar que sea una notificación de pago
    if (type === 'payment') {
      const paymentId = data.id;

      // Procesar webhook con Mercado Pago service
      await mercadoPagoService.processPaymentWebhook(data);

      logger.info('Payment webhook processed successfully', {
        service: 'payments',
        paymentId,
        ip: req.ip
      });
    }

    // Responder a Mercado Pago
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Payment webhook processing error', {
      service: 'payments',
      type: req.body?.type,
      paymentId: req.body?.data?.id,
      error,
      ip: req.ip
    });
    res.status(500).send('Error procesando webhook');
  }
}

/**
 * Permite a profesionales retirar fondos
 * REQ-44: Retiro de fondos a cuenta bancaria
 */
async function withdrawFunds(req, res) {
  try {
    const { id: professionalId } = req.user;
    const { amount, bankDetails } = req.body;

    // Validar campos requeridos
    if (!amount || !bankDetails) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: amount, bankDetails',
      });
    }

    const result = await paymentService.withdrawFunds(professionalId, amount, bankDetails);

    logger.info('Funds withdrawal successful', {
      service: 'payments',
      userId: professionalId,
      amount,
      ip: req.ip
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Funds withdrawal error', {
      service: 'payments',
      userId: req.user?.id,
      amount: req.body?.amount,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Genera comprobante de pago
 * REQ-45: Generación de comprobantes de pago
 */
async function generateReceipt(req, res) {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        error: 'Se requiere paymentId',
      });
    }

    // Generar y guardar comprobante
    const receiptUrl = await receiptService.generateAndSaveReceipt(paymentId);

    logger.info('Receipt generated successfully', {
      service: 'payments',
      paymentId,
      receiptUrl,
      userId: req.user?.id,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        receiptUrl,
        message: 'Comprobante generado exitosamente'
      },
    });
  } catch (error) {
    logger.error('Error generating receipt', {
      service: 'payments',
      paymentId: req.params.paymentId,
      error,
      userId: req.user?.id,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Descarga un comprobante de pago
 */
async function downloadReceipt(req, res) {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({
        error: 'Se requiere nombre de archivo',
      });
    }

    const fileBuffer = await receiptService.getReceiptFile(fileName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileBuffer);

  } catch (error) {
    console.error('Error descargando comprobante:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
}

module.exports = {
  createPaymentPreference,
  releaseFunds,
  getPaymentStatus,
  handleWebhook,
  withdrawFunds,
  generateReceipt,
  downloadReceipt,
};