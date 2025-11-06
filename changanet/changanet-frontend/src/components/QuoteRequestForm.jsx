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
const QuoteRequestForm = ({ onClose, professionalName }) => {
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

    try {
      const response = await fetch('/api/quotes/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (response.ok) {
        // REGISTRAR MÉTRICA DE SOLICITUD DE PRESUPUESTO
        const { captureMessage } = require('../config/sentryConfig');
        captureMessage('Solicitud de presupuesto enviada desde frontend', 'info', {
          tags: {
            event: 'quote_request_frontend',
            business_metric: 'quote_request',
            component: 'QuoteRequestForm'
          },
          extra: {
            description: formData.descripción,
            coverage_area: formData.zona_cobertura,
            timestamp: new Date().toISOString(),
            business_impact: 'economic_environmental'
          }
        });

        // Cerrar modal y mostrar mensaje de éxito
        if (onClose) {
          onClose();
        }
        alert('Solicitud de cotización enviada. Recibirás respuestas pronto.');
        navigate('/mi-cuenta/presupuestos');
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (err) {
      setError('Error de red. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">¿Cómo quieres contactar?</h2>
        <p className="text-gray-600">Elige la opción que más te convenga</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      {/* Quick Message Option */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-emerald-800 mb-3">💬 Mensaje Rápido</h3>
        <p className="text-emerald-700 mb-4 text-sm">Envía un mensaje directo al profesional sin formularios largos</p>
        <button
          onClick={() => setShowQuickMessage(true)}
          className="w-full bg-emerald-500 text-white py-3 rounded-2xl hover:bg-emerald-600 transition-all duration-300 font-semibold min-h-[44px] touch-manipulation"
          aria-label="Enviar mensaje rápido al profesional"
        >
          Enviar Mensaje Rápido
        </button>
      </div>

      {/* Full Quote Request Form */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Solicitud Completa de Presupuesto</h3>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="descripcion" className="block text-gray-700 font-medium mb-2 text-lg">
              ¿Qué trabajo necesitas?
            </label>
            <textarea
              id="descripcion"
              name="descripción"
              value={formData.descripción}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 text-gray-700 text-lg min-h-[120px]"
              rows="4"
              placeholder="Describe brevemente el trabajo que necesitas realizar..."
              required
              aria-describedby="descripcion-help"
            />
            <div id="descripcion-help" className="sr-only">Describe el trabajo que necesitas, incluyendo detalles importantes como tamaño, materiales, etc.</div>
          </div>

          <div>
            <label htmlFor="zona" className="block text-gray-700 font-medium mb-2 text-lg">
              ¿Dónde lo necesitas?
            </label>
            <input
              id="zona"
              type="text"
              name="zona_cobertura"
              value={formData.zona_cobertura}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 text-gray-700 text-lg min-h-[44px]"
              placeholder="Ej: Palermo, CABA"
              required
              aria-describedby="zona-help"
            />
            <div id="zona-help" className="sr-only">Ingresa la ubicación donde necesitas el servicio</div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center min-h-[44px] touch-manipulation"
            aria-label="Enviar solicitud completa de presupuesto"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Enviando...
              </>
            ) : (
              <>
                <span className="mr-2">📤</span>
                Enviar Solicitud de Presupuesto
              </>
            )}
          </button>
        </form>
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
