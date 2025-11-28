/**
 * Servicio de API específico para operaciones administrativas
 * Maneja llamadas seguras al backend con gestión avanzada de tokens y permisos
 */

import { API_BASE_URL } from '../config/api.js';

/**
 * Headers de seguridad adicionales para operaciones admin
 */
const getAdminSecurityHeaders = () => ({
  'X-Requested-With': 'XMLHttpRequest',
  'X-Client-Version': '1.0.0',
  'X-Client-Type': 'admin-web',
  'X-Admin-Operation': 'true',
});

/**
 * Configuración de reintentos para operaciones admin (más agresiva)
 */
const ADMIN_RETRY_CONFIG = {
  maxRetries: 2,
  baseDelay: 500, // 0.5 segundos
  maxDelay: 5000, // 5 segundos
  backoffFactor: 1.5
};

/**
 * Verifica si el usuario tiene permisos de admin válidos
 */
function validateAdminPermissions() {
  const token = localStorage.getItem('changanet_token');
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;

    if (payload.exp < currentTime) {
      throw new Error('Token expirado');
    }

    if (payload.role !== 'admin') {
      throw new Error('Permisos insuficientes');
    }

    return true;
  } catch (error) {
    console.error('Error validando permisos admin:', error);
    throw new Error('Sesión de administrador inválida');
  }
}

/**
 * Calcula el delay para reintentos admin
 */
function calculateAdminRetryDelay(attempt) {
  const delay = ADMIN_RETRY_CONFIG.baseDelay * Math.pow(ADMIN_RETRY_CONFIG.backoffFactor, attempt);
  return Math.min(delay, ADMIN_RETRY_CONFIG.maxDelay);
}

/**
 * Clase de error específica para operaciones admin
 */
export class AdminAPIError extends Error {
  constructor(message, status, code, data = null) {
    super(message);
    this.name = 'AdminAPIError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * Función principal para llamadas API admin con validación de permisos
 */
async function adminApiRequest(url, options = {}, retryCount = 0) {
  // Validar permisos antes de cada llamada
  validateAdminPermissions();

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 segundos timeout para admin

    // Obtener token fresco
    const token = localStorage.getItem('changanet_token');

    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...getAdminSecurityHeaders(),
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Manejar respuestas exitosas
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = response;
      }

      return data;
    }

    // Manejar errores específicos de admin
    if (response.status === 401) {
      console.warn('🔐 Token admin expirado o inválido');
      localStorage.removeItem('changanet_token');
      localStorage.removeItem('changanet_user');
      window.location.href = '/admin/login';
      throw new AdminAPIError('Sesión de administrador expirada', 401, 'SESSION_EXPIRED');
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({ message: 'Permisos insuficientes' }));
      throw new AdminAPIError(errorData.message || 'No tienes permisos para esta operación', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    if (response.status === 423) { // Locked - usuario bloqueado
      throw new AdminAPIError('Usuario bloqueado por medidas de seguridad', 423, 'USER_LOCKED');
    }

    // Reintentar para errores reintentables
    const isRetryable = response.status >= 500 || response.status === 408 || response.status === 429;
    if (isRetryable && retryCount < ADMIN_RETRY_CONFIG.maxRetries) {
      const delay = calculateAdminRetryDelay(retryCount);
      console.warn(`⚠️ Reintentando operación admin en ${delay}ms (intento ${retryCount + 1}/${ADMIN_RETRY_CONFIG.maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return adminApiRequest(url, options, retryCount + 1);
    }

    // Error final
    const errorData = await response.json().catch(() => ({ message: 'Error desconocido en operación admin' }));
    throw new AdminAPIError(
      errorData.message || `Error ${response.status}: ${response.statusText}`,
      response.status,
      'API_ERROR',
      errorData
    );

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AdminAPIError('Operación admin tardó demasiado tiempo', 408, 'TIMEOUT');
    }

    if (error instanceof AdminAPIError) {
      throw error;
    }

    // Error de red - reintentar si corresponde
    if (!error.response && retryCount < ADMIN_RETRY_CONFIG.maxRetries) {
      const delay = calculateAdminRetryDelay(retryCount);
      console.warn(`🌐 Error de conexión en operación admin, reintentando en ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return adminApiRequest(url, options, retryCount + 1);
    }

    throw new AdminAPIError(error.message || 'Error de conexión en operación administrativa', 0, 'NETWORK_ERROR');
  }
}

/**
 * Métodos HTTP convenientes para operaciones admin
 */
export const adminApi = {
  get: (url, options = {}) => adminApiRequest(url, { ...options, method: 'GET' }),
  post: (url, data, options = {}) => adminApiRequest(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  }),
  put: (url, data, options = {}) => adminApiRequest(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (url, options = {}) => adminApiRequest(url, { ...options, method: 'DELETE' }),
  patch: (url, data, options = {}) => adminApiRequest(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data)
  })
};

