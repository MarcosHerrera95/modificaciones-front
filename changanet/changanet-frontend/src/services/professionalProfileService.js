/**
 * ProfessionalProfileService
 * Servicio frontend para gestión de perfiles profesionales
 * 
 * Maneja todas las llamadas a la API del backend para REQ-06 a REQ-10
 */

import { api } from './apiService';

class ProfessionalProfileService {
  /**
   * Obtiene el perfil completo del profesional autenticado
   */
  async getMyProfile() {
    try {
      const response = await api.get('/professionals/me');
      return response.data.profile;
    } catch (error) {
      console.error('Error getting my profile:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener el perfil');
    }
  }

  /**
   * Actualiza el perfil del profesional
   * @param {Object} profileData - Datos del perfil a actualizar
   * @param {File} profilePhoto - Foto de perfil (opcional)
   * @param {File} bannerPhoto - Foto de portada (opcional)
   */
  async updateMyProfile(profileData, profilePhoto = null, bannerPhoto = null) {
    try {
      const formData = new FormData();
      
      // Agregar datos del perfil
      Object.keys(profileData).forEach(key => {
        if (profileData[key] !== null && profileData[key] !== undefined) {
          if (Array.isArray(profileData[key])) {
            // Para arrays, agregar cada elemento por separado
            profileData[key].forEach(item => {
              formData.append(key, item);
            });
          } else {
            formData.append(key, profileData[key]);
          }
        }
      });

      // Agregar fotos si existen
      if (profilePhoto) {
        formData.append('foto_perfil', profilePhoto);
      }
      if (bannerPhoto) {
        formData.append('foto_portada', bannerPhoto);
      }

      const response = await api.put('/professionals/me', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error(error.response?.data?.message || 'Error al actualizar el perfil');
    }
  }

  /**
   * Obtiene el perfil público de un profesional
   * @param {string} professionalId - ID del profesional
   */
  async getPublicProfile(professionalId) {
    try {
      const response = await api.get(`/professionals/${professionalId}`);
      return response.data.profile;
    } catch (error) {
      console.error('Error getting public profile:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener el perfil público');
    }
  }

  /**
   * Actualiza las especialidades del profesional
   * @param {Array} specialtyIds - Array de IDs de especialidades
   * @param {number} primarySpecialtyIndex - Índice de la especialidad principal
   */
  async updateSpecialties(specialtyIds, primarySpecialtyIndex = 0) {
    try {
      const response = await api.post('/professionals/me/specialties', {
        specialtyIds,
        primarySpecialtyIndex
      });
      return response.data;
    } catch (error) {
      console.error('Error updating specialties:', error);
      throw new Error(error.response?.data?.message || 'Error al actualizar especialidades');
    }
  }

  /**
   * Obtiene la zona de cobertura del profesional
   */
  async getMyCoverageZone() {
    try {
      const response = await api.get('/professionals/me/coverage-zone');
      return response.data.coverageZone;
    } catch (error) {
      console.error('Error getting coverage zone:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener zona de cobertura');
    }
  }

  /**
   * Actualiza la zona de cobertura del profesional
   * @param {Object} zoneData - Datos de la zona de cobertura
   */
  async updateMyCoverageZone(zoneData) {
    try {
      const response = await api.put('/professionals/me/coverage-zone', zoneData);
      return response.data;
    } catch (error) {
      console.error('Error updating coverage zone:', error);
      throw new Error(error.response?.data?.message || 'Error al actualizar zona de cobertura');
    }
  }

  /**
   * Obtiene las tarifas del profesional
   */
  async getMyRates() {
    try {
      const response = await api.get('/professionals/me/rates');
      return response.data.rates;
    } catch (error) {
      console.error('Error getting rates:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener tarifas');
    }
  }

  /**
   * Actualiza las tarifas del profesional
   * @param {Object} rateData - Datos de las tarifas
   */
  async updateMyRates(rateData) {
    try {
      const response = await api.put('/professionals/me/rates', rateData);
      return response.data;
    } catch (error) {
      console.error('Error updating rates:', error);
      throw new Error(error.response?.data?.message || 'Error al actualizar tarifas');
    }
  }

  /**
   * Busca profesionales con filtros avanzados
   * @param {Object} searchCriteria - Criterios de búsqueda
   */
  async searchProfessionals(searchCriteria) {
    try {
      const params = new URLSearchParams();
      
      Object.keys(searchCriteria).forEach(key => {
        const value = searchCriteria[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            params.append(key, JSON.stringify(value));
          } else if (typeof value === 'object') {
            params.append(key, JSON.stringify(value));
          } else {
            params.append(key, value);
          }
        }
      });

      const response = await api.get(`/professionals/search?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error searching professionals:', error);
      throw new Error(error.response?.data?.message || 'Error en la búsqueda');
    }
  }

  /**
   * Obtiene todas las especialidades disponibles
   * @param {boolean} grouped - Si agrupar por categoría
   */
  async getSpecialties(grouped = false) {
    try {
      const response = await api.get(`/specialties?grouped=${grouped}`);
      return response.data.specialties;
    } catch (error) {
      console.error('Error getting specialties:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener especialidades');
    }
  }

  /**
   * Busca especialidades por término
   * @param {string} query - Término de búsqueda
   * @param {number} limit - Límite de resultados
   */
  async searchSpecialties(query, limit = 20) {
    try {
      const response = await api.get(`/specialties/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return response.data.specialties;
    } catch (error) {
      console.error('Error searching specialties:', error);
      throw new Error(error.response?.data?.message || 'Error en la búsqueda de especialidades');
    }
  }

  /**
   * Obtiene todas las zonas de cobertura disponibles
   * @param {Object} options - Opciones de filtrado
   */
  async getCoverageZones(options = {}) {
    try {
      const params = new URLSearchParams();
      
      Object.keys(options).forEach(key => {
        if (options[key]) {
          params.append(key, options[key]);
        }
      });

      const response = await api.get(`/zones?${params}`);
      return response.data.zones;
    } catch (error) {
      console.error('Error getting coverage zones:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener zonas de cobertura');
    }
  }

  /**
   * Busca zonas de cobertura por término
   * @param {string} query - Término de búsqueda
   */
  async searchCoverageZones(query) {
    try {
      const response = await api.get(`/zones?q=${encodeURIComponent(query)}`);
      return response.data.zones;
    } catch (error) {
      console.error('Error searching coverage zones:', error);
      throw new Error(error.response?.data?.message || 'Error en la búsqueda de zonas');
    }
  }

  /**
   * Obtiene los tipos de tarifa disponibles
   */
  async getRateTypes() {
    try {
      const response = await api.get('/rate-types');
      return response.data.rateTypes;
    } catch (error) {
      console.error('Error getting rate types:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener tipos de tarifa');
    }
  }

  /**
   * Obtiene los rangos de tarifas por categoría
   */
  async getRateRanges() {
    try {
      const response = await api.get('/rate-ranges');
      return response.data.rateRanges;
    } catch (error) {
      console.error('Error getting rate ranges:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener rangos de tarifas');
    }
  }

  /**
   * Calcula tarifas sugeridas
   * @param {number} experienceYears - Años de experiencia
   * @param {string} specialty - Especialidad
   */
  async getSuggestedRates(experienceYears, specialty) {
    try {
      const response = await api.post('/professionals/me/rates/suggest', {
        experienceYears,
        specialty
      });
      return response.data.suggestions;
    } catch (error) {
      console.error('Error getting suggested rates:', error);
      throw new Error(error.response?.data?.message || 'Error al calcular tarifas sugeridas');
    }
  }

  /**
   * Obtiene el score de completitud del perfil
   */
  async getMyProfileCompletion() {
    try {
      const response = await api.get('/professionals/me/completion');
      return response.data.completion;
    } catch (error) {
      console.error('Error getting profile completion:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener completitud del perfil');
    }
  }

  /**
   * Obtiene estadísticas del perfil
   */
  async getMyProfileStatistics() {
    try {
      const response = await api.get('/professionals/me/statistics');
      return response.data.statistics;
    } catch (error) {
      console.error('Error getting profile statistics:', error);
      throw new Error(error.response?.data?.message || 'Error al obtener estadísticas del perfil');
    }
  }

  /**
   * Valida datos del perfil sin guardarlos
   * @param {Object} profileData - Datos a validar
   */
  async validateProfileData(profileData) {
    try {
      const response = await api.post('/professionals/me/validate', profileData);
      return response.data.valid;
    } catch (error) {
      console.error('Error validating profile data:', error);
      throw new Error(error.response?.data?.message || 'Error en la validación');
    }
  }

  /**
   * Valida una foto antes de subirla
   * @param {File} photoFile - Archivo de foto
   */
  async validateProfilePhoto(photoFile) {
    try {
      const formData = new FormData();
      formData.append('foto', photoFile);

      const response = await api.get('/professionals/me/validate-photo', {
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error validating profile photo:', error);
      throw new Error(error.response?.data?.message || 'Error al validar la foto');
    }
  }

  /**
   * Utilidades para formateo de datos
   */
  formatProfileData(rawData) {
    return {
      nombre: rawData.usuario?.nombre || '',
      email: rawData.usuario?.email || '',
      telefono: rawData.usuario?.telefono || '',
      especialidad: rawData.especialidad || '',
      especialidades: rawData.especialidades || [],
      anos_experiencia: rawData.anos_experiencia || 0,
      zona_cobertura: rawData.zona_cobertura || '',
      coverage_zone_id: rawData.coverage_zone?.id || '',
      coverage_zone: rawData.coverage_zone || null,
      latitud: rawData.latitud,
      longitud: rawData.longitud,
      tipo_tarifa: rawData.tipo_tarifa || 'hora',
      tarifa_hora: rawData.tarifa_hora || 0,
      tarifa_servicio: rawData.tarifa_servicio || 0,
      tarifa_convenio: rawData.tarifa_convenio || '',
      descripcion: rawData.descripcion || '',
      url_foto_perfil: rawData.url_foto_perfil || '',
      url_foto_portada: rawData.url_foto_portada || '',
      esta_disponible: rawData.esta_disponible !== false,
      calificacion_promedio: rawData.calificacion_promedio || 0,
      estado_verificacion: rawData.estado_verificacion || 'pendiente',
      profile_completion_score: rawData.profile_completion_score || 0,
      profile_views_count: rawData.profile_views_count || 0,
      last_profile_update: rawData.last_profile_update
    };
  }

  /**
   * Calcula el score de completitud del perfil en el frontend
   * @param {Object} profileData - Datos del perfil
   */
  calculateCompletionScore(profileData) {
    const fields = [
      { key: 'especialidad', weight: 20 },
      { key: 'anos_experiencia', weight: 15 },
      { key: 'zona_cobertura', weight: 15 },
      { key: 'tipo_tarifa', weight: 15 },
      { key: 'tarifa_hora', weight: 10 },
      { key: 'descripcion', weight: 15 },
      { key: 'url_foto_perfil', weight: 10 }
    ];

    let totalScore = 0;
    const filledFields = [];

    fields.forEach(field => {
      const value = profileData[field.key];
      if (value !== null && value !== undefined && value !== '' && value !== 0) {
        totalScore += field.weight;
        filledFields.push(field.key);
      }
    });

    return {
      score: Math.min(totalScore, 100),
      filled_fields: filledFields.length,
      total_fields: fields.length,
      missing_fields: fields.filter(f => !filledFields.includes(f.key)).map(f => f.key),
      percentage: Math.round((filledFields.length / fields.length) * 100)
    };
  }
}

export default new ProfessionalProfileService();