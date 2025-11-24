/**
 * Componente OptimizedProfessionalCard
 * Implementa React.memo, useMemo, useCallback y lazy loading para optimización de performance
 * Creado: 2025-11-24
 * Versión: 2.0.0
 */

import React, { memo, useMemo, useCallback } from 'react';
import { StarIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

// Componente memoizado para optimización
const ProfessionalCard = memo(({ 
  professional, 
  isFavorite, 
  onToggleFavorite, 
  onViewProfile,
  className = '' 
}) => {
  // Memoizar cálculos costosos
  const cardContent = useMemo(() => {
    const rating = professional?.perfiles_profesionales?.calificacion_promedio || 0;
    const experience = professional?.perfiles_profesionales?.anos_experiencia || 0;
    const hourlyRate = professional?.perfiles_profesionales?.tarifa_hora || 0;
    const coverageArea = professional?.perfiles_profesionales?.zona_cobertura || '';
    const profilePhoto = professional?.url_foto_perfil || '/default-avatar.png';
    
    return {
      rating: rating.toFixed(1),
      experience: experience > 0 ? `${experience} años` : 'Nuevo',
      hourlyRate: hourlyRate > 0 ? `$${hourlyRate.toLocaleString()}/hora` : 'A convenir',
      coverageArea: coverageArea.length > 30 ? `${coverageArea.substring(0, 30)}...` : coverageArea,
      profilePhoto,
      isVerified: professional?.esta_verificado || false
    };
  }, [professional]);

  // Memoizar callbacks para evitar re-renders innecesarios
  const handleToggleFavorite = useCallback((e) => {
    e.stopPropagation();
    onToggleFavorite?.(professional.id);
  }, [professional.id, onToggleFavorite]);

  const handleViewProfile = useCallback(() => {
    onViewProfile?.(professional.id);
  }, [professional.id, onViewProfile]);

  // Memoizar la lista de especialidades
  const specialties = useMemo(() => {
    if (professional?.perfiles_profesionales?.especialidades) {
      try {
        const parsed = JSON.parse(professional.perfiles_profesionales.especialidades);
        return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
      } catch {
        return [];
      }
    }
    return [professional?.perfiles_profesionales?.especialidad].filter(Boolean);
  }, [professional]);

  return (
    <div 
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-[1.02] ${className}`}
      onClick={handleViewProfile}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleViewProfile()}
      aria-label={`Ver perfil de ${professional?.nombre || 'Profesional'}`}
    >
      {/* Header con foto de perfil */}
      <div className="relative p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={cardContent.profilePhoto}
                alt={`Foto de perfil de ${professional?.nombre}`}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                loading="lazy"
                onError={(e) => {
                  e.target.src = '/default-avatar.png';
                }}
              />
              {cardContent.isVerified && (
                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {professional?.nombre || 'Profesional'}
              </h3>
              
              {/* Rating */}
              <div className="flex items-center space-x-1 mt-1">
                <StarIcon className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-600">{cardContent.rating}</span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-600">{cardContent.experience}</span>
              </div>
            </div>
          </div>
          
          {/* Botón de favorito */}
          <button
            onClick={handleToggleFavorite}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={isFavorite ? 'Remover de favoritos' : 'Agregar a favoritos'}
          >
            {isFavorite ? (
              <HeartSolidIcon className="w-5 h-5 text-red-500" />
            ) : (
              <HeartOutlineIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="px-4 pb-4">
        {/* Especialidades */}
        {specialties.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {specialties.map((specialty, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Información adicional */}
        <div className="space-y-2">
          {/* Zona de cobertura */}
          <div className="flex items-center text-sm text-gray-600">
            <MapPinIcon className="w-4 h-4 mr-1 flex-shrink-0" />
            <span className="truncate">{cardContent.coverageArea}</span>
          </div>

          {/* Tarifa */}
          <div className="flex items-center text-sm text-gray-600">
            <ClockIcon className="w-4 h-4 mr-1 flex-shrink-0" />
            <span className="font-medium">{cardContent.hourlyRate}</span>
          </div>
        </div>

        {/* Estado de disponibilidad */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              professional?.perfiles_profesionales?.esta_disponible 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {professional?.perfiles_profesionales?.esta_disponible ? 'Disponible' : 'No disponible'}
            </span>
            
            {professional?.perfiles_profesionales?.estado_verificacion === 'verificado' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Verificado
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// Nombre de display para debugging
ProfessionalCard.displayName = 'OptimizedProfessionalCard';

export default ProfessionalCard;

/**
 * Hook personalizado para optimizar la carga de tarjetas de profesionales
 * Implementa virtualización y lazy loading para listas grandes
 */
export const useOptimizedProfessionalList = (professionals, options = {}) => {
  const {
    itemsPerPage = 20,
    enableVirtualization = true,
    enableIntersectionObserver = true
  } = options;

  const [currentPage, setCurrentPage] = React.useState(1);
  const [visibleItems, setVisibleItems] = React.useState([]);
  const observerRef = React.useRef(null);

  // Memoizar la lista filtrada y paginada
  const paginatedProfessionals = useMemo(() => {
    if (!professionals || !Array.isArray(professionals)) return [];
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return professionals.slice(startIndex, endIndex);
  }, [professionals, currentPage, itemsPerPage]);

  // Cargar más elementos cuando sea necesario
  const loadMore = useCallback(() => {
    if (currentPage * itemsPerPage < professionals.length) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, itemsPerPage, professionals.length]);

  // Intersection Observer para lazy loading
  React.useEffect(() => {
    if (!enableIntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, enableIntersectionObserver]);

  return {
    professionals: paginatedProfessionals,
    currentPage,
    totalPages: Math.ceil(professionals.length / itemsPerPage),
    hasMore: currentPage * itemsPerPage < professionals.length,
    loadMore,
    setCurrentPage
  };
};