import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchProfessionals = async () => {
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

        const url = `/api/professionals?${urlParams.toString()}`;
        const response = await fetch(url, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
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
      }
    };

    fetchProfessionals();
  }, [location.search, zonaCobertura, precioMin, precioMax, especialidad, sortBy]);

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