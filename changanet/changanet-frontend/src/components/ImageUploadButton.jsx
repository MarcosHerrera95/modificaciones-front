/**
 * @component ImageUploadButton
 * @description Botón para seleccionar y subir imágenes
 * @required_by REQ-18: Envío de imágenes
 */

import React, { useRef, useState } from 'react';

const ImageUploadButton = ({ onImageSelect, disabled = false }) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validar tipo de archivo
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WebP).');
      return;
    }

    // Validar tamaño de archivo
    if (file.size > MAX_FILE_SIZE) {
      alert('El archivo es demasiado grande. El tamaño máximo permitido es 5MB.');
      return;
    }

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Notificar al componente padre
    if (onImageSelect) {
      onImageSelect(file);
    }
  };

  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {preview ? (
        // Preview de imagen seleccionada
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-16 h-16 object-cover rounded-lg border-2 border-blue-500"
          />
          <button
            onClick={clearPreview}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
            disabled={disabled}
          >
            ×
          </button>
        </div>
      ) : (
        // Botón de subida
        <button
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={disabled}
          className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
            disabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : isDragging
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300 border-2 border-dashed border-gray-400'
          }`}
          title={disabled ? "Conectando..." : "Subir imagen"}
        >
          <svg
            className="w-6 h-6"
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
        </button>
      )}

      {/* Indicador de drag and drop */}
      {isDragging && !disabled && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm shadow-lg">
          Suelta la imagen aquí
        </div>
      )}
    </div>
  );
};

export default ImageUploadButton;