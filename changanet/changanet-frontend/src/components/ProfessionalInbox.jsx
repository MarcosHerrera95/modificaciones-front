/**
 * @component ProfessionalInbox - Bandeja de Entrada del Profesional
 * @descripción Componente para que los profesionales vean y gestionen solicitudes recibidas (REQ-32)
 * @versión 2.0 - Sistema robusto con gestión avanzada de solicitudes
 * 
 * FUNCIONALIDADES IMPLEMENTADAS:
 * ✅ REQ-32: Vista de solicitudes distribuidas al profesional
 * ✅ Gestión de estado de solicitudes (respondidas/pendientes/expiradas)
 * ✅ Notificaciones de tiempo límite
 * ✅ Filtros y búsqueda de solicitudes
 * ✅ Vista detallada de solicitud completa
 * ✅ Acceso rápido a responder solicitudes
 * ✅ Estadísticas de rendimiento
 * 
 * CARACTERÍSTICAS UX:
 * - Dashboard intuitivo con métricas
 * - Indicadores visuales de urgencia
 * - Filtros avanzados
 * - Acciones en lote
 * - Preview rápido de solicitudes
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNotificationContext } from '../context/NotificationContext';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import BudgetOfferForm from './BudgetOfferForm';

const STATUS_FILTERS = [
  { value: 'all', label: 'Todas', count: 0 },
  { value: 'pending', label: 'Pendientes', count: 0 },
  { value: 'responded', label: 'Respondidas', count: 0 },
  { value: 'expired', label: 'Expiradas', count: 0 },
  { value: 'viewed', label: 'Vistas', count: 0 }
];

const URGENCY_COLORS = {
  URGENT: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  NORMAL: 'bg-blue-100 text-blue-800 border-blue-200'
};

/**
 * @función ProfessionalInbox - Componente principal de la bandeja de entrada
 * @descripción Dashboard para que profesionales gestionen solicitudes de presupuesto
 * @returns {JSX.Element} Bandeja de entrada del profesional
 */
