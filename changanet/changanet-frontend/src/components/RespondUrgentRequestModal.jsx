/**
 * @component RespondUrgentRequestModal - Modal de respuesta a solicitudes urgentes
 * @descripción Modal que permite a profesionales aceptar o rechazar solicitudes urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Interfaz clara para gestión rápida de emergencias
 */

import { useState } from 'react';
import { useNotificationContext } from '../context/NotificationContext';

const RespondUrgentRequestModal = ({ isOpen, onClose, urgentRequest, onAccept, onReject }) => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(''); // Para rechazos
  const notificationContext = useNotificationContext();

  if (!isOpen || !urgentRequest) return null;

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

      await response.json();

      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'success',
          title: 'Solicitud Aceptada',
          message: 'Has aceptado la solicitud urgente. El cliente será notificado inmediatamente.',
          duration: 6000
        });
      }

      if (onAccept) onAccept(urgentRequest);
      onClose();
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
    if (!response.trim()) {
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'warning',
          title: 'Motivo requerido',
          message: 'Por favor, indica el motivo del rechazo.',
          duration: 3000
        });
      }
      return;
    }

    setLoading(true);
    try {
      const rejectResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/urgent/${urgentRequest.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (!rejectResponse.ok) {
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
      onClose();
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

  const getTimeElapsed = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} minutos`;

    const diffHours = Math.floor(diffMins / 60);
    return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.493-1.646 1.743-2.98l-4.243-5.5a3.54 3.54 0 00-.514-1.332l-1.243-2.24a1.5 1.5 0 00-.514-1.332l-4.243-5.5A1.5 1.5 0 004.14 4.5L6.5 5.5c1.046.667 1.7 1.81 1.7 3.135 0 .88-.34 1.684-.916 2.257L4.5 7.5A1.5 1.5 0 004.5 5.5L2 4.5A1.5 1.5 0 001.5 3H1c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v6.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 018 9.5V8" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Solicitud Urgente</h2>
                <p className="text-red-100 text-sm">Respuesta requerida inmediatamente</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Información de la solicitud */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-800 font-medium text-sm">
                  {getTimeElapsed(urgentRequest.created_at)}
                </span>
              </div>
              {urgentRequest.price_estimate && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-800">
                    ${urgentRequest.price_estimate.toLocaleString('es-AR')}
                  </p>
                  <p className="text-xs text-red-600">Precio estimado</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-red-900 mb-1">Cliente:</h4>
                <div className="flex items-center space-x-3">
                  <img
                    src={urgentRequest.client?.url_foto_perfil || '/default-avatar.png'}
                    alt={urgentRequest.client?.nombre || 'Cliente'}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="text-red-800">{urgentRequest.client?.nombre || 'Cliente'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-red-900 mb-1">Ubicación:</h4>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-red-800 text-sm">
                    {urgentRequest.location ?
                      `${urgentRequest.location.lat.toFixed(4)}, ${urgentRequest.location.lng.toFixed(4)}` :
                      'No especificada'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Descripción del problema */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Descripción del problema:</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed">
                {urgentRequest.description}
              </p>
            </div>
          </div>

          {/* Información importante */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div>
                <h4 className="text-blue-900 font-medium">Información importante</h4>
                <ul className="mt-1 text-blue-800 text-sm space-y-1">
                  <li>• Las solicitudes urgentes tienen prioridad máxima</li>
                  <li>• El cliente espera respuesta inmediata</li>
                  <li>• Si aceptas, serás el profesional asignado</li>
                  <li>• Los precios urgentes incluyen recargo especial</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Campo de motivo para rechazo */}
          <div className="mb-6">
            <label htmlFor="response" className="block text-sm font-medium text-gray-700 mb-2">
              Motivo del rechazo (opcional, pero recomendado):
            </label>
            <textarea
              id="response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
              rows="3"
              placeholder="Ej: No tengo disponibilidad en este momento, estoy fuera de la zona, etc."
            />
          </div>

          {/* Botones de acción */}
          <div className="flex space-x-4">
            <button
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Aceptar Solicitud Urgente</span>
                </>
              )}
            </button>

            <button
              onClick={handleReject}
              disabled={loading}
              className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Rechazar
            </button>
          </div>

          {/* Botón cancelar */}
          <div className="mt-4 text-center">
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Responder más tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RespondUrgentRequestModal;