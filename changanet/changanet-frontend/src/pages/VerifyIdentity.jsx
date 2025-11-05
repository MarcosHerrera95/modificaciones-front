import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const VerifyIdentity = () => {
  const { user } = useAuth();
  const [documentUrl, setDocumentUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/verification/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({ url_documento: documentUrl })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Documento enviado exitosamente. Será revisado en las próximas 24-48 horas.');
      } else {
        setError(data.error || 'Error al enviar documento');
      }
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">
            Verificar Identidad
          </h1>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Verificación de Identidad
              </h2>
              <p className="text-gray-600">
                Para ofrecer servicios en Changánet, necesitamos verificar tu identidad.
                Sube una foto de tu DNI o documento de identidad.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">
                  URL del Documento
                </label>
                <input
                  type="url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700"
                  placeholder="https://ejemplo.com/mi-documento.jpg"
                  required
                />
                <p className="text-sm text-gray-500 mt-2">
                  Sube tu documento a un servicio como Google Drive, Dropbox o Imgur y pega el enlace aquí.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <span className="mr-2">📤</span>
                    Enviar Documento
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 bg-emerald-50 rounded-2xl p-6">
              <h3 className="font-semibold text-gray-800 mb-3">¿Qué documentos aceptamos?</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• DNI (frente y dorso)</li>
                <li>• Pasaporte</li>
                <li>• Licencia de conducir</li>
                <li>• Documento de identidad profesional</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3">
                El proceso de verificación toma 24-48 horas hábiles.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyIdentity;
