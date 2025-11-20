import { useState } from 'react';
import { createPortal } from 'react-dom';
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
      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      const response = await fetch(`${apiBaseUrl}/api/quotes/request`, {
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

  // Create portal to render modal at document body level - completely independent of parent containers
  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 animate-fade-in p-4">
      <div className="absolute bg-white rounded-xl shadow-lg w-full max-w-[640px] max-h-[95vh] overflow-hidden border border-gray-200 animate-modal-expand"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) scale(1)',
          transformOrigin: 'center center'
        }}
      >
        {/* Close button - top right corner */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full transition-all duration-300 bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <h3 className="text-lg font-bold text-gray-900">Solicitar Presupuesto</h3>
                </div>
                <p className="text-amber-600 font-medium text-sm mb-1">a {professionalName}</p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-2">
              <div>
                <label className="block text-gray-700 font-medium mb-0.5 text-xs">Descripción del Trabajo</label>
                <textarea
                  name="descripción"
                  value={formData.descripción}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400 resize-none text-xs"
                  rows={1}
                  placeholder="Describe el trabajo..."
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-0.5 text-xs">Zona de Cobertura</label>
                <input
                  type="text"
                  name="zona_cobertura"
                  value={formData.zona_cobertura}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400 text-xs"
                  placeholder="Buenos Aires, CABA..."
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium transition-all duration-200 flex items-center justify-center text-xs px-1.5 py-1 rounded-lg hover:shadow-sm min-h-[24px] border border-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    // Navigate to chat with professional
                    window.location.href = `/chat/${professionalId}`;
                  }}
                  className="flex-1 bg-blue-500 text-white hover:bg-blue-600 font-medium transition-all duration-200 flex items-center justify-center text-xs px-1.5 py-1 rounded-lg min-h-[24px] shadow-sm"
                >
                  <span className="mr-1">💬</span>
                  Chat
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-1 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all duration-200 font-medium text-xs flex items-center justify-center min-h-[24px] shadow-sm"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <span className="mr-1">📤</span>
                      Enviar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal using portal to document body - completely independent of parent containers
  return createPortal(modalContent, document.body);
};

export default QuoteRequestModal;