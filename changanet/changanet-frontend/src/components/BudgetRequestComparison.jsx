/**
 * @component BudgetRequestComparison - Vista Comparativa de Ofertas de Presupuesto
 * @descripción Componente para comparar ofertas de múltiples profesionales (REQ-34)
 * @versión 2.0 - Sistema robusto con comparación avanzada y selección intuitiva
 * 
 * FUNCIONALIDADES IMPLEMENTADAS:
 * ✅ REQ-34: Cliente compara ofertas en una vista única
 * ✅ Vista de tabla comparativa responsive
 * ✅ Filtros y ordenamiento por precio/tiempo
 * ✅ Información detallada del profesional
 * ✅ Selección de oferta favorita
 * ✅ Chat directo con profesionales
 * ✅ Indicadores de "Mejor Precio" y "Más Rápido"
 * 
 * CARACTERÍSTICAS UX:
 * - Vista de cards mobile-friendly
 * - Indicadores visuales claros
 * - Interacción intuitiva
 * - Información contextual rica
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../context/NotificationContext';
import { useChat } from '../context/ChatContext';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import ProfessionalCard from './ProfessionalCard';
import StarRating from './StarRating';

const SORT_OPTIONS = [
  { value: 'price_asc', label: 'Precio: Menor a Mayor' },
  { value: 'price_desc', label: 'Precio: Mayor a Menor' },
  { value: 'time_asc', label: 'Tiempo: Más Rápido' },
  { value: 'time_desc', label: 'Tiempo: Más Lento' },
  { value: 'rating_desc', label: 'Calificación: Mejor' },
  { value: 'distance_asc', label: 'Distancia: Más Cercano' }
];

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todas las ofertas' },
  { value: 'best_price', label: 'Mejor precio' },
  { value: 'fastest', label: 'Más rápido' },
  { value: 'verified', label: 'Solo verificados' },
  { value: 'top_rated', label: 'Top calificados' }
];

/**
 * @función BudgetRequestComparison - Componente principal de comparación
 * @descripción Muestra vista comparativa de ofertas con filtros y ordenamiento
 * @returns {JSX.Element} Vista comparativa de ofertas
 */
const BudgetRequestComparison = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const notificationContext = useNotificationContext();
  const { startChat } = useChat();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [offers, setOffers] = useState([]);
  const [filteredOffers, setFilteredOffers] = useState([]);
  const [sortBy, setSortBy] = useState('price_asc');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);

  /**
   * Cargar datos de la solicitud y ofertas
   */
  useEffect(() => {
    fetchComparisonData();
  }, [id]);

  /**
   * Filtrar y ordenar ofertas cuando cambien los criterios
   */
  useEffect(() => {
    applyFiltersAndSort();
  }, [offers, sortBy, filterBy]);

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/budget-requests/${id}/offers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        setData(result.data);
        setOffers(result.data.offers || []);
      } else {
        setError(result.error || 'Error al cargar las ofertas');
      }
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...offers];

    // Aplicar filtros
    switch (filterBy) {
      case 'best_price':
        filtered = filtered.filter(offer => offer.isBestPrice);
        break;
      case 'fastest':
        filtered = filtered.filter(offer => offer.isFastest);
        break;
      case 'verified':
        filtered = filtered.filter(offer => offer.professional?.is_verified);
        break;
      case 'top_rated':
        filtered = filtered.filter(offer => offer.professional?.rating >= 4.5);
        break;
    }

    // Aplicar ordenamiento
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'time_asc':
          return (a.estimatedDays || 999) - (b.estimatedDays || 999);
        case 'time_desc':
          return (b.estimatedDays || 0) - (a.estimatedDays || 0);
        case 'rating_desc':
          return (b.professional?.rating || 0) - (a.professional?.rating || 0);
        case 'distance_asc':
          return (a.professionalDistance || 999) - (b.professionalDistance || 999);
        default:
          return 0;
      }
    });

    setFilteredOffers(filtered);
  };

  const handleSelectOffer = async (offer) => {
    setSelectedOffer(offer);
    setShowConfirmModal(true);
  };

  const confirmSelection = async () => {
    if (!selectedOffer) return;

    setSelectionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/budget-requests/${id}/select-offer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({ offerId: selectedOffer.id })
      });

      const result = await response.json();

      if (response.ok) {
        // Notificación de éxito
        if (notificationContext) {
          notificationContext.showNotification({
            type: 'success',
            title: '¡Oferta seleccionada!',
            message: `Has seleccionado a ${selectedOffer.professional?.usuarios?.nombre}. Te contactaremos pronto.`
          });
        }

        // Navegar a la página de servicios o mostrar confirmación
        navigate('/mi-cuenta/presupuestos');
      } else {
        setError(result.error || 'Error al seleccionar la oferta');
      }
    } catch (error) {
      console.error('Error selecting offer:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setSelectionLoading(false);
      setShowConfirmModal(false);
    }
  };

  const handleStartChat = (professionalId, professionalName) => {
    startChat(professionalId, professionalName);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatTime = (days) => {
    if (!days) return 'No especificado';
    if (days === 1) return '1 día';
    if (days < 7) return `${days} días`;
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays === 0) return `${weeks} semana${weeks > 1 ? 's' : ''}`;
    return `${weeks}s ${remainingDays}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600">Cargando comparación de ofertas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorAlert 
        message={error}
        onRetry={() => fetchComparisonData()}
        className="my-4"
      />
    );
  }

  if (!data || offers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay ofertas disponibles</h3>
        <p className="text-gray-600 mb-6">Aún no has recibido ofertas para esta solicitud de presupuesto.</p>
        <button
          onClick={() => navigate('/mi-cuenta/presupuestos')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Volver a mis presupuestos
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comparar ofertas</h1>
            <p className="text-gray-600">Solicitud: {data.request?.title}</p>
          </div>
          <button
            onClick={() => navigate('/mi-cuenta/presupuestos')}
            className="text-gray-500 hover:text-gray-700 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Volver</span>
          </button>
        </div>

        {/* Métricas de comparación */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{offers.length}</div>
              <div className="text-sm text-blue-800">Ofertas recibidas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {formatPrice(data.comparisonMetrics?.priceRange?.min || 0)}
              </div>
              <div className="text-sm text-blue-800">Precio mínimo</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {formatTime(data.comparisonMetrics?.timeRange?.min)}
              </div>
              <div className="text-sm text-blue-800">Tiempo más rápido</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {data.comparisonMetrics?.responseRate || 0}%
              </div>
              <div className="text-sm text-blue-800">Tasa de respuesta</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de filtrado y ordenamiento */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filtrar:</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Ordenar por:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de ofertas */}
      <div className="space-y-4">
        {filteredOffers.map((offer, index) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            rank={index + 1}
            onSelect={() => handleSelectOffer(offer)}
            onChat={() => handleStartChat(offer.professional?.usuarios?.id, offer.professional?.usuarios?.nombre)}
            isSelected={selectedOffer?.id === offer.id}
          />
        ))}
      </div>

      {/* Modal de confirmación */}
      {showConfirmModal && (
        <ConfirmSelectionModal
          offer={selectedOffer}
          onConfirm={confirmSelection}
          onCancel={() => {
            setShowConfirmModal(false);
            setSelectedOffer(null);
          }}
          loading={selectionLoading}
          formatPrice={formatPrice}
          formatTime={formatTime}
        />
      )}
    </div>
  );
};

/**
 * @component OfferCard - Card individual de oferta
 * @descripción Muestra información detallada de una oferta profesional
 */
const OfferCard = ({ offer, rank, onSelect, onChat, isSelected }) => {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatTime = (days) => {
    if (!days) return 'No especificado';
    if (days === 1) return '1 día';
    if (days < 7) return `${days} días`;
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays === 0) return `${weeks} semana${weeks > 1 ? 's' : ''}`;
    return `${weeks}s ${remainingDays}d`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border-2 transition-all hover:shadow-md ${
      isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          {/* Información del profesional */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              {offer.professional?.usuarios?.url_foto_perfil ? (
                <img
                  src={offer.professional.usuarios.url_foto_perfil}
                  alt={offer.professional.usuarios.nombre}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              
              {/* Badges de indicadores */}
              <div className="absolute -top-1 -right-1 flex flex-col space-y-1">
                {offer.isBestPrice && (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    Mejor precio
                  </span>
                )}
                {offer.isFastest && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    Más rápido
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {offer.professional?.usuarios?.nombre}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <StarRating rating={offer.professional?.rating || 0} />
                  <span>({offer.professional?.rating?.toFixed(1) || '0.0'})</span>
                </div>
                {offer.professional?.years_experience && (
                  <span>{offer.professional.years_experience} años exp.</span>
                )}
                {offer.professionalDistance && (
                  <span>{offer.professionalDistance.toFixed(1)} km</span>
                )}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                {offer.professional?.is_verified && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verificado
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {offer.professional?.specialty || 'Profesional'}
                </span>
              </div>
            </div>
          </div>

          {/* Precio principal */}
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {formatPrice(offer.price)}
            </div>
            {offer.estimatedDays && (
              <div className="text-sm text-gray-600">
                {formatTime(offer.estimatedDays)}
              </div>
            )}
          </div>
        </div>

        {/* Comentarios */}
        {offer.comments && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Comentarios:</h4>
            <p className="text-gray-600 text-sm leading-relaxed bg-gray-50 p-3 rounded-lg">
              {offer.comments}
            </p>
          </div>
        )}

        {/* Disponibilidad */}
        {offer.availabilityDetails && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Disponibilidad:</h4>
            <p className="text-gray-600 text-sm">{offer.availabilityDetails}</p>
          </div>
        )}

        {/* Fotos de la oferta */}
        {offer.photos && offer.photos.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Trabajos anteriores:</h4>
            <div className="flex space-x-2 overflow-x-auto">
              {offer.photos.slice(0, 3).map((photo, index) => (
                <img
                  key={index}
                  src={photo.url}
                  alt={`Trabajo ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                />
              ))}
              {offer.photos.length > 3 && (
                <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-gray-500">+{offer.photos.length - 3}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comparación con promedio */}
        <div className="mb-4 bg-gray-50 p-3 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
            <div>
              <div className="text-xs text-gray-500">Vs. promedio</div>
              <div className={`font-medium ${parseFloat(offer.priceVsAverage) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {offer.priceVsAverage > 0 ? '+' : ''}{offer.priceVsAverage}%
              </div>
            </div>
            {offer.estimatedDays && (
              <div>
                <div className="text-xs text-gray-500">Tiempo adicional</div>
                <div className="font-medium text-blue-600">
                  {offer.daysDifference > 0 ? `+${offer.daysDifference}d` : 'Más rápido'}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500">Distancia</div>
              <div className="font-medium text-purple-600">
                {offer.professionalDistance ? `${offer.professionalDistance.toFixed(1)} km` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Calificación</div>
              <div className="font-medium text-yellow-600">
                {offer.professional?.rating?.toFixed(1) || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex space-x-3">
            <button
              onClick={onChat}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Chat</span>
            </button>
            
            <button
              onClick={onSelect}
              className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                isSelected
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{isSelected ? 'Seleccionado' : 'Seleccionar'}</span>
            </button>
          </div>

          <div className="text-xs text-gray-500">
            Oferta #{rank} de {offer.totalOffers || 'múltiples'}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @component ConfirmSelectionModal - Modal de confirmación de selección
 * @descripción Modal para confirmar la selección de una oferta
 */
const ConfirmSelectionModal = ({ offer, onConfirm, onCancel, loading, formatPrice, formatTime }) => {
  if (!offer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar selección</h3>
              <p className="text-sm text-gray-600">¿Estás seguro de esta elección?</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{offer.professional?.usuarios?.nombre}</span>
              <span className="font-bold text-lg">{formatPrice(offer.price)}</span>
            </div>
            {offer.estimatedDays && (
              <div className="text-sm text-gray-600">
                Tiempo estimado: {formatTime(offer.estimatedDays)}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">¿Qué sucede después?</p>
                <ul className="space-y-1 text-xs">
                  <li>• Te contactaremos para coordinar los detalles</li>
                  <li>• El profesional recibirá tu confirmación</li>
                  <li>• Podrás agendar el servicio en tu panel</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              <span>{loading ? 'Confirmando...' : 'Confirmar Selección'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetRequestComparison;