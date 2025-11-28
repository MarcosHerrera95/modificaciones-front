/**
 * @component UrgentCard - Tarjeta para mostrar solicitudes urgentes
 * @description Componente reutilizable para mostrar información de solicitudes urgentes en formato de tarjeta
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UrgentCard = ({
  request,
  userType = 'client',
  onAccept,
  onReject,
  onCancel,
  onViewDetails,
  showActions = true,
  compact = false
}) => {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);

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
          borderColor: 'border-yellow-200',
          icon: '⏳'
        };
      case 'assigned':
        return {
          color: 'green',
          text: 'Asignada',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          icon: '✅'
        };
      case 'in_progress':
        return {
          color: 'blue',
          text: 'En Progreso',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          icon: '🔄'
        };
      case 'completed':
        return {
          color: 'purple',
          text: 'Completada',
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-800',
          borderColor: 'border-purple-200',
          icon: '🏁'
        };
      case 'cancelled':
        return {
          color: 'red',
          text: 'Cancelada',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-200',
          icon: '❌'
        };
      default:
        return {
          color: 'gray',
          text: status,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-200',
          icon: '❓'
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

  // Handle actions
  const handleAccept = async () => {
    if (onAccept) {
      setActionLoading(true);
      try {
        await onAccept(request.id);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleReject = async () => {
    if (onReject) {
      setActionLoading(true);
      try {
        await onReject(request.id);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleCancel = async () => {
    if (onCancel && window.confirm('¿Estás seguro de que quieres cancelar esta solicitud?')) {
      setActionLoading(true);
      try {
        await onCancel(request.id);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(request.id);
    } else {
      navigate(`/urgent/${request.id}`);
    }
  };

  const statusInfo = getStatusInfo(request.status);

  if (compact) {
    // Compact version for lists
    return (
      <div className={`border-l-4 ${statusInfo.borderColor} bg-white rounded-r-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer`} onClick={handleViewDetails}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-lg">{statusInfo.icon}</span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Solicitud #{request.id.slice(-6)}
              </h3>
              <p className="text-xs text-gray-600">
                {getServiceCategoryName(request.service_category || request.serviceCategory)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
              {statusInfo.text}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              {getTimeElapsed(request.created_at)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className={`border-l-4 ${statusInfo.borderColor} bg-white rounded-r-lg shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{statusInfo.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Solicitud Urgente #{request.id.slice(-6)}
              </h2>
              <p className="text-sm text-gray-600">
                {getServiceCategoryName(request.service_category || request.serviceCategory)}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
            {statusInfo.text}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Description */}
        <div className="mb-4">
          <p className="text-gray-700 text-sm leading-relaxed">
            {request.description.length > 150
              ? `${request.description.substring(0, 150)}...`
              : request.description
            }
          </p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="font-medium text-gray-600">Tiempo:</span>
            <p className="text-gray-900">{getTimeElapsed(request.created_at)}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Radio:</span>
            <p className="text-gray-900">{request.radius_km || request.radiusKm} km</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Precio est.:</span>
            <p className="text-gray-900 font-semibold">
              ${request.price_estimate?.toLocaleString('es-AR') || 'N/A'}
            </p>
          </div>
          {userType === 'professional' && request.client && (
            <div>
              <span className="font-medium text-gray-600">Cliente:</span>
              <p className="text-gray-900">{request.client.nombre}</p>
            </div>
          )}
        </div>

        {/* Photos Preview */}
        {request.photos && request.photos.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-600">
                {request.photos.length} foto{request.photos.length !== 1 ? 's' : ''} adjunta{request.photos.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Assignment Info */}
        {request.status === 'assigned' && request.assigned_professional && (
          <div className={`mb-4 p-3 rounded-lg ${statusInfo.bgColor} border ${statusInfo.borderColor}`}>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className={`font-medium text-sm ${statusInfo.textColor}`}>
                Asignado a {request.assigned_professional.nombre}
              </span>
            </div>
          </div>
        )}

        {/* Candidates Info */}
        {request.status === 'pending' && request.candidates_count > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.493-1.646 1.743-2.98l-4.243-5.5a3.54 3.54 0 00-.514-1.332l-1.243-2.24a1.5 1.5 0 00-.514-1.332l-4.243-5.5A1.5 1.5 0 004.14 4.5L6.5 5.5c1.046.667 1.7 1.81 1.7 3.135 0 .88-.34 1.684-.916 2.257L4.5 7.5A1.5 1.5 0 004.5 5.5L2 4.5A1.5 1.5 0 001.5 3H1c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v6.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 018 9.5V8" />
              </svg>
              <span className="font-medium text-sm text-yellow-800">
                {request.candidates_count} profesional{request.candidates_count !== 1 ? 'es' : ''} interesado{request.candidates_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleViewDetails}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              Ver Detalles
            </button>

            {userType === 'client' && request.status === 'pending' && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Cancelando...' : 'Cancelar'}
              </button>
            )}

            {userType === 'professional' && request.status === 'pending' && (
              <div className="flex gap-2 flex-1">
                <button
                  onClick={handleAccept}
                  disabled={actionLoading}
                  className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Aceptando...' : 'Aceptar'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UrgentCard;