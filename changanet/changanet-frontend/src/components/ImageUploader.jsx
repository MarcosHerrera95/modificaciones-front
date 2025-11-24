import React, { useState, useRef } from 'react';

/**
 * ImageUploader
 * Componente para subir foto de perfil y portada
 * 
 * Implementa REQ-06: Subir foto de perfil y portada
 * 
 * Características:
 * - Drag & drop
 * - Previsualización en tiempo real
 * - Validación de archivos (5MB, JPEG/PNG/WebP)
 * - Botón de remover imagen
 * - Estados de carga
 * - Responsive design
 */

const ImageUploader = ({
  profilePhoto,
  bannerPhoto,
  onProfilePhotoChange,
  onBannerPhotoChange,
  isLoading = false
}) => {
  const [dragOverProfile, setDragOverProfile] = useState(false);
  const [dragOverBanner, setDragOverBanner] = useState(false);
  const [profilePreview, setProfilePreview] = useState(profilePhoto || '');
  const [bannerPreview, setBannerPreview] = useState(bannerPhoto || '');
  const profileInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const validateImageFile = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!file) {
      throw new Error('No se proporcionó archivo');
    }

    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande. Máximo 5MB permitido.');
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no válido. Use JPEG, PNG o WebP.');
    }

    return true;
  };

  const handleFileSelect = (file, type) => {
    try {
      validateImageFile(file);

      if (type === 'profile') {
        onProfilePhotoChange(file);
        const reader = new FileReader();
        reader.onload = (e) => setProfilePreview(e.target.result);
        reader.readAsDataURL(file);
      } else if (type === 'banner') {
        onBannerPhotoChange(file);
        const reader = new FileReader();
        reader.onload = (e) => setBannerPreview(e.target.result);
        reader.readAsDataURL(file);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    setDragOverProfile(false);
    setDragOverBanner(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0], type);
    }
  };

  const handleDragOver = (e, type) => {
    e.preventDefault();
    if (type === 'profile') {
      setDragOverProfile(true);
    } else {
      setDragOverBanner(true);
    }
  };

  const handleDragLeave = (type) => {
    if (type === 'profile') {
      setDragOverProfile(false);
    } else {
      setDragOverBanner(false);
    }
  };

  const removeImage = (type) => {
    if (type === 'profile') {
      onProfilePhotoChange(null);
      setProfilePreview('');
    } else {
      onBannerPhotoChange(null);
      setBannerPreview('');
    }
  };

  const ProfilePhotoSection = () => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        📸 Foto de Perfil
        <span className="text-sm font-normal text-gray-500 ml-2">(Requerida)</span>
      </h3>
      
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
          dragOverProfile
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
        }`}
        onDrop={(e) => handleDrop(e, 'profile')}
        onDragOver={(e) => handleDragOver(e, 'profile')}
        onDragLeave={() => handleDragLeave('profile')}
      >
        <input
          type="file"
          ref={profileInputRef}
          onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0], 'profile')}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
        />

        {profilePreview ? (
          <div className="relative">
            <div className="w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-white shadow-xl">
              <img
                src={profilePreview}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => removeImage('profile')}
              className="absolute top-0 right-1/2 transform translate-x-20 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => profileInputRef.current?.click()}
              className="mt-4 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Cambiar Foto
            </button>
          </div>
        ) : (
          <div className="py-8">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-800 mb-2">Subir Foto de Perfil</h4>
            <p className="text-gray-600 mb-4">Arrastra una imagen aquí o haz clic para seleccionar</p>
            <button
              type="button"
              onClick={() => profileInputRef.current?.click()}
              disabled={isLoading}
              className="bg-emerald-500 text-white px-6 py-3 rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Subiendo...' : 'Seleccionar Imagen'}
            </button>
            <p className="text-xs text-gray-500 mt-2">JPEG, PNG, WebP • Máximo 5MB</p>
          </div>
        )}
      </div>
    </div>
  );

  const BannerPhotoSection = () => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        🖼️ Foto de Portada
        <span className="text-sm font-normal text-gray-500 ml-2">(Opcional)</span>
      </h3>
      
      <div
        className={`relative border-2 border-dashed rounded-2xl p-6 transition-all duration-300 ${
          dragOverBanner
            ? 'border-teal-400 bg-teal-50'
            : 'border-gray-300 hover:border-teal-400 hover:bg-teal-50'
        }`}
        onDrop={(e) => handleDrop(e, 'banner')}
        onDragOver={(e) => handleDragOver(e, 'banner')}
        onDragLeave={() => handleDragLeave('banner')}
      >
        <input
          type="file"
          ref={bannerInputRef}
          onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0], 'banner')}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
        />

        {bannerPreview ? (
          <div className="relative">
            <div className="w-full h-48 rounded-xl overflow-hidden border-2 border-gray-200">
              <img
                src={bannerPreview}
                alt="Foto de portada"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => removeImage('banner')}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="absolute bottom-2 right-2 bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors text-sm"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-800 mb-2">Subir Foto de Portada</h4>
            <p className="text-gray-600 mb-4">Añade una imagen que represente tu trabajo</p>
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={isLoading}
              className="bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Subiendo...' : 'Seleccionar Imagen'}
            </button>
            <p className="text-xs text-gray-500 mt-2">JPEG, PNG, WebP • Máximo 5MB</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">📷 Fotos de tu Perfil</h2>
        <p className="text-gray-600">Las fotos ayudan a los clientes a confiar en ti</p>
      </div>

      <ProfilePhotoSection />
      <BannerPhotoSection />
    </div>
  );
};

export default ImageUploader;