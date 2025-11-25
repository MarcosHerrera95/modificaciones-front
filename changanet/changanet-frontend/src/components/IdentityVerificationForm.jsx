import { useState, useRef } from 'react';
import VerificationStatusBadge from './VerificationStatusBadge';

const IdentityVerificationForm = ({ className = '' }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileBack, setSelectedFileBack] = useState(null);
  const [preview, setPreview] = useState('');
  const [previewBack, setPreviewBack] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);
  const fileInputBackRef = useRef(null);

  const handleFileChange = (e, isBack = false) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Solo se permiten archivos JPG, PNG o PDF');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('El archivo no puede superar los 5MB');
        return;
      }

      if (isBack) {
        setSelectedFileBack(file);
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => setPreviewBack(reader.result);
          reader.readAsDataURL(file);
        } else {
          setPreviewBack('📄 ' + file.name);
        }
      } else {
        setSelectedFile(file);
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => setPreview(reader.result);
          reader.readAsDataURL(file);
        } else {
          setPreview('📄 ' + file.name);
        }
      }

      setError('');
    }
  };

  const handleUploadClick = (isBack = false) => {
    if (isBack) {
      fileInputBackRef.current.click();
    } else {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedFile) {
      setError('Por favor selecciona el documento frontal');
      return;
    }

    try {
      setLoading(true);

      // Paso 1: Generar URL presignada para documento frontal
      const uploadResponse = await fetch('/api/verification/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentType: 'dni',
          fileName: selectedFile.name,
          fileType: selectedFile.type
        })
      });

      if (!uploadResponse.ok) {
        throw new Error('Error al generar URL de subida');
      }

      const uploadData = await uploadResponse.json();

      // Paso 2: Subir archivo frontal a la URL presignada
      const uploadToS3Response = await fetch(uploadData.data.uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type
        }
      });

      if (!uploadToS3Response.ok) {
        throw new Error('Error al subir el documento frontal');
      }

      let documentBackUrl = null;

      // Paso 3: Subir documento posterior si existe
      if (selectedFileBack) {
        const uploadBackResponse = await fetch('/api/verification/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            documentType: 'dni',
            fileName: selectedFileBack.name,
            fileType: selectedFileBack.type
          })
        });

        if (uploadBackResponse.ok) {
          const uploadBackData = await uploadBackResponse.json();

          const uploadBackToS3Response = await fetch(uploadBackData.data.uploadUrl, {
            method: 'PUT',
            body: selectedFileBack,
            headers: {
              'Content-Type': selectedFileBack.type
            }
          });

          if (uploadBackToS3Response.ok) {
            documentBackUrl = uploadBackData.data.key;
          }
        }
      }

      // Paso 4: Crear solicitud de verificación
      const verificationResponse = await fetch('/api/verification/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentType: 'dni',
          documentFrontUrl: uploadData.data.key,
          documentBackUrl: documentBackUrl
        })
      });

      const verificationData = await verificationResponse.json();

      if (verificationResponse.ok) {
        setSuccess('Documento enviado exitosamente. Será revisado en las próximas 24-48 horas.');
        setSelectedFile(null);
        setSelectedFileBack(null);
        setPreview('');
        setPreviewBack('');
      } else {
        setError(verificationData.error || 'Error al enviar documento');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Verificación de Identidad</h3>
        <VerificationStatusBadge showDetails={true} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg mb-6">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Documento Frontal */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Documento Frontal *
          </label>

          <div
            onClick={() => handleUploadClick(false)}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300 min-h-[150px] flex flex-col items-center justify-center"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleUploadClick(false);
              }
            }}
            aria-label="Seleccionar documento frontal"
          >
            {preview ? (
              <div className="space-y-4">
                {preview.startsWith('data:') ? (
                  <img
                    src={preview}
                    alt="Vista previa del documento frontal"
                    className="max-w-full max-h-24 mx-auto rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-2xl">{preview.split(' ')[0]}</div>
                )}
                <div className="text-sm text-gray-600">
                  {selectedFile?.name} ({(selectedFile?.size / 1024 / 1024).toFixed(2)} MB)
                </div>
                <div className="text-emerald-600 font-medium">Haz clic para cambiar</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Documento Frontal</div>
                  <div className="text-xs text-gray-500">Haz clic para seleccionar</div>
                </div>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileChange(e, false)}
            accept="image/jpeg,image/jpg,image/png,application/pdf"
            className="hidden"
            aria-label="Seleccionar documento frontal"
          />
        </div>

        {/* Documento Posterior (Opcional) */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Documento Posterior (Opcional)
          </label>

          <div
            onClick={() => handleUploadClick(true)}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300 min-h-[120px] flex flex-col items-center justify-center"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleUploadClick(true);
              }
            }}
            aria-label="Seleccionar documento posterior"
          >
            {previewBack ? (
              <div className="space-y-4">
                {previewBack.startsWith('data:') ? (
                  <img
                    src={previewBack}
                    alt="Vista previa del documento posterior"
                    className="max-w-full max-h-20 mx-auto rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-xl">{previewBack.split(' ')[0]}</div>
                )}
                <div className="text-xs text-gray-600">
                  {selectedFileBack?.name}
                </div>
                <div className="text-emerald-600 font-medium text-xs">Haz clic para cambiar</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="text-xs text-gray-500">Opcional</div>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputBackRef}
            onChange={(e) => handleFileChange(e, true)}
            accept="image/jpeg,image/jpg,image/png,application/pdf"
            className="hidden"
            aria-label="Seleccionar documento posterior"
          />
        </div>

        {/* Información */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">📋 Información importante</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Solo se aceptan documentos de identidad oficiales (DNI, Pasaporte, etc.)</li>
            <li>• La información debe ser legible y completa</li>
            <li>• El proceso de verificación toma 24-48 horas hábiles</li>
            <li>• Recibirás una notificación cuando se complete la revisión</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Enviando...
            </>
          ) : (
            <>
              <span className="mr-2">📤</span>
              Enviar para Verificación
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default IdentityVerificationForm;