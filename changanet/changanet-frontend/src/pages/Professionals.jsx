// src/pages/Professionals.jsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ProfessionalCard from '../components/ProfessionalCard';

const Professionals = () => {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('rating');
  const [filterVerified, setFilterVerified] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchProfessionals = async () => {
      setLoading(true);
      try {
        // INTEGRACIÓN CON BACKEND: Buscar profesionales con filtros
        const response = await fetch(`http://localhost:3002/api/professionals${location.search}`);
        const data = await response.json();
        if (response.ok) {
          setProfessionals(data.professionals);
        } else {
          console.error('Error al buscar profesionales:', data.error);
        }
      } catch (error) {
        console.error('Error de red:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfessionals();
  }, [location.search]);

  const sortedProfessionals = [...professionals].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'price':
        return a.tarifa_hora - b.tarifa_hora;
      case 'name':
        return a.usuario.nombre.localeCompare(b.usuario.nombre);
      default:
        return 0;
    }
  });

  const filteredProfessionals = filterVerified
    ? sortedProfessionals.filter(p => p.estado_verificacion === 'verificado')
    : sortedProfessionals;

  if (loading) {
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
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-4">
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

            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="rating">⭐ Mejor calificación</option>
                <option value="price">💰 Precio más bajo</option>
                <option value="name">📝 Nombre (A-Z)</option>
              </select>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredProfessionals.map((professional) => (
              <ProfessionalCard key={professional.usuario_id} professional={professional} />
            ))}
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
