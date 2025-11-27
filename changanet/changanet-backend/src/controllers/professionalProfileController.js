/**
 * ProfessionalProfileController
 * Controlador mejorado para gestión completa de perfiles profesionales
 * 
 * Implementa REQ-06 a REQ-10 del PRD:
 * - REQ-06: Subir foto de perfil y portada
 * - REQ-07: Seleccionar especialidades múltiples
 * - REQ-08: Ingresar años de experiencia
 * - REQ-09: Definir zona de cobertura geográfica
 * - REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 */

const { PrismaClient } = require('@prisma/client');
const professionalProfileService = require('../services/professionalProfileService');
const specialtyService = require('../services/specialtyService');
const coverageZoneService = require('../services/coverageZoneService');
const rateService = require('../services/rateService');

const prisma = new PrismaClient();

class ProfessionalProfileController {
  /**
   * GET /api/professionals/me
   * Obtiene el perfil completo del profesional autenticado
   */
  static async getMyProfile(req, res) {
    try {
      const { userId } = req.user;
      
      // Verificar que el usuario es profesional
      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden acceder a esta funcionalidad'
        });
      }

      const profile = await professionalProfileService.getProfessionalProfile(userId, true);
      
      res.json({
        success: true,
        profile,
        message: 'Perfil obtenido exitosamente'
      });
    } catch (error) {
      console.error('Error getting my profile:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener el perfil'
      });
    }
  }

  /**
   * PUT /api/professionals/me
   * Actualiza el perfil completo del profesional autenticado
   */
  static async updateMyProfile(req, res) {
    try {
      const { userId } = req.user;
      
      // Verificar que el usuario es profesional
      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden actualizar perfiles'
        });
      }

      // Separar archivos de datos
      const imageFiles = {
        profilePhoto: req.files?.find(f => f.fieldname === 'foto_perfil'),
        bannerPhoto: req.files?.find(f => f.fieldname === 'foto_portada')
      };

      // Preparar datos del perfil
      const profileData = {
        ...req.body,
        specialtyIds: req.body.specialtyIds ? 
          (Array.isArray(req.body.specialtyIds) ? req.body.specialtyIds : [req.body.specialtyIds]) : 
          undefined
      };

      const result = await professionalProfileService.updateProfessionalProfile(
        userId, 
        profileData, 
        imageFiles
      );

      res.json(result);
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // Manejar errores específicos
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          error: 'Perfil no encontrado',
          message: error.message
        });
      }
      
      if (error.message.includes('no válida')) {
        return res.status(400).json({
          error: 'Datos inválidos',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al actualizar el perfil'
      });
    }
  }

  /**
   * GET /api/professionals/:professionalId
   * Obtiene el perfil público de un profesional
   */
  static async getPublicProfile(req, res) {
    try {
      const { professionalId } = req.params;

      const profile = await professionalProfileService.getProfessionalProfile(professionalId, false);
      
      res.json({
        success: true,
        profile,
        message: 'Perfil público obtenido exitosamente'
      });
    } catch (error) {
      console.error('Error getting public profile:', error);
      
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          error: 'Perfil no encontrado',
          message: 'El profesional no existe o no tiene perfil configurado'
        });
      }

      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener el perfil público'
      });
    }
  }

  /**
   * POST /api/professionals/me/specialties
   * Actualiza las especialidades del profesional
   */
  static async updateSpecialties(req, res) {
    try {
      const { userId } = req.user;
      const { specialtyIds, primarySpecialtyIndex = 0 } = req.body;

      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden actualizar especialidades'
        });
      }

      const result = await specialtyService.updateProfessionalSpecialties(
        userId, 
        specialtyIds, 
        primarySpecialtyIndex
      );

      res.json(result);
    } catch (error) {
      console.error('Error updating specialties:', error);
      
      if (error.message.includes('no son válidas')) {
        return res.status(400).json({
          error: 'Especialidades inválidas',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al actualizar especialidades'
      });
    }
  }

  /**
   * GET /api/professionals/me/coverage-zone
   * Obtiene la zona de cobertura del profesional
   */
  static async getCoverageZone(req, res) {
    try {
      const { userId } = req.user;

      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden acceder a esta funcionalidad'
        });
      }

      const coverageZone = await coverageZoneService.getProfessionalCoverageZone(userId);
      
      res.json({
        success: true,
        coverageZone,
        message: 'Zona de cobertura obtenida exitosamente'
      });
    } catch (error) {
      console.error('Error getting coverage zone:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener la zona de cobertura'
      });
    }
  }

  /**
   * PUT /api/professionals/me/coverage-zone
   * Actualiza la zona de cobertura del profesional
   */
  static async updateCoverageZone(req, res) {
    try {
      const { userId } = req.user;
      const zoneData = req.body;

      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden actualizar zonas de cobertura'
        });
      }

      const result = await coverageZoneService.updateProfessionalCoverageZone(userId, zoneData);
      
      res.json(result);
    } catch (error) {
      console.error('Error updating coverage zone:', error);
      
      if (error.message.includes('no encontrada')) {
        return res.status(400).json({
          error: 'Zona inválida',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al actualizar la zona de cobertura'
      });
    }
  }

  /**
   * GET /api/professionals/me/rates
   * Obtiene las tarifas del profesional
   */
  static async getRates(req, res) {
    try {
      const { userId } = req.user;

      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden acceder a esta funcionalidad'
        });
      }

      const rates = await rateService.getProfessionalRates(userId);
      
      res.json({
        success: true,
        rates,
        message: 'Tarifas obtenidas exitosamente'
      });
    } catch (error) {
      console.error('Error getting rates:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener las tarifas'
      });
    }
  }

  /**
   * PUT /api/professionals/me/rates
   * Actualiza las tarifas del profesional
   */
  static async updateRates(req, res) {
    try {
      const { userId } = req.user;
      const rateData = req.body;

      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden actualizar tarifas'
        });
      }

      const result = await rateService.updateProfessionalRates(userId, rateData);
      
      res.json(result);
    } catch (error) {
      console.error('Error updating rates:', error);
      
      if (error.message.includes('debe ser mayor a 0') || 
          error.message.includes('debe tener al menos')) {
        return res.status(400).json({
          error: 'Tarifas inválidas',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al actualizar las tarifas'
      });
    }
  }

  /**
   * GET /api/professionals/search
   * Busca profesionales con filtros avanzados
   */
  static async searchProfessionals(req, res) {
    try {
      const {
        specialtyIds,
        location,
        maxDistance,
        rateType,
        minRate,
        maxRate,
        availableOnly,
        sortBy,
        page,
        limit
      } = req.query;

      // Parsear specialtyIds si viene como string
      let parsedSpecialtyIds = [];
      if (specialtyIds) {
        try {
          parsedSpecialtyIds = typeof specialtyIds === 'string' ? 
            JSON.parse(specialtyIds) : specialtyIds;
        } catch (e) {
          return res.status(400).json({
            error: 'Formato inválido',
            message: 'specialtyIds debe ser un array válido'
          });
        }
      }

      // Parsear location si viene como string
      let parsedLocation = null;
      if (location) {
        try {
          parsedLocation = typeof location === 'string' ? 
            JSON.parse(location) : location;
        } catch (e) {
          return res.status(400).json({
            error: 'Formato inválido',
            message: 'location debe ser un objeto válido con lat y lng'
          });
        }
      }

      const criteria = {
        specialtyIds: parsedSpecialtyIds,
        location: parsedLocation,
        maxDistance: maxDistance ? parseFloat(maxDistance) : undefined,
        rateType,
        minRate: minRate ? parseFloat(minRate) : undefined,
        maxRate: maxRate ? parseFloat(maxRate) : undefined,
        availableOnly: availableOnly !== 'false',
        sortBy: sortBy || 'calificacion_promedio',
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20
      };

      const results = await professionalProfileService.searchProfessionals(criteria);
      
      res.json({
        success: true,
        ...results,
        message: 'Búsqueda completada exitosamente'
      });
    } catch (error) {
      console.error('Error searching professionals:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error en la búsqueda de profesionales'
      });
    }
  }

  /**
   * GET /api/specialties
   * Obtiene todas las especialidades disponibles
   */
  static async getSpecialties(req, res) {
    try {
      const { grouped } = req.query;

      if (grouped === 'true') {
        const specialties = await specialtyService.getSpecialtiesByCategory();
        res.json({
          success: true,
          specialties,
          message: 'Especialidades agrupadas obtenidas exitosamente'
        });
      } else {
        const specialties = await specialtyService.getAllSpecialties();
        res.json({
          success: true,
          specialties,
          message: 'Especialidades obtenidas exitosamente'
        });
      }
    } catch (error) {
      console.error('Error getting specialties:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener especialidades'
      });
    }
  }

  /**
   * GET /api/specialties/search
   * Busca especialidades por término
   */
  static async searchSpecialties(req, res) {
    try {
      const { q, limit } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          error: 'Término de búsqueda requerido',
          message: 'Debe proporcionar un término de búsqueda de al menos 2 caracteres'
        });
      }

      const specialties = await specialtyService.searchSpecialties(q, limit ? parseInt(limit) : 20);
      
      res.json({
        success: true,
        specialties,
        query: q,
        count: specialties.length,
        message: 'Búsqueda de especialidades completada'
      });
    } catch (error) {
      console.error('Error searching specialties:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error en la búsqueda de especialidades'
      });
    }
  }

  /**
   * GET /api/zones
   * Obtiene todas las zonas de cobertura disponibles
   */
  static async getCoverageZones(req, res) {
    try {
      const { grouped, state, q } = req.query;

      let zones;
      if (grouped === 'true') {
        zones = await coverageZoneService.getCoverageZonesByState();
        res.json({
          success: true,
          zones,
          message: 'Zonas agrupadas obtenidas exitosamente'
        });
      } else if (state) {
        zones = await coverageZoneService.getCitiesByState(state);
        res.json({
          success: true,
          zones,
          state,
          message: `Ciudades de ${state} obtenidas exitosamente`
        });
      } else if (q) {
        zones = await coverageZoneService.searchCoverageZones(q, 50);
        res.json({
          success: true,
          zones,
          query: q,
          count: zones.length,
          message: 'Búsqueda de zonas completada'
        });
      } else {
        zones = await coverageZoneService.getAllCoverageZones();
        res.json({
          success: true,
          zones,
          message: 'Zonas obtenidas exitosamente'
        });
      }
    } catch (error) {
      console.error('Error getting coverage zones:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener zonas de cobertura'
      });
    }
  }

  /**
   * GET /api/rate-types
   * Obtiene los tipos de tarifa disponibles
   */
  static async getRateTypes(req, res) {
    try {
      const rateTypes = rateService.getAvailableRateTypes();
      
      res.json({
        success: true,
        rateTypes,
        message: 'Tipos de tarifa obtenidos exitosamente'
      });
    } catch (error) {
      console.error('Error getting rate types:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener tipos de tarifa'
      });
    }
  }

  /**
   * GET /api/rate-ranges
   * Obtiene los rangos de tarifas por categoría
   */
  static async getRateRanges(req, res) {
    try {
      const rateRanges = rateService.getRateRangesByCategory();
      
      res.json({
        success: true,
        rateRanges,
        message: 'Rangos de tarifas obtenidos exitosamente'
      });
    } catch (error) {
      console.error('Error getting rate ranges:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al obtener rangos de tarifas'
      });
    }
  }

  /**
   * POST /api/professionals/me/rates/suggest
   * Obtiene tarifas sugeridas para un profesional
   */
  static async getSuggestedRates(req, res) {
    try {
      const { userId } = req.user;
      const { experienceYears, specialty } = req.body;

      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden obtener sugerencias de tarifas'
        });
      }

      const suggestions = await rateService.calculateSuggestedRates(
        experienceYears,
        specialty
      );

      res.json({
        success: true,
        suggestions,
        message: 'Tarifas sugeridas obtenidas exitosamente'
      });
    } catch (error) {
      console.error('Error getting suggested rates:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al calcular tarifas sugeridas'
      });
    }
  }

  /**
   * POST /api/professionals
   * Crea un nuevo perfil profesional
   */
  static async createProfile(req, res) {
    try {
      const { userId } = req.user;

      if (req.user.role !== 'profesional') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los profesionales pueden crear perfiles'
        });
      }

      // Verificar que no tenga perfil ya
      const existingProfile = await professionalProfileService.getProfessionalProfile(userId, true).catch(() => null);
      if (existingProfile) {
        return res.status(400).json({
          error: 'Perfil ya existe',
          message: 'Ya tienes un perfil profesional configurado'
        });
      }

      const profileData = req.body;
      const profile = await professionalProfileService.createProfessionalProfile(userId, profileData);

      res.status(201).json({
        success: true,
        profile,
        message: 'Perfil profesional creado exitosamente'
      });
    } catch (error) {
      console.error('Error creating profile:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al crear el perfil profesional'
      });
    }
  }

  /**
   * PATCH /api/professionals/:id/verify
   * Verifica un perfil profesional
   */
  static async verifyProfile(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.user;

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden verificar perfiles'
        });
      }

      const profile = await professionalProfileService.verifyProfessionalProfile(id, userId);

      res.json({
        success: true,
        profile,
        message: 'Perfil profesional verificado exitosamente'
      });
    } catch (error) {
      console.error('Error verifying profile:', error);

      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          error: 'Perfil no encontrado',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al verificar el perfil profesional'
      });
    }
  }

  /**
   * DELETE /api/professionals/:id
   * Elimina un perfil profesional
   */
  static async deleteProfile(req, res) {
    try {
      const { id } = req.params;

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden eliminar perfiles'
        });
      }

      const deletedProfile = await professionalProfileService.deleteProfessionalProfile(id);

      res.json({
        success: true,
        message: 'Perfil profesional eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error deleting profile:', error);

      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          error: 'Perfil no encontrado',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al eliminar el perfil profesional'
      });
    }
  }
}

module.exports = ProfessionalProfileController;