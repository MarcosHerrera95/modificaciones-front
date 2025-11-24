// src/components/search/AdvancedSearchBar.jsx
/**
 * Barra de Búsqueda Avanzada para Changánet
 * Implementa REQ-11: Búsqueda por palabra clave
 * Diseño responsive y UX optimizada
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';

const AdvancedSearchBar = ({ 
  initialFilters = {}, 
  onSearch,
  className = '',
  showAdvancedFilters = true,
  placeholder = "¿Qué servicio necesitas?"
}) => {
  const navigate = useNavigate();
  
  // Estado local de la búsqueda
  const [keyword, setKeyword] = useState(initialFilters.keyword || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Función debounced para obtener sugerencias
  const getSuggestions = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
          const combinedSuggestions = [
            ...data.data.specialties.map(s => ({ type: 'specialty', value: s })),
            ...data.data.locations.map(l => ({ type: 'location', value: l }))
          ];
          setSuggestions(combinedSuggestions);
        }
      } catch (error) {
        console.error('Error getting suggestions:', error);
        setSuggestions([]);
      }
    }, 300),
    []
  );

  // Efecto para actualizar sugerencias cuando cambia la keyword
  useEffect(() => {
    if (keyword) {
      getSuggestions(keyword);
    } else {
      setSuggestions([]);
    }
  }, [keyword, getSuggestions]);

  // Función para manejar la búsqueda
  const handleSearch = useCallback((searchKeyword = keyword) => {
    if (!searchKeyword.trim()) return;

    setIsLoading(true);
    setShowSuggestions(false);

    const filters = {
      q: searchKeyword.trim(),
      ...initialFilters
    };

    // Actualizar URL con parámetros de búsqueda
    const searchParams = new URLSearchParams(filters);
    navigate(`/profesionales?${searchParams.toString()}`);

    // Callback opcional para búsqueda en tiempo real
    if (onSearch) {
      onSearch(filters);
    }

    setIsLoading(false);
  }, [keyword, initialFilters, navigate, onSearch]);

  // Función para manejar selección de sugerencia
  const handleSuggestionSelect = (suggestion) => {
    setKeyword(suggestion.value);
    setShowSuggestions(false);
    
    if (suggestion.type === 'specialty') {
      handleSearch(suggestion.value);
    }
  };

  // Función para manejar teclas especiales
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Función para manejar cambio de input
  const handleInputChange = (e) => {
    const value = e.target.value;
    setKeyword(value);
    setShowSuggestions(true);
  };

  return (
    <div className={`advanced-search-bar ${className}`}>
      <div className="relative w-full">
        {/* Input principal de búsqueda */}
        <div className="relative flex items-center">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <input
            type="text"
            value={keyword}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl 
                     focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 
                     transition-all duration-200 text-gray-900 placeholder-gray-500
                     hover:border-gray-300"
            aria-label="Campo de búsqueda de servicios"
          />
          
          {/* Botón de búsqueda */}
          <button
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="absolute right-2 p-2 bg-emerald-500 text-white rounded-lg 
                     hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Buscar"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>

        {/* Dropdown de sugerencias */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl 
                        shadow-lg max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${index}`}
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center 
                         transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl
                         border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    suggestion.type === 'specialty' 
                      ? 'bg-emerald-100 text-emerald-600' 
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {suggestion.type === 'specialty' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-900 font-medium">{suggestion.value}</div>
                    <div className="text-xs text-gray-500 capitalize">{suggestion.type}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Overlay para cerrar sugerencias */}
      {showSuggestions && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
};

export default AdvancedSearchBar;