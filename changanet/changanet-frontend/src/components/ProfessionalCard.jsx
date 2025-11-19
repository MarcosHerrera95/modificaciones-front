// src/components/ProfessionalCard.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../hooks/useFavorites';
import QuoteRequestModal from './modals/QuoteRequestModal';
import VerifiedBadge from './VerifiedBadge';
import RatingDisplay from './RatingDisplay';
import { getDistanceMatrix, getSimulatedCoordinates, calculateHaversineDistance } from '../services/mapService';

const ProfessionalCard = ({ professional }) => {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [distance, setDistance] = useState('Calculando...');
  const [loading, setLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const distanceCalculatedRef = useRef(false);

  // Si ya viene la distancia calculada desde el hook, usarla
  useEffect(() => {
    if (professional.distancia_calculada !== undefined) {
      setDistance(`${professional.distancia_calculada} km`);
      setLoading(false);
      distanceCalculatedRef.current = true;
    }
  }, [professional.distancia_calculada]);

  const handleQuoteRequest = () => {
    if (!user) {
      alert('Debes iniciar sesión para solicitar un presupuesto.');
      return;
    }
    setShowQuoteModal(true);
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      alert('Debes iniciar sesión para agregar a favoritos.');
      return;
    }
    if (user.rol !== 'cliente') {
      alert('Solo los clientes pueden agregar profesionales a favoritos.');
      return;
    }

    setFavoriteLoading(true);
    try {
      const success = await toggleFavorite(professional.usuario_id);
      if (success) {
        // Feedback visual ya se maneja en el hook
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  // Calcular distancia usando Google Maps API o fallback
  const calculateDistance = useCallback(async () => {
    if (!professional?.zona_cobertura) return;

    setLoading(true);
    try {
      // Intentar obtener ubicación del usuario
      let clientLat, clientLon;

      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: false
            });
          });
          clientLat = position.coords.latitude;
          clientLon = position.coords.longitude;
        } catch {
          console.warn('Geolocalización no disponible, usando Buenos Aires por defecto');
          // Fallback: Buenos Aires
          clientLat = -34.6037;
          clientLon = -58.3816;
        }
      } else {
        // Fallback: Buenos Aires
        clientLat = -34.6037;
        clientLon = -58.3816;
      }

      // Obtener coordenadas del profesional
      const profCoords = getSimulatedCoordinates(professional.zona_cobertura);

      // Verificar si tenemos API key de Google Maps
      const hasGoogleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (hasGoogleMapsKey) {
        // Intentar usar Google Distance Matrix API
        try {
          const result = await getDistanceMatrix(
            { lat: clientLat, lng: clientLon },
            { lat: profCoords.lat, lng: profCoords.lng }
          );

          // Mostrar distancia y duración si están disponibles
          let distanceText = '';
          if (result.distance) {
            distanceText = result.distance.text;
          }
          if (result.duration) {
            distanceText += distanceText ? ` (${result.duration.text})` : result.duration.text;
          }
          if (distanceText) {
            setDistance(distanceText);
          } else {
            throw new Error('No distance data available');
          }
        } catch {
          // Google Maps no disponible, usar cálculo alternativo
          const dist = calculateHaversineDistance(clientLat, clientLon, profCoords.lat, profCoords.lng);
          setDistance(`${dist.toFixed(1)} km (aprox.)`);
        }
      } else {
        // No hay API key, usar cálculo alternativo directamente
        const dist = calculateHaversineDistance(clientLat, clientLon, profCoords.lat, profCoords.lng);
        setDistance(`${dist.toFixed(1)} km (aprox.)`);
      }
    } catch (error) {
      console.error('Error calculando distancia:', error);
      setDistance('Distancia no disponible');
    } finally {
      setLoading(false);
    }
  }, [professional?.zona_cobertura]);

  useEffect(() => {
    if (distanceCalculatedRef.current) return;
    distanceCalculatedRef.current = true;
    calculateDistance();
  }, [calculateDistance]);

  return (
    <div className="professional-card card-glow p-8 rounded-3xl overflow-hidden group hover-lift animate-on-scroll relative">
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-cyan-50/50 opacity-0 group-hover:opacity-100 transition-all duration-500"></div>

      {/* Favorite button - top right corner */}
      {user && user.rol === 'cliente' && (
        <button
          onClick={handleToggleFavorite}
          disabled={favoriteLoading}
          className={`absolute top-4 right-4 z-10 p-2 rounded-full transition-all duration-300 ${
            isFavorite(professional.usuario_id)
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-white/80 text-gray-600 hover:bg-white hover:text-red-500'
          } shadow-lg hover:shadow-xl disabled:opacity-50`}
          aria-label={
            isFavorite(professional.usuario_id)
              ? 'Remover de favoritos'
              : 'Agregar a favoritos'
          }
        >
          {favoriteLoading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg
              className={`w-5 h-5 ${isFavorite(professional.usuario_id) ? 'fill-current' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          )}
        </button>
      )}

      <div className="relative flex flex-col md:flex-row">
        <div className="flex-shrink-0 mb-6 md:mb-0 md:mr-8">
          <div className="relative">
            <img
              src={professional.usuario?.url_foto_perfil || 'https://placehold.co/120x120?text=👷'}
              alt={`Foto de perfil de ${professional.usuario.nombre}`}
              className="w-28 h-28 md:w-32 md:h-32 rounded-3xl object-cover shadow-xl group-hover:shadow-2xl transition-all duration-300 border-4 border-white/50"
            />
            {professional.estado_verificacion === 'verificado' && (
              <div className="absolute -top-3 -right-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full p-2 shadow-xl animate-pulse" title="Profesional Verificado">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            )}
            {professional.estado_verificacion === 'pendiente' && (
              <div className="absolute -top-3 -right-3 bg-yellow-500 text-white rounded-full p-2 shadow-xl" title="Verificación en proceso">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            )}
            {professional.estado_verificacion === 'pendiente' && (
              <div className="absolute -top-3 -right-3 bg-yellow-500 text-white rounded-full p-2 shadow-xl">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="flex-grow">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 group-hover:text-emerald-700 transition-colors duration-300">
                  {professional.usuario.nombre}
                </h2>
                {professional.estado_verificacion === 'verificado' && (
                  <VerifiedBadge size="sm" />
                )}
              </div>
              <p className="text-emerald-600 font-semibold text-xl mb-2">{professional.especialidad}</p>
              <p className="text-gray-600 flex items-center text-lg">
                <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {professional.zona_cobertura} • {loading ? 'Calculando...' : distance}
              </p>
            </div>

            <div className="mt-4 md:mt-0 md:text-right">
              <div className="mb-3">
                <RatingDisplay
                  rating={professional.calificacion_promedio || 0}
                  size="sm"
                  showLabel={false}
                />
              </div>
              <p className="text-3xl font-black text-gradient">
                ${professional.tarifa_hora}
                <span className="text-base font-normal text-gray-500">/hora</span>
              </p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-3 mb-6">
            {professional.estado_verificacion === 'verificado' && (
              <span className="bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Verificado
              </span>
            )}
            <span className="bg-gradient-to-r from-cyan-100 to-teal-100 text-cyan-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {professional.zona_cobertura}
            </span>
            {professional.estado_verificacion === 'verificado' && (
              <span className="bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Verificado
              </span>
            )}
            {professional.estado_verificacion === 'pendiente' && (
              <span className="bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                En revisión
              </span>
            )}
            {professional.estado_verificacion === 'rechazado' && (
              <span className="bg-gradient-to-r from-red-100 to-pink-100 text-red-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
                Rechazado
              </span>
            )}
            <span className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Respuesta Rápida
            </span>
          </div>

          {/* Triple Impacto indicators */}
          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <div className="flex items-center bg-emerald-50 px-3 py-2 rounded-xl text-emerald-700 font-medium">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Inclusión Social
            </div>
            <div className="flex items-center bg-green-50 px-3 py-2 rounded-xl text-green-700 font-medium">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9a9 9 0 019-9" />
              </svg>
              Eco-friendly
            </div>
          </div>
        </div>

        <div className="md:ml-8 flex flex-col justify-between space-y-4">
          <Link
            to={`/profesional/${professional.usuario_id}`}
            className="bg-white text-emerald-600 hover:text-emerald-700 font-semibold transition-all duration-300 flex items-center group/link text-lg px-4 py-2 rounded-xl hover:bg-emerald-50 hover:shadow-md hover:scale-[1.02] min-h-[44px] touch-manipulation"
            aria-label={`Ver perfil completo de ${professional.usuario.nombre}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Ver Perfil Completo</span>
          </Link>
          <button
            onClick={handleQuoteRequest}
            className="bg-amber-500 text-black px-8 py-4 rounded-2xl hover:bg-amber-600 hover:shadow-md hover:scale-[1.02] transition-all duration-300 font-bold shadow-xl text-lg flex items-center justify-center min-h-[44px] touch-manipulation"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Solicitar Presupuesto
          </button>
        </div>
      </div>

      <QuoteRequestModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        professionalId={professional.usuario_id}
        professionalName={professional.usuario.nombre}
      />
    </div>
  );
};

export default ProfessionalCard;
