// src/components/VerificationForm.jsx
import { useState } from 'react';

const VerificationForm = () => {
  const [documentoUrl, setDocumentoUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('/api/verification/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({ url_documento: documentoUrl })
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setDocumentoUrl('');
      } else {
        setError(data.error || 'Error al enviar documento');
      }
    } catch (err) {
      setError('Error de red. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Verificación de Identidad</h2>

      {success && (
        <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
          Documento de verificación enviado. En revisión.
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">URL del Documento de Identidad</label>
          <input
            type="url"
            value={documentoUrl}
            onChange={(e) => setDocumentoUrl(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="https://ejemplo.com/documento_dni.jpg"
            required
          />
          <p className="text-gray-500 text-sm mt-1">
            Sube una foto clara de tu DNI (frente y dorso) a un servicio de almacenamiento en la nube (Google Drive, Dropbox, etc.) y pega aquí el enlace compartido.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-2 rounded-md hover:bg-emerald-600 transition disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar para Verificación'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">¿Por qué es importante la verificación?</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li>Aumenta tu confiabilidad ante los clientes</li>
          <li>Te permite acceder a funciones avanzadas</li>
          <li>Es un requisito para recibir pagos</li>
        </ul>
      </div>
    </div>
  );
};

export default VerificationForm;
