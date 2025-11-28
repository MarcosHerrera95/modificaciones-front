/**
 * @component UrgentRequestsList - Lista de solicitudes urgentes
 * @description Componente para mostrar lista de solicitudes urgentes con filtros y acciones
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrgentContext } from '../context/UrgentContext';

const UrgentRequestsList = ({ userType = 'client' }) => {
  const navigate = useNavigate();
  const {
    userRequests,
    nearbyRequests,
    userRequestsLoading,
    nearbyRequestsLoading,
    loadUserRequests,
    loadNearbyRequests,
    cancelRequest,
    acceptRequest,
    rejectRequest,
    filters,
    setFilters,
    pagination,
    setPagination
  } = useUrgentContext();

  const [selectedRequests, setSelectedRequests] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Determine which requests to show based on user type
  const requests = userType === 'professional' ? nearbyRequests : userRequests;
  const loading = userType === 'professional' ? nearbyRequestsLoading : userRequestsLoading;

  // Load requests on mount and when filters change
  useEffect(() => {
    if (userType === 'professional') {
      // For professionals, load nearby requests (requires location)
      loadNearbyRequests();
    } else {
      // For clients, load their own requests
      loadUserRequests();
    }
  }, [userType, filters, pagination.page, loadUserRequests, loadNearbyRequests]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters) => {
    setFilters({ ...filters, ...newFilters });
    setPagination({ ...pagination, page: 1 }); // Reset to first page
  }, [filters, setFilters, pagination, setPagination]);

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    setPagination({ ...pagination, page: newPage });
  }, [pagination, setPagination]);

  // Handle request selection for bulk actions
  const handleRequestSelect = useCallback((requestId) => {
    setSelectedRequests(prev =>
      prev.includes(requestId)
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    setSelectedRequests(
      selectedRequests.length === requests.length
        ? []
        : requests.map(req => req.id)
    );
  }, [selectedRequests, requests]);

  // Bulk actions
  const handleBulkCancel = useCallback(async () => {
    if (!selectedRequests.length) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(selectedRequests.map(id => cancelRequest(id)));
      setSelectedRequests([]);
    } catch (error) {
      console.error('Error in bulk cancel:', error);
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedRequests, cancelRequest]);

  // Individual actions
  const handleViewDetails = useCallback((requestId) => {
    navigate(`/urgent/${requestId}`);
  }, [navigate]);

  const handleAcceptRequest = useCallback(async (requestId) => {
    try {
      await acceptRequest(requestId);
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  }, [acceptRequest]);

  const handleRejectRequest = useCallback(async (requestId, reason) => {
    try {
      await rejectRequest(requestId, reason);
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  }, [rejectRequest]);

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

  // Get status color and text
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { color: 'yellow', text: 'Pendiente', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
      case 'assigned':
        return { color: 'green', text: 'Asignada', bgColor: 'bg-green-100', textColor: 'text-green-800' };
      case 'in_progress':
        return { color: 'blue', text: 'En Progreso', bgColor: 'bg-blue-100', textColor: 'text-blue-800' };
      case 'completed':
        return { color: 'purple', text: 'Completada', bgColor: 'bg-purple-100', textColor: 'text-purple-800' };
      case 'cancelled':
        return { color: 'red', text: 'Cancelada', bgColor: 'bg-red-100', textColor: 'text-red-800' };
      default:
        return { color: 'gray', text: status, bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3"></div>
          <span className="text-gray-600">Cargando solicitudes urgentes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {userType === 'professional' ? 'Solicitudes Cercanas' : 'Mis Solicitudes Urgentes'}
            </h2>
            <p className="text-red-100 text-sm">
              {userType === 'professional'
                ? 'Solicitudes de emergencia en tu área'
                : 'Gestiona tus solicitudes de servicio urgente'
              }
            </p>
          </div>
          {userType === 'client' && (
            <button
              onClick={() => navigate('/urgent/new')}
              className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg hover:bg-opacity-30 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nueva Solicitud</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Estado:</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange({ status: e.target.value })}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="assigned">Asignadas</option>
              <option value="in_progress">En Progreso</option>
              <option value="completed">Completadas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>

          {/* Service Category Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Servicio:</label>
            <select
              value={filters.serviceCategory}
              onChange={(e) => handleFilterChange({ serviceCategory: e.target.value })}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">Todos</option>
              <option value="general">General</option>
              <option value="plomero">Plomería</option>
              <option value="electricista">Electricidad</option>
              <option value="albañil">Albañilería</option>
              <option value="pintor">Pintura</option>
              <option value="gasista">Gas</option>
              <option value="herrero">Herrería</option>
              <option value="carpintero">Carpintería</option>
              <option value="jardinero">Jardinería</option>
              <option value="mecanico">Mecánica</option>
              <option value="informatica">Informática</option>
            </select>
          </div>

          {/* Bulk Actions for Clients */}
          {userType === 'client' && selectedRequests.length > 0 && (
            <div className="flex items-center space-x-2 ml-auto">
              <span className="text-sm text-gray-600">
                {selectedRequests.length} seleccionada{selectedRequests.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleBulkCancel}
                disabled={bulkActionLoading}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {bulkActionLoading ? 'Cancelando...' : 'Cancelar Seleccionadas'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Requests List */}
      <div className="p-6">
        {requests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg font-medium">No hay solicitudes urgentes</p>
            <p className="text-sm">
              {userType === 'professional'
                ? 'No hay solicitudes urgentes en tu área actualmente.'
                : 'Crea tu primera solicitud de servicio urgente.'
              }
            </p>
            {userType === 'client' && (
              <button
                onClick={() => navigate('/urgent/new')}
                className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Crear Solicitud Urgente
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Select All Checkbox for Clients */}
            {userType === 'client' && requests.length > 0 && (
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <input
                  type="checkbox"
                  checked={selectedRequests.length === requests.length}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label className="text-sm text-gray-700">
                  Seleccionar todas ({requests.length})
                </label>
              </div>
            )}

            {/* Request Items */}
            {requests.map((request) => {
              const statusInfo = getStatusInfo(request.status);
              return (
                <div
                  key={request.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header with checkbox for clients */}
                      <div className="flex items-center space-x-3 mb-3">
                        {userType === 'client' && (
                          <input
                            type="checkbox"
                            checked={selectedRequests.includes(request.id)}
                            onChange={() => handleRequestSelect(request.id)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                        )}
                        <h3 className="text-lg font-semibold text-gray-900">
                          Solicitud #{request.id.slice(-6)}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                          {statusInfo.text}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getTimeElapsed(request.created_at)}
                        </span>
                      </div>

                      {/* Request Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Servicio:</span> {getServiceCategoryName(request.service_category || request.serviceCategory)}
                        </div>
                        <div>
                          <span className="font-medium">Radio:</span> {request.radius_km || request.radiusKm} km
                        </div>
                        <div>
                          <span className="font-medium">Precio est.:</span> ${request.price_estimate?.toLocaleString('es-AR') || 'N/A'}
                        </div>
                        {userType === 'professional' && request.client && (
                          <div>
                            <span className="font-medium">Cliente:</span> {request.client.nombre}
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="mb-3">
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-lg line-clamp-2">
                          {request.description}
                        </p>
                      </div>

                      {/* Assignment Info */}
                      {request.status === 'assigned' && request.assigned_professional && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-800 font-medium text-sm">
                              Asignado a {request.assigned_professional.nombre}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Candidates count for pending requests */}
                      {request.status === 'pending' && request.candidates_count > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.493-1.646 1.743-2.98l-4.243-5.5a3.54 3.54 0 00-.514-1.332l-1.243-2.24a1.5 1.5 0 00-.514-1.332l-4.243-5.5A1.5 1.5 0 004.14 4.5L6.5 5.5c1.046.667 1.7 1.81 1.7 3.135 0 .88-.34 1.684-.916 2.257L4.5 7.5A1.5 1.5 0 004.5 5.5L2 4.5A1.5 1.5 0 001.5 3H1c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v6.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 018 9.5V8" />
                            </svg>
                            <span className="text-yellow-800 font-medium text-sm">
                              {request.candidates_count} profesional{request.candidates_count !== 1 ? 'es' : ''} notificado{request.candidates_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleViewDetails(request.id)}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                      >
                        Ver Detalles
                      </button>

                      {userType === 'client' && request.status === 'pending' && (
                        <button
                          onClick={() => cancelRequest(request.id)}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}

                      {userType === 'professional' && request.status === 'pending' && (
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                          >
                            Aceptar
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id, 'No disponible')}
                            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} resultados
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.limit >= pagination.total}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UrgentRequestsList;