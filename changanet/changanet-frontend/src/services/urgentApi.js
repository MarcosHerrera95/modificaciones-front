/**
 * @file urgentApi.js - API service for urgent services
 * @description Centralized API calls for urgent request management
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

// Helper function to get auth token
const getAuthToken = () => localStorage.getItem('changanet_token');

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// ==================================================
// CLIENT ENDPOINTS
// ==================================================

/**
 * Create a new urgent request
 * @param {Object} requestData - Request data
 * @param {string} requestData.description - Problem description
 * @param {Object} requestData.location - Location coordinates {lat, lng}
 * @param {number} requestData.radiusKm - Search radius in km
 * @param {string} requestData.serviceCategory - Service category
 * @param {Array} requestData.photos - Array of photo files (optional)
 * @returns {Promise<Object>} Created request data
 */
export const createUrgentRequest = async (requestData) => {
  const formData = new FormData();

  // Add basic data
  formData.append('description', requestData.description);
  formData.append('location', JSON.stringify(requestData.location));
  formData.append('radiusKm', requestData.radiusKm);
  if (requestData.serviceCategory) {
    formData.append('serviceCategory', requestData.serviceCategory);
  }

  // Add photos if provided
  if (requestData.photos && requestData.photos.length > 0) {
    requestData.photos.forEach((photo) => {
      formData.append(`photos`, photo);
    });
  }

  return apiCall('/api/urgent-requests', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
      // Don't set Content-Type for FormData
    },
    body: formData
  });
};

/**
 * Get urgent request status
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} Request status data
 */
export const getUrgentRequestStatus = async (requestId) => {
  return apiCall(`/api/urgent-requests/${requestId}/status`);
};

/**
 * Cancel urgent request
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelUrgentRequest = async (requestId) => {
  return apiCall(`/api/urgent-requests/${requestId}/cancel`, {
    method: 'POST'
  });
};

/**
 * Get user's urgent requests
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of user's urgent requests
 */
export const getUserUrgentRequests = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters);
  return apiCall(`/api/urgent-requests?${queryParams}`);
};

// ==================================================
// PROFESSIONAL ENDPOINTS
// ==================================================

/**
 * Get nearby urgent requests for professionals
 * @param {Object} location - Location coordinates {lat, lng}
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Nearby urgent requests
 */
export const getNearbyUrgentRequests = async (location, filters = {}) => {
  const queryParams = new URLSearchParams({
    lat: location.lat,
    lng: location.lng,
    ...filters
  });
  return apiCall(`/api/urgent/nearby?${queryParams}`);
};

/**
 * Accept urgent request
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} Acceptance result
 */
export const acceptUrgentRequest = async (requestId) => {
  return apiCall(`/api/urgent/${requestId}/accept`, {
    method: 'POST'
  });
};

/**
 * Reject urgent request
 * @param {string} requestId - Request ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejection result
 */
export const rejectUrgentRequest = async (requestId, reason = '') => {
  return apiCall(`/api/urgent/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

// ==================================================
// ADMIN ENDPOINTS
// ==================================================

/**
 * Get urgent pricing rules
 * @returns {Promise<Array>} Pricing rules
 */
export const getUrgentPricingRules = async () => {
  return apiCall('/api/urgent/pricing');
};

/**
 * Update urgent pricing rules
 * @param {Array} rules - New pricing rules
 * @returns {Promise<Object>} Update result
 */
export const updateUrgentPricingRules = async (rules) => {
  return apiCall('/api/urgent/pricing/update', {
    method: 'POST',
    body: JSON.stringify({ rules })
  });
};

/**
 * Get matching statistics
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Statistics data
 */
export const getMatchingStats = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters);
  return apiCall(`/api/matching/stats?${queryParams}`);
};

/**
 * Get geospatial statistics
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Geospatial stats
 */
export const getGeospatialStats = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters);
  return apiCall(`/api/matching/geostats?${queryParams}`);
};

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

/**
 * Validate urgent request data
 * @param {Object} data - Request data to validate
 * @returns {Object} Validation result {isValid, errors}
 */
export const validateUrgentRequest = (data) => {
  const errors = [];

  if (!data.description || data.description.trim().length < 10) {
    errors.push('La descripción debe tener al menos 10 caracteres');
  }

  if (!data.location || !data.location.lat || !data.location.lng) {
    errors.push('La ubicación es requerida');
  }

  if (!data.radiusKm || data.radiusKm < 1 || data.radiusKm > 50) {
    errors.push('El radio debe estar entre 1 y 50 km');
  }

  if (data.photos && data.photos.length > 5) {
    errors.push('Máximo 5 fotos permitidas');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Calculate estimated price for urgent request
 * @param {string} serviceCategory - Service category
 * @param {number} radiusKm - Search radius
 * @returns {Promise<number>} Estimated price
 */
export const calculateUrgentPrice = async (serviceCategory, radiusKm) => {
  try {
    const rules = await getUrgentPricingRules();
    const rule = rules.find(r => r.service_category === serviceCategory);

    if (!rule) return null;

    // Simple calculation based on radius and base multiplier
    const radiusMultiplier = Math.max(1, radiusKm / 5);
    return Math.round(rule.min_price * rule.base_multiplier * radiusMultiplier);
  } catch (error) {
    console.error('Error calculating urgent price:', error);
    return null;
  }
};

/**
 * Check for duplicate requests
 * @param {Object} location - Location coordinates
 * @param {string} description - Problem description
 * @returns {Promise<boolean>} True if duplicate found
 */
export const checkForDuplicates = async (location, description) => {
  try {
    // TODO: Implement backend endpoint to check for similar recent requests
    // For now, return false (no duplicate prevention implemented yet)
    console.log('Checking for duplicates:', { location, description });
    return false;
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return false;
  }
};

export default {
  createUrgentRequest,
  getUrgentRequestStatus,
  cancelUrgentRequest,
  getUserUrgentRequests,
  getNearbyUrgentRequests,
  acceptUrgentRequest,
  rejectUrgentRequest,
  getUrgentPricingRules,
  updateUrgentPricingRules,
  getMatchingStats,
  getGeospatialStats,
  validateUrgentRequest,
  calculateUrgentPrice,
  checkForDuplicates
};