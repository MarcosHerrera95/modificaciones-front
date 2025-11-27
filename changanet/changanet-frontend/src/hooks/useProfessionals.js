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
  const [cachedProfessionals, setCachedProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTime, setSearchTime] = useState(null);
  const [hasError, setHasError] = useState(false);

  // Default fallback professionals to ensure list is never empty
  const getDefaultProfessionals = () => [
    {
      usuario_id: 'default-1',
      usuario: { nombre: 'Profesional Ejemplo 1', email: 'ejemplo1@changánet.com', url_foto_perfil: 'https://ui-avatars.com/api/?name=Profesional+1&size=120&background=random&color=fff' },
      especialidad: 'Plomero',
      zona_cobertura: 'Buenos Aires',
      tarifa_hora: 2500,
      calificacion_promedio: 4.5,
      estado_verificacion: 'verificado',
      descripcion: 'Profesional con experiencia en reparaciones residenciales.'
    },
    {
      usuario_id: 'default-2',
      usuario: { nombre: 'Profesional Ejemplo 2', email: 'ejemplo2@changánet.com', url_foto_perfil: 'https://ui-avatars.com/api/?name=Profesional+2&size=120&background=random&color=fff' },
      especialidad: 'Electricista',
      zona_cobertura: 'CABA',
      tarifa_hora: 3000,
      calificacion_promedio: 4.8,
      estado_verificacion: 'verificado',
      descripcion: 'Especialista en instalaciones eléctricas y mantenimiento.'
    },
    {
      usuario_id: 'default-3',
      usuario: { nombre: 'Profesional Ejemplo 3', email: 'ejemplo3@changánet.com', url_foto_perfil: 'https://ui-avatars.com/api/?name=Profesional+3&size=120&background=random&color=fff' },
      especialidad: 'Carpintero',
      zona_cobertura: 'GBA Norte',
      tarifa_hora: 2800,
      calificacion_promedio: 4.2,
      estado_verificacion: 'pendiente',
      descripcion: 'Trabajos de carpintería y muebles a medida.'
    }
  ];

  // Load cached professionals from localStorage on mount
  useEffect(() => {
    // Force complete reset - clear everything
    localStorage.removeItem('cachedProfessionals');
    localStorage.removeItem('professionalFilters');
    setCachedProfessionals([]);
    setProfessionals([]); // Start with empty array
    console.log('🧹 COMPLETE RESET - Cleared all caches and starting fresh');

    // Don't load any cached data - let the API fetch handle everything
    // This ensures we get real data from the backend
  }, []);
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
    console.log('🚀 fetchProfessionals called with loadMore:', loadMore);

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
      
      // Ordenamiento y paginación - CARGAR TODOS LOS PROFESIONALES
      urlParams.set('sort_by', sortBy);
      urlParams.set('page', '1');
      urlParams.set('limit', '100'); // Cargar máximo permitido por el backend

      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      const url = `${apiBaseUrl}/api/professionals?${urlParams.toString()}`;
      console.log('Fetching professionals:', url);
      console.log('API Base URL:', apiBaseUrl);

      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      console.log('🔍 PROFESSIONALS API - Response status:', response.status);
      console.log('🔍 PROFESSIONALS API - Response ok:', response.ok);
      console.log('🔍 PROFESSIONALS API - Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('❌ PROFESSIONALS API - Fetch failed with status:', response.status);
        const errorText = await response.text();
        console.error('❌ PROFESSIONALS API - Error response:', errorText);
        if (response.status === 429) {
          throw new Error('Demasiadas solicitudes al servidor de profesionales.');
        }

        // Use cached data instead of clearing the list
        if (!loadMore) {
          if (cachedProfessionals.length > 0) {
            console.log('🔄 Using cached professionals due to API error');
            setProfessionals(cachedProfessionals);
            setHasError(true);
          } else {
            // No cached data, use defaults
            const defaults = getDefaultProfessionals();
            setProfessionals(defaults);
            setCachedProfessionals(defaults);
            setHasError(true);
            console.log('🔄 Using default professionals due to API error');
          }
        }
        setHasMore(false);
        return;
      }

      const data = await response.json();
      console.log('✅ Received data from API:', data);
      console.log('🔍 DEBUGGING API - Response data type:', typeof data);
      console.log('🔍 DEBUGGING API - Data keys:', Object.keys(data));
      console.log('🔍 DEBUGGING API - Professionals data:', data.professionals);
      console.log('🔍 DEBUGGING API - Professionals data type:', typeof data.professionals);
      console.log('🔍 DEBUGGING API - Is professionals array:', Array.isArray(data.professionals));
      const newProfessionals = data.professionals || [];
      console.log('✅ New professionals array:', newProfessionals);
      console.log('✅ New professionals length:', newProfessionals.length);
      console.log('🔍 DEBUGGING - New professionals type:', typeof newProfessionals);
      console.log('🔍 DEBUGGING - Is new professionals array:', Array.isArray(newProfessionals));

      // DIAGNOSTIC LOGS FOR VALIDATION
      console.log('🔍 VALIDATION: newProfessionals after extraction:', newProfessionals, 'length:', newProfessionals.length);
      if (newProfessionals.length === 0) {
        console.warn('⚠️ VALIDATION: API returned empty professionals array - this may cause empty list');
      }

      // Additional validation
      if (data.professionals === null || data.professionals === undefined) {
        console.error('❌ API returned null/undefined for professionals');
      } else if (!Array.isArray(data.professionals)) {
        console.error('❌ API returned non-array for professionals:', data.professionals);
      } else if (data.professionals.length === 0) {
        console.warn('⚠️ API returned empty professionals array - no professionals in database');
      }

      // Log each professional's ID for debugging
      if (newProfessionals.length > 0) {
        console.log('📋 Professional IDs from API:');
        newProfessionals.forEach((prof, index) => {
          console.log(`   ${index + 1}. ID: ${prof.usuario_id}, Name: ${prof.usuario?.nombre}`);
        });
      } else {
        console.log('⚠️ No professionals received from API!');
      }

      // Log each professional's ID for debugging
      if (newProfessionals.length > 0) {
        console.log('📋 Professional IDs from API:');
        newProfessionals.forEach((prof, index) => {
          console.log(`   ${index + 1}. ID: ${prof.usuario_id}, Name: ${prof.usuario?.nombre}`);
        });
      }

      console.log('🔍 CRITICAL - About to set state with professionals:', newProfessionals);
      console.log('🔍 LOAD_MORE_CHECK: loadMore =', loadMore, 'current professionals length before:', professionals.length);

      // Si estamos cargando más, agregar a los existentes
      if (loadMore) {
        console.log('🔍 APPENDING: will append', newProfessionals.length, 'items to existing', professionals.length);
        setProfessionals(prev => {
          const updated = [...prev, ...newProfessionals];
          console.log('🔍 STATE_UPDATE: After append, professionals will have', updated.length, 'items');
          return updated;
        });
      } else {
        console.log('🔍 SETTING_STATE: setting to newProfessionals with', newProfessionals.length, 'items');
        setProfessionals(newProfessionals);
      }

      // Cache successful results for fallback
      if (!loadMore && newProfessionals.length > 0) {
        setCachedProfessionals(newProfessionals);
        setHasError(false);
        // Save to localStorage for persistence across sessions
        try {
          localStorage.setItem('cachedProfessionals', JSON.stringify(newProfessionals));
          console.log('💾 Saved professionals to localStorage');
        } catch (error) {
          console.error('Error saving to localStorage:', error);
        }
      }

      // Force immediate state update to ensure UI shows real data
      console.log('🔄 FORCE UPDATE - Setting professionals state immediately');
      setProfessionals(newProfessionals);
      console.log('🔍 VALIDATION: Final state set to newProfessionals length:', newProfessionals.length);
      setLoading(false);

      // Verificar si hay más resultados
      setHasMore(newProfessionals.length === 20);

      const endTime = performance.now();
      setSearchTime((endTime - startTime).toFixed(2));
    } catch (error) {
      console.error('Error de red:', error);
      if (!loadMore) {
        // Use cached data instead of clearing the list
        if (cachedProfessionals.length > 0) {
          console.log('🔄 Using cached professionals due to network error');
          setProfessionals(cachedProfessionals);
          setHasError(true);
        } else {
          // No cached data, use defaults
          const defaults = getDefaultProfessionals();
          setProfessionals(defaults);
          setCachedProfessionals(defaults);
          setHasError(true);
          console.log('🔄 Using default professionals due to network error');
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    sortBy
  ]);

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

  // DIAGNOSTIC: Log final returned professionals
  console.log('🔍 HOOK_RETURN: Returning professionalsWithDistance with length:', professionalsWithDistance.length);
  if (professionalsWithDistance.length === 0) {
    console.warn('⚠️ HOOK_RETURN: Returning empty professionals array - UI will show no professionals');
  }

  return {
    professionals: professionalsWithDistance,
    loading,
    searchTime,
    hasError,
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