/**
 * APIs específicas para operaciones administrativas
 */

// Dashboard y estadísticas
export const adminStatsAPI = {
  getOverview: () => adminApi.get('/api/admin/stats'),
  getDetailedStats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return adminApi.get(`/api/admin/stats/detailed?${queryString}`);
  }
};

// Gestión de usuarios
export const adminUsersAPI = {
  getAll: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/users?${queryString}`);
  },
  getById: (userId) => adminApi.get(`/api/admin/users/${userId}`),
  updateRole: (userId, newRole) => adminApi.put(`/api/admin/users/${userId}/role`, { newRole }),
  blockUser: (userId, reason = '') => adminApi.put(`/api/admin/users/${userId}/block`, {
    blocked: true,
    reason
  }),
  unblockUser: (userId) => adminApi.put(`/api/admin/users/${userId}/block`, {
    blocked: false
  }),
  deleteUser: (userId, reason = '') => adminApi.delete(`/api/admin/users/${userId}`, {
    body: JSON.stringify({ reason })
  }),
  resetPassword: (userId) => adminApi.post(`/api/admin/users/${userId}/reset-password`),
  impersonateUser: (userId) => adminApi.post(`/api/admin/users/${userId}/impersonate`)
};

// Gestión de servicios
export const adminServicesAPI = {
  getAll: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/services?${queryString}`);
  },
  getById: (serviceId) => adminApi.get(`/api/admin/services/${serviceId}`),
  updateStatus: (serviceId, status, notes = '') => adminApi.put(`/api/admin/services/${serviceId}/status`, {
    status,
    notes
  }),
  cancelService: (serviceId, reason = '') => adminApi.put(`/api/admin/services/${serviceId}/cancel`, {
    reason
  }),
  refundService: (serviceId, amount, reason = '') => adminApi.post(`/api/admin/services/${serviceId}/refund`, {
    amount,
    reason
  })
};

// Gestión de pagos y comisiones
export const adminPaymentsAPI = {
  getTransactions: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/payments?${queryString}`);
  },
  getTransactionById: (transactionId) => adminApi.get(`/api/admin/payments/${transactionId}`),
  getCommissionSettings: () => adminApi.get('/api/admin/commissions/active'),
  updateCommissionSettings: (settings) => adminApi.put('/api/admin/commissions/update', settings),
  getCommissionHistory: () => adminApi.get('/api/admin/commissions/history'),
  processWithdrawal: (withdrawalId) => adminApi.post(`/api/admin/withdrawals/${withdrawalId}/process`),
  rejectWithdrawal: (withdrawalId, reason = '') => adminApi.put(`/api/admin/withdrawals/${withdrawalId}/reject`, {
    reason
  }),
  refundPayment: (paymentId, amount, reason = '') => adminApi.post(`/api/admin/payments/${paymentId}/refund`, {
    amount,
    reason
  })
};

// Gestión de verificaciones
export const adminVerificationAPI = {
  getPending: () => adminApi.get('/api/admin/verifications/pending'),
  getById: (requestId) => adminApi.get(`/api/admin/verifications/${requestId}`),
  approveVerification: (requestId, notes = '') => adminApi.post(`/api/admin/verifications/${requestId}/approve`, {
    notes
  }),
  rejectVerification: (requestId, reason = '') => adminApi.post(`/api/admin/verifications/${requestId}/reject`, {
    reason
  }),
  getVerificationStats: () => adminApi.get('/api/admin/verifications/stats')
};

// Gestión de categorías
export const adminCategoriesAPI = {
  getAll: () => adminApi.get('/api/admin/categories'),
  createCategory: (categoryData) => adminApi.post('/api/admin/categories', categoryData),
  updateCategory: (categoryId, categoryData) => adminApi.put(`/api/admin/categories/${categoryId}`, categoryData),
  deleteCategory: (categoryId) => adminApi.delete(`/api/admin/categories/${categoryId}`),
  reorderCategories: (categoryOrder) => adminApi.put('/api/admin/categories/reorder', {
    order: categoryOrder
  })
};

// Gestión de contenido y moderación
export const adminContentAPI = {
  getReports: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/moderation/reports?${queryString}`);
  },
  resolveReport: (reportId, action, notes = '') => adminApi.put(`/api/admin/moderation/reports/${reportId}/resolve`, {
    action,
    notes
  }),
  getContentStats: () => adminApi.get('/api/admin/content/stats'),
  updateContentSettings: (settings) => adminApi.put('/api/admin/content/settings', settings)
};

// Gestión de disputas
export const adminDisputesAPI = {
  getAll: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/disputes?${queryString}`);
  },
  getById: (disputeId) => adminApi.get(`/api/admin/disputes/${disputeId}`),
  resolveDispute: (disputeId, resolution) => adminApi.put(`/api/admin/disputes/${disputeId}/resolve`, resolution),
  escalateDispute: (disputeId, reason = '') => adminApi.put(`/api/admin/disputes/${disputeId}/escalate`, {
    reason
  })
};

// Auditoría y logs
export const adminAuditAPI = {
  getLogs: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/audit/logs?${queryString}`);
  },
  getAuditStats: () => adminApi.get('/api/admin/audit/stats'),
  exportLogs: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/audit/export?${queryString}`);
  }
};

// Configuración del sistema
export const adminSystemAPI = {
  getSettings: () => adminApi.get('/api/admin/system/settings'),
  updateSettings: (settings) => adminApi.put('/api/admin/system/settings', settings),
  getHealthStatus: () => adminApi.get('/api/admin/system/health'),
  clearCache: () => adminApi.post('/api/admin/system/cache/clear'),
  restartService: (serviceName) => adminApi.post(`/api/admin/system/services/${serviceName}/restart`),
  getLogs: (serviceName, filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/system/logs/${serviceName}?${queryString}`);
  }
};

// Servicios urgentes
export const adminUrgentAPI = {
  getAll: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return adminApi.get(`/api/admin/urgent?${queryString}`);
  },
  getById: (urgentId) => adminApi.get(`/api/admin/urgent/${urgentId}`),
  updateStatus: (urgentId, status, notes = '') => adminApi.put(`/api/admin/urgent/${urgentId}/status`, {
    status,
    notes
  }),
  assignProfessional: (urgentId, professionalId) => adminApi.put(`/api/admin/urgent/${urgentId}/assign`, {
    professionalId
  }),
  getUrgentStats: () => adminApi.get('/api/admin/urgent/stats')
};

// Validación de sesión admin
export const adminSessionAPI = {
  validateSession: () => adminApi.get('/api/admin/validate-session'),
  refreshSession: () => adminApi.post('/api/admin/refresh-session'),
  logout: () => adminApi.post('/api/admin/logout')
};

export default adminApi;