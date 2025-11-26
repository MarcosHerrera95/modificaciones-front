/**
 * @component NearestProfessionalsPreview - Vista previa de profesionales cercanos
 * @descripción Componente para mostrar profesionales disponibles cerca de la ubicación del cliente
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Ayuda a clientes a elegir profesionales antes de enviar solicitud urgente
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const NearestProfessionalsPreview = ({ location, radiusKm = 5, onProfessionalSelect }) => {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Cargar profesionales cercanos
  const loadNearbyProfessionals = async () => {
    if (!location) return;

    setLoading(true);
    setError('');

    try {
      // Simular búsqueda de profesionales (en implementación real, esto vendría de una API)
      // Por ahora, usaremos datos de ejemplo
      const mockProfessionals = [
        {
          id: '1',
          nombre: 'Carlos Martínez',
          especialidad: 'Plomero',
          distancia: 2.3,
          calificacion_promedio: 4.8,
          url_foto_perfil: '/default-avatar.png',
          esta_disponible: true,
          tarifa_hora: 1500
        },
        {
          id: '2',
          nombre: 'Ana García',
          especialidad: 'Electricista',
          distancia: 3.1,
          calificacion_promedio: 4.6,
          url_foto_perfil: '/default-avatar.png',
          esta_disponible: true,
          tarifa_hora: 1800
        },
        {
          id: '3',
          nombre: 'Roberto López',
          especialidad: 'Albañil',
          distancia: 4.2,
          calificacion_promedio: 4.9,
          url_foto_perfil: '/default-avatar.png',
          esta_disponible: false,
          tarifa_hora: 2000
        }
      ];

      // Filtrar por distancia
      const nearby = mockProfessionals.filter(prof =>
        prof.distancia <= radiusKm && prof.esta_disponible
      );

      // Ordenar por distancia
      nearby.sort((a, b) => a.distancia - b.distancia);

      setProfessionals(nearby);
    } catch (err) {
      console.error('Error loading nearby professionals:', err);
      setError('Error al cargar profesionales cercanos.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando cambia la ubicación o radio
  useEffect(() => {
    loadNearbyProfessionals();
  }, [location, radiusKm]);

  const handleProfessionalClick = (professional) => {
    if (onProfessionalSelect) {
      onProfessionalSelect(professional);
    } else {
      // Navegar al perfil del profesional
      navigate(`/profesional/${professional.id}`);
    }
  };

  if (!location) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Comparte tu ubicación
        </h3>
        <p className="text-gray-600">
          Para mostrarte profesionales cercanos disponibles, necesitamos saber tu ubicación.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3"></div>
          <span className="text-gray-600">Buscando profesionales cercanos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Profesionales Cercanos
            </h3>
            <p className="text-green-100 text-sm">
              {professionals.length} disponible{professionals.length !== 1 ? 's' : ''} en {radiusKm} km
            </p>
          </div>
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Lista de Profesionales */}
      <div className="p-6">
        {professionals.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-.966-5.5-2.5" />
            </svg>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No hay profesionales disponibles
            </h4>
            <p className="text-gray-600 mb-4">
              Intenta aumentar el radio de búsqueda o vuelve más tarde.
            </p>
            <button
              onClick={() => loadNearbyProfessionals()}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              Reintentar búsqueda
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {professionals.map((professional) => (
              <div
                key={professional.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => handleProfessionalClick(professional)}
              >
                <div className="flex items-center space-x-4">
                  {/* Foto de perfil */}
                  <div className="relative">
                    <img
                      src={professional.url_foto_perfil}
                      alt={professional.nombre}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>

                  {/* Información del profesional */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-gray-900 truncate">
                        {professional.nombre}
                      </h4>
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{professional.distancia.toFixed(1)} km</span>
                      </div>
                    </div>

                    <p className="text-green-600 font-medium text-sm">
                      {professional.especialidad}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {professional.calificacion_promedio.toFixed(1)}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          ${professional.tarifa_hora.toLocaleString('es-AR')}
                        </p>
                        <p className="text-xs text-gray-500">por hora</p>
                      </div>
                    </div>
                  </div>

                  {/* Flecha de navegación */}
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Información adicional */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12c0 4.418-4.582 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div>
              <h4 className="text-blue-900 font-medium">¿Necesitas atención inmediata?</h4>
              <p className="text-blue-700 text-sm mt-1">
                Si es una emergencia, considera usar nuestro servicio urgente.
                Los profesionales disponibles recibirán notificaciones prioritarias.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NearestProfessionalsPreview;