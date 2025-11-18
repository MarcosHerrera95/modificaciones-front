// src/components/SearchBar.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { initAutocomplete } from '../services/mapService';

const SearchBar = () => {
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');
  const [serviceSuggestions, setServiceSuggestions] = useState([]);
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(-1);
  const navigate = useNavigate();
  const serviceInputRef = useRef(null);
  const locationInputRef = useRef(null);
  const serviceSuggestionsRef = useRef(null);

  // Lista de servicios comunes para autocompletado
  const allServices = [
    'Plomero', 'Electricista', 'Pintor', 'Jardinero', 'Carpintero',
    'Mecánico', 'Técnico en aire acondicionado', 'Cerrajero',
    'Limpieza del hogar', 'Mudanzas', 'Gasista', 'Albañil',
    'Herrero', 'Instalador de pisos', 'Decorador'
  ];

  // Inicializar autocompletado de ubicación
  useEffect(() => {
    if (locationInputRef.current) {
      initAutocomplete(locationInputRef.current, (placeData) => {
        setLocation(placeData.address);
      }).catch(error => {
        console.warn('Autocompletado de ubicación no disponible:', error.message);
      });
    }
  }, []);

  // Filtrar sugerencias de servicios
  const getFilteredServiceSuggestions = (input) => {
    if (!input.trim()) return [];

    const filtered = allServices.filter(service =>
      service.toLowerCase().includes(input.toLowerCase())
    );

    // Agregar la entrada del usuario si no está en la lista
    if (input.trim() && !filtered.some(s => s.toLowerCase() === input.toLowerCase())) {
      filtered.unshift(input.trim());
    }

    return filtered.slice(0, 8);
  };

  // Actualizar sugerencias de servicios cuando cambia el input
  useEffect(() => {
    if (service.trim()) {
      const filtered = getFilteredServiceSuggestions(service);
      setServiceSuggestions(filtered);
      setShowServiceSuggestions(filtered.length > 0);
    } else {
      setServiceSuggestions([]);
      setShowServiceSuggestions(false);
    }
    setSelectedServiceIndex(-1);
  }, [service]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (service.trim() || location.trim()) {
      setShowServiceSuggestions(false);
      const params = new URLSearchParams();
      if (service.trim()) {
        params.set('especialidad', service.trim());
      }
      if (location.trim()) {
        params.set('zona_cobertura', location.trim());
      }
      // Navigate to professionals search page instead of API endpoint
      navigate(`/profesionales?${params.toString()}`);
    }
  };

  const handleServiceSuggestionClick = (suggestion) => {
    setService(suggestion);
    setShowServiceSuggestions(false);
    setSelectedServiceIndex(-1);
    // Auto-focus en el campo de ubicación
    setTimeout(() => {
      locationInputRef.current?.focus();
    }, 100);
  };

  const handleServiceKeyDown = (e) => {
    if (!showServiceSuggestions || serviceSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedServiceIndex(prev =>
          prev < serviceSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedServiceIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedServiceIndex >= 0) {
          handleServiceSuggestionClick(serviceSuggestions[selectedServiceIndex]);
        } else {
          // Auto-focus en ubicación si no hay sugerencia seleccionada
          locationInputRef.current?.focus();
        }
        break;
      case 'Escape':
        setShowServiceSuggestions(false);
        setSelectedServiceIndex(-1);
        break;
    }
  };

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        serviceSuggestionsRef.current &&
        !serviceSuggestionsRef.current.contains(event.target) &&
        serviceInputRef.current &&
        !serviceInputRef.current.contains(event.target)
      ) {
        setShowServiceSuggestions(false);
        setSelectedServiceIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search-bar max-w-4xl mx-auto relative">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-4 border border-gray-300">
        <div className="flex items-center gap-4">
          {/* Campo de servicio */}
          <div className="flex-1 relative">
            <input
              ref={serviceInputRef}
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              onKeyDown={handleServiceKeyDown}
              onFocus={() => {
                if (serviceSuggestions.length > 0) setShowServiceSuggestions(true);
              }}
              placeholder="¿Qué necesitas? (Plomero, Electricista...)"
              className="search-input w-full pl-4 pr-20 py-4 text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-800 placeholder-gray-500 shadow-sm"
              aria-label="Buscar servicio profesional"
              aria-describedby="service-help"
              aria-expanded={showServiceSuggestions}
              aria-haspopup="listbox"
              role="combobox"
              aria-activedescendant={selectedServiceIndex >= 0 ? `service-suggestion-${selectedServiceIndex}` : undefined}
            />
            {/* Iconos dentro del campo */}
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              {service && (
                <button
                  type="button"
                  onClick={() => setService('')}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <div className="text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Separador vertical */}
          <div className="w-px h-12 bg-gray-300"></div>

          {/* Campo de ubicación */}
          <div className="flex-1 relative">
            <input
              ref={locationInputRef}
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="¿Dónde? (Buenos Aires, CABA...)"
              className="search-input w-full pl-4 pr-4 py-4 text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-800 placeholder-gray-500 shadow-sm"
              aria-label="Buscar ubicación geográfica"
              aria-describedby="location-help"
            />
          </div>

          {/* Botón de búsqueda */}
          <button
            type="submit"
            disabled={!service.trim() && !location.trim()}
            className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed px-4 py-3 rounded-lg border border-gray-300 transition-all duration-200 shadow-sm flex items-center justify-center"
            aria-label="Buscar profesionales"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Descripciones de ayuda */}
        <div id="service-help" className="sr-only">
          Ingresa el tipo de servicio que necesitas. Mientras escribes, verás sugerencias de servicios disponibles.
        </div>
        <div id="location-help" className="sr-only">
          Ingresa tu ubicación o zona donde necesitas el servicio. El autocompletado te ayudará a encontrar direcciones precisas.
        </div>
      </form>

      {/* Lista de sugerencias de servicios */}
      {showServiceSuggestions && serviceSuggestions.length > 0 && (
        <div
          ref={serviceSuggestionsRef}
          className="absolute top-full left-2 right-2 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto border-t-0"
          role="listbox"
          aria-label="Sugerencias de servicios"
        >
          {serviceSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              id={`service-suggestion-${index}`}
              onClick={() => handleServiceSuggestionClick(suggestion)}
              className={`w-full text-left px-6 py-4 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl ${
                index === selectedServiceIndex ? 'bg-emerald-50' : ''
              }`}
              role="option"
              aria-selected={index === selectedServiceIndex}
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-gray-700 font-medium">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
