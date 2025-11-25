// src/components/search/AdvancedFilters.jsx
/**
 * Componente de Filtros Avanzados para Búsqueda de Profesionales
 * Implementa filtros según REQ-12 y REQ-13 del PRD
 */

import React, { useState, useEffect } from 'react';
import { useGeolocation } from '../../hooks/useGeolocation';

const AdvancedFilters = ({ 
  filters, 
  onFiltersChange, 
  onClearFilters,
  isLoading = false,
  className = '' 
}) => {
  const { location: geoLocation, requestLocation, clearLocation } = useGeolocation();
  
  // Estado local de filtros (para evitar actualizaciones excesivas)
  const [localFilters, setLocalFilters] = useState(filters);

  // Sincronizar con filtros externos
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Contar filtros activos
  const activeFiltersCount = Object.keys(localFilters).filter(key => {
    const value = localFilters[key];
    if (typeof value === 'boolean') return value;
    return value && value.toString().trim() !== '';
  }).length;

  // Manejar cambios en filtros
  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Limpiar un filtro específico
  const handleClearFilter = (key) => {
    const newFilters = { ...localFilters };
    delete newFilters[key];
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`}>
      {/* Header con contador de filtros */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">🔍</span>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Filtros de Búsqueda</h3>
            {activeFiltersCount > 0 && (
              <span className="text-sm text-emerald-600 font-medium">
                {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} activo{activeFiltersCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        
        {/* Botón para limpiar todos los filtros */}
        {activeFiltersCount > 0 && (
          <button
            onClick={() => {
              setLocalFilters({});
              onClearFilters();
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 
                     transition-colors text-sm font-medium flex items-center space-x-2"
            disabled={isLoading}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Limpiar todo</span>
          </button>
        )}
      </div>

      {/* Geolocalización */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">📍</span>
            <div>
              <h4 className="text-gray-700 font-semibold">Ubicación</h4>
              <p className="text-sm text-gray-500">Para búsquedas por distancia</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {geoLocation ? (
              <>
                <div className="text-right">
                  <span className="text-green-600 font-medium text-sm">Ubicación activada</span>
                  <div className="text-xs text-gray-500">
                    ({geoLocation.latitude.toFixed(4)}, {geoLocation.longitude.toFixed(4)})
                  </div>
                </div>
                <button
                  onClick={clearLocation}
                  className="text-sm text-red-600 hover:text-red-700 underline px-2 py-1"
                >
                  Desactivar
                </button>
              </>
            ) : (
              <button
                onClick={requestLocation}
                className="text-sm text-blue-600 hover:text-blue-700 underline px-2 py-1"
              >
                Activar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Especialidad */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm flex items-center space-x-2">
            <span>🔧</span>
            <span>Especialidad</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={localFilters.specialty || ''}
              onChange={(e) => handleFilterChange('specialty', e.target.value)}
              placeholder="Ej: Plomero, Electricista"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 
                       focus:border-transparent text-sm transition-all duration-200"
              disabled={isLoading}
            />
            {localFilters.specialty && (
              <button
                onClick={() => handleClearFilter('specialty')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Ciudad */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm flex items-center space-x-2">
            <span>🏙️</span>
            <span>Ciudad</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={localFilters.city || ''}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              placeholder="Ej: Buenos Aires, Córdoba"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 
                       focus:border-transparent text-sm transition-all duration-200"
              disabled={isLoading}
            />
            {localFilters.city && (
              <button
                onClick={() => handleClearFilter('city')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Barrio */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm flex items-center space-x-2">
            <span>📍</span>
            <span>Barrio</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={localFilters.district || ''}
              onChange={(e) => handleFilterChange('district', e.target.value)}
              placeholder="Ej: Palermo, Recoleta"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 
                       focus:border-transparent text-sm transition-all duration-200"
              disabled={isLoading}
            />
            {localFilters.district && (
              <button
                onClick={() => handleClearFilter('district')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Precio mínimo */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm flex items-center space-x-2">
            <span>💰</span>
            <span>Precio mínimo</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={localFilters.minPrice || ''}
              onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              placeholder="0"
              min="0"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 
                       focus:border-transparent text-sm transition-all duration-200"
              disabled={isLoading}
            />
            {localFilters.minPrice && (
              <button
                onClick={() => handleClearFilter('minPrice')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Precio máximo */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm flex items-center space-x-2">
            <span>💰</span>
            <span>Precio máximo</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={localFilters.maxPrice || ''}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              placeholder="10000"
              min="0"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 
                       focus:border-transparent text-sm transition-all duration-200"
              disabled={isLoading}
            />
            {localFilters.maxPrice && (
              <button
                onClick={() => handleClearFilter('maxPrice')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Radio de distancia */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm flex items-center space-x-2">
            <span>🎯</span>
            <span>Radio de distancia</span>
          </label>
          <select
            value={localFilters.radius || ''}
            onChange={(e) => handleFilterChange('radius', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 
                     focus:border-transparent text-sm transition-all duration-200"
            disabled={isLoading || !geoLocation}
          >
            <option value="">Sin límite</option>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="15">15 km</option>
            <option value="20">20 km</option>
            <option value="30">30 km</option>
            <option value="50">50 km</option>
          </select>
          {!geoLocation && (
            <p className="text-xs text-amber-600 flex items-center space-x-1">
              <span>⚠️</span>
              <span>Activa tu ubicación para usar este filtro</span>
            </p>
          )}
        </div>
      </div>

      {/* Segunda fila de filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {/* Ordenamiento */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm flex items-center space-x-2">
            <span>📊</span>
            <span>Ordenar por</span>
          </label>
          <select
            value={localFilters.sortBy || 'rating'}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 
                     focus:border-transparent text-sm transition-all duration-200"
            disabled={isLoading}
          >
            <option value="rating">⭐ Mejor calificación</option>
            <option value="distance" disabled={!geoLocation}>📍 Más cercano</option>
            <option value="price">💰 Precio más bajo</option>
            <option value="availability">✅ Más disponible</option>
          </select>
          {localFilters.sortBy === 'distance' && !geoLocation && (
            <p className="text-xs text-amber-600">Requiere ubicación activada</p>
          )}
        </div>

        {/* Filtro de verificación */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm">Estado</label>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localFilters.onlyVerified || false}
                onChange={(e) => handleFilterChange('onlyVerified', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded 
                         focus:ring-emerald-500 focus:ring-2"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-700">Solo verificados</span>
              <span className="text-emerald-600">✅</span>
            </label>
          </div>
        </div>

        {/* Disponibilidad */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm">Disponibilidad</label>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localFilters.availableOnly || false}
                onChange={(e) => handleFilterChange('availableOnly', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded 
                         focus:ring-emerald-500 focus:ring-2"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-700">Solo disponibles</span>
              <span className="text-green-600">✅</span>
            </label>
          </div>
        </div>

        {/* Botón de aplicación */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold text-sm">&nbsp;</label>
          <button
            onClick={() => onFiltersChange(localFilters)}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 
                     focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 transition-all duration-200 
                     disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Aplicar filtros</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Resumen de filtros activos */}
      {activeFiltersCount > 0 && (
        <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
          <h4 className="text-sm font-semibold text-emerald-800 mb-2">Filtros activos:</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(localFilters).map(([key, value]) => {
              if (!value) return null;
              
              const labels = {
                specialty: 'Especialidad',
                city: 'Ciudad',
                district: 'Barrio',
                minPrice: 'Precio mín',
                maxPrice: 'Precio máx',
                radius: 'Radio',
                sortBy: 'Orden',
                onlyVerified: 'Verificados',
                availableOnly: 'Disponibles'
              };
              
              return (
                <span
                  key={key}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-100 text-emerald-800 
                           text-xs rounded-full cursor-pointer hover:bg-emerald-200 transition-colors"
                  onClick={() => handleClearFilter(key)}
                >
                  <span>{labels[key] || key}:</span>
                  <span className="font-medium">
                    {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value}
                  </span>
                  <span className="text-emerald-600">✕</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;