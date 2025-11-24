import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';

const ImageUploadSection = ({ profilePhoto, bannerPhoto, onPhotoUpload, errors = {} }) => {
  const [previews, setPreviews] = useState({
    profile: profilePhoto || null,
    banner: bannerPhoto || null
  });

  const profileFileInputRef = useRef(null);
  const bannerFileInputRef = useRef(null);

  /**
   * Valida el archivo de imagen
   */
  const validateImageFile = (file) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      throw new Error('Solo se permiten archivos de imagen (JPEG, PNG, WebP)');
    }

    if (file.size > maxSize) {
      throw new Error('El archivo no puede exceder los 5MB');
    }

    return true;
  };

  /**
   * Maneja la selección de archivo
   */
  const handleFileSelect = (type, file) => {
    if (!file) return;

    try {
      validateImageFile(file);

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews(prev => ({
          ...prev,
          [type]: e.target.result
        }));

        // Notificar al componente padre
        onPhotoUpload(type, file, e.target.result);
      };
      reader.readAsDataURL(file);

      toast.success(`${type === 'profile' ? 'Foto de perfil' : 'Foto de portada'} seleccionada`);

    } catch (error) {
      toast.error(error.message);
      console.error('Error validating image:', error);
    }
  };

  /**
   * Maneja el click en el área de upload
   */
  const handleUploadClick = (type) => {
    if (type === 'profile') {
      profileFileInputRef.current?.click();
    } else {
      bannerFileInputRef.current?.click();
    }
  };

  /**
   * Maneja el cambio de archivo
   */
  const handleFileChange = (type) => (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(type, file);
    }
  };

  /**
   * Remueve una imagen
   */
  const handleRemoveImage = (type) => {
    setPreviews(prev => ({
      ...prev,
      [type]: null
    }));

    onPhotoUpload(type, null, null);
    toast.success(`${type === 'profile' ? 'Foto de perfil' : 'Foto de portada'} eliminada`);
  };

  /**
   * Obtiene el texto de placeholder para cada tipo
   */
  const getPlaceholderText = (type) => {
    if (type === 'profile') {
      return 'Haz clic para subir tu foto de perfil\n(Recomendado: 400x400px, máx 5MB)';
    }
    return 'Haz clic para subir tu foto de portada\n(Recomendado: 1200x400px, máx 5MB)';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Fotos de Perfil</h2>
        <p className="text-gray-600">
          Sube una foto de perfil y una foto de portada para mejorar tu perfil profesional
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Foto de Perfil */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Foto de Perfil</h3>
          
          <div 
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50
              ${errors.url_foto_perfil ? 'border-red-300 bg-red-50' : 'border-gray-300'}
            `}
            onClick={() => handleUploadClick('profile')}
          >
            <input
              ref={profileFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange('profile')}
              className="hidden"
            />

            {previews.profile ? (
              <div className="relative">
                <img
                  src={previews.profile}
                  alt="Foto de perfil"
                  className="w-32 h-32 rounded-full object-cover mx-auto shadow-md"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage('profile');
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
                  title="Eliminar foto"
                >
                  ×
                </button>
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Haz clic para cambiar</p>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <svg 
                  className="w-16 h-16 text-gray-400 mx-auto mb-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                  />
                </svg>
                <p className="text-gray-600 whitespace-pre-line text-sm">
                  {getPlaceholderText('profile')}
                </p>
              </div>
            )}
          </div>

          {errors.url_foto_perfil && (
            <p className="text-red-500 text-sm">{errors.url_foto_perfil}</p>
          )}
        </div>

        {/* Foto de Portada */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Foto de Portada</h3>
          
          <div 
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50
              ${errors.url_foto_portada ? 'border-red-300 bg-red-50' : 'border-gray-300'}
            `}
            onClick={() => handleUploadClick('banner')}
          >
            <input
              ref={bannerFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange('banner')}
              className="hidden"
            />

            {previews.banner ? (
              <div className="relative">
                <img
                  src={previews.banner}
                  alt="Foto de portada"
                  className="w-full h-32 object-cover rounded-md shadow-md"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage('banner');
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
                  title="Eliminar foto"
                >
                  ×
                </button>
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Haz clic para cambiar</p>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <svg 
                  className="w-16 h-16 text-gray-400 mx-auto mb-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                  />
                </svg>
                <p className="text-gray-600 whitespace-pre-line text-sm">
                  {getPlaceholderText('banner')}
                </p>
              </div>
            )}
          </div>

          {errors.url_foto_portada && (
            <p className="text-red-500 text-sm">{errors.url_foto_portada}</p>
          )}
        </div>
      </div>

      {/* Consejos adicionales */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">💡 Consejos para mejores fotos:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Usa fotos de alta calidad con buena iluminación</li>
          <li>• Para foto de perfil: imagen cuadrada, enfoque en tu rostro</li>
          <li>• Para portada: imagen horizontal, puedes incluir tu workspace</li>
          <li>• Formatos recomendados: JPEG, PNG o WebP</li>
          <li>• Tamaño máximo: 5MB por imagen</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageUploadSection;