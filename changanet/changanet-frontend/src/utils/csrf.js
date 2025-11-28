/**
 * CSRF Protection utilities for Changánet
 * Implements double-submit cookie pattern for CSRF protection
 */

let csrfToken = null;

/**
 * Get CSRF token from server or cache
 */
export const getCsrfToken = async () => {
  // Return cached token if available
  if (csrfToken) {
    return csrfToken;
  }

  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (response.ok) {
      const data = await response.json();
      csrfToken = data.token;
      return csrfToken;
    } else {
      console.warn('Failed to get CSRF token:', response.status);
      return null;
    }
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return null;
  }
};

/**
 * Get headers with CSRF token for API requests
 */
export const getCsrfHeaders = async (additionalHeaders = {}) => {
  const token = await getCsrfToken();

  const headers = {
    ...additionalHeaders,
  };

  if (token) {
    headers['X-CSRF-Token'] = token;
  }

  return headers;
};

/**
 * Enhanced fetch with CSRF protection
 */
export const secureFetch = async (url, options = {}) => {
  const csrfHeaders = await getCsrfHeaders(options.headers);

  return fetch(url, {
    ...options,
    credentials: 'include', // Always include cookies
    headers: csrfHeaders,
  });
};

/**
 * Clear cached CSRF token (useful after logout)
 */
export const clearCsrfToken = () => {
  csrfToken = null;
};