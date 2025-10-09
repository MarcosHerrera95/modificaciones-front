import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const QuoteRequestModal = ({ isOpen, onClose, professionalId, professionalName }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    descripción: '',
    zona_cobertura: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({
          profesional_id: professionalId,
          ...formData
        })
      });
      const data = await response.json();

      if (response.ok) {
        alert('Solicitud de cotización enviada exitosamente. Recibirás respuestas pronto.');
        onClose();
        setFormData({ descripción: '', zona_cobertura: '' });
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (err) {
      setError('Error de red. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="relative">
            <h2 className="text-3xl font-bold mb-2">Solicitar Presupuesto</h2>
            <p className="text-amber-100">a {professionalName}</p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-6 flex items-center">
              <span className="text-red-500 mr-3">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Descripción del Trabajo</label>
              <textarea
                name="descripción"
                value={formData.descripción}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400 resize-none"
                rows={4}
                placeholder="Describe detalladamente el trabajo que necesitas..."
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Zona de Cobertura</label>
              <input
                type="text"
                name="zona_cobertura"
                value={formData.zona_cobertura}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400"
                placeholder="Buenos Aires, CABA..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-4 rounded-2xl hover:from-amber-600 hover:to-orange-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <span className="mr-2">📤</span>
                  Enviar Solicitud
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Recibirás respuestas de {professionalName} en las próximas horas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteRequestModal;