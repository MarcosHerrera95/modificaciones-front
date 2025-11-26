/**
 * @component UrgentStatusTracker - Rastreador de estado de servicios urgentes
 * @descripción Componente para mostrar el estado en tiempo real de solicitudes urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Transparencia en el proceso de atención urgente
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../context/NotificationContext';

const UrgentStatusTracker = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const notificationContext = useNotificationContext();

  const [urgentRequest, setUrgentRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Estados del flujo
  const statusConfig = {
    pending: {
      title: 'Buscando profesionales',
      description: 'Estamos buscando profesionales disponibles en tu área.',
      color: 'blue',
      icon: 'search',
      progress: 25
    },
    assigned: {
      title: 'Profesional asignado',
      description: 'Un profesional ha aceptado tu solicitud y se contactará pronto.',
      color: 'green',
      icon: 'check-circle',
      progress: 75
    },
    completed: {
      title: 'Servicio completado',
      description: 'El servicio urgente ha sido completado exitosamente.',
      color: 'green',
      icon: 'check-circle',
      progress: 100
    },
    cancelled: {
      title: 'Solicitud cancelada',
      description: 'La solicitud urgente ha sido cancelada.',
      color: 'red',
      icon: 'x-circle',
      progress: 0
    }
  };

  // Cargar datos de la solicitud
  const loadUrgentRequest = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/urgent-requests/${id}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.status === 404) {
        setError('Solicitud urgente no encontrada.');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al cargar la solicitud');
      }

      const data = await response.json();
      setUrgentRequest(data);
      setError('');
    } catch (err) {
      console.error('Error loading urgent request:', err);
      setError('Error al cargar el estado de la solicitud.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Cancelar solicitud
  const cancelRequest = async () => {
    if (!confirm('¿Estás seguro de que quieres cancelar esta solicitud urgente?')) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/urgent-requests/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cancelar la solicitud');
      }

      // Recargar datos
      await loadUrgentRequest();

      // Notificar
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'info',
          title: 'Solicitud Cancelada',
          message: 'La solicitud urgente ha sido cancelada exitosamente.',
          duration: 4000
        });
      }
    } catch (err) {
      console.error('Error cancelling request:', err);
      setError('Error al cancelar la solicitud.');
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadUrgentRequest();
  }, [id]);

  // Auto-refresh cada 30 segundos para estados activos
  useEffect(() => {
    if (!urgentRequest || ['completed', 'cancelled'].includes(urgentRequest.status)) {
      return;
    }

    const interval = setInterval(() => {
      loadUrgentRequest();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [urgentRequest?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          </div>
          <p className="text-center text-gray-600">Cargando estado de solicitud...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.493-1.646 1.743-2.98l-4.243-5.5a3.54 3.54 0 00-.514-1.332l-1.243-2.24a1.5 1.5 0 00-.514-1.332l-4.243-5.5A1.5 1.5 0 004.14 4.5L6.5 5.5c1.046.667 1.7 1.81 1.7 3.135 0 .88-.34 1.684-.916 2.257L4.5 7.5A1.5 1.5 0 004.5 5.5L2 4.5A1.5 1.5 0 001.5 3H1c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v6.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 018 9.5V8" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/mi-cuenta')}
              className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!urgentRequest) {
    return null;
  }

  const statusInfo = statusConfig[urgentRequest.status];
  const assignedProfessional = urgentRequest.assignments?.[0]?.professional;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Servicio Urgente</h1>
              <p className="text-gray-600">ID: {urgentRequest.id}</p>
            </div>
            <button
              onClick={() => navigate('/mi-cuenta')}
              className="text-gray-600 hover:text-gray-800 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Estado Principal */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Progress Bar */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                <div className="flex items-center justify-between text-white mb-2">
                  <span className="font-semibold">{statusInfo.title}</span>
                  <span className="text-sm">{statusInfo.progress}%</span>
                </div>
                <div className="w-full bg-red-400 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-500"
                    style={{ width: `${statusInfo.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Status Content */}
              <div className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 bg-${statusInfo.color}-100 rounded-full flex items-center justify-center`}>
                    <svg className={`w-6 h-6 text-${statusInfo.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {statusInfo.icon === 'search' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      )}
                      {statusInfo.icon === 'check-circle' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                      {statusInfo.icon === 'x-circle' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {statusInfo.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {statusInfo.description}
                    </p>

                    {/* Información específica por estado */}
                    {urgentRequest.status === 'pending' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-blue-800 font-medium">Buscando profesionales cercanos...</span>
                        </div>
                        <p className="text-blue-700 text-sm">
                          Radio de búsqueda: {urgentRequest.radius_km} km
                        </p>
                        <p className="text-blue-700 text-sm">
                          Candidatos notificados: {urgentRequest.candidates?.length || 0}
                        </p>
                      </div>
                    )}

                    {urgentRequest.status === 'assigned' && assignedProfessional && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="text-green-800 font-medium mb-2">Profesional Asignado</h4>
                        <div className="flex items-center space-x-3">
                          <img
                            src={assignedProfessional.url_foto_perfil || '/default-avatar.png'}
                            alt={assignedProfessional.nombre}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-green-800 font-medium">{assignedProfessional.nombre}</p>
                            <p className="text-green-600 text-sm">{assignedProfessional.telefono || 'Sin teléfono'}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex space-x-2">
                          <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors">
                            Contactar Profesional
                          </button>
                        </div>
                      </div>
                    )}

                    {urgentRequest.status === 'completed' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-green-800 font-medium">Servicio completado exitosamente</span>
                        </div>
                      </div>
                    )}

                    {urgentRequest.status === 'cancelled' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="text-red-800 font-medium">Solicitud cancelada</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                {urgentRequest.status === 'pending' && (
                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={cancelRequest}
                      className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors font-medium"
                    >
                      Cancelar Solicitud
                    </button>
                    <button
                      onClick={loadUrgentRequest}
                      disabled={refreshing}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center space-x-2"
                    >
                      {refreshing ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      <span>Actualizar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Detalles de la Solicitud */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalles de la Solicitud</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción del Problema
                  </label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {urgentRequest.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ubicación
                    </label>
                    <p className="text-gray-900">
                      {urgentRequest.location ? `${urgentRequest.location.lat.toFixed(4)}, ${urgentRequest.location.lng.toFixed(4)}` : 'No especificada'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Radio de Búsqueda
                    </label>
                    <p className="text-gray-900">{urgentRequest.radius_km} km</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Solicitud
                    </label>
                    <p className="text-gray-900">
                      {new Date(urgentRequest.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>

                  {urgentRequest.price_estimate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Precio Estimado
                      </label>
                      <p className="text-gray-900 font-semibold">
                        ${urgentRequest.price_estimate.toLocaleString('es-AR')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Panel Lateral */}
          <div className="space-y-6">
            {/* Candidatos (solo si pending) */}
            {urgentRequest.status === 'pending' && urgentRequest.candidates && urgentRequest.candidates.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Profesionales Notificados ({urgentRequest.candidates.length})
                </h3>

                <div className="space-y-3">
                  {urgentRequest.candidates.map((candidate, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <img
                          src={candidate.professional.url_foto_perfil || '/default-avatar.png'}
                          alt={candidate.professional.nombre}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-gray-900 font-medium text-sm">
                            {candidate.professional.nombre}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {candidate.distance_km.toFixed(1)} km
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {candidate.responded ? (
                          candidate.accepted ? (
                            <span className="text-green-600 text-xs font-medium">Aceptó</span>
                          ) : (
                            <span className="text-red-600 text-xs font-medium">Rechazó</span>
                          )
                        ) : (
                          <div className="flex items-center space-x-1">
                            <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-yellow-600 text-xs">Esperando</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Información de Ayuda */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">
                ¿Necesitas Ayuda?
              </h3>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-blue-900 font-medium">¿Qué sucede ahora?</h4>
                    <p className="text-blue-700 text-sm">
                      Los profesionales disponibles en tu área recibirán una notificación urgente.
                      El primero en aceptar será asignado automáticamente.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <h4 className="text-blue-900 font-medium">Tiempo de respuesta</h4>
                    <p className="text-blue-700 text-sm">
                      Normalmente recibes respuesta en 5-15 minutos. Si no hay respuesta,
                      amplia el radio de búsqueda o intenta más tarde.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UrgentStatusTracker;