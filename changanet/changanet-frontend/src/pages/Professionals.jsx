// src/pages/Professionals.jsx
import { useState, useEffect, useRef } from 'react';
import ProfessionalCard from '../components/ProfessionalCard';
import QuoteRequestForm from '../components/QuoteRequestForm';
import BackButton from '../components/BackButton';
import useProfessionals from '../hooks/useProfessionals';
import useGeolocation from '../hooks/useGeolocation';

const Professionals = () => {
  console.log('🚀 Professionals component mounted');
  
  const {
    professionals: filteredProfessionals,
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
    hasMore,
    loadMore,
    clearFilters
  } = useProfessionals();
  
  const {
    location: geoLocation,
    loading: geoLoading,
    error: geoError,
    requestLocation,
    clearLocation
  } = useGeolocation();
  
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [currentProfessional, setCurrentProfessional] = useState(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  
  // Ref para scroll infinito
  const observerRef = useRef();
  const loadMoreRef = useRef(null);

  console.log('🎯 Filtered professionals:', filteredProfessionals.length);

  // Configurar IntersectionObserver para scroll infinito
  useEffect(() => {
    if (loading) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        console.log('📜 Loading more professionals...');
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

  // Mostrar prompt de ubicación si se selecciona radio sin ubicación
  useEffect(() => {
    if (radioDistancia && !geoLocation) {
      setShowLocationPrompt(true);
    } else {
      setShowLocationPrompt(false);
    }
  }, [radioDistancia, geoLocation]);

  if (loading && filteredProfessionals.length === 0) {
    console.log('⏳ Still loading...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="loading-spinner mx-auto mb-6"></div>
          <p className="text-gray-600 text-xl font-medium">Buscando los mejores profesionales...</p>
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
          <h1 className="text-5xl font-black mb-6 text-gradient">
            Profesionales Disponibles
          </h1>
          <p className="text-gray-600 text-xl font-medium">
            {filteredProfessionals.length} profesionales encontrados para ti
            {searchTime && (
              <span className="text-sm text-emerald-600 ml-2">
                (búsqueda en {searchTime}ms)
              </span>
            )}
          </p>
        </div>

        {/* Location Prompt */}
        {showLocationPrompt && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">📍</span>
                <div>
                  <p className="font-semibold text-blue-800">Activa tu ubicación</p>
                  <p className="text-sm text-blue-600">Para buscar por radio de distancia, necesitamos tu ubicación</p>
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
                  onClick={() => setRadioDistancia('')}
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

        {/* Filters and Sort */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          {/* Geolocation Status */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📍</span>
                {geoLocation ? (
                  <div>
                    <span className="text-green-600 font-semibold">Ubicación activada</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({geoLocation.latitude.toFixed(4)}, {geoLocation.longitude.toFixed(4)})
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500">Ubicación desactivada</span>
                )}
              </div>
              {geoLocation ? (
                <button
                  onClick={clearLocation}
                  className="text-sm text-red-600 hover:text-red-700 underline"
                >
                  Desactivar ubicación
                </button>
              ) : (
                <button
                  onClick={requestLocation}
                  disabled={geoLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 underline disabled:opacity-50"
                >
                  {geoLoading ? 'Obteniendo...' : 'Activar ubicación'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-center">
            {/* Verified Filter */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterVerified}
                  onChange={(e) => setFilterVerified(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span className="text-gray-700 font-medium text-sm">Solo verificados</span>
                <span className="text-emerald-600">✅</span>
              </label>
            </div>

            {/* Specialty Filter */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Especialidad</label>
              <input
                type="text"
                placeholder="Ej: Plomero"
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>

            {/* City Filter */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Ciudad</label>
              <input
                type="text"
                placeholder="Ej: Buenos Aires"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Neighborhood Filter */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Barrio</label>
              <input
                type="text"
                placeholder="Ej: Palermo"
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Distance Radius Filter */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Radio (km)</label>
              <select
                value={radioDistancia}
                onChange={(e) => setRadioDistancia(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                disabled={!geoLocation}
              >
                <option value="">Sin límite</option>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="20">20 km</option>
                <option value="50">50 km</option>
                <option value="100">100 km</option>
              </select>
            </div>

            {/* Price Min Filter */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Precio mín</label>
              <input
                type="number"
                placeholder="Min $"
                value={precioMin}
                onChange={(e) => setPrecioMin(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center mt-4">
            {/* Price Max Filter */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Precio máx</label>
              <input
                type="number"
                placeholder="Max $"
                value={precioMax}
                onChange={(e) => setPrecioMax(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>

            {/* General Zone (fallback) */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Zona general</label>
              <input
                type="text"
                placeholder="Ej: CABA, GBA"
                value={zonaCobertura}
                onChange={(e) => setZonaCobertura(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Sort Options */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Ordenar por</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              >
                <option value="calificacion_promedio">⭐ Mejor calificación</option>
                <option value="tarifa_hora">💰 Precio más bajo</option>
                <option value="distancia">📍 Más cercano</option>
                <option value="disponibilidad">✅ Más disponible</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                🗑️ Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {filteredProfessionals.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No encontramos profesionales</h2>
            <p className="text-gray-600 mb-6">Intenta ajustar tus filtros o búsqueda</p>
            <button
              onClick={clearFilters}
              className="bg-emerald-500 text-white px-6 py-3 rounded-lg hover:bg-emerald-600 hover:shadow-md hover:scale-[1.02] transition-all duration-200 inline-flex items-center justify-center mx-auto"
            >
              Limpiar todos los filtros
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {console.log('🎨 Rendering grid with', filteredProfessionals.length, 'professionals')}
              {filteredProfessionals.map((professional) => (
                <ProfessionalCard 
                  key={professional.usuario_id} 
                  professional={professional}
                  showDistance={!!geoLocation}
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

            {!hasMore && filteredProfessionals.length > 0 && (
              <div className="text-center mt-12 py-8">
                <p className="text-gray-500 text-lg">✨ Has visto todos los profesionales disponibles</p>
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
              professionalName={currentProfessional.usuario?.nombre}
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

export default Professionals;
