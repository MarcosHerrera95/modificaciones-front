/**
 * Componente VerificationForm - Formulario para solicitar verificación de identidad
 * Permite a los profesionales subir su documento de identidad para verificación manual
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const VerificationForm = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);

  // Cargar estado actual de verificación
  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const loadVerificationStatus = async () => {
    try {
      const response = await fetch('/api/verification/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Error cargando estado de verificación:', error);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG) y PDF.');
        return;
      }

      // Validar tamaño (5MB máximo)
      if (file.size > 5 * 1024 * 1024) {
        setError('El archivo es demasiado grande. Máximo 5MB permitido.');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setError('Por favor selecciona un documento');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);

      const response = await fetch('/api/verification/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(data.data);
        setSelectedFile(null);
        alert('Solicitud de verificación enviada correctamente. Recibirás una notificación cuando sea revisada.');
      } else {
        setError(data.error || 'Error al enviar la solicitud');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  // Solo mostrar para profesionales
  if (user?.role !== 'profesional') {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        Verificación de Identidad
      </h3>

      {/* Estado actual */}
      {status && (
        <div className="mb-6">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            status.estado === 'aprobado'
              ? 'bg-green-100 text-green-800'
              : status.estado === 'rechazado'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {status.estado === 'aprobado' && '✅ Verificado'}
            {status.estado === 'rechazado' && '❌ Rechazado'}
            {status.estado === 'pendiente' && '⏳ Pendiente de revisión'}
            {status.estado === 'no_solicitado' && 'No solicitado'}
          </div>

          {status.comentario_admin && (
            <p className="mt-2 text-sm text-gray-600">
              <strong>Comentario del administrador:</strong> {status.comentario_admin}
            </p>
          )}

          {status.revisado_en && (
            <p className="mt-1 text-xs text-gray-500">
              Revisado el: {new Date(status.revisado_en).toLocaleDateString('es-ES')}
            </p>
          )}
        </div>
      )}

      {/* Formulario - solo mostrar si no está aprobado */}
      {(!status || status.estado !== 'aprobado') && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Documento de Identidad
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Sube una foto clara de tu DNI, cédula o pasaporte. Aceptamos imágenes (JPG, PNG) o PDF.
            </p>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploading}
            />

            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600">
                Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedFile || uploading || status?.estado === 'pendiente'}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              !selectedFile || uploading || status?.estado === 'pendiente'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Subiendo...
              </>
            ) : status?.estado === 'pendiente' ? (
              'Solicitud pendiente'
            ) : (
              'Solicitar Verificación'
            )}
          </button>
        </form>
      )}

      {/* Información adicional */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          ¿Por qué verificar mi identidad?
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Aumenta la confianza de los clientes</li>
          <li>• Apareces más arriba en las búsquedas</li>
          <li>• Destacas como profesional verificado</li>
          <li>• Proceso manual y seguro por nuestro equipo</li>
        </ul>
      </div>
    </div>
  );
};

export default VerificationForm;
