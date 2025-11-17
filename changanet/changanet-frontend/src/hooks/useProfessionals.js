import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const useProfessionals = () => {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTime, setSearchTime] = useState(null);
  const [sortBy, setSortBy] = useState('calificacion_promedio');
  const [filterVerified, setFilterVerified] = useState(false);
  const [zonaCobertura, setZonaCobertura] = useState('');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const location = useLocation();
  const debounceTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchCountRef = useRef(0);

  const fetchProfessionals = useCallback(async () => {
    if (isFetchingRef.current) {
      console.log('Skipping fetch, already fetching');
      return;
    }

    isFetchingRef.current = true;

    const startTime = performance.now();
    setLoading(true);
    try {
      const urlParams = new URLSearchParams(location.search);
      if (zonaCobertura) urlParams.set('zona_cobertura', zonaCobertura);
      if (precioMin) urlParams.set('precio_min', precioMin);
      if (precioMax) urlParams.set('precio_max', precioMax);
      if (especialidad) urlParams.set('especialidad', especialidad);
      urlParams.set('sort_by', sortBy);
      urlParams.set('limit', '100');

      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
      const url = `${apiBaseUrl}/api/professionals?${urlParams.toString()}`;
      console.log('Fetching professionals:', url);
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Demasiadas solicitudes al servidor de profesionales.');
        }
        setProfessionals([]);
        return;
      }

      const data = await response.json();
      setProfessionals(data.professionals || []);
      const endTime = performance.now();
      setSearchTime((endTime - startTime).toFixed(2));
    } catch (error) {
      console.error('Error de red:', error);
      setProfessionals([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [location.search, zonaCobertura, precioMin, precioMax, especialidad, sortBy]);

  useEffect(() => {
    fetchCountRef.current++;
    console.log(`useProfessionals useEffect triggered ${fetchCountRef.current} times with deps:`, {
      locationSearch: location.search,
      zonaCobertura,
      precioMin,
      precioMax,
      especialidad,
      sortBy
    });

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced fetch
    debounceTimeoutRef.current = setTimeout(() => {
      fetchProfessionals();
    }, 500); // 500ms debounce

    // Cleanup function to clear timeout
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [fetchProfessionals]);

  const filteredProfessionals = filterVerified
    ? professionals.filter(p => p.estado_verificacion === 'verificado')
    : professionals;

  return {
    professionals: filteredProfessionals,
    loading,
    searchTime,
    sortBy,
    setSortBy,
    filterVerified,
    setFilterVerified,
    zonaCobertura,
    setZonaCobertura,
    precioMin,
    setPrecioMin,
    precioMax,
    setPrecioMax,
    especialidad,
    setEspecialidad
  };
};

export default useProfessionals;