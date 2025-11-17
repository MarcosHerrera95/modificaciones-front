/**
 * @component QuoteRequestForm - Formulario de solicitud de presupuesto
 * @descripción Componente para crear solicitudes de presupuesto a múltiples profesionales (REQ-31, REQ-32, REQ-33)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Frontend] Implementar Formulario de Solicitud de Presupuesto
 * @impacto Económico: Facilita comparación de precios y acceso a servicios profesionales
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuickMessageModal from './QuickMessageModal';

/**
 * @función QuoteRequestForm - Componente principal del formulario
 * @descripción Maneja estado del formulario y envío de solicitudes de presupuesto (REQ-31)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Frontend] Implementar Formulario de Solicitud de Presupuesto
 * @impacto Económico: Interfaz intuitiva para conectar demanda y oferta de servicios
 * @returns {JSX.Element} Formulario de solicitud de presupuesto
 */
const QuoteRequestForm = ({ onClose, professionalName, professionalId }) => {
  const [formData, setFormData] = useState({
    descripción: '',
    zona_cobertura: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickMessage, setShowQuickMessage] = useState(false);
  const navigate = useNavigate();

  /**
   * @función handleChange - Manejar cambios en inputs del formulario
   * @descripción Actualiza estado del formulario con valores de inputs (REQ-31)
   * @sprint Sprint 2 – Solicitudes y Presupuestos
   * @tarjeta Tarjeta 5: [Frontend] Implementar Formulario de Solicitud de Presupuesto
   * @impacto Social: Interfaz intuitiva accesible para todos los niveles técnicos
   * @param {Event} e - Evento de cambio del input
   */
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  /**
   * @función handleSubmit - Enviar solicitud de presupuesto
   * @descripción Envía solicitud a backend y maneja respuesta con métricas (REQ-32, REQ-33)
   * @sprint Sprint 2 – Solicitudes y Presupuestos
   * @tarjeta Tarjeta 5: [Frontend] Implementar Formulario de Solicitud de Presupuesto
   * @impacto Económico: Conecta eficientemente demanda y oferta de servicios profesionales
   * @param {Event} e - Evento de envío del formulario
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('Submitting quote request');
    console.log('Token exists:', !!sessionStorage.getItem('changanet_token'));
    console.log('Token:', sessionStorage.getItem('changanet_token'));

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({
          profesional_id: professionalId,
          descripcion: formData.descripción,
          zona_cobertura: formData.zona_cobertura
        })
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        // Cerrar modal y mostrar mensaje de éxito
        if (onClose) {
          onClose();
        }
        alert('Solicitud de cotización enviada exitosamente. El profesional recibirá una notificación y podrás ver las respuestas en tu panel.');
        navigate('/mi-cuenta/presupuestos');
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (err) {
      console.log('Fetch error:', err);
      setError('Error de red. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header Section - Compact */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full shadow-md">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            ¿Cómo quieres contactar?
          </h1>
          <p className="text-gray-600 text-sm">Elige la opción que más te convenga</p>
        </div>
      </div>

      {/* Error Alert - Compact */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg" role="alert" aria-live="polite">
          <div className="flex items-center">
            <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Contact Options Grid - More Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Quick Message Option */}
        <div className="group relative bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-lg transition-all duration-300">
          <div className="absolute -top-3 -right-3 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
            <span className="text-lg">⚡</span>
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-emerald-800 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                Mensaje Rápido
              </h3>
              <p className="text-emerald-700 text-sm leading-relaxed">Mensaje directo sin formularios largos</p>
            </div>
            <button
              onClick={() => setShowQuickMessage(true)}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 px-4 rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 font-semibold shadow-md hover:shadow-lg flex items-center justify-center space-x-2 min-h-[44px] touch-manipulation text-sm"
              aria-label="Enviar mensaje rápido al profesional"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Enviar Mensaje</span>
            </button>
          </div>
        </div>

        {/* Full Quote Request Option */}
        <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
          <div className="absolute -top-3 -right-3 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
            <span className="text-lg">📋</span>
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-blue-800 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Solicitud Completa
              </h3>
              <p className="text-blue-700 text-sm leading-relaxed">Presupuesto detallado con descripción completa</p>
            </div>
            <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-md">
              <span className="font-medium">✓</span> Mejor presupuesto
            </div>
          </div>
        </div>
      </div>

      {/* Full Quote Request Form - More Compact */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Solicitud de Presupuesto</h3>
            <p className="text-gray-600 text-sm">Más detalles = Mejor presupuesto</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="descripcion" className="flex items-center text-gray-900 font-semibold text-base">
              <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              ¿Qué trabajo necesitas?
            </label>
            <textarea
              id="descripcion"
              name="descripción"
              value={formData.descripción}
              onChange={handleChange}
              className="w-full px-3 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-gray-900 text-sm min-h-[100px] placeholder-gray-500 resize-none"
              rows="4"
              placeholder="Describe el trabajo que necesitas..."
              required
              aria-describedby="descripcion-help"
            />
            <div id="descripcion-help" className="sr-only">Describe el trabajo que necesitas, incluyendo detalles importantes como tamaño, materiales, urgencia, etc.</div>
          </div>

          <div className="space-y-2">
            <label htmlFor="zona" className="flex items-center text-gray-900 font-semibold text-base">
              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ¿Dónde lo necesitas?
            </label>
            <input
              id="zona"
              type="text"
              name="zona_cobertura"
              value={formData.zona_cobertura}
              onChange={handleChange}
              className="w-full px-3 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 text-gray-900 text-sm placeholder-gray-500"
              placeholder="Ej: Palermo, CABA"
              required
              aria-describedby="zona-help"
            />
            <div id="zona-help" className="sr-only">Ingresa la ubicación donde necesitas el servicio, incluyendo calle y barrio si es posible</div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-h-[48px] touch-manipulation text-sm"
            aria-label="Enviar solicitud completa de presupuesto"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Enviar Solicitud</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Back Button - Compact */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onClose}
          className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 font-medium text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </button>
      </div>

      <QuickMessageModal
        isOpen={showQuickMessage}
        onClose={() => setShowQuickMessage(false)}
        professionalName={professionalName || 'el profesional'}
        onSendMessage={(message) => {
          // Here you would integrate with your chat service
          console.log('Sending quick message:', message);
        }}
      />
    </div>
  );
};

export default QuoteRequestForm;
