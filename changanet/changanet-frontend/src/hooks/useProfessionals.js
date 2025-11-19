import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import useGeolocation from './useGeolocation';

const useProfessionals = () => {
  // Cargar filtros guardados de localStorage
  const loadSavedFilters = () => {
    try {
      const saved = localStorage.getItem('professionalFilters');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Error al cargar filtros guardados:', error);
      return {};
    }
  };

  const savedFilters = loadSavedFilters();

  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTime, setSearchTime] = useState(null);
  const [sortBy, setSortBy] = useState(savedFilters.sortBy || 'calificacion_promedio');
  const [filterVerified, setFilterVerified] = useState(savedFilters.filterVerified || false);
  const [zonaCobertura, setZonaCobertura] = useState(savedFilters.zonaCobertura || '');
  const [ciudad, setCiudad] = useState(savedFilters.ciudad || '');
  const [barrio, setBarrio] = useState(savedFilters.barrio || '');
  const [precioMin, setPrecioMin] = useState(savedFilters.precioMin || '');
  const [precioMax, setPrecioMax] = useState(savedFilters.precioMax || '');
  const [especialidad, setEspecialidad] = useState(savedFilters.especialidad || '');
  const [radioDistancia, setRadioDistancia] = useState(savedFilters.radioDistancia || '');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const location = useLocation();
  const debounceTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);
  const fetchCountRef = useRef(0);
  
  // Hook de geolocalización
  const { location: userLocation, calculateDistance } = useGeolocation();

  // Guardar filtros en localStorage cuando cambien
  useEffect(() => {
    const filters = {
      sortBy,
      filterVerified,
      zonaCobertura,
      ciudad,
      barrio,
      precioMin,
      precioMax,
      especialidad,
      radioDistancia
    };
    localStorage.setItem('professionalFilters', JSON.stringify(filters));
  }, [sortBy, filterVerified, zonaCobertura, ciudad, barrio, precioMin, precioMax, especialidad, radioDistancia]);

  // Initialize state from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const especialidadParam = urlParams.get('especialidad');
    const zonaParam = urlParams.get('zona_cobertura');
    const ciudadParam = urlParams.get('ciudad');
    const barrioParam = urlParams.get('barrio');

    if (especialidadParam) setEspecialidad(especialidadParam);
    if (zonaParam) setZonaCobertura(zonaParam);
    if (ciudadParam) setCiudad(ciudadParam);
    if (barrioParam) setBarrio(barrioParam);
  }, [location.search]);

  const fetchProfessionals = useCallback(async (loadMore = false) => {
    if (isFetchingRef.current) {
      console.log('Skipping fetch, already fetching');
      return;
    }

    isFetchingRef.current = true;

    const startTime = performance.now();
    setLoading(true);
    
    try {
      const urlParams = new URLSearchParams(location.search);
      
      // Filtros básicos
      if (especialidad) urlParams.set('especialidad', especialidad);
      if (precioMin) urlParams.set('precio_min', precioMin);
      if (precioMax) urlParams.set('precio_max', precioMax);
      if (filterVerified) urlParams.set('verificado', 'true');
      
      // Filtros de ubicación mejorados
      if (ciudad) urlParams.set('ciudad', ciudad);
      if (barrio) urlParams.set('barrio', barrio);
      if (zonaCobertura && !ciudad && !barrio) {
        // Solo usar zona_cobertura si no hay ciudad/barrio específicos
        urlParams.set('zona_cobertura', zonaCobertura);
      }
      
      // Geolocalización y radio
      if (userLocation && radioDistancia) {
        urlParams.set('lat', userLocation.latitude.toString());
        urlParams.set('lng', userLocation.longitude.toString());
        urlParams.set('radio', radioDistancia);
      }
      
      // Ordenamiento y paginación
      urlParams.set('sort_by', sortBy);
      urlParams.set('page', loadMore ? page.toString() : '1');
      urlParams.set('limit', '20');

      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
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
        setHasMore(false);
        return;
      }

      const data = await response.json();
      const newProfessionals = data.professionals || [];
      
      // Si estamos cargando más, agregar a los existentes
      if (loadMore) {
        setProfessionals(prev => [...prev, ...newProfessionals]);
      } else {
        setProfessionals(newProfessionals);
      }
      
      // Verificar si hay más resultados
      setHasMore(newProfessionals.length === 20);
      
      const endTime = performance.now();
      setSearchTime((endTime - startTime).toFixed(2));
    } catch (error) {
      console.error('Error de red:', error);
      if (!loadMore) {
        setProfessionals([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [
    location.search, 
    especialidad, 
    precioMin, 
    precioMax, 
    filterVerified, 
    ciudad, 
    barrio, 
    zonaCobertura, 
    userLocation, 
    radioDistancia, 
    sortBy, 
    page
  ]);

  // Efecto para fetch con debounce
  useEffect(() => {
    fetchCountRef.current++;
    console.log(`useProfessionals useEffect triggered ${fetchCountRef.current} times`);

    // Resetear página cuando cambien los filtros
    setPage(1);

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced fetch
    debounceTimeoutRef.current = setTimeout(() => {
      fetchProfessionals(false);
    }, 500); // 500ms debounce

    // Cleanup function to clear timeout
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [fetchProfessionals]);

  // Función para cargar más profesionales (scroll infinito)
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      fetchProfessionals(true);
    }
  }, [loading, hasMore, fetchProfessionals]);

  // Función para limpiar todos los filtros
  const clearFilters = () => {
    setSortBy('calificacion_promedio');
    setFilterVerified(false);
    setZonaCobertura('');
    setCiudad('');
    setBarrio('');
    setPrecioMin('');
    setPrecioMax('');
    setEspecialidad('');
    setRadioDistancia('');
    localStorage.removeItem('professionalFilters');
  };

  // Calcular distancias si tenemos ubicación del usuario
  const professionalsWithDistance = professionals.map(prof => {
    if (userLocation && prof.latitud && prof.longitud) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        prof.latitud,
        prof.longitud
      );
      return { ...prof, distancia_calculada: distance };
    }
    return prof;
  });

  return {
    professionals: professionalsWithDistance,
    loading,
    searchTime,
    sortBy,
    setSortBy,
    filterVerified,
    setFilterVerified,
    zonaCobertura,
    setZonaCobertura,
    ciudad,
    setCiudad,
    barrio,
    setBarrio,
    precioMin,
    setPrecioMin,
    precioMax,
    setPrecioMax,
    especialidad,
    setEspecialidad,
    radioDistancia,
    setRadioDistancia,
    userLocation,
    hasMore,
    loadMore,
    clearFilters
  };
};

export default useProfessionals;
