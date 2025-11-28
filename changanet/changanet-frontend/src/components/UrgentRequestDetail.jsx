/**
 * @component UrgentRequestDetail - Detalle de solicitud urgente
 * @description Vista detallada de una solicitud urgente individual con acciones disponibles
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUrgentContext } from '../context/UrgentContext';

const UrgentRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentRequest,
    currentRequestLoading,
    currentRequestError,
    loadRequestDetails,
    cancelRequest,
    acceptRequest,
    rejectRequest,
    userType
  } = useUrgentContext();

  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Load request details on mount
  useEffect(() => {
    if (id) {
      loadRequestDetails(id);
    }
  }, [id, loadRequestDetails]);

  // Handle cancel request
  const handleCancelRequest = useCallback(async () => {
    if (!window.confirm('¿Estás seguro de que quieres cancelar esta solicitud urgente?')) {
      return;
    }

    setActionLoading(true);
    try {
      await cancelRequest(id);
      navigate('/urgent');
    } catch (error) {
      console.error('Error canceling request:', error);
    } finally {
      setActionLoading(false);
    }
  }, [id, cancelRequest, navigate]);

  // Handle accept request (professionals only)
  const handleAcceptRequest = useCallback(async () => {
    setActionLoading(true);
    try {
      await acceptRequest(id);
      // Stay on the page to show updated status
    } catch (error) {
      console.error('Error accepting request:', error);
    } finally {
      setActionLoading(false);
    }
  }, [id, acceptRequest]);

  // Handle reject request (professionals only)
  const handleRejectRequest = useCallback(async () => {
    if (!rejectReason.trim()) {
      alert('Por favor, proporciona una razón para rechazar la solicitud.');
      return;
    }

    setActionLoading(true);
    try {
      await rejectRequest(id, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      navigate('/urgent');
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setActionLoading(false);
    }
  }, [id, rejectReason, rejectRequest, navigate]);

  // Format time elapsed
  const getTimeElapsed = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  // Get status info
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return {
          color: 'yellow',
          text: 'Pendiente',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          description: 'Esperando que un profesional acepte la solicitud'
        };
      case 'assigned':
        return {
          color: 'green',
          text: 'Asignada',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          description: 'Un profesional ha aceptado la solicitud'
        };
      case 'in_progress':
        return {
          color: 'blue',
          text: 'En Progreso',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          description: 'El profesional está trabajando en la solicitud'
        };
      case 'completed':
        return {
          color: 'purple',
          text: 'Completada',
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-800',
          description: 'La solicitud ha sido completada exitosamente'
        };
      case 'cancelled':
        return {
          color: 'red',
          text: 'Cancelada',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          description: 'La solicitud ha sido cancelada'
        };
      default:
        return {
          color: 'gray',
          text: status,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          description: ''
        };
    }
  };

  // Get service category display name
  const getServiceCategoryName = (category) => {
    const categories = {
      general: 'Servicio General',
      plomero: 'Plomería',
      electricista: 'Electricidad',
      albañil: 'Albañilería',
      pintor: 'Pintura',
      gasista: 'Gas',
      herrero: 'Herrería',
      carpintero: 'Carpintería',
      jardinero: 'Jardinería',
      mecanico: 'Mecánica',
      informatica: 'Informática'
    };
    return categories[category] || category;
  };

  if (currentRequestLoading) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3"></div>
          <span className="text-gray-600">Cargando detalles de la solicitud...</span>
        </div>
      </div>
    );
  }

  if (currentRequestError) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 font-medium">Error al cargar la solicitud</p>
          </div>
          <p className="text-red-600 mt-1">{currentRequestError}</p>
          <button
            onClick={() => navigate('/urgent')}
            className="mt-3 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  if (!currentRequest) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6">
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-lg font-medium">Solicitud no encontrada</p>
          <button
            onClick={() => navigate('/urgent')}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(currentRequest.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">
                Solicitud Urgente #{currentRequest.id.slice(-6)}
              </h1>
              <p className="text-red-100 text-sm">
                {getTimeElapsed(currentRequest.created_at)}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
              {statusInfo.text}
            </span>
          </div>
        </div>

        {/* Status Description */}
        <div className="p-6 border-b border-gray-200">
          <p className="text-gray-600">{statusInfo.description}</p>
        </div>

        {/* Actions */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/urgent')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Volver a la lista
            </button>

            {currentRequest.status === 'pending' && (
              <>
                {userType === 'client' && (
                  <button
                    onClick={handleCancelRequest}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Cancelando...' : 'Cancelar Solicitud'}
                  </button>
                )}

                {userType === 'professional' && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleAcceptRequest}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? 'Aceptando...' : 'Aceptar Solicitud'}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Request Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Basic Info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información del Problema</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción del problema
              </label>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-900 whitespace-pre-wrap">{currentRequest.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de servicio
                </label>
                <p className="text-gray-900">
                  {getServiceCategoryName(currentRequest.service_category || currentRequest.serviceCategory)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Radio de búsqueda
                </label>
                <p className="text-gray-900">{currentRequest.radius_km || currentRequest.radiusKm} km</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio estimado
              </label>
              <p className="text-2xl font-bold text-green-600">
                ${currentRequest.price_estimate?.toLocaleString('es-AR') || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Location & Assignment */}
        <div className="space-y-6">
          {/* Location */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ubicación</h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-gray-900 font-medium">Coordenadas</p>
                  <p className="text-gray-600 text-sm">
                    {currentRequest.latitude?.toFixed(4) || currentRequest.location?.lat?.toFixed(4)}, {' '}
                    {currentRequest.longitude?.toFixed(4) || currentRequest.location?.lng?.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Info */}
          {currentRequest.status === 'assigned' && currentRequest.assigned_professional && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Profesional Asignado</h3>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">
                    {currentRequest.assigned_professional.nombre}
                  </p>
                  {currentRequest.assigned_professional.telefono && (
                    <p className="text-gray-600 text-sm">
                      {currentRequest.assigned_professional.telefono}
                    </p>
                  )}
                  <p className="text-gray-500 text-sm">
                    Asignado {getTimeElapsed(currentRequest.assigned_at)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Client Info (for professionals) */}
          {userType === 'professional' && currentRequest.client && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Cliente</h3>

              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <p className="text-gray-900">{currentRequest.client.nombre}</p>
                </div>
                {currentRequest.client.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{currentRequest.client.email}</p>
                  </div>
                )}
                {currentRequest.client.telefono && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <p className="text-gray-900">{currentRequest.client.telefono}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photos */}
      {currentRequest.photos && currentRequest.photos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fotos del Problema</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentRequest.photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img
                  src={photo.url || photo}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
                  onClick={() => {
                    // Open photo in modal or lightbox
                    window.open(photo.url || photo, '_blank');
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Rechazar Solicitud
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón del rechazo (opcional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows="3"
                  placeholder="Explica por qué no puedes atender esta solicitud..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRejectRequest}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Rechazando...' : 'Rechazar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UrgentRequestDetail;