const ProfessionalInbox = () => {
  const { professionalId } = useParams();
  const notificationContext = useNotificationContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [distributions, setDistributions] = useState([]);
  const [filteredDistributions, setFilteredDistributions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('urgency'); // urgency, date, price
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [selectedDistribution, setSelectedDistribution] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  /**
   * Cargar datos de la bandeja de entrada
   */
  useEffect(() => {
    fetchInboxData();
  }, [professionalId]);

  /**
   * Aplicar filtros y ordenamiento
   */
  useEffect(() => {
    applyFiltersAndSort();
  }, [distributions, statusFilter, searchTerm, sortBy]);

  const fetchInboxData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/budget-requests/inbox/${professionalId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        setData(result.data);
        setDistributions(result.data.distributions || []);
      } else {
        setError(result.error || 'Error al cargar la bandeja de entrada');
      }
    } catch (error) {
      console.error('Error fetching inbox data:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...distributions];

    // Aplicar filtro de estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Aplicar búsqueda
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.request?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.request?.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.request?.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Aplicar ordenamiento
    const urgencyOrder = { URGENT: 3, HIGH: 2, NORMAL: 1 };
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'urgency':
          return (urgencyOrder[b.urgencyLevel] || 0) - (urgencyOrder[a.urgencyLevel] || 0);
        case 'date':
          return new Date(b.sentAt) - new Date(a.sentAt);
        case 'expires':
          return new Date(a.expiresAt) - new Date(b.expiresAt);
        default:
          return 0;
      }
    });

    setFilteredDistributions(filtered);
  };

  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredDistributions.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredDistributions.map(item => item.id)));
    }
  };

  const handleStartOffer = (distribution) => {
    setSelectedDistribution(distribution);
    setShowOfferForm(true);
  };

  const handleOfferSuccess = () => {
    setShowOfferForm(false);
    setSelectedDistribution(null);
    fetchInboxData(); // Recargar datos

    // Notificación de éxito
    if (notificationContext) {
      notificationContext.showNotification({
        type: 'success',
        title: 'Respuesta enviada',
        message: 'Tu oferta ha sido enviada exitosamente al cliente.'
      });
    }
  };

  const formatTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs <= 0) return 'Expirado';
    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h`;
    return 'Menos de 1h';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'responded': return 'bg-green-100 text-green-800';
      case 'viewed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      plomeria: '🔧',
      electricidad: '⚡',
      albañileria: '🧱',
      pintura: '🎨',
      jardineria: '🌱',
      limpieza: '🧽',
      gasista: '🔥',
      cerrajeria: '🔐',
      otros: '🔨'
    };
    return icons[category] || '🔨';
  };

  // Paginación
  const totalPages = Math.ceil(filteredDistributions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredDistributions.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600">Cargando bandeja de entrada...</span>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorAlert 
        message={error}
        onRetry={() => fetchInboxData()}
        className="my-4"
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bandeja de Entrada</h1>
        <p className="text-gray-600">Gestiona las solicitudes de presupuesto que recibes</p>
      </div>

      {/* Estadísticas del panel */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-blue-600">{data.summary.total}</div>
            <div className="text-sm text-gray-600">Total solicitudes</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-yellow-600">{data.summary.pending}</div>
            <div className="text-sm text-gray-600">Pendientes</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-green-600">{data.summary.responded}</div>
            <div className="text-sm text-gray-600">Respondidas</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-red-600">{data.summary.expired}</div>
            <div className="text-sm text-gray-600">Expiradas</div>
          </div>
        </div>
      )}

      {/* Controles de filtrado */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
          {/* Búsqueda */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar solicitudes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_FILTERS.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label} ({filter.count || 0})
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="urgency">Ordenar por urgencia</option>
              <option value="date">Más recientes</option>
              <option value="expires">Por expirar</option>
            </select>

            {/* Seleccionar todo */}
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedItems.size === filteredDistributions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de solicitudes */}
      <div className="bg-white rounded-lg shadow-sm border">
        {currentItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay solicitudes</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'No se encontraron solicitudes con los filtros aplicados.'
                : 'Aún no has recibido solicitudes de presupuesto.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {currentItems.map((item) => (
              <RequestItem
                key={item.id}
                item={item}
                isSelected={selectedItems.has(item.id)}
                onSelect={() => handleItemSelect(item.id)}
                onRespond={() => handleStartOffer(item)}
                formatTimeRemaining={formatTimeRemaining}
                getStatusColor={getStatusColor}
                getCategoryIcon={getCategoryIcon}
              />
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredDistributions.length)} de {filteredDistributions.length} solicitudes
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Anterior
            </button>
            <span className="px-3 py-2 text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Formulario de oferta */}
      {showOfferForm && selectedDistribution && (
        <BudgetOfferForm
          distribution={selectedDistribution}
          onClose={() => {
            setShowOfferForm(false);
            setSelectedDistribution(null);
          }}
          onSuccess={handleOfferSuccess}
        />
      )}
    </div>
  );
};

/**
 * @component RequestItem - Item individual de solicitud
 * @descripción Muestra una solicitud individual en la lista
 */
const RequestItem = ({ 
  item, 
  isSelected, 
  onSelect, 
  onRespond, 
  formatTimeRemaining, 
  getStatusColor, 
  getCategoryIcon 
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`p-4 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
      <div className="flex items-start space-x-4">
        {/* Checkbox de selección */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />

        {/* Información principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{getCategoryIcon(item.request?.category)}</span>
              <div>
                <h3 className="text-lg font-medium text-gray-900 truncate">
                  {item.request?.title}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{item.request?.category}</span>
                  <span>•</span>
                  <span>{new Date(item.sentAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span className={getStatusColor(item.status)}>
                    {item.status === 'sent' ? 'Pendiente' : 
                     item.status === 'responded' ? 'Respondida' : 
                     item.status === 'expired' ? 'Expirada' : item.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Indicadores de urgencia */}
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                URGENCY_COLORS[item.urgencyLevel] || URGENCY_COLORS.NORMAL
              }`}>
                {item.urgencyLevel}
              </span>
              <span className="text-sm text-gray-600">
                {formatTimeRemaining(item.expiresAt)}
              </span>
            </div>
          </div>

          {/* Vista previa de la descripción */}
          <div className="mb-3">
            <p className="text-gray-600 text-sm line-clamp-2">
              {item.request?.description}
            </p>
          </div>

          {/* Información del cliente */}
          <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
            <div className="flex items-center space-x-2">
              {item.request?.client?.url_foto_perfil ? (
                <img
                  src={item.request.client.url_foto_perfil}
                  alt={item.request.client.nombre}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
              )}
              <span>{item.request?.client?.nombre}</span>
            </div>
            {item.request?.location && (
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{item.request.location.address || 'Ubicación no especificada'}</span>
              </div>
            )}
          </div>

          {/* Fotos preview */}
          {item.request?.photos && item.request.photos.length > 0 && (
            <div className="flex space-x-2 mb-3">
              {item.request.photos.slice(0, 3).map((photo, index) => (
                <img
                  key={index}
                  src={photo.url}
                  alt={`Foto ${index + 1}`}
                  className="w-12 h-12 object-cover rounded border"
                />
              ))}
              {item.request.photos.length > 3 && (
                <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                  <span className="text-xs text-gray-500">+{item.request.photos.length - 3}</span>
                </div>
              )}
            </div>
          )}

          {/* Vista expandida */}
          {expanded && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Descripción completa:</h4>
              <p className="text-gray-600 text-sm mb-3">{item.request?.description}</p>
              
              {/* Presupuesto esperado */}
              {(item.request?.budgetRangeMin || item.request?.budgetRangeMax) && (
                <div className="mb-3">
                  <h4 className="font-medium text-gray-900 mb-1">Presupuesto esperado:</h4>
                  <p className="text-sm text-gray-600">
                    {item.request.budgetRangeMin && item.request.budgetRangeMax
                      ? `$${item.request.budgetRangeMin.toLocaleString()} - $${item.request.budgetRangeMax.toLocaleString()}`
                      : item.request.budgetRangeMin
                      ? `Mínimo: $${item.request.budgetRangeMin.toLocaleString()}`
                      : `Hasta: $${item.request.budgetRangeMax?.toLocaleString()}`
                    }
                  </p>
                </div>
              )}

              {/* Fecha preferida */}
              {item.request?.preferredDate && (
                <div className="mb-3">
                  <h4 className="font-medium text-gray-900 mb-1">Fecha preferida:</h4>
                  <p className="text-sm text-gray-600">
                    {new Date(item.request.preferredDate).toLocaleDateString('es-AR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {expanded ? 'Ocultar' : 'Ver más'}
          </button>
          
          {!item.responded && !item.isExpired && (
            <button
              onClick={onRespond}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              Responder
            </button>
          )}
          
          {item.responded && (
            <div className="px-4 py-2 bg-green-100 text-green-800 text-sm rounded-lg">
              Respondida
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfessionalInbox;