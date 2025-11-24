/**
 * ProfessionalProfileAPIService
 * Servicio actualizado para gestión de perfiles profesionales
 * 
 * Implementa comunicación correcta con backend para REQ-06 a REQ-10:
 * - REQ-06: Subir foto de perfil y portada
 * - REQ-07: Seleccionar especialidades múltiples
 * - REQ-08: Ingresar años de experiencia
 * - REQ-09: Definir zona de cobertura geográfica
 * - REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 */

class ProfessionalProfileAPIService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    this.token = localStorage.getItem('changanet_token');
  }

  /**
   * Configurar headers de autenticación
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Manejo de respuestas de API
   */
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * GET /api/professionals/me
   * Obtiene el perfil completo del profesional autenticado
   */
  async getMyProfile() {
    try {
      const response = await fetch(`${this.baseURL}/api/professionals/me`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      throw error;
    }
  }

  /**
   * PUT /api/professionals/me
   * Actualiza el perfil completo del profesional
   */
  async updateMyProfile(profileData, imageFiles = {}) {
    try {
      const formData = new FormData();

      // Agregar datos del perfil
      Object.keys(profileData).forEach(key => {
        if (profileData[key] !== null && profileData[key] !== undefined) {
          if (Array.isArray(profileData[key])) {
            formData.append(key, JSON.stringify(profileData[key]));
          } else {
            formData.append(key, profileData[key]);
          }
        }
      });

      // Agregar archivos de imagen
      if (imageFiles.profilePhoto) {
        formData.append('foto_perfil', imageFiles.profilePhoto);
      }
      if (imageFiles.bannerPhoto) {
        formData.append('foto_portada', imageFiles.bannerPhoto);
      }

      const response = await fetch(`${this.baseURL}/api/professionals/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`
          // No setear Content-Type para FormData, el browser lo maneja automáticamente
        },
        body: formData
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      throw error;
    }
  }

  /**
   * GET /api/specialties
   * Obtiene todas las especialidades disponibles
   */
  async getSpecialties(grouped = false) {
    try {
      const response = await fetch(`${this.baseURL}/api/specialties?grouped=${grouped}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result.specialties || [];
    } catch (error) {
      console.error('Error obteniendo especialidades:', error);
      throw error;
    }
  }

  /**
   * GET /api/specialties/search
   * Busca especialidades por término
   */
  async searchSpecialties(query, limit = 20) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/specialties/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const result = await this.handleResponse(response);
      return result.specialties || [];
    } catch (error) {
      console.error('Error buscando especialidades:', error);
      throw error;
    }
  }

  /**
   * POST /api/professionals/me/specialties
   * Actualiza las especialidades del profesional
   */
  async updateSpecialties(specialtyIds, primarySpecialtyIndex = 0) {
    try {
      const response = await fetch(`${this.baseURL}/api/professionals/me/specialties`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          specialtyIds,
          primarySpecialtyIndex
        })
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error actualizando especialidades:', error);
      throw error;
    }
  }

  /**
   * GET /api/zones
   * Obtiene todas las zonas de cobertura disponibles
   */
  async getCoverageZones(params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = `${this.baseURL}/api/zones${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result.zones || [];
    } catch (error) {
      console.error('Error obteniendo zonas de cobertura:', error);
      throw error;
    }
  }

  /**
   * PUT /api/professionals/me/coverage-zone
   * Actualiza la zona de cobertura del profesional
   */
  async updateCoverageZone(zoneData) {
    try {
      const response = await fetch(`${this.baseURL}/api/professionals/me/coverage-zone`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(zoneData)
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error actualizando zona de cobertura:', error);
      throw error;
    }
  }

  /**
   * GET /api/rate-types
   * Obtiene los tipos de tarifa disponibles
   */
  async getRateTypes() {
    try {
      const response = await fetch(`${this.baseURL}/api/rate-types`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result.rateTypes || [];
    } catch (error) {
      console.error('Error obteniendo tipos de tarifa:', error);
      throw error;
    }
  }

  /**
   * GET /api/rate-ranges
   * Obtiene los rangos de tarifas por categoría
   */
  async getRateRanges() {
    try {
      const response = await fetch(`${this.baseURL}/api/rate-ranges`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result.rateRanges || {};
    } catch (error) {
      console.error('Error obteniendo rangos de tarifas:', error);
      throw error;
    }
  }

  /**
   * PUT /api/professionals/me/rates
   * Actualiza las tarifas del profesional
   */
  async updateRates(rateData) {
    try {
      const response = await fetch(`${this.baseURL}/api/professionals/me/rates`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(rateData)
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error actualizando tarifas:', error);
      throw error;
    }
  }

  /**
   * POST /api/professionals/me/rates/suggest
   * Obtiene tarifas sugeridas
   */
  async getSuggestedRates(experienceYears, specialty) {
    try {
      const response = await fetch(`${this.baseURL}/api/professionals/me/rates/suggest`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          experienceYears,
          specialty
        })
      });

      const result = await this.handleResponse(response);
      return result.suggestions || [];
    } catch (error) {
      console.error('Error obteniendo tarifas sugeridas:', error);
      throw error;
    }
  }

  /**
   * GET /api/professionals/me/completion
   * Obtiene el score de completitud del perfil
   */
  async getProfileCompletion() {
    try {
      const response = await fetch(`${this.baseURL}/api/professionals/me/completion`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result.completion || { score: 0 };
    } catch (error) {
      console.error('Error obteniendo completitud del perfil:', error);
      throw error;
    }
  }

  /**
   * GET /api/professionals/me/statistics
   * Obtiene estadísticas del perfil
   */
  async getProfileStatistics() {
    try {
      const response = await fetch(`${this.baseURL}/api/professionals/me/statistics`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result.statistics || {};
    } catch (error) {
      console.error('Error obteniendo estadísticas del perfil:', error);
      throw error;
    }
  }

  /**
   * Validar archivo de imagen antes de subir
   */
  validateImageFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!file) {
      throw new Error('No se proporcionó archivo');
    }

    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande. Máximo 5MB permitido.');
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no válido. Use JPEG, PNG o WebP.');
    }

    return true;
  }

  /**
   * Subir imagen individual con validación
   */
  async uploadImage(file, type = 'profile') {
    try {
      this.validateImageFile(file, type);

      const formData = new FormData();
      formData.append('foto', file);

      const response = await fetch(`${this.baseURL}/api/professionals/me/validate-photo`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        body: formData
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error validando imagen:', error);
      throw error;
    }
  }

  /**
   * Calcular score de completitud del perfil en frontend
   */
  calculateCompletionScore(profile) {
    const requiredFields = [
      'url_foto_perfil',
      'especialidades',
      'anos_experiencia',
      'zona_cobertura',
      'tipo_tarifa',
      'tarifa_hora',
      'descripcion'
    ];

    const optionalFields = [
      'url_foto_portada',
      'tarifa_servicio',
      'tarifa_convenio'
    ];

    let filledRequired = 0;
    let filledOptional = 0;

    requiredFields.forEach(field => {
      const value = profile[field];
      if (value && (Array.isArray(value) ? value.length > 0 : value.toString().trim() !== '')) {
        filledRequired++;
      }
    });

    optionalFields.forEach(field => {
      const value = profile[field];
      if (value && (Array.isArray(value) ? value.length > 0 : value.toString().trim() !== '')) {
        filledOptional++;
      }
    });

    const requiredScore = (filledRequired / requiredFields.length) * 70; // 70% weight
    const optionalScore = (filledOptional / optionalFields.length) * 30; // 30% weight
    const totalScore = Math.round(requiredScore + optionalScore);

    return {
      score: totalScore,
      required: {
        filled: filledRequired,
        total: requiredFields.length,
        percentage: Math.round((filledRequired / requiredFields.length) * 100)
      },
      optional: {
        filled: filledOptional,
        total: optionalFields.length,
        percentage: Math.round((filledOptional / optionalFields.length) * 100)
      },
      missingFields: requiredFields.filter(field => {
        const value = profile[field];
        return !value || (Array.isArray(value) ? value.length === 0 : value.toString().trim() === '');
      })
    };
  }

  /**
   * Formatear datos del perfil para envío
   */
  formatProfileData(rawProfile) {
    return {
      nombre: rawProfile.nombre,
      email: rawProfile.email,
      telefono: rawProfile.telefono,
      especialidad: rawProfile.especialidad,
      specialtyIds: rawProfile.especialidades?.map(s => s.id) || [],
      anos_experiencia: rawProfile.anos_experiencia,
      zona_cobertura: rawProfile.zona_cobertura,
      latitud: rawProfile.latitud,
      longitud: rawProfile.longitud,
      coverage_zone_id: rawProfile.coverage_zone?.id,
      tipo_tarifa: rawProfile.tipo_tarifa,
      tarifa_hora: rawProfile.tarifa_hora,
      tarifa_servicio: rawProfile.tarifa_servicio,
      tarifa_convenio: rawProfile.tarifa_convenio,
      descripcion: rawProfile.descripcion,
      esta_disponible: rawProfile.esta_disponible
    };
  }
}

export const professionalProfileAPI = new ProfessionalProfileAPIService();
export default professionalProfileAPI;