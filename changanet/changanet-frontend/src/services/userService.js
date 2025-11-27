/**
 * UserService
 * Servicio frontend para operaciones generales de usuario
 *
 * Maneja operaciones CRUD de usuarios, gestión de perfiles,
 * cambio de contraseñas y configuración de notificaciones
 */

class UserService {
  constructor() {
    this.baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
    this.token = localStorage.getItem('changanet_token');
  }

  /**
   * Configurar headers de autenticación
   */
  getAuthHeaders(contentType = 'application/json') {
    const headers = {
      'Authorization': `Bearer ${this.token}`
    };

    if (contentType !== 'multipart/form-data') {
      headers['Content-Type'] = contentType;
    }

    return headers;
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
   * Actualizar token de autenticación
   */
  updateToken(newToken) {
    this.token = newToken;
    localStorage.setItem('changanet_token', newToken);
  }

  /**
   * GET /api/profile
   * Obtiene el perfil completo del usuario autenticado
   */
  async getMyProfile() {
    try {
      const response = await fetch(`${this.baseURL}/api/profile`, {
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
   * PUT /api/profile
   * Actualiza el perfil del usuario autenticado
   */
  async updateMyProfile(profileData, profilePhoto = null) {
    try {
      let body;
      let headers = this.getAuthHeaders();

      if (profilePhoto) {
        // Si hay foto, usar FormData
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

        // Agregar foto de perfil
        formData.append('foto', profilePhoto);

        body = formData;
        headers = this.getAuthHeaders('multipart/form-data');
      } else {
        // Datos JSON normales
        body = JSON.stringify(profileData);
      }

      const response = await fetch(`${this.baseURL}/api/profile`, {
        method: 'PUT',
        headers,
        body
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      throw error;
    }
  }

  /**
   * POST /api/auth/change-password
   * Cambia la contraseña del usuario
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/change-password`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      throw error;
    }
  }

  /**
   * PUT /api/users/fcm-token
   * Actualiza el token FCM para notificaciones push
   */
  async updateFCMToken(fcmToken) {
    try {
      const response = await fetch(`${this.baseURL}/api/users/fcm-token`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ fcmToken })
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error actualizando token FCM:', error);
      throw error;
    }
  }

  /**
   * PUT /api/users/preferences
   * Actualiza las preferencias del usuario
   */
  async updatePreferences(preferences) {
    try {
      const response = await fetch(`${this.baseURL}/api/users/preferences`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ preferences })
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error actualizando preferencias:', error);
      throw error;
    }
  }

  /**
   * PUT /api/users/notifications
   * Actualiza la configuración de notificaciones
   */
  async updateNotificationSettings(notificationSettings) {
    try {
      const response = await fetch(`${this.baseURL}/api/users/notifications`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ notificationSettings })
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error actualizando configuración de notificaciones:', error);
      throw error;
    }
  }

  /**
   * DELETE /api/users/account
   * Solicita eliminación de cuenta (soft delete)
   */
  async requestAccountDeletion(reason = '') {
    try {
      const response = await fetch(`${this.baseURL}/api/users/account`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reason })
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error solicitando eliminación de cuenta:', error);
      throw error;
    }
  }

  /**
   * GET /api/users/stats
   * Obtiene estadísticas del usuario (solo para admins)
   */
  async getUserStats() {
    try {
      const response = await fetch(`${this.baseURL}/api/users/stats`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error obteniendo estadísticas de usuario:', error);
      throw error;
    }
  }

  /**
   * POST /api/users/verify-email
   * Envía email de verificación
   */
  async requestEmailVerification() {
    try {
      const response = await fetch(`${this.baseURL}/api/users/verify-email`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error solicitando verificación de email:', error);
      throw error;
    }
  }

  /**
   * POST /api/users/reset-password
   * Solicita reset de contraseña
   */
  async requestPasswordReset(email) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await this.handleResponse(response);
      return result;
    } catch (error) {
      console.error('Error solicitando reset de contraseña:', error);
      throw error;
    }
  }

  /**
   * Validar formato de email
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validar fortaleza de contraseña
   */
  validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];

    if (password.length < minLength) {
      errors.push(`Mínimo ${minLength} caracteres`);
    }
    if (!hasUpperCase) {
      errors.push('Al menos una mayúscula');
    }
    if (!hasLowerCase) {
      errors.push('Al menos una minúscula');
    }
    if (!hasNumbers) {
      errors.push('Al menos un número');
    }
    if (!hasSpecialChar) {
      errors.push('Al menos un carácter especial');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: errors.length === 0 ? 'strong' :
               errors.length <= 2 ? 'medium' : 'weak'
    };
  }

  /**
   * Validar datos de perfil antes de envío
   */
  validateProfileData(profileData) {
    const errors = [];

    if (profileData.nombre && profileData.nombre.trim().length < 2) {
      errors.push('El nombre debe tener al menos 2 caracteres');
    }

    if (profileData.email && !this.validateEmail(profileData.email)) {
      errors.push('Email inválido');
    }

    if (profileData.telefono && profileData.telefono.trim().length < 8) {
      errors.push('Teléfono inválido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Formatear datos de perfil para envío
   */
  formatProfileData(rawData) {
    return {
      nombre: rawData.nombre?.trim(),
      email: rawData.email?.trim().toLowerCase(),
      telefono: rawData.telefono?.trim(),
      direccion: rawData.direccion?.trim(),
      preferencias_servicio: rawData.preferencias_servicio,
      notificaciones_push: Boolean(rawData.notificaciones_push),
      notificaciones_email: Boolean(rawData.notificaciones_email),
      notificaciones_sms: Boolean(rawData.notificaciones_sms),
      notificaciones_servicios: Boolean(rawData.notificaciones_servicios),
      notificaciones_mensajes: Boolean(rawData.notificaciones_mensajes),
      notificaciones_pagos: Boolean(rawData.notificaciones_pagos),
      notificaciones_marketing: Boolean(rawData.notificaciones_marketing),
      sms_enabled: Boolean(rawData.sms_enabled)
    };
  }
}

export const userService = new UserService();
export default userService;