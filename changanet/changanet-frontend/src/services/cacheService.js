/**
 * Servicio de Caché Frontend para Changánet
 * Implementa caché multinivel optimizado para el navegador
 *
 * Niveles de caché:
 * 1. Memory (ultra rápido, temporal, por sesión)
 * 2. localStorage (persistente, limitado, por usuario)
 * 3. sessionStorage (persistente, limitado, por pestaña)
 *
 * Características:
 * - TTL automático con limpieza
 * - Compresión para datos grandes
 * - Sincronización entre pestañas
 * - Fallback automático
 */

// Configuraciones de TTL por tipo de contenido
const CACHE_TTL = {
  search_results: 300000,    // 5 minutos
  suggestions: 180000,       // 3 minutos
  user_preferences: 3600000, // 1 hora
  static_data: 86400000      // 24 horas
};

// Prefijo para evitar conflictos
const CACHE_PREFIX = 'changanet_cache_';

// Clase principal del servicio de caché
class FrontendCacheService {
  constructor() {
    this.memoryCache = new Map();
    this.isLocalStorageAvailable = this.checkLocalStorage();
    this.isSessionStorageAvailable = this.checkSessionStorage();

    // Limpiar caché expirado al inicializar
    this.cleanupExpiredCache();

    // Escuchar cambios en otras pestañas
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent.bind(this));
    }
  }

  /**
   * Verificar disponibilidad de localStorage
   */
  checkLocalStorage() {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verificar disponibilidad de sessionStorage
   */
  checkSessionStorage() {
    try {
      const test = '__sessionStorage_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Manejar eventos de storage de otras pestañas
   */
  handleStorageEvent(event) {
    if (event.key && event.key.startsWith(CACHE_PREFIX)) {
      // Invalidar memoria cache cuando otra pestaña actualiza
      const key = event.key.replace(CACHE_PREFIX, '');
      this.memoryCache.delete(key);
    }
  }

  /**
   * Generar clave de caché completa
   */
  getCacheKey(key, type = 'search_results') {
    return `${CACHE_PREFIX}${type}_${key}`;
  }

  /**
   * Comprimir datos si son grandes
   */
  compressData(data) {
    // Para datos muy grandes, podríamos implementar compresión
    // Por ahora, solo serializamos
    return JSON.stringify(data);
  }

  /**
   * Descomprimir datos
   */
  decompressData(data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Obtener datos desde caché multinivel
   */
  get(key, type = 'search_results') {
    const cacheKey = this.getCacheKey(key, type);
    const now = Date.now();

    // Nivel 1: Memory cache (más rápido)
    const memoryData = this.memoryCache.get(cacheKey);
    if (memoryData && memoryData.expires > now) {
      return memoryData.data;
    }

    // Nivel 2: localStorage (persistente)
    if (this.isLocalStorageAvailable) {
      try {
        const localData = localStorage.getItem(cacheKey);
        if (localData) {
          const parsed = this.decompressData(localData);
          if (parsed && parsed.expires > now) {
            // Migrar a memory cache
            this.memoryCache.set(cacheKey, parsed);
            return parsed.data;
          } else {
            // Datos expirados, limpiar
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.warn('localStorage read error:', error);
      }
    }

    // Nivel 3: sessionStorage (por pestaña)
    if (this.isSessionStorageAvailable) {
      try {
        const sessionData = sessionStorage.getItem(cacheKey);
        if (sessionData) {
          const parsed = this.decompressData(sessionData);
          if (parsed && parsed.expires > now) {
            // Migrar a memory cache
            this.memoryCache.set(cacheKey, parsed);
            return parsed.data;
          } else {
            // Datos expirados, limpiar
            sessionStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.warn('sessionStorage read error:', error);
      }
    }

    return null;
  }

  /**
   * Almacenar datos en caché multinivel
   */
  set(key, data, type = 'search_results') {
    const cacheKey = this.getCacheKey(key, type);
    const ttl = CACHE_TTL[type] || CACHE_TTL.search_results;
    const expires = Date.now() + ttl;
    const cacheData = { data, expires, timestamp: Date.now() };

    // Nivel 1: Memory cache
    this.memoryCache.set(cacheKey, cacheData);

    // Nivel 2: localStorage
    if (this.isLocalStorageAvailable) {
      try {
        const compressed = this.compressData(cacheData);
        localStorage.setItem(cacheKey, compressed);
      } catch (error) {
        // localStorage lleno, intentar limpiar y reintentar
        if (error.name === 'QuotaExceededError') {
          this.cleanupExpiredCache();
          try {
            const compressed = this.compressData(cacheData);
            localStorage.setItem(cacheKey, compressed);
          } catch {
            console.warn('localStorage still full after cleanup');
          }
        } else {
          console.warn('localStorage write error:', error);
        }
      }
    }

    // Nivel 3: sessionStorage para datos críticos
    if (this.isSessionStorageAvailable && type === 'user_preferences') {
      try {
        const compressed = this.compressData(cacheData);
        sessionStorage.setItem(cacheKey, compressed);
      } catch (error) {
        console.warn('sessionStorage write error:', error);
      }
    }
  }

  /**
   * Invalidar clave específica
   */
  invalidate(key, type = 'search_results') {
    const cacheKey = this.getCacheKey(key, type);

    // Limpiar memory cache
    this.memoryCache.delete(cacheKey);

    // Limpiar localStorage
    if (this.isLocalStorageAvailable) {
      try {
        localStorage.removeItem(cacheKey);
      } catch (error) {
        console.warn('localStorage remove error:', error);
      }
    }

    // Limpiar sessionStorage
    if (this.isSessionStorageAvailable) {
      try {
        sessionStorage.removeItem(cacheKey);
      } catch (error) {
        console.warn('sessionStorage remove error:', error);
      }
    }
  }

  /**
   * Invalidar por patrón
   */
  invalidateByPattern(pattern, type = 'search_results') {
    const prefix = this.getCacheKey('', type);

    // Limpiar memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix) && key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Limpiar localStorage
    if (this.isLocalStorageAvailable) {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(prefix) && key.includes(pattern)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('localStorage pattern cleanup error:', error);
      }
    }

    // Limpiar sessionStorage
    if (this.isSessionStorageAvailable) {
      try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith(prefix) && key.includes(pattern)) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('sessionStorage pattern cleanup error:', error);
      }
    }
  }

  /**
   * Limpiar caché expirado
   */
  cleanupExpiredCache() {
    const now = Date.now();

    // Limpiar memory cache
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        this.memoryCache.delete(key);
      }
    }

    // Limpiar localStorage
    if (this.isLocalStorageAvailable) {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(CACHE_PREFIX)) {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = this.decompressData(data);
              if (!parsed || parsed.expires <= now) {
                localStorage.removeItem(key);
              }
            }
          }
        });
      } catch (error) {
        console.warn('localStorage cleanup error:', error);
      }
    }

    // Limpiar sessionStorage
    if (this.isSessionStorageAvailable) {
      try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith(CACHE_PREFIX)) {
            const data = sessionStorage.getItem(key);
            if (data) {
              const parsed = this.decompressData(data);
              if (!parsed || parsed.expires <= now) {
                sessionStorage.removeItem(key);
              }
            }
          }
        });
      } catch (error) {
        console.warn('sessionStorage cleanup error:', error);
      }
    }
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    // Limpiar memory cache
    this.memoryCache.clear();

    // Limpiar localStorage
    if (this.isLocalStorageAvailable) {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('localStorage clear error:', error);
      }
    }

    // Limpiar sessionStorage
    if (this.isSessionStorageAvailable) {
      try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith(CACHE_PREFIX)) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('sessionStorage clear error:', error);
      }
    }
  }

  /**
   * Obtener estadísticas del caché
   */
  getStats() {
    const now = Date.now();
    let memoryValid = 0;
    let memoryExpired = 0;
    let localStorageValid = 0;
    let localStorageExpired = 0;
    let sessionStorageValid = 0;
    let sessionStorageExpired = 0;

    // Estadísticas de memory cache
    for (const [, value] of this.memoryCache.entries()) {
      if (value.expires > now) {
        memoryValid++;
      } else {
        memoryExpired++;
      }
    }

    // Estadísticas de localStorage
    if (this.isLocalStorageAvailable) {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(CACHE_PREFIX)) {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = this.decompressData(data);
              if (parsed) {
                if (parsed.expires > now) {
                  localStorageValid++;
                } else {
                  localStorageExpired++;
                }
              }
            }
          }
        });
      } catch (error) {
        console.warn('Error getting localStorage stats:', error);
      }
    }

    // Estadísticas de sessionStorage
    if (this.isSessionStorageAvailable) {
      try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith(CACHE_PREFIX)) {
            const data = sessionStorage.getItem(key);
            if (data) {
              const parsed = this.decompressData(data);
              if (parsed) {
                if (parsed.expires > now) {
                  sessionStorageValid++;
                } else {
                  sessionStorageExpired++;
                }
              }
            }
          }
        });
      } catch (error) {
        console.warn('Error getting sessionStorage stats:', error);
      }
    }

    return {
      memory: {
        valid: memoryValid,
        expired: memoryExpired,
        total: memoryValid + memoryExpired
      },
      localStorage: {
        available: this.isLocalStorageAvailable,
        valid: localStorageValid,
        expired: localStorageExpired,
        total: localStorageValid + localStorageExpired
      },
      sessionStorage: {
        available: this.isSessionStorageAvailable,
        valid: sessionStorageValid,
        expired: sessionStorageExpired,
        total: sessionStorageValid + sessionStorageExpired
      }
    };
  }
}

// Instancia singleton
const cacheService = new FrontendCacheService();

// Funciones de conveniencia para uso común
export const getCachedData = (key, type) => cacheService.get(key, type);
export const setCachedData = (key, data, type) => cacheService.set(key, data, type);
export const invalidateCache = (key, type) => cacheService.invalidate(key, type);
export const clearAllCache = () => cacheService.clear();
export const getCacheStats = () => cacheService.getStats();

export default cacheService;