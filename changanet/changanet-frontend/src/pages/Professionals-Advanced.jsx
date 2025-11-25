// src/pages/Professionals-Advanced.jsx
import { useState, useEffect, useRef } from 'react';
import ProfessionalCard from '../components/ProfessionalCard';
import QuoteRequestForm from '../components/QuoteRequestForm';
import BackButton from '../components/BackButton';
import AdvancedSearchBar from '../components/search/AdvancedSearchBar';
import AdvancedFilters from '../components/search/AdvancedFilters';
import useAdvancedSearch from '../hooks/useAdvancedSearch';
import useGeolocation from '../hooks/useGeolocation';
import { useAuth } from '../context/AuthContext';

const ProfessionalsAdvanced = () => {
  console.log('🚀 ProfessionalsAdvanced component mounted - ADVANCED SEARCH SYSTEM');
  console.log('Current timestamp:', new Date().toISOString());

  const { user } = useAuth();

  // Hook de búsqueda avanzada
  const {
    results: professionals,
    loading,
    error,
    meta,
    searchTime,
    cacheHit,
    hasMore,
    filters,
    loadMore,
    updateFilters,
    clearFilters,
    activeFiltersCount
  } = useAdvancedSearch();

  // Hook de geolocalización
  const {
    location: geoLocation,
    loading: geoLoading,
    error: geoError,
    requestLocation
  } = useGeolocation();
  
  // Estados de la interfaz
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [currentProfessional, setCurrentProfessional] = useState(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [selectedProfessionals, setSelectedProfessionals] = useState([]);
  const [showSelectionMode, setShowSelectionMode] = useState(false);
  
  // Refs para funcionalidades
  const observerRef = useRef();
  const loadMoreRef = useRef(null);

  // Debug logging
  console.log('🎯 Advanced search results:', professionals.length);
  console.log('🎯 Advanced search meta:', meta);
  console.log('🔍 Active filters count:', activeFiltersCount);
  console.log('🔍 Current filters:', filters);

  // Log all professional IDs for debugging
  if (professionals.length > 0) {
    console.log('📋 ALL PROFESSIONAL IDs currently displayed:');
    professionals.forEach((prof, index) => {
      console.log(`   ${index + 1}. ID: ${prof.usuario_id}, Name: ${prof.nombre}, Rating: ${prof.calificacion_promedio}`);
    });
  } else {
    console.log('⚠️ NO PROFESSIONALS DISPLAYED IN ADVANCED FRONTEND!');
  }

  // Configurar IntersectionObserver para scroll infinito
  useEffect(() => {
    if (loading) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        console.log('📜 Loading more professionals with advanced search...');
        loadMore();
      }
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadMore]);

  // Manejar selección de profesionales
  const handleSelectProfessional = (professionalId) => {
    setSelectedProfessionals(prev =>
      prev.includes(professionalId)
        ? prev.filter(id => id !== professionalId)
        : [...prev, professionalId]
    );
  };

  const handleHireSelected = () => {
    if (selectedProfessionals.length === 0) {
      alert('Selecciona al menos un profesional para contratar.');
      return;
    }
    alert(`Contratando ${selectedProfessionals.length} profesional(es). Funcionalidad en desarrollo.`);
  };

  const clearSelection = () => {
    setSelectedProfessionals([]);
    setShowSelectionMode(false);
  };

  // Manejar cambios en filtros
  const handleFiltersChange = (newFilters) => {
    console.log('🔄 Filters changed:', newFilters);
    updateFilters(newFilters);
  };

  if (loading && professionals.length === 0) {
    console.log('⏳ Advanced search still loading...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="loading-spinner mx-auto mb-6"></div>
          <p className="text-gray-600 text-xl font-medium">Buscando los mejores profesionales...</p>
          <p className="text-gray-500 text-sm mt-2">Sistema de búsqueda avanzada activo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="container mx-auto px-4 py-12">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton />
        </div>

        {/* Header */}
        <div className="mb-12 text-center animate-fade-in">
          <h1 className="text-5xl font-black mb-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
            Profesionales Disponibles
          </h1>
          <p className="text-gray-800 text-xl font-semibold">
            {professionals.length} profesionales encontrados 
            {searchTime && (
              <span className="text-sm text-emerald-600 ml-2 font-normal">
                (búsqueda en {searchTime}ms)
              </span>
            )}
            {cacheHit && (
              <span className="text-sm text-blue-600 ml-2 font-normal">
                ⚡ Datos en caché
              </span>
            )}
          </p>
          {meta.total > 0 && (
            <p className="text-gray-600 text-sm mt-1">
              Mostrando {professionals.length} de {meta.total} resultados
            </p>
          )}

          {/* Sistema de búsqueda avanzada - Banner de estado */}
          <div className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>Sistema de Búsqueda Avanzada Activo</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-1 bg-emerald-200 rounded-full text-xs">
                {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} aplicado{activeFiltersCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Selection Mode Toggle */}
          {user && user.rol === 'cliente' && (
            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={() => setShowSelectionMode(!showSelectionMode)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  showSelectionMode
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showSelectionMode ? '✖️ Cancelar selección' : '☑️ Seleccionar para contratar'}
              </button>

              {showSelectionMode && selectedProfessionals.length > 0 && (
                <>
                  <div className="flex items-center bg-blue-100 px-4 py-3 rounded-lg">
                    <span className="text-blue-800 font-semibold">
                      {selectedProfessionals.length} profesional(es) seleccionado(s)
                    </span>
                  </div>
                  <button
                    onClick={handleHireSelected}
                    className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-semibold transition-all duration-300 flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Contratar Seleccionados</span>
                  </button>
                  <button
                    onClick={clearSelection}
                    className="bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 font-semibold transition-all duration-300"
                  >
                    Limpiar
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <span className="text-2xl mr-3">❌</span>
              <div>
                <p className="font-semibold text-red-800">
                  Error en búsqueda avanzada
                </p>
                <p className="text-sm text-red-600">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Barra de búsqueda avanzada */}
        <div className="mb-8">
          <AdvancedSearchBar
            initialFilters={filters}
            onSearch={handleFiltersChange}
            showAdvancedFilters={true}
            placeholder="¿Qué servicio necesitas? (ej: Plomero en Palermo)"
          />
        </div>

        {/* Filtros avanzados */}
        <div className="mb-8">
          <AdvancedFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={clearFilters}
            isLoading={loading}
          />
        </div>

        {/* Location Prompt */}
        {showLocationPrompt && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">📍</span>
                <div>
                  <p className="font-semibold text-blue-800">Activa tu ubicación</p>
                  <p className="text-sm text-blue-600">Para búsquedas por radio de distancia</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={requestLocation}
                  disabled={geoLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {geoLoading ? 'Obteniendo...' : 'Activar'}
                </button>
                <button
                  onClick={() => setShowLocationPrompt(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
            {geoError && (
              <p className="text-sm text-red-600 mt-2">⚠️ {geoError}</p>
            )}
          </div>
        )}

        {/* Resultados */}
        {professionals.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {activeFiltersCount > 0 ? 'No encontramos profesionales con esos filtros' : 'No hay profesionales disponibles'}
            </h2>
            <p className="text-gray-600 mb-6">
              {activeFiltersCount > 0 ? 'Intenta ajustar tus filtros o realizar una búsqueda más amplia' : 'Prueba más tarde o contacta al administrador'}
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="bg-emerald-500 text-white px-6 py-3 rounded-lg hover:bg-emerald-600 hover:shadow-md hover:scale-[1.02] transition-all duration-200 inline-flex items-center justify-center mx-auto"
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Grid de profesionales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {professionals.map((professional, index) => (
                <ProfessionalCard
                  key={professional.usuario_id || `prof-adv-${index}`}
                  professional={professional}
                  showDistance={!!geoLocation}
                  isSelected={selectedProfessionals.includes(professional.usuario_id)}
                  onSelect={handleSelectProfessional}
                  showSelection={showSelectionMode}
                />
              ))}
            </div>

            {/* Scroll Infinito - Elemento observador */}
            {hasMore && (
              <div ref={loadMoreRef} className="text-center mt-12 py-8">
                {loading ? (
                  <div className="flex flex-col items-center">
                    <div className="loading-spinner mb-4"></div>
                    <p className="text-gray-600">Cargando más profesionales...</p>
                    <p className="text-sm text-gray-500 mt-1">Sistema de búsqueda avanzada</p>
                  </div>
                ) : (
                  <button
                    onClick={loadMore}
                    className="bg-emerald-500 text-white px-8 py-4 rounded-full hover:bg-emerald-600 hover:shadow-md hover:scale-[1.02] transition-all duration-200 shadow-lg font-semibold inline-flex items-center justify-center mx-auto"
                  >
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Cargar más profesionales
                  </button>
                )}
              </div>
            )}

            {!hasMore && professionals.length > 0 && (
              <div className="text-center mt-12 py-8">
                <p className="text-gray-500 text-lg">✨ Has visto todos los profesionales disponibles</p>
                <p className="text-sm text-gray-400 mt-1">Sistema de búsqueda avanzada - Changánet</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quote Request Modal */}
      {showQuoteModal && currentProfessional && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => {
                setShowQuoteModal(false);
                setCurrentProfessional(null);
              }}
              className="absolute top-4 right-4 text-emerald-500 hover:text-emerald-700 text-2xl z-10"
              aria-label="Cerrar modal"
            >
              ×
            </button>
            <QuoteRequestForm
              professionalName={currentProfessional.nombre}
              professionalId={currentProfessional.usuario_id}
              onClose={() => {
                setShowQuoteModal(false);
                setCurrentProfessional(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalsAdvanced;