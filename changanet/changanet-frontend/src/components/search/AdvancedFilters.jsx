// src/components/search/AdvancedFilters.jsx
/**
 * Componente de Filtros Avanzados para Changánet
 * Implementa REQ-12: Filtros por especialidad, ciudad, barrio y radio
 * Implementa REQ-13: Filtros por rango de precio
 * Implementa REQ-14: Ordenamiento por calificación, cercanía y disponibilidad
 */

import React, { useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';

const AdvancedFilters = ({ 
  filters = {}, 
  onFiltersChange, 
  userLocation = null,
  className = '' 
}) => {
  // Estado local de los filtros
  const [localFilters, setLocalFilters] = useState({
    specialty: filters.specialty || '',
    city: filters.city || '',
    district: filters.district || '',
    minPrice: filters.minPrice || '',
    maxPrice: filters.maxPrice || '',
    priceType: filters.priceType || 'hora',
    sortBy: filters.sortBy || 'rating',
    radius: filters.radius || '',
    onlyVerified: filters.onlyVerified || false,
    availableOnly: filters.availableOnly || false,
    ...filters
  });

  // Estados para sugerencias
  const [specialtySuggestions, setSpecialtySuggestions] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSpecialtySuggestions, setShowSpecialtySuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  // Función debounced para obtener sugerencias de especialidades
  const getSpecialtySuggestions = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setSpecialtySuggestions([]);
        return;
      }

      try {
        const response = await fetch(`/api/search/specialties?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
          setSpecialtySuggestions(data.data.slice(0, 5));
        }
      } catch (error) {
        console.error('Error getting specialty suggestions:', error);
        setSpecialtySuggestions([]);
      }
    }, 300),
    []
  );

  // Función debounced para obtener sugerencias de ubicaciones
  const getLocationSuggestions = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setLocationSuggestions([]);
        return;
      }

      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
          setLocationSuggestions(data.data.locations.slice(0, 5));
        }
      } catch (error) {
        console.error('Error getting location suggestions:', error);
        setLocationSuggestions([]);
      }
    }, 300),
    []
  );

  // Efectos para actualizar sugerencias
  useEffect(() => {
    if (localFilters.specialty) {
      getSpecialtySuggestions(localFilters.specialty);
    } else {
      setSpecialtySuggestions([]);
    }
  }, [localFilters.specialty, getSpecialtySuggestions]);

  useEffect(() => {
    if (localFilters.city) {
      getLocationSuggestions(localFilters.city);
    } else {
      setLocationSuggestions([]);
    }
  }, [localFilters.city, getLocationSuggestions]);

  // Función para actualizar filtros
  const updateFilter = useCallback((key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    
    // Callback para notificar cambios
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  }, [localFilters, onFiltersChange]);

  // Función para limpiar filtros
  const clearFilters = useCallback(() => {
    const clearedFilters = {
      specialty: '',
      city: '',
      district: '',
      minPrice: '',
      maxPrice: '',
      priceType: 'hora',
      sortBy: 'rating',
      radius: '',
      onlyVerified: false,
      availableOnly: false
    };
    setLocalFilters(clearedFilters);
    
    if (onFiltersChange) {
      onFiltersChange(clearedFilters);
    }
  }, [onFiltersChange]);

  // Función para obtener filtros activos
  const getActiveFiltersCount = () => {
    return Object.entries(localFilters).filter(([key, value]) => {
      if (key === 'sortBy' || key === 'priceType') return false;
      if (key === 'onlyVerified' || key === 'availableOnly') return value;
      return value && value.toString().trim() !== '';
    }).length;
  };

  return (
    <div className={`advanced-filters bg-white rounded-xl shadow-lg p-6 ${className}`}>
      {/* Header con título y contador de filtros */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">Filtros de Búsqueda</h3>
          {getActiveFiltersCount() > 0 && (
            <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {getActiveFiltersCount()} activo{getActiveFiltersCount() !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        {getActiveFiltersCount() > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Fila 1: Especialidad y Ubicación */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Filtro de Especialidad */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Especialidad
          </label>
          <div className="relative">
            <input
              type="text"
              value={localFilters.specialty}
              onChange={(e) => updateFilter('specialty', e.target.value)}
              onFocus={() => setShowSpecialtySuggestions(true)}
              placeholder="Ej: Plomero, Electricista..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
            
            {/* Sugerencias de especialidades */}
            {showSpecialtySuggestions && specialtySuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {specialtySuggestions.map((specialty, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      updateFilter('specialty', specialty.name);
                      setShowSpecialtySuggestions(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {specialty.name}
                    {specialty.category && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({specialty.category})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filtro de Ciudad */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ciudad
          </label>
          <div className="relative">
            <input
              type="text"
              value={localFilters.city}
              onChange={(e) => updateFilter('city', e.target.value)}
              onFocus={() => setShowLocationSuggestions(true)}
              placeholder="Ej: Buenos Aires, Córdoba..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
            
            {/* Sugerencias de ubicaciones */}
            {showLocationSuggestions && locationSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {locationSuggestions.map((location, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      updateFilter('city', location);
                      setShowLocationSuggestions(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center"
                  >
                    <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {location}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fila 2: Barrio y Radio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Filtro de Barrio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Barrio
          </label>
          <input
            type="text"
            value={localFilters.district}
            onChange={(e) => updateFilter('district', e.target.value)}
            placeholder="Ej: Palermo, Recoleta..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Filtro de Radio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Radio de búsqueda
            {!userLocation && (
              <span className="text-xs text-amber-600 ml-1">
                (requiere ubicación)
              </span>
            )}
          </label>
          <select
            value={localFilters.radius}
            onChange={(e) => updateFilter('radius', e.target.value)}
            disabled={!userLocation}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Sin límite</option>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="20">20 km</option>
            <option value="30">30 km</option>
            <option value="50">50 km</option>
          </select>
        </div>
      </div>

      {/* Fila 3: Filtros de Precio */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rango de precio
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tipo de precio */}
          <div>
            <select
              value={localFilters.priceType}
              onChange={(e) => updateFilter('priceType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            >
              <option value="hora">Por hora</option>
              <option value="servicio">Por servicio</option>
              <option value="convenio">A convenir</option>
            </select>
          </div>
          
          {/* Precio mínimo */}
          <div>
            <input
              type="number"
              value={localFilters.minPrice}
              onChange={(e) => updateFilter('minPrice', e.target.value)}
              placeholder="Precio mínimo"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </div>
          
          {/* Precio máximo */}
          <div>
            <input
              type="number"
              value={localFilters.maxPrice}
              onChange={(e) => updateFilter('maxPrice', e.target.value)}
              placeholder="Precio máximo"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Fila 4: Ordenamiento y opciones adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ordenamiento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ordenar por
          </label>
          <select
            value={localFilters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          >
            <option value="rating">⭐ Mejor calificación</option>
            <option value="distance">📍 Más cercano</option>
            <option value="availability">✅ Más disponible</option>
            <option value="price">💰 Precio más bajo</option>
          </select>
        </div>

        {/* Opciones adicionales */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Opciones
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={localFilters.onlyVerified}
                onChange={(e) => updateFilter('onlyVerified', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-700">Solo verificados</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={localFilters.availableOnly}
                onChange={(e) => updateFilter('availableOnly', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-700">Solo disponibles</span>
            </label>
          </div>
        </div>
      </div>

      {/* Overlay para cerrar sugerencias */}
      {(showSpecialtySuggestions || showLocationSuggestions) && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => {
            setShowSpecialtySuggestions(false);
            setShowLocationSuggestions(false);
          }}
        />
      )}
    </div>
  );
};

export default AdvancedFilters;