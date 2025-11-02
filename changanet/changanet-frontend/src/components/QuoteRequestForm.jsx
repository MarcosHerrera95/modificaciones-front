/**
 * @component QuoteRequestForm - Formulario de solicitud de presupuesto
 * @descripción Componente para crear solicitudes de presupuesto a múltiples profesionales (REQ-31, REQ-32, REQ-33)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Frontend] Implementar Formulario de Solicitud de Presupuesto
 * @impacto Económico: Facilita comparación de precios y acceso a servicios profesionales
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * @función QuoteRequestForm - Componente principal del formulario
 * @descripción Maneja estado del formulario y envío de solicitudes de presupuesto (REQ-31)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 5: [Frontend] Implementar Formulario de Solicitud de Presupuesto
 * @impacto Económico: Interfaz intuitiva para conectar demanda y oferta de servicios
 * @returns {JSX.Element} Formulario de solicitud de presupuesto
 */
const QuoteRequestForm = () => {
  const [formData, setFormData] = useState({
    descripción: '',
    zona_cobertura: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Solicitar Presupuesto</h2>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Descripción del Trabajo</label>
          <textarea
            name="descripción"
            value={formData.descripción}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            rows="4"
            placeholder="Describe detalladamente el trabajo que necesitas..."
            required
          ></textarea>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Zona de Cobertura</label>
          <input
            type="text"
            name="zona_cobertura"
            value={formData.zona_cobertura}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Buenos Aires, CABA..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-2 rounded-md hover:bg-emerald-600 transition disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar Solicitud de Presupuesto'}
        </button>
      </form>
    </div>
  );
};

export default QuoteRequestForm;
