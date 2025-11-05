/**
 * Servicio de API para el frontend de Changánet
 * Maneja todas las llamadas HTTP al backend con retry logic y manejo de errores
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';

/**
 * Headers de seguridad para todas las peticiones
 */
const getSecurityHeaders = () => ({
  'X-Requested-With': 'XMLHttpRequest',
  'X-Client-Version': '1.0.0',
  'X-Client-Type': 'web',
});

/**
 * Configuración de reintentos para llamadas API
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 segundo
  maxDelay: 10000, // 10 segundos
  backoffFactor: 2
};

/**
 * Calcula el delay para el siguiente reintento usando backoff exponencial
 */
function calculateRetryDelay(attempt) {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

/**
 * Determina si un error es reintentable
 */
function isRetryableError(error) {
  // Reintentar en errores de red, timeouts, y errores del servidor (5xx)
  if (!error.response) return true; // Error de red
  const status = error.response.status;
  return status >= 500 || status === 408 || status === 429;
}

/**
 * Función principal para hacer llamadas API con retry logic
 */
async function apiRequest(url, options = {}, retryCount = 0) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Si la respuesta es exitosa, retornarla
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return response;
    }

    // Si es un error 401 (no autorizado), redirigir al login
    if (response.status === 401) {
      console.warn('🔐 Token expirado o inválido, redirigiendo al login');
      localStorage.removeItem('changanet_token');
      localStorage.removeItem('changanet_user');
      window.location.href = '/';
      throw new Error('Sesión expirada');
    }

    // Si es un error 403 (prohibido), mostrar mensaje específico
    if (response.status === 403) {
      throw new Error('No tienes permisos para realizar esta acción');
    }

    // Para otros errores, intentar reintento si es apropiado
    if (isRetryableError({ response }) && retryCount < RETRY_CONFIG.maxRetries) {
      const delay = calculateRetryDelay(retryCount);
      console.warn(`⚠️ Reintentando solicitud en ${delay}ms (intento ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return apiRequest(url, options, retryCount + 1);
    }

    // Si no se puede reintentar, lanzar error
    const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);

  } catch (error) {
    // Manejar errores de red y timeouts
    if (error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado tiempo. Verifica tu conexión a internet.');
    }

    if (!error.response && retryCount < RETRY_CONFIG.maxRetries) {
      const delay = calculateRetryDelay(retryCount);
      console.warn(`🌐 Error de conexión, reintentando en ${delay}ms (intento ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return apiRequest(url, options, retryCount + 1);
    }

    // Si es el último intento o error no reintentable, lanzar el error
    throw error;
  }
}

/**
 * Métodos HTTP convenientes
 */
export const api = {
  get: (url, options = {}) => apiRequest(url, { ...options, method: 'GET' }),
  post: (url, data, options = {}) => apiRequest(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  }),
  put: (url, data, options = {}) => apiRequest(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (url, options = {}) => apiRequest(url, { ...options, method: 'DELETE' }),
  patch: (url, data, options = {}) => apiRequest(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data)
  })
};

/**
 * Funciones específicas para Changánet
 */

// Autenticación
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  registerProfessional: (userData) => api.post('/api/auth/register-professional', userData),
  logout: () => api.post('/api/auth/logout'),
  refreshToken: () => api.post('/api/auth/refresh'),
  getProfile: () => api.get('/api/profile'),
  updateProfile: (data) => api.put('/api/profile', data)
};

// Servicios
export const servicesAPI = {
  getAll: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return api.get(`/api/services?${queryString}`);
  },
  getById: (id) => api.get(`/api/services/${id}`),
  create: (serviceData) => api.post('/api/services', serviceData),
  update: (id, serviceData) => api.put(`/api/services/${id}`, serviceData),
  delete: (id) => api.delete(`/api/services/${id}`)
};

// Profesionales
export const professionalsAPI = {
  search: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    return api.get(`/api/professionals?${queryString}`);
  },
  getById: (id) => api.get(`/api/professionals/${id}`),
  getReviews: (id) => api.get(`/api/professionals/${id}/reviews`)
};

// Cotizaciones
export const quotesAPI = {
  create: (quoteData) => api.post('/api/quotes', quoteData),
  getMyQuotes: () => api.get('/api/quotes'),
  getById: (id) => api.get(`/api/quotes/${id}`),
  update: (id, data) => api.put(`/api/quotes/${id}`, data),
  accept: (id) => api.post(`/api/quotes/${id}/accept`),
  reject: (id, reason) => api.post(`/api/quotes/${id}/reject`, { reason })
};

// Mensajes
export const messagesAPI = {
  getConversation: (userId) => api.get(`/api/messages?with=${userId}`),
  sendMessage: (messageData) => api.post('/api/messages', messageData),
  markAsRead: (senderId) => api.put(`/api/messages/mark-read`, { senderId })
};

// Notificaciones
export const notificationsAPI = {
  getAll: () => api.get('/api/notifications'),
  markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.put('/api/notifications/mark-all-read'),
  delete: (id) => api.delete(`/api/notifications/${id}`)
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
  status: () => api.get('/api/status')
};

export default api;