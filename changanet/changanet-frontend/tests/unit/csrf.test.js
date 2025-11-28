/**
 * Pruebas unitarias para utilidades CSRF
 * Cubre: Obtención de tokens, headers, protección contra CSRF
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { getCsrfToken, getCsrfHeaders, secureFetch, clearCsrfToken } from '../../src/utils/csrf';

// Mock de fetch global
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('CSRF Utilities - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Limpiar token cacheado
    clearCsrfToken();
  });

  afterEach(() => {
    clearCsrfToken();
  });

  describe('getCsrfToken', () => {
    test('debe obtener token del servidor cuando no está cacheado', async () => {
      const mockToken = 'csrf-token-123';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });

      const token = await getCsrfToken();

      expect(global.fetch).toHaveBeenCalledWith('/api/csrf-token', {
        method: 'GET',
        credentials: 'include'
      });
      expect(token).toBe(mockToken);
    });

    test('debe retornar token cacheado en llamadas subsiguientes', async () => {
      const mockToken = 'cached-token-456';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });

      // Primera llamada
      const token1 = await getCsrfToken();
      expect(token1).toBe(mockToken);

      // Segunda llamada (debe usar cache)
      const token2 = await getCsrfToken();
      expect(token2).toBe(mockToken);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Solo una llamada a fetch
    });

    test('debe retornar null cuando falla la obtención del token', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const token = await getCsrfToken();

      expect(token).toBeNull();
    });

    test('debe manejar errores de red', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const token = await getCsrfToken();

      expect(token).toBeNull();
    });
  });

  describe('getCsrfHeaders', () => {
    test('debe incluir token CSRF en headers cuando está disponible', async () => {
      const mockToken = 'header-token-789';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });

      const headers = await getCsrfHeaders();

      expect(headers['X-CSRF-Token']).toBe(mockToken);
    });

    test('debe incluir headers adicionales proporcionados', async () => {
      const mockToken = 'additional-headers-token';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });

      const additionalHeaders = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123'
      };

      const headers = await getCsrfHeaders(additionalHeaders);

      expect(headers['X-CSRF-Token']).toBe(mockToken);
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('Bearer token123');
    });

    test('no debe incluir header CSRF cuando no hay token', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false
      });

      const headers = await getCsrfHeaders();

      expect(headers['X-CSRF-Token']).toBeUndefined();
    });
  });

  describe('secureFetch', () => {
    test('debe incluir credentials y headers CSRF en la petición', async () => {
      const mockToken = 'secure-fetch-token';
      const mockResponse = { ok: true, json: jest.fn().mockResolvedValue({ data: 'test' }) };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await secureFetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      expect(result).toBe(mockResponse);

      // Verificar primera llamada (obtener token CSRF)
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/csrf-token', {
        method: 'GET',
        credentials: 'include'
      });

      // Verificar segunda llamada (petición segura)
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': mockToken
        },
        body: JSON.stringify({ test: 'data' })
      });
    });

    test('debe funcionar sin headers adicionales', async () => {
      const mockToken = 'no-headers-token';
      const mockResponse = { ok: true };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await secureFetch('/api/simple');

      expect(result).toBe(mockResponse);
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/simple', {
        credentials: 'include',
        headers: { 'X-CSRF-Token': mockToken }
      });
    });

    test('debe manejar errores de obtención de token CSRF', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false
      });

      const mockResponse = { ok: true };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await secureFetch('/api/test');

      expect(result).toBe(mockResponse);
      // Debería continuar sin token CSRF
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/test', {
        credentials: 'include',
        headers: {} // Sin X-CSRF-Token
      });
    });
  });

  describe('clearCsrfToken', () => {
    test('debe limpiar el token cacheado', async () => {
      // Cachear un token
      const mockToken = 'token-to-clear';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });

      await getCsrfToken();
      expect(await getCsrfToken()).toBe(mockToken); // Cacheado

      // Limpiar cache
      clearCsrfToken();

      // Nueva llamada debería hacer fetch nuevamente
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: 'new-token' })
      });

      const newToken = await getCsrfToken();
      expect(newToken).toBe('new-token');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integración con double-submit pattern', () => {
    test('debe implementar patrón double-submit correctamente', async () => {
      const mockToken = 'double-submit-token';
      const mockResponse = { ok: true, data: 'success' };

      // Mock para obtener token
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });

      // Mock para petición segura
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await secureFetch('/api/secure-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensitive: 'data' })
      });

      expect(result).toBe(mockResponse);

      // Verificar que se envió el token tanto en cookie (credentials: include)
      // como en header (X-CSRF-Token)
      const secureCall = global.fetch.mock.calls[1];
      expect(secureCall[1].credentials).toBe('include');
      expect(secureCall[1].headers['X-CSRF-Token']).toBe(mockToken);
    });

    test('debe proteger contra CSRF attacks simulados', async () => {
      // Simular un ataque CSRF donde el atacante intenta hacer una petición
      // sin el token CSRF válido
      const mockResponse = { ok: false, status: 403 };

      global.fetch.mockResolvedValueOnce({
        ok: false // Token CSRF no disponible
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await secureFetch('/api/csrf-protected', {
        method: 'POST',
        body: JSON.stringify({ action: 'malicious' })
      });

      expect(result).toBe(mockResponse);
      // La petición se hace pero sin token CSRF, lo que debería ser rechazada por el servidor
    });
  });

  describe('Manejo de concurrencia', () => {
    test('debe manejar múltiples llamadas concurrentes correctamente', async () => {
      const mockToken = 'concurrent-token';

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken })
      });

      // Múltiples llamadas concurrentes
      const promises = [
        getCsrfToken(),
        getCsrfToken(),
        getCsrfToken()
      ];

      const results = await Promise.all(promises);

      // Todas deberían retornar el mismo token
      results.forEach(token => {
        expect(token).toBe(mockToken);
      });

      // Solo una llamada a fetch (cache funciona)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('debe ser thread-safe con clearCsrfToken', async () => {
      const mockToken1 = 'token-1';
      const mockToken2 = 'token-2';

      // Primera llamada
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken1 })
      });

      const token1 = await getCsrfToken();
      expect(token1).toBe(mockToken1);

      // Limpiar mientras otra llamada está en progreso
      clearCsrfToken();

      // Nueva llamada
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ token: mockToken2 })
      });

      const token2 = await getCsrfToken();
      expect(token2).toBe(mockToken2);
    });
  });
});