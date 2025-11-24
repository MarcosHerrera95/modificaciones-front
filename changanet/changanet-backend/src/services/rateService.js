/**
 * RateService
 * Servicio para gestión de tarifas profesionales
 * 
 * Implementa REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RateService {
  // Tipos de tarifa válidos según el PRD
  RATE_TYPES = {
    HOUR: 'hora',
    SERVICE: 'servicio',
    CUSTOM: 'convenio'
  };

  // Tarifas mínimas y máximas por categoría (en ARS)
  RATE_RANGES = {
    'Construcción': { min: 1500, max: 8000 },
    'Automotriz': { min: 2000, max: 6000 },
    'Tecnología': { min: 2500, max: 10000 },
    'Jardinería': { min: 1200, max: 4000 },
    'Limpieza': { min: 1000, max: 3000 },
    'Climatización': { min: 3000, max: 12000 },
    'Seguridad': { min: 2000, max: 8000 },
    'Transporte': { min: 1500, max: 5000 },
    'default': { min: 1000, max: 10000 }
  };

  /**
   * Obtiene las tarifas de un profesional
   */
  async getProfessionalRates(professionalId) {
    try {
      const profile = await prisma.perfiles_profesionales.findUnique({
        where: { usuario_id: professionalId },
        select: {
          tipo_tarifa: true,
          tarifa_hora: true,
          tarifa_servicio: true,
          tarifa_convenio: true,
          especialidad: true
        }
      });

      if (!profile) {
        throw new Error('Perfil profesional no encontrado');
      }

      return {
        tipo_tarifa: profile.tipo_tarifa,
        tarifa_hora: profile.tarifa_hora,
        tarifa_servicio: profile.tarifa_servicio,
        tarifa_convenio: profile.tarifa_convenio,
        specialty: profile.especialidad
      };
    } catch (error) {
      console.error('Error getting professional rates:', error);
      throw error;
    }
  }

  /**
   * Actualiza las tarifas de un profesional
   */
  async updateProfessionalRates(professionalId, rateData) {
    try {
      const {
        tipo_tarifa,
        tarifa_hora,
        tarifa_servicio,
        tarifa_convenio,
        especialidad
      } = rateData;

      // Validar tipo de tarifa
      const validatedType = this.validateRateType(tipo_tarifa);
      
      // Validar tarifas según el tipo
      const validatedRates = this.validateRates({
        tipo_tarifa: validatedType,
        tarifa_hora,
        tarifa_servicio,
        tarifa_convenio,
        especialidad
      });

      // Obtener especialidad para validación de rangos
      let specialtyCategory = 'default';
      if (especialidad) {
        const specialty = await this.getSpecialtyCategory(especialidad);
        specialtyCategory = specialty?.category || 'default';
      }

      // Validar rangos de precios
      this.validateRateRanges(validatedRates, specialtyCategory);

      const updatedProfile = await prisma.perfiles_profesionales.update({
        where: { usuario_id: professionalId },
        data: {
          tipo_tarifa: validatedRates.tipo_tarifa,
          tarifa_hora: validatedRates.tarifa_hora,
          tarifa_servicio: validatedRates.tarifa_servicio,
          tarifa_convenio: validatedRates.tarifa_convenio,
          last_profile_update: new Date()
        },
        select: {
          tipo_tarifa: true,
          tarifa_hora: true,
          tarifa_servicio: true,
          tarifa_convenio: true
        }
      });

      return {
        success: true,
        rates: updatedProfile,
        message: 'Tarifas actualizadas exitosamente'
      };
    } catch (error) {
      console.error('Error updating professional rates:', error);
      throw error;
    }
  }

  /**
   * Valida el tipo de tarifa
   */
  validateRateType(tipo) {
    if (!tipo || !Object.values(this.RATE_TYPES).includes(tipo)) {
      return this.RATE_TYPES.HOUR; // Valor por defecto
    }
    return tipo;
  }

  /**
   * Valida los valores de las tarifas
   */
  validateRates(rates) {
    const { tipo_tarifa, tarifa_hora, tarifa_servicio, tarifa_convenio } = rates;

    // Limpiar valores null/undefined/empty
    const cleanRates = {
      tipo_tarifa,
      tarifa_hora: this.cleanNumericValue(tarifa_hora),
      tarifa_servicio: this.cleanNumericValue(tarifa_servicio),
      tarifa_convenio: tarifa_convenio ? tarifa_convenio.trim() : null
    };

    // Validar que al menos una tarifa esté definida según el tipo
    switch (tipo_tarifa) {
      case this.RATE_TYPES.HOUR:
        if (!cleanRates.tarifa_hora || cleanRates.tarifa_hora <= 0) {
          throw new Error('La tarifa por hora debe ser mayor a 0');
        }
        break;
      case this.RATE_TYPES.SERVICE:
        if (!cleanRates.tarifa_servicio || cleanRates.tarifa_servicio <= 0) {
          throw new Error('La tarifa por servicio debe ser mayor a 0');
        }
        break;
      case this.RATE_TYPES.CUSTOM:
        if (!cleanRates.tarifa_convenio || cleanRates.tarifa_convenio.length < 5) {
          throw new Error('La descripción de "a convenir" debe tener al menos 5 caracteres');
        }
        break;
    }

    return cleanRates;
  }

  /**
   * Limpia y convierte valores numéricos
   */
  cleanNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    const numValue = parseFloat(value);
    return isNaN(numValue) || numValue < 0 ? null : numValue;
  }

  /**
   * Valida que las tarifas estén dentro de rangos razonables por categoría
   */
  validateRateRanges(rates, specialtyCategory) {
    const range = this.RATE_RANGES[specialtyCategory] || this.RATE_RANGES.default;

    if (rates.tarifa_hora) {
      if (rates.tarifa_hora < range.min) {
        throw new Error(`La tarifa por hora ($${rates.tarifa_hora}) es menor al mínimo recomendado para ${specialtyCategory} ($${range.min})`);
      }
      if (rates.tarifa_hora > range.max * 2) {
        throw new Error(`La tarifa por hora ($${rates.tarifa_hora}) parece excesiva. Máximo recomendado: $${range.max * 2}`);
      }
    }

    if (rates.tarifa_servicio) {
      if (rates.tarifa_servicio < range.min) {
        throw new Error(`La tarifa por servicio ($${rates.tarifa_servicio}) es menor al mínimo recomendado para ${specialtyCategory} ($${range.min})`);
      }
      if (rates.tarifa_servicio > range.max * 3) {
        throw new Error(`La tarifa por servicio ($${rates.tarifa_servicio}) parece excesiva. Máximo recomendado: $${range.max * 3}`);
      }
    }
  }

  /**
   * Obtiene la categoría de una especialidad
   */
  async getSpecialtyCategory(specialtyName) {
    try {
      const specialty = await prisma.specialties.findFirst({
        where: {
          name: { contains: specialtyName, mode: 'insensitive' },
          is_active: true
        },
        select: {
          category: true
        }
      });

      return specialty;
    } catch (error) {
      console.error('Error getting specialty category:', error);
      return null;
    }
  }

  /**
   * Calcula tarifas sugeridas basadas en la experiencia y categoría
   */
  async calculateSuggestedRates(experienceYears, specialtyName) {
    try {
      const specialty = await this.getSpecialtyCategory(specialtyName);
      const category = specialty?.category || 'default';
      const baseRange = this.RATE_RANGES[category] || this.RATE_RANGES.default;

      // Factor de experiencia (0.5x a 2x del rango base)
      let experienceMultiplier = 1.0;
      if (experienceYears < 2) {
        experienceMultiplier = 0.7; // Menos experiencia
      } else if (experienceYears >= 2 && experienceYears < 5) {
        experienceMultiplier = 1.0; // Experiencia normal
      } else if (experienceYears >= 5 && experienceYears < 10) {
        experienceMultiplier = 1.3; // Experiencia media-alta
      } else {
        experienceMultiplier = 1.6; // Experto
      }

      const suggestedRates = {
        tipo_tarifa: this.RATE_TYPES.HOUR,
        tarifa_hora: Math.round(baseRange.min * experienceMultiplier),
        tarifa_servicio: Math.round(baseRange.min * 1.5 * experienceMultiplier),
        tarifa_convenio: 'Consultar precio según proyecto específico'
      };

      return {
        suggested_rates: suggestedRates,
        category: category,
        confidence: experienceYears ? 'medium' : 'low',
        note: experienceYears ? 
          `Basado en ${experienceYears} años de experiencia en ${category}` : 
          'Sugerencia general para la categoría'
      };
    } catch (error) {
      console.error('Error calculating suggested rates:', error);
      throw error;
    }
  }

  /**
   * Obtiene rangos de tarifas por categoría
   */
  getRateRangesByCategory() {
    return this.RATE_RANGES;
  }

  /**
   * Busca profesionales por rango de tarifas
   */
  async searchProfessionalsByRateRange(minRate, maxRate, rateType = this.RATE_TYPES.HOUR, limit = 50) {
    try {
      const where = {
        rol: 'profesional',
        perfil_profesional: {
          isNot: null,
          tipo_tarifa: rateType,
          ...(rateType === this.RATE_TYPES.HOUR && {
            tarifa_hora: {
              gte: minRate,
              lte: maxRate
            }
          }),
          ...(rateType === this.RATE_TYPES.SERVICE && {
            tarifa_servicio: {
              gte: minRate,
              lte: maxRate
            }
          })
        }
      };

      const professionals = await prisma.usuarios.findMany({
        where,
        include: {
          perfil_profesional: {
            select: {
              tipo_tarifa: true,
              tarifa_hora: true,
              tarifa_servicio: true,
              tarifa_convenio: true,
              especialidad: true,
              calificacion_promedio: true,
              zona_cobertura: true
            }
          }
        },
        take: limit,
        orderBy: {
          perfil_profesional: {
            tarifa_hora: rateType === this.RATE_TYPES.HOUR ? 'asc' : undefined,
            tarifa_servicio: rateType === this.RATE_TYPES.SERVICE ? 'asc' : undefined,
            calificacion_promedio: 'desc'
          }
        }
      });

      return professionals;
    } catch (error) {
      console.error('Error searching professionals by rate range:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de tarifas por especialidad
   */
  async getRateStatistics() {
    try {
      // Obtener profesionales con tarifas
      const professionals = await prisma.perfiles_profesionales.findMany({
        where: {
          tipo_tarifa: { not: null }
        },
        select: {
          tipo_tarifa: true,
          tarifa_hora: true,
          tarifa_servicio: true,
          especialidad: true
        }
      });

      // Calcular estadísticas por tipo de tarifa
      const stats = {
        hourly: this.calculateRateStats(
          professionals.filter(p => p.tarifa_hora).map(p => p.tarifa_hora)
        ),
        service: this.calculateRateStats(
          professionals.filter(p => p.tarifa_servicio).map(p => p.tarifa_servicio)
        ),
        total_professionals: professionals.length
      };

      return stats;
    } catch (error) {
      console.error('Error getting rate statistics:', error);
      throw error;
    }
  }

  /**
   * Calcula estadísticas de un array de tarifas
   */
  calculateRateStats(rates) {
    if (rates.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        average: 0,
        median: 0
      };
    }

    const sortedRates = rates.sort((a, b) => a - b);
    const sum = rates.reduce((acc, rate) => acc + rate, 0);

    return {
      count: rates.length,
      min: Math.min(...rates),
      max: Math.max(...rates),
      average: Math.round(sum / rates.length),
      median: sortedRates[Math.floor(sortedRates.length / 2)]
    };
  }

  /**
   * Valida si una tarifa es competitiva
   */
  async isRateCompetitive(professionalId) {
    try {
      const profile = await prisma.perfiles_profesionales.findUnique({
        where: { usuario_id: professionalId },
        select: {
          tipo_tarifa: true,
          tarifa_hora: true,
          tarifa_servicio: true,
          especialidad: true
        }
      });

      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      const specialty = await this.getSpecialtyCategory(profile.especialidad);
      const category = specialty?.category || 'default';
      const range = this.RATE_RANGES[category];

      let competitiveness = 'unknown';
      let recommendation = '';

      if (profile.tipo_tarifa === this.RATE_TYPES.HOUR && profile.tarifa_hora) {
        if (profile.tarifa_hora < range.min) {
          competitiveness = 'low';
          recommendation = `Tu tarifa está por debajo del promedio del mercado. Considera aumentar a $${range.min} - $${range.max}`;
        } else if (profile.tarifa_hora > range.max * 1.5) {
          competitiveness = 'high';
          recommendation = `Tu tarifa está por encima del promedio. Asegúrate de justificar el valor con tu experiencia y calidad`;
        } else {
          competitiveness = 'competitive';
          recommendation = `Tu tarifa está dentro del rango competitivo para tu especialidad`;
        }
      }

      return {
        competitiveness,
        recommendation,
        category,
        market_range: range
      };
    } catch (error) {
      console.error('Error checking rate competitiveness:', error);
      throw error;
    }
  }

  /**
   * Obtiene tipos de tarifa disponibles
   */
  getAvailableRateTypes() {
    return [
      {
        value: this.RATE_TYPES.HOUR,
        label: 'Por Hora',
        description: 'Tarifa calculada por hora de trabajo',
        icon: '⏰'
      },
      {
        value: this.RATE_TYPES.SERVICE,
        label: 'Por Servicio',
        description: 'Precio fijo por servicio completo',
        icon: '🔧'
      },
      {
        value: this.RATE_TYPES.CUSTOM,
        label: 'A Convenir',
        description: 'Precio según el proyecto específico',
        icon: '🤝'
      }
    ];
  }
}

module.exports = new RateService();