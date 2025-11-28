import { useState, useRef, useEffect } from 'react';
import VerificationStatusBadge from './VerificationStatusBadge';
import { verificationAPI } from '../services/apiService';

const IdentityVerificationForm = ({ className = '' }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileBack, setSelectedFileBack] = useState(null);
  const [selectedSelfie, setSelectedSelfie] = useState(null);
  const [preview, setPreview] = useState('');
  const [previewBack, setPreviewBack] = useState('');
  const [previewSelfie, setPreviewSelfie] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [biometricData, setBiometricData] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputBackRef = useRef(null);
  const selfieInputRef = useRef(null);

  // Validate form when files change
  useEffect(() => {
    validateForm();
  }, [selectedFile, selectedFileBack, selectedSelfie]);

  // Enhanced validation function
  const validateFile = (file, type) => {
    const errors = {};

    if (!file) {
      errors.required = 'Este archivo es obligatorio';
      return errors;
    }

    // Validate file type
    const allowedTypes = type === 'selfie'
      ? ['image/jpeg', 'image/jpg', 'image/png']
      : ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (!allowedTypes.includes(file.type)) {
      errors.type = type === 'selfie'
        ? 'Para la selfie solo se permiten imágenes JPG o PNG'
        : 'Solo se permiten archivos JPG, PNG o PDF';
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      errors.size = `El archivo no puede superar los ${maxSize / (1024 * 1024)}MB`;
    }

    // Validate minimum size (1KB min to avoid empty files)
    const minSize = 1024; // 1KB
    if (file.size < minSize) {
      errors.minSize = 'El archivo parece estar vacío o es demasiado pequeño';
    }

    // Additional validation for images
    if (file.type.startsWith('image/') && type === 'selfie') {
      // Check if it's actually a valid image by trying to read it
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        // Additional checks could be added here
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        errors.corrupted = 'La imagen parece estar corrupta';
      };
    }

    return errors;
  };

  // Validate all files and update form validity
  const validateForm = () => {
    const frontErrors = validateFile(selectedFile, 'front');
    const backErrors = selectedFileBack ? validateFile(selectedFileBack, 'back') : {};
    const selfieErrors = validateFile(selectedSelfie, 'selfie');

    const allErrors = {
      front: frontErrors,
      back: backErrors,
      selfie: selfieErrors
    };

    setValidationErrors(allErrors);

    // Check if form is valid (no errors in required fields)
    const hasFrontErrors = Object.keys(frontErrors).length > 0;
    const hasSelfieErrors = Object.keys(selfieErrors).length > 0;
    const hasBackErrors = selectedFileBack && Object.keys(backErrors).length > 0;

    setIsFormValid(!hasFrontErrors && !hasSelfieErrors && !hasBackErrors);

    return allErrors;
  };

  const handleFileChange = (e, type = 'front') => {
    const file = e.target.files[0];
    if (file) {
      const errors = validateFile(file, type);

      if (Object.keys(errors).length > 0) {
        setValidationErrors(prev => ({ ...prev, [type]: errors }));
        setError(Object.values(errors)[0]);
        return;
      }

      if (type === 'back') {
        setSelectedFileBack(file);
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => setPreviewBack(reader.result);
          reader.readAsDataURL(file);
        } else {
          setPreviewBack('📄 ' + file.name);
        }
      } else if (type === 'selfie') {
        setSelectedSelfie(file);
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => setPreviewSelfie(reader.result);
          reader.readAsDataURL(file);
        } else {
          setPreviewSelfie('📄 ' + file.name);
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
      // Re-validate form after file change
      setTimeout(validateForm, 100);
    }
  };

  const handleUploadClick = (type = 'front') => {
    if (type === 'back') {
      fileInputBackRef.current.click();
    } else if (type === 'selfie') {
      selfieInputRef.current.click();
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

    if (!selectedSelfie) {
      setError('Por favor toma una selfie para verificación biométrica');
      return;
    }

    try {
      setLoading(true);

      // Paso 1: Generar URL presignada para documento frontal
      const uploadData = await verificationAPI.generateUploadUrl({
        documentType: 'dni',
        fileName: selectedFile.name,
        fileType: selectedFile.type
      });

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
        const uploadBackData = await verificationAPI.generateUploadUrl({
          documentType: 'dni',
          fileName: selectedFileBack.name,
          fileType: selectedFileBack.type
        });

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

      // Paso 4: Generar URL presignada para selfie
      const selfieUploadData = await verificationAPI.generateUploadUrl({
        isSelfie: true,
        fileName: selectedSelfie.name,
        fileType: selectedSelfie.type
      });

      // Paso 5: Subir selfie
      const selfieUploadToS3Response = await fetch(selfieUploadData.data.uploadUrl, {
        method: 'PUT',
        body: selectedSelfie,
        headers: {
          'Content-Type': selectedSelfie.type
        }
      });

      if (!selfieUploadToS3Response.ok) {
        throw new Error('Error al subir la selfie');
      }

      // Paso 6: Generar datos biométricos básicos (placeholder)
      const biometricDataGenerated = {
        selfieHash: await generateFileHash(selectedSelfie),
        documentHash: await generateFileHash(selectedFile),
        timestamp: new Date().toISOString(),
        deviceInfo: navigator.userAgent
      };

      // Paso 7: Crear solicitud de verificación con datos biométricos
      const verificationData = await verificationAPI.createRequest({
        documentType: 'dni',
        documentFrontUrl: uploadData.data.key,
        documentBackUrl: documentBackUrl,
        selfieUrl: selfieUploadData.data.key,
        biometricData: biometricDataGenerated
      });

      setSuccess('Documentos enviados exitosamente. La verificación biométrica será procesada en las próximas 24-48 horas.');
      // Reset form
      setSelectedFile(null);
      setSelectedFileBack(null);
      setSelectedSelfie(null);
      setPreview('');
      setPreviewBack('');
      setPreviewSelfie('');
      setBiometricData(null);
      // Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (fileInputBackRef.current) fileInputBackRef.current.value = '';
      if (selfieInputRef.current) selfieInputRef.current.value = '';

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para generar hash de archivo
  const generateFileHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

          {validationErrors.front && Object.keys(validationErrors.front).length > 0 && (
            <div className="mt-2 text-sm text-red-600">
              {Object.values(validationErrors.front)[0]}
            </div>
          )}
        </div>

        {/* Documento Posterior (Opcional) */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Documento Posterior (Opcional)
          </label>

          <div
            onClick={() => handleUploadClick('back')}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300 min-h-[120px] flex flex-col items-center justify-center"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleUploadClick('back');
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
            onChange={(e) => handleFileChange(e, 'back')}
            accept="image/jpeg,image/jpg,image/png,application/pdf"
            className="hidden"
            aria-label="Seleccionar documento posterior"
          />

          {validationErrors.back && Object.keys(validationErrors.back).length > 0 && (
            <div className="mt-2 text-sm text-red-600">
              {Object.values(validationErrors.back)[0]}
            </div>
          )}
        </div>

        {/* Selfie para Verificación Biométrica */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Selfie para Verificación Biométrica *
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Toma una foto de tu rostro para verificar que eres el titular del documento
          </p>

          <div
            onClick={() => handleUploadClick('selfie')}
            className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-300 min-h-[150px] flex flex-col items-center justify-center"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleUploadClick('selfie');
              }
            }}
            aria-label="Tomar selfie"
          >
            {previewSelfie ? (
              <div className="space-y-4">
                {previewSelfie.startsWith('data:') ? (
                  <img
                    src={previewSelfie}
                    alt="Vista previa de la selfie"
                    className="max-w-full max-h-24 mx-auto rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-2xl">{previewSelfie.split(' ')[0]}</div>
                )}
                <div className="text-sm text-gray-600">
                  {selectedSelfie?.name} ({(selectedSelfie?.size / 1024 / 1024).toFixed(2)} MB)
                </div>
                <div className="text-blue-600 font-medium">Haz clic para cambiar</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Tomar Selfie</div>
                  <div className="text-xs text-gray-500">Haz clic para seleccionar</div>
                </div>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={selfieInputRef}
            onChange={(e) => handleFileChange(e, 'selfie')}
            accept="image/jpeg,image/jpg,image/png"
            capture="user"
            className="hidden"
            aria-label="Tomar selfie"
          />

          {validationErrors.selfie && Object.keys(validationErrors.selfie).length > 0 && (
            <div className="mt-2 text-sm text-red-600">
              {Object.values(validationErrors.selfie)[0]}
            </div>
          )}
        </div>

        {/* Información */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">📋 Información importante</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Solo se aceptan documentos de identidad oficiales (DNI, Pasaporte, etc.)</li>
            <li>• La selfie debe mostrar claramente tu rostro para verificación biométrica</li>
            <li>• La información debe ser legible y completa</li>
            <li>• El proceso incluye verificación automática y manual (24-48 horas hábiles)</li>
            <li>• Recibirás una notificación cuando se complete la revisión</li>
            <li>• Los datos biométricos se procesan de forma segura y confidencial</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading || !isFormValid}
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