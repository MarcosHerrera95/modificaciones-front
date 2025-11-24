// src/hooks/useAdvancedSearch.js
/**
 * Hook optimizado para búsqueda avanzada de profesionales
 * Reemplaza useProfessionals.js con funcionalidad mejorada
 * Implementa REQ-11 a REQ-15 del PRD
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const useAdvancedSearch = () => {
  // Estados principales
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    totalPages: 0,
    searchTime: 0,
    filters: {},
    cached: false
  });
  const [filters, setFilters] = useState({});

  // Estados adicionales
  const [hasMore, setHasMore] = useState(true);
  const [searchTime, setSearchTime] = useState(null);
  const [cacheHit, setCacheHit] = useState(false);

  // Referencias y configuración
  const location = useLocation();
  const debounceTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Configuración de la API
  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';

  /**
   * Construye la URL de búsqueda con todos los parámetros
   */
  const buildSearchURL = useCallback((searchFilters = filters, page = 1) => {
    const searchParams = new URLSearchParams();
    
    // Parámetros básicos de búsqueda
    if (searchFilters.q) searchParams.set('q', searchFilters.q);
    if (searchFilters.specialty) searchParams.set('specialty', searchFilters.specialty);
    if (searchFilters.city) searchParams.set('city', searchFilters.city);
    if (searchFilters.district) searchParams.set('district', searchFilters.district);
    
    // Parámetros de precio
    if (searchFilters.minPrice) searchParams.set('minPrice', searchFilters.minPrice);
    if (searchFilters.maxPrice) searchParams.set('maxPrice', searchFilters.maxPrice);
    if (searchFilters.priceType) searchParams.set('priceType', searchFilters.priceType);
    
    // Parámetros de ordenamiento
    if (searchFilters.sortBy) searchParams.set('sortBy', searchFilters.sortBy);
    
    // Parámetros geográficos
    if (searchFilters.userLat && searchFilters.userLng) {
      searchParams.set('user_lat', searchFilters.userLat);
      searchParams.set('user_lng', searchFilters.userLng);
    }
    if (searchFilters.radius) searchParams.set('radius', searchFilters.radius);
    
    // Parámetros de paginación
    searchParams.set('page', page.toString());
    searchParams.set('limit', '20');
    
    // Filtros adicionales
    if (searchFilters.onlyVerified) searchParams.set('onlyVerified', 'true');
    if (searchFilters.availableOnly) searchParams.set('availableOnly', 'true');
    
    return `${API_BASE_URL}/api/advanced-search?${searchParams.toString()}`;
  }, [filters, API_BASE_URL]);

  /**
   * Ejecuta la búsqueda con la API avanzada
   */
  const executeSearch = useCallback(async (searchFilters = filters, loadMore = false) => {
    if (isFetchingRef.current) {
      return; // Evitar búsquedas concurrentes
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Cancelar solicitud anterior si existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Crear nuevo AbortController
      abortControllerRef.current = new AbortController();

      const searchUrl = buildSearchURL(searchFilters, meta.page + (loadMore ? 1 : 0));
      
      console.log('🔍 Ejecutando búsqueda avanzada:', searchUrl);

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const newResults = data.data.professionals;
        const newMeta = data.meta;

        // Actualizar resultados
        if (loadMore) {
          setResults(prev => [...prev, ...newResults]);
        } else {
          setResults(newResults);
        }

        // Actualizar metadata
        setMeta({
          total: newMeta.total,
          page: newMeta.page,
          totalPages: newMeta.totalPages,
          searchTime: newMeta.searchTime,
          filters: newMeta.filters,
          cached: newMeta.cached
        });

        setSearchTime(newMeta.searchTime);
        setCacheHit(newMeta.cached);

        // Verificar si hay más resultados
        setHasMore(newMeta.page < newMeta.totalPages);

      } else {
        throw new Error(data.error || 'Error en la búsqueda');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Búsqueda cancelada');
        return;
      }

      console.error('Error en búsqueda avanzada:', error);
      setError(error.message);
      
      // Usar datos en caché si están disponibles
      if (!loadMore && results.length === 0) {
        const cachedData = getCachedSearchResults(searchFilters);
        if (cachedData) {
          setResults(cachedData.professionals);
          setMeta(cachedData.meta);
          setCacheHit(true);
          setError('Mostrando datos en caché');
        }
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [filters, meta.page, buildSearchURL, results.length]);

  /**
   * Obtiene datos en caché localStorage
   */
  const getCachedSearchResults = useCallback((searchFilters) => {
    try {
      const cacheKey = `advanced_search_${JSON.stringify(searchFilters)}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const parsed = JSON.parse(cached);
        // Verificar si el caché no ha expirado (24 horas)
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn('Error reading cache:', error);
    }
    return null;
  }, []);

  /**
   * Guarda resultados en caché localStorage
   */
  const saveToCache = useCallback((searchFilters, data) => {
    try {
      const cacheKey = `advanced_search_${JSON.stringify(searchFilters)}`;
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error saving to cache:', error);
    }
  }, []);

  /**
   * Función principal de búsqueda
   */
  const search = useCallback((newFilters = null) => {
    if (newFilters) {
      setFilters(newFilters);
    }
    
    // Cancelar búsqueda anterior
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce de 500ms para evitar demasiadas solicitudes
    debounceTimeoutRef.current = setTimeout(() => {
      executeSearch(newFilters || filters, false);
    }, 500);
  }, [filters, executeSearch]);

  /**
   * Función para cargar más resultados (paginación)
   */
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      executeSearch(filters, true);
    }
  }, [loading, hasMore, executeSearch, filters]);

  /**
   * Función para actualizar filtros
   */
  const updateFilters = useCallback((newFilters) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...newFilters
    }));
    search(newFilters);
  }, [search]);

  /**
   * Función para limpiar todos los filtros
   */
  const clearFilters = useCallback(() => {
    const clearedFilters = {};
    setFilters(clearedFilters);
    search(clearedFilters);
  }, [search]);

  /**
   * Función para establecer ubicación del usuario
   */
  const setUserLocation = useCallback((lat, lng) => {
    const newFilters = { ...filters, userLat: lat, userLng: lng };
    updateFilters(newFilters);
  }, [filters, updateFilters]);

  /**
   * Efecto para inicializar desde parámetros de URL
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const urlFilters = {};
    
    // Leer filtros de la URL
    urlParams.forEach((value, key) => {
      if (['q', 'specialty', 'city', 'district', 'minPrice', 'maxPrice', 
           'priceType', 'sortBy', 'radius', 'onlyVerified', 'availableOnly'].includes(key)) {
        urlFilters[key] = value;
      }
    });

    // Convertir strings a booleanos
    if (urlFilters.onlyVerified === 'true') urlFilters.onlyVerified = true;
    if (urlFilters.availableOnly === 'true') urlFilters.availableOnly = true;
    
    if (Object.keys(urlFilters).length > 0) {
      setFilters(urlFilters);
      search(urlFilters);
    } else if (results.length === 0) {
      // Búsqueda inicial si no hay filtros
      search();
    }
  }, []); // Solo ejecutar una vez al montar

  /**
   * Efecto para guardar filtros en localStorage
   */
  useEffect(() => {
    try {
      localStorage.setItem('advanced_search_filters', JSON.stringify(filters));
    } catch (error) {
      console.warn('Error saving filters to localStorage:', error);
    }
  }, [filters]);

  /**
   * Efecto para guardar resultados en caché cuando cambian
   */
  useEffect(() => {
    if (results.length > 0 && meta.total > 0) {
      saveToCache(filters, {
        professionals: results,
        meta
      });
    }
  }, [results, meta, filters, saveToCache]);

  /**
   * Cleanup al desmontar
   */
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Estados principales
    results,
    loading,
    error,
    meta,
    searchTime,
    cacheHit,
    hasMore,
    
    // Funciones de búsqueda
    search,
    loadMore,
    updateFilters,
    clearFilters,
    
    // Utilidades
    filters,
    setUserLocation,
    
    // Información de rendimiento
    isFetching: isFetchingRef.current,
    
    // Estadísticas
    activeFiltersCount: Object.keys(filters).filter(key => {
      const value = filters[key];
      if (typeof value === 'boolean') return value;
      return value && value.toString().trim() !== '';
    }).length
  };
};

export default useAdvancedSearch;