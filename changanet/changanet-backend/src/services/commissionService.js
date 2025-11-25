/**
 * Servicio de gestión de comisiones configurables
 * Implementa REQ-43: Comisión configurable (5-10%)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Obtiene la configuración de comisión activa
 * @returns {Object} Configuración de comisión
 */
async function getActiveCommissionSettings() {
  try {
    const settings = await prisma.commission_settings.findFirst({
      where: { active: true },
      orderBy: { updated_at: 'desc' }
    });

    // Si no hay configuración, devolver valores por defecto según PRD
    if (!settings) {
      return {
        commission_percentage: 0.05, // 5%
        minimum_fee: 0.00,
        active: true,
        updated_at: new Date(),
        updated_by: null
      };
    }

    return settings;
  } catch (error) {
    console.error('Error obteniendo configuración de comisión:', error);
    // Fallback a valores por defecto
    return {
      commission_percentage: 0.05,
      minimum_fee: 0.00,
      active: true,
      updated_at: new Date(),
      updated_by: null
    };
  }
}

/**
 * Actualiza la configuración de comisión
 * @param {Object} newSettings - Nueva configuración
 * @param {number} newSettings.commission_percentage - Porcentaje de comisión (0.05 = 5%)
 * @param {number} newSettings.minimum_fee - Monto mínimo de comisión
 * @param {string} updatedBy - ID del administrador que actualiza
 * @returns {Object} Configuración actualizada
 */
async function updateCommissionSettings(newSettings, updatedBy) {
  try {
    const { commission_percentage, minimum_fee } = newSettings;

    // Validar que la comisión esté entre 5-10% según PRD
    if (commission_percentage < 0.05 || commission_percentage > 0.10) {
      throw new Error('La comisión debe estar entre 5% y 10% según requisitos del sistema');
    }

    // Validar que el monto mínimo no sea negativo
    if (minimum_fee < 0) {
      throw new Error('El monto mínimo de comisión no puede ser negativo');
    }

    // Desactivar configuración anterior
    await prisma.commission_settings.updateMany({
      where: { active: true },
      data: { active: false }
    });

    // Crear nueva configuración activa
    const newConfig = await prisma.commission_settings.create({
      data: {
        commission_percentage,
        minimum_fee,
        active: true,
        updated_by: updatedBy
      }
    });

    console.log(`💰 Configuración de comisión actualizada: ${commission_percentage * 100}% - Mínimo: $${minimum_fee}`);

    return newConfig;
  } catch (error) {
    console.error('Error actualizando configuración de comisión:', error);
    throw error;
  }
}

/**
 * Calcula la comisión para un monto dado
 * @param {number} amount - Monto total
 * @returns {Object} Detalles del cálculo de comisión
 */
async function calculateCommission(amount) {
  try {
    const settings = await getActiveCommissionSettings();

    // Calcular comisión basada en porcentaje
    let commission = amount * settings.commission_percentage;

    // Aplicar monto mínimo si corresponde
    if (commission < settings.minimum_fee) {
      commission = settings.minimum_fee;
    }

    // Monto que recibe el profesional
    const professionalAmount = amount - commission;

    return {
      total_amount: amount,
      commission_percentage: settings.commission_percentage,
      commission_amount: commission,
      minimum_fee_applied: commission === settings.minimum_fee,
      professional_amount: professionalAmount,
      settings_used: settings
    };
  } catch (error) {
    console.error('Error calculando comisión:', error);
    throw error;
  }
}

/**
 * Obtiene historial de configuraciones de comisión
 * @param {number} limit - Número máximo de registros
 * @returns {Array} Historial de configuraciones
 */
async function getCommissionHistory(limit = 10) {
  try {
    const history = await prisma.commission_settings.findMany({
      orderBy: { updated_at: 'desc' },
      take: limit,
      include: {
        updated_by_user: {
          select: {
            nombre: true,
            email: true
          }
        }
      }
    });

    return history;
  } catch (error) {
    console.error('Error obteniendo historial de comisiones:', error);
    return [];
  }
}

/**
 * Inicializa configuración de comisión por defecto si no existe
 */
async function initializeDefaultCommissionSettings() {
  try {
    const existingSettings = await prisma.commission_settings.findFirst({
      where: { active: true }
    });

    if (!existingSettings) {
      await prisma.commission_settings.create({
        data: {
          commission_percentage: 0.05, // 5%
          minimum_fee: 0.00,
          active: true,
          updated_by: null
        }
      });
      console.log('✅ Configuración de comisión por defecto inicializada');
    }
  } catch (error) {
    console.error('Error inicializando configuración de comisión por defecto:', error);
  }
}

module.exports = {
  getActiveCommissionSettings,
  updateCommissionSettings,
  calculateCommission,
  getCommissionHistory,
  initializeDefaultCommissionSettings
};