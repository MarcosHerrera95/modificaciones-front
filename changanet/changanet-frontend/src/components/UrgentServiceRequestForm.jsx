/**
 * @component UrgentServiceRequestForm - Formulario de solicitud de servicios urgentes
 * @descripción Componente para crear solicitudes de servicios urgentes con geolocalización
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Atención inmediata para situaciones de emergencia
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../context/NotificationContext';

const UrgentServiceRequestForm = ({ onClose }) => {
  const [formData, setFormData] = useState({
    description: '',
    location: null,
    radiusKm: 5,
    serviceCategory: 'general'
  });
  const [locationError, setLocationError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const navigate = useNavigate();
  const notificationContext = useNotificationContext();

  // Obtener ubicación actual del usuario
  const getCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('La geolocalización no está soportada por este navegador.');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = { lat: latitude, lng: longitude };
        setFormData(prev => ({ ...prev, location }));
        setLocationLoading(false);
      },
      (error) => {
        let errorMessage = 'Error al obtener la ubicación.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado. Por favor, permite el acceso a la ubicación.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Ubicación no disponible.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado para obtener la ubicación.';
            break;
        }
        setLocationError(errorMessage);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutos
      }
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validaciones
    if (!formData.description.trim()) {
      setError('La descripción del problema es requerida.');
      setLoading(false);
      return;
    }

    if (!formData.location) {
      setError('Debes compartir tu ubicación para servicios urgentes.');
      setLoading(false);
      return;
    }

    if (formData.radiusKm < 1 || formData.radiusKm > 50) {
      setError('El radio debe estar entre 1 y 50 km.');
      setLoading(false);
      return;
    }

    try {
      const requestData = {
        description: formData.description,
        location: formData.location,
        radiusKm: formData.radiusKm,
        serviceCategory: formData.serviceCategory
      };

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/urgent-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (response.ok) {
        // Notificar éxito
        if (notificationContext?.addNotification) {
          notificationContext.addNotification({
            type: 'success',
            title: 'Solicitud Urgente Enviada',
            message: 'Tu solicitud de servicio urgente ha sido enviada. Recibirás notificaciones cuando un profesional acepte.',
            duration: 5000
          });
        }

        // Cerrar modal y redirigir
        if (onClose) onClose();

        // Redirigir al tracker de estado
        navigate(`/urgent/${data.id}/status`);
      } else {
        setError(data.error || 'Error al enviar solicitud urgente.');
      }
    } catch (err) {
      console.error('Error submitting urgent request:', err);
      setError('Error de red. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.493-1.646 1.743-2.98l-4.243-5.5a3.54 3.54 0 00-.514-1.332l-1.243-2.24a1.5 1.5 0 00-.514-1.332l-4.243-5.5A1.5 1.5 0 004.14 4.5L6.5 5.5c1.046.667 1.7 1.81 1.7 3.135 0 .88-.34 1.684-.916 2.257L4.5 7.5A1.5 1.5 0 004.5 5.5L2 4.5A1.5 1.5 0 001.5 3H1c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v6.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 018 9.5V8" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Servicio Urgente</h1>
            <p className="text-red-100 text-sm">Atención inmediata disponible</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Descripción del problema */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-2">
              ¿Cuál es el problema urgente?
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 text-gray-900 placeholder-gray-500 resize-none"
              rows="4"
              placeholder="Describe detalladamente el problema que necesitas resolver urgentemente..."
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Sé específico: qué sucede, desde cuándo, síntomas, etc.
            </p>
          </div>

          {/* Categoría de servicio */}
          <div>
            <label htmlFor="serviceCategory" className="block text-sm font-semibold text-gray-900 mb-2">
              Tipo de servicio
            </label>
            <select
              id="serviceCategory"
              name="serviceCategory"
              value={formData.serviceCategory}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 text-gray-900"
            >
              <option value="general">Servicio General</option>
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

          {/* Ubicación */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Ubicación
            </label>

            {!formData.location ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-all duration-300 text-blue-700 font-medium"
                >
                  {locationLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                      Obteniendo ubicación...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Compartir mi ubicación actual
                    </>
                  )}
                </button>

                {locationError && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {locationError}
                  </p>
                )}

                <p className="text-sm text-gray-500">
                  Necesitamos tu ubicación para encontrar profesionales cercanos disponibles.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-green-800 font-medium">Ubicación compartida</p>
                    <p className="text-green-600 text-sm">
                      {formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, location: null }))}
                    className="text-green-600 hover:text-green-800 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Radio de búsqueda */}
          <div>
            <label htmlFor="radiusKm" className="block text-sm font-semibold text-gray-900 mb-2">
              Radio de búsqueda: {formData.radiusKm} km
            </label>
            <input
              type="range"
              id="radiusKm"
              name="radiusKm"
              min="1"
              max="50"
              value={formData.radiusKm}
              onChange={(e) => setFormData(prev => ({ ...prev, radiusKm: parseInt(e.target.value) }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 km</span>
              <span>25 km</span>
              <span>50 km</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Buscaremos profesionales dentro de este radio desde tu ubicación.
            </p>
          </div>

          {/* Información importante */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-yellow-800 font-medium">Información importante</h4>
                <ul className="mt-1 text-yellow-700 text-sm space-y-1">
                  <li>• Los servicios urgentes tienen precios especiales</li>
                  <li>• Recibirás notificaciones cuando un profesional acepte</li>
                  <li>• Solo el primer profesional que acepte será asignado</li>
                  <li>• Puedes cancelar la solicitud en cualquier momento</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.location}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-6 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Solicitar Urgente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UrgentServiceRequestForm;