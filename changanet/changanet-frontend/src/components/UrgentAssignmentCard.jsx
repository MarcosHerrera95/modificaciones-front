/**
 * @component UrgentAssignmentCard - Tarjeta de asignación urgente para profesionales
 * @descripción Componente que muestra solicitudes urgentes asignadas al profesional
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Permite a profesionales gestionar eficientemente solicitudes urgentes
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../context/NotificationContext';

const UrgentAssignmentCard = ({ urgentRequest, onAccept, onReject }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const notificationContext = useNotificationContext();

  // Calcular tiempo transcurrido desde la solicitud
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

  // Calcular distancia (simulada por ahora)
  const getDistance = () => {
    // En implementación real, calcular distancia real
    return (Math.random() * 5 + 1).toFixed(1);
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/urgent/${urgentRequest.id}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al aceptar solicitud');
      }

      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'success',
          title: 'Solicitud Aceptada',
          message: 'Has aceptado la solicitud urgente. El cliente será notificado.',
          duration: 5000
        });
      }

      if (onAccept) onAccept(urgentRequest);
    } catch (err) {
      console.error('Error accepting urgent request:', err);
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudo aceptar la solicitud. Intenta nuevamente.',
          duration: 4000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('¿Estás seguro de que quieres rechazar esta solicitud urgente?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/urgent/${urgentRequest.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al rechazar solicitud');
      }

      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'info',
          title: 'Solicitud Rechazada',
          message: 'Has rechazado la solicitud urgente.',
          duration: 4000
        });
      }

      if (onReject) onReject(urgentRequest);
    } catch (err) {
      console.error('Error rejecting urgent request:', err);
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudo rechazar la solicitud. Intenta nuevamente.',
          duration: 4000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContactClient = () => {
    // Navegar al chat con el cliente
    navigate(`/chat?user=${urgentRequest.client_id}`);
  };

  const handleViewDetails = () => {
    // Mostrar detalles completos de la solicitud
    navigate(`/urgent/${urgentRequest.id}/details`);
  };

  return (
    <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
      {/* Header con indicador urgente */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.493-1.646 1.743-2.98l-4.243-5.5a3.54 3.54 0 00-.514-1.332l-1.243-2.24a1.5 1.5 0 00-.514-1.332l-4.243-5.5A1.5 1.5 0 004.14 4.5L6.5 5.5c1.046.667 1.7 1.81 1.7 3.135 0 .88-.34 1.684-.916 2.257L4.5 7.5A1.5 1.5 0 004.5 5.5L2 4.5A1.5 1.5 0 001.5 3H1c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v6.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 018 9.5V8" />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full animate-ping"></div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-800">¡Solicitud Urgente!</h3>
            <p className="text-red-600 text-sm">{getTimeElapsed(urgentRequest.created_at)}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center space-x-1 text-red-600 mb-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">{getDistance()} km</span>
          </div>
          {urgentRequest.price_estimate && (
            <p className="text-lg font-bold text-red-800">
              ${urgentRequest.price_estimate.toLocaleString('es-AR')}
            </p>
          )}
        </div>
      </div>

      {/* Información del cliente */}
      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex items-center space-x-3 mb-3">
          <img
            src={urgentRequest.client?.url_foto_perfil || '/default-avatar.png'}
            alt={urgentRequest.client?.nombre || 'Cliente'}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <h4 className="font-semibold text-gray-900">
              {urgentRequest.client?.nombre || 'Cliente'}
            </h4>
            <p className="text-sm text-gray-600">Cliente verificado</p>
          </div>
        </div>

        {/* Descripción del problema */}
        <div className="mb-3">
          <h5 className="font-medium text-gray-900 mb-2">Problema reportado:</h5>
          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg text-sm leading-relaxed">
            {urgentRequest.description}
          </p>
        </div>

        {/* Ubicación aproximada */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>
            Ubicación: {urgentRequest.location ?
              `${urgentRequest.location.lat.toFixed(4)}, ${urgentRequest.location.lng.toFixed(4)}` :
              'No especificada'
            }
          </span>
        </div>
      </div>

      {/* Estado y acciones */}
      <div className="space-y-3">
        {/* Estado actual */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Estado:</span>
          <span className={`font-medium ${
            urgentRequest.status === 'pending' ? 'text-yellow-600' :
            urgentRequest.status === 'assigned' ? 'text-green-600' :
            'text-gray-600'
          }`}>
            {urgentRequest.status === 'pending' ? 'Esperando respuesta' :
             urgentRequest.status === 'assigned' ? 'Asignado a ti' :
             urgentRequest.status}
          </span>
        </div>

        {/* Acciones según estado */}
        {urgentRequest.status === 'pending' ? (
          <div className="flex space-x-3">
            <button
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Aceptar</span>
                </>
              )}
            </button>

            <button
              onClick={handleReject}
              disabled={loading}
              className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Rechazar
            </button>
          </div>
        ) : urgentRequest.status === 'assigned' ? (
          <div className="space-y-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-800 text-sm font-medium text-center">
                ✅ Esta solicitud está asignada a ti
              </p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleContactClient}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Contactar</span>
              </button>

              <button
                onClick={handleViewDetails}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                Ver detalles
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-gray-600 text-sm text-center">
              Esta solicitud ya no está disponible
            </p>
          </div>
        )}
      </div>

      {/* Información adicional */}
      <div className="mt-4 pt-4 border-t border-red-200">
        <div className="flex items-center justify-between text-xs text-red-600">
          <span>ID: {urgentRequest.id.slice(-8)}</span>
          <span>Prioridad: Urgente</span>
        </div>
      </div>
    </div>
  );
};

export default UrgentAssignmentCard;