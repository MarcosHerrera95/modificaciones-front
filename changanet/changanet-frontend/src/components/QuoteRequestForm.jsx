// src/components/QuoteRequestForm.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const QuoteRequestForm = () => {
  const [formData, setFormData] = useState({
    descripción: '',
    zona_cobertura: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

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
