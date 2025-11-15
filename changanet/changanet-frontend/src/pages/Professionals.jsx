// src/pages/Professionals.jsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ProfessionalCard from '../components/ProfessionalCard';

const Professionals = () => {
  console.log('🚀 Professionals component mounted');
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTime, setSearchTime] = useState(null);
  const [sortBy, setSortBy] = useState('calificacion_promedio');
  const [filterVerified, setFilterVerified] = useState(false);
  const [zonaCobertura, setZonaCobertura] = useState('');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [selectedProfessionals, setSelectedProfessionals] = useState([]);
  const location = useLocation();

  useEffect(() => {
    console.log('🔄 useEffect triggered, fetching professionals');
    const fetchProfessionals = async () => {
      const startTime = performance.now();
      setLoading(true);
      console.log('⏳ Starting fetch...');
      try {
        // Construir query string con filtros adicionales
        const urlParams = new URLSearchParams(location.search);
        if (zonaCobertura) urlParams.set('zona_cobertura', zonaCobertura);
        if (precioMin) urlParams.set('precio_min', precioMin);
        if (precioMax) urlParams.set('precio_max', precioMax);

        // INTEGRACIÓN CON BACKEND: Buscar profesionales con filtros
        urlParams.set('sort_by', sortBy);
        urlParams.set('limit', '100'); // Mostrar hasta 100 profesionales

        const url = `/api/professionals?${urlParams.toString()}`;
        console.log('🌐 Fetching URL:', url);
        const response = await fetch(url, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        console.log('📡 Response status:', response.status);

        if (!response.ok) {
          let errorMessage = 'Error al buscar profesionales';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.warn('No se pudo parsear respuesta de error:', parseError);
          }
          console.error('Error al buscar profesionales:', errorMessage);
          setProfessionals([]); // Mostrar lista vacía en caso de error
          return;
        }

        const data = await response.json();
        console.log('📊 API Response:', data);
        console.log('👥 Professionals received:', data.professionals?.length || 0);
        console.log('👥 First professional:', data.professionals?.[0]);
        setProfessionals(data.professionals || []);
        console.log('💾 Set professionals to state:', data.professionals?.length);
        const endTime = performance.now();
        setSearchTime((endTime - startTime).toFixed(2));
      } catch (error) {
        console.error('Error de red:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfessionals();
  }, [location.search, zonaCobertura, precioMin, precioMax, sortBy]);

  // El ordenamiento ahora se hace en el backend, así que solo usamos los resultados tal cual
  const sortedProfessionals = professionals;

  const filteredProfessionals = filterVerified
    ? sortedProfessionals.filter(p => p.estado_verificacion === 'verificado')
    : sortedProfessionals;

  console.log('🎯 Filtered professionals:', filteredProfessionals.length, 'out of', sortedProfessionals.length);

  // Funciones para manejar selección
  const handleSelectProfessional = (professionalId) => {
    setSelectedProfessionals(prev =>
      prev.includes(professionalId)
        ? prev.filter(id => id !== professionalId)
        : [...prev, professionalId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProfessionals.length === filteredProfessionals.length) {
      setSelectedProfessionals([]);
    } else {
      setSelectedProfessionals(filteredProfessionals.map(p => p.usuario_id));
    }
  };

  const handleRequestServices = () => {
    if (selectedProfessionals.length === 0) {
      alert('Por favor selecciona al menos un profesional');
      return;
    }
    alert(`Solicitando servicios a ${selectedProfessionals.length} profesional(es) seleccionado(s)`);
    // Aquí iría la lógica para enviar las solicitudes
  };

  if (loading) {
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
        {/* Header */}
        <div className="mb-12 text-center animate-fade-in">
          <h1 className="text-5xl font-black mb-6 text-gradient">
            Profesionales Disponibles
          </h1>
          <p className="text-gray-600 text-xl font-medium">
            {filteredProfessionals.length} profesionales encontrados para ti
            {selectedProfessionals.length > 0 && (
              <span className="text-emerald-600 font-semibold ml-4">
                • {selectedProfessionals.length} seleccionado(s)
              </span>
            )}
            {searchTime && (
              <span className="text-sm text-emerald-600 ml-2">
                (búsqueda en {searchTime}ms)
              </span>
            )}
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            {/* Verified Filter */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterVerified}
                  onChange={(e) => setFilterVerified(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span className="text-gray-700 font-medium">Solo verificados</span>
                <span className="text-emerald-600">✅</span>
              </label>
            </div>

            {/* Location Filter */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Zona/Barrio</label>
              <input
                type="text"
                placeholder="Ej: Palermo, CABA"
                value={zonaCobertura}
                onChange={(e) => setZonaCobertura(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Price Filters */}
            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Precio mínimo</label>
              <input
                type="number"
                placeholder="Min $"
                value={precioMin}
                onChange={(e) => setPrecioMin(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-gray-700 font-medium text-sm">Precio máximo</label>
              <input
                type="number"
                placeholder="Max $"
                value={precioMax}
                onChange={(e) => setPrecioMax(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Sort Options and Selection Controls */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="calificacion_promedio">⭐ Mejor calificación</option>
                <option value="tarifa_hora">💰 Precio más bajo</option>
                <option value="distancia">📍 Más cercano</option>
                <option value="disponibilidad">✅ Más disponible</option>
              </select>
            </div>

            {/* Selection Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSelectAll}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {selectedProfessionals.length === filteredProfessionals.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
              </button>
              {selectedProfessionals.length > 0 && (
                <button
                  onClick={handleRequestServices}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-semibold"
                >
                  Solicitar Servicios ({selectedProfessionals.length})
                </button>
              )}
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
              onClick={() => window.history.back()}
              className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-50 hover:shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a buscar
            </button>
          </div>
        ) : (
          <div>
            {/* Lista de profesionales */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-6 text-center">Lista de Profesionales Disponibles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProfessionals.map((professional) => (
                  <div key={professional.usuario_id} className={`bg-white p-4 rounded-lg shadow-md border-2 transition-all ${selectedProfessionals.includes(professional.usuario_id) ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        checked={selectedProfessionals.includes(professional.usuario_id)}
                        onChange={() => handleSelectProfessional(professional.usuario_id)}
                        className="w-5 h-5 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Seleccionar</span>
                    </div>
                    <img
                      src={professional.usuario?.url_foto_perfil || 'https://placehold.co/100x100?text=👷'}
                      alt={professional.usuario?.nombre}
                      className="w-16 h-16 rounded-full mx-auto mb-2"
                    />
                    <h4 className="font-bold text-center">{professional.usuario?.nombre}</h4>
                    <p className="text-sm text-center text-gray-600">{professional.especialidad}</p>
                    <p className="text-sm text-center text-gray-500">{professional.zona_cobertura}</p>
                    <p className="text-sm text-center font-semibold text-green-600">${professional.tarifa_hora}/hora</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid original con ProfessionalCard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {console.log('🎨 Rendering grid with', filteredProfessionals.length, 'professionals')}
              {filteredProfessionals.map((professional) => (
                <ProfessionalCard key={professional.usuario_id} professional={professional} />
              ))}
            </div>
          </div>
        )}

        {/* Load More Button */}
        {filteredProfessionals.length > 0 && filteredProfessionals.length % 12 === 0 && (
          <div className="text-center mt-12">
            <button className="bg-emerald-500 text-black px-8 py-4 rounded-full hover:bg-emerald-600 hover:shadow-md hover:scale-[1.02] transition-all duration-200 shadow-lg font-semibold flex items-center justify-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Cargar más profesionales
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Professionals;
