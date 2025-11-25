/**
 * Controlador de gestión de comisiones
 * Permite a administradores configurar comisiones del sistema
 */

const commissionService = require('../services/commissionService');
const logger = require('../services/logger');

/**
 * Obtiene la configuración de comisión activa
 */
async function getActiveCommissionSettings(req, res) {
  try {
    const settings = await commissionService.getActiveCommissionSettings();

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Error obteniendo configuración de comisión activa', {
      service: 'commissions',
      userId: req.user?.id,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

/**
 * Actualiza la configuración de comisión
 */
async function updateCommissionSettings(req, res) {
  try {
    const { commission_percentage, minimum_fee } = req.body;
    const updatedBy = req.user.id;

    // Validar campos requeridos
    if (commission_percentage === undefined || minimum_fee === undefined) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: commission_percentage, minimum_fee'
      });
    }

    const newSettings = await commissionService.updateCommissionSettings(
      { commission_percentage, minimum_fee },
      updatedBy
    );

    logger.info('Configuración de comisión actualizada', {
      service: 'commissions',
      userId: updatedBy,
      newSettings,
      ip: req.ip
    });

    res.json({
      success: true,
      data: newSettings,
      message: 'Configuración de comisión actualizada exitosamente'
    });
  } catch (error) {
    logger.error('Error actualizando configuración de comisión', {
      service: 'commissions',
      userId: req.user?.id,
      body: req.body,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

/**
 * Obtiene el historial de configuraciones de comisión
 */
async function getCommissionHistory(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await commissionService.getCommissionHistory(limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Error obteniendo historial de comisiones', {
      service: 'commissions',
      userId: req.user?.id,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

/**
 * Calcula comisión para un monto dado (útil para testing)
 */
async function calculateCommission(req, res) {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Se requiere un monto válido mayor a 0'
      });
    }

    const calculation = await commissionService.calculateCommission(amount);

    res.json({
      success: true,
      data: calculation
    });
  } catch (error) {
    logger.error('Error calculando comisión', {
      service: 'commissions',
      userId: req.user?.id,
      amount: req.body?.amount,
      error,
      ip: req.ip
    });
    res.status(500).json({
      error: error.message || 'Error interno del servidor'
    });
  }
}

module.exports = {
  getActiveCommissionSettings,
  updateCommissionSettings,
  getCommissionHistory,
  calculateCommission
};