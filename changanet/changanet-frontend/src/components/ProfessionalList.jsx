import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProfessional } from '../context/useProfessional';
import ProfessionalCard from './ProfessionalCard';
import LoadingSpinner from './LoadingSpinner';

/**
 * ProfessionalList
 * Componente para mostrar una lista de profesionales con filtros y paginación
 *
 * Características:
 * - Lista paginada de profesionales
 * - Filtros por especialidad, zona, calificación, etc.
 * - Búsqueda por texto
 * - Vista de cuadrícula/lista
 * - Estados de carga y error
 * - Integración con contexto profesional
 */

const ProfessionalList = ({ initialFilters = {}, showFilters = true, showPagination = true }) => {
  const { user } = useAuth();
  const {
    professionals,
    professionalsLoading,
    professionalsError,
    searchProfessionals,
    pagination
  } = useProfessional();

  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [selectedProfessionals, setSelectedProfessionals] = useState([]);
  const [showSelection, setShowSelection] = useState(false);

  // Estados de filtros locales
  const [localFilters, setLocalFilters] = useState({
    search: '',
    specialty: '',
    zone: '',
    rating: 0,
    availability: null,
    priceRange: [0, 10000],
    ...initialFilters
  });

  // Cargar profesionales iniciales
  useEffect(() => {
    searchProfessionals(localFilters);
  }, []);

  // Aplicar filtros cuando cambian
  const applyFilters = useCallback(async () => {
    await searchProfessionals(localFilters);
  }, [localFilters, searchProfessionals]);

  // Manejar cambios en filtros
  const handleFilterChange = (filterKey, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };

  // Limpiar filtros
  const clearFilters = () => {
    setLocalFilters({
      search: '',
      specialty: '',
      zone: '',
      rating: 0,
      availability: null,
      priceRange: [0, 10000]
    });
  };

  // Manejar selección de profesionales
  const handleProfessionalSelect = (professionalId) => {
    setSelectedProfessionals(prev =>
      prev.includes(professionalId)
        ? prev.filter(id => id !== professionalId)
        : [...prev, professionalId]
    );
  };

  // Cargar más profesionales (paginación)
  const loadMore = async () => {
    if (!pagination.hasMore || professionalsLoading) return;

    await searchProfessionals(localFilters, pagination.page + 1, true);
  };

  // Simulación de datos para desarrollo
  const mockProfessionals = [
    {
      usuario_id: '1',
      usuario: { nombre: 'María González', url_foto_perfil: 'https://ui-avatars.com/api/?name=María+González&size=120&background=random&color=fff' },
      especialidad: 'Limpieza Residencial',
      zona_cobertura: 'Palermo, Buenos Aires',
      tarifa_hora: 1500,
      calificacion_promedio: 4.8,
      estado_verificacion: 'verificado',
      distancia_calculada: 2.5
    },
    {
      usuario_id: '2',
      usuario: { nombre: 'Carlos Rodríguez', url_foto_perfil: 'https://ui-avatars.com/api/?name=Carlos+Rodríguez&size=120&background=random&color=fff' },
      especialidad: 'Plomería',
      zona_cobertura: 'Recoleta, Buenos Aires',
      tarifa_hora: 2000,
      calificacion_promedio: 4.6,
      estado_verificacion: 'verificado',
      distancia_calculada: 3.1
    },
    {
      usuario_id: '3',
      usuario: { nombre: 'Ana López', url_foto_perfil: 'https://ui-avatars.com/api/?name=Ana+López&size=120&background=random&color=fff' },
      especialidad: 'Jardinería',
      zona_cobertura: 'Belgrano, Buenos Aires',
      tarifa_hora: 1800,
      calificacion_promedio: 4.9,
      estado_verificacion: 'verificado',
      distancia_calculada: 1.8
    }
  ];

  const displayProfessionals = professionals.length > 0 ? professionals : mockProfessionals;

  return (
    <div className="w-full">
      {/* Filtros */}
      {showFilters && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar profesionales..."
                value={localFilters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Especialidad */}
            <div className="w-full lg:w-48">
              <select
                value={localFilters.specialty}
                onChange={(e) => handleFilterChange('specialty', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Todas las especialidades</option>
                <option value="limpieza">Limpieza</option>
                <option value="plomeria">Plomería</option>
                <option value="electricidad">Electricidad</option>
                <option value="jardineria">Jardinería</option>
                <option value="pintura">Pintura</option>
              </select>
            </div>

            {/* Zona */}
            <div className="w-full lg:w-48">
              <select
                value={localFilters.zone}
                onChange={(e) => handleFilterChange('zone', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Todas las zonas</option>
                <option value="palermo">Palermo</option>
                <option value="recoleta">Recoleta</option>
                <option value="belgrano">Belgrano</option>
                <option value="microcentro">Microcentro</option>
              </select>
            </div>

            {/* Calificación mínima */}
            <div className="w-full lg:w-32">
              <select
                value={localFilters.rating}
                onChange={(e) => handleFilterChange('rating', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value={0}>Cualquier calificación</option>
                <option value={4}>4+ estrellas</option>
                <option value={4.5}>4.5+ estrellas</option>
                <option value={5}>5 estrellas</option>
              </select>
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={applyFilters}
                disabled={professionalsLoading}
                className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {professionalsLoading ? 'Buscando...' : 'Buscar'}
              </button>

              <button
                onClick={clearFilters}
                className="px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Filtros adicionales */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
            {/* Disponibilidad */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localFilters.availability === true}
                onChange={(e) => handleFilterChange('availability', e.target.checked ? true : null)}
                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Solo disponibles</span>
            </label>

            {/* Rango de precios */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Precio:</span>
              <input
                type="range"
                min="0"
                max="10000"
                step="500"
                value={localFilters.priceRange[1]}
                onChange={(e) => handleFilterChange('priceRange', [0, parseInt(e.target.value)])}
                className="w-24"
              />
              <span className="text-sm text-gray-600">Hasta ${localFilters.priceRange[1]}</span>
            </div>
          </div>
        </div>
      )}

      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Vista */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Cuadrícula
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Lista
            </button>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-gray-600">
            {displayProfessionals.length} profesional{displayProfessionals.length !== 1 ? 'es' : ''} encontrado{displayProfessionals.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Selección múltiple (solo para clientes) */}
        {user && user.rol === 'cliente' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSelection(!showSelection)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showSelection
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showSelection ? 'Cancelar selección' : 'Seleccionar múltiples'}
            </button>

            {showSelection && selectedProfessionals.length > 0 && (
              <button
                onClick={() => {
                  // TODO: Implementar acción con profesionales seleccionados
                  alert(`Seleccionados: ${selectedProfessionals.length} profesionales`);
                }}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                Comparar ({selectedProfessionals.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista de profesionales */}
      {professionalsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
          Error al cargar profesionales: {professionalsError}
        </div>
      )}

      {professionalsLoading && displayProfessionals.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className={`grid gap-6 ${
            viewMode === 'grid'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1'
          }`}>
            {displayProfessionals.map((professional) => (
              <ProfessionalCard
                key={professional.usuario_id}
                professional={professional}
                isSelected={selectedProfessionals.includes(professional.usuario_id)}
                onSelect={showSelection ? handleProfessionalSelect : undefined}
                showSelection={showSelection}
              />
            ))}
          </div>

          {/* Mensaje cuando no hay resultados */}
          {displayProfessionals.length === 0 && !professionalsLoading && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No se encontraron profesionales
              </h3>
              <p className="text-gray-600 mb-6">
                Intenta ajustar tus filtros de búsqueda o busca en otra zona.
              </p>
              <button
                onClick={clearFilters}
                className="bg-emerald-500 text-white px-6 py-3 rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Paginación / Cargar más */}
          {showPagination && pagination.hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                disabled={professionalsLoading}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {professionalsLoading ? 'Cargando...' : 'Cargar más profesionales'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProfessionalList;