/**
 * MessageInput - Componente mejorado para entrada de mensajes
 * Con soporte para texto, imágenes y validaciones
 */

import React, { useState, useRef } from 'react';

const MessageInput = ({ 
  value, 
  onChange, 
  onSend, 
  onImageSelect, 
  disabled = false,
  placeholder = "Escribe un mensaje...",
  settings = {}
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef(null);

  // Ajustar altura del textarea automáticamente
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  const handleTextareaChange = (e) => {
    onChange(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend();
      // Limpiar textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Manejar drag & drop de archivos
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleImageFile(imageFile);
    }
  };

  // Manejar selección de archivo
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleImageFile = (file) => {
    // Validaciones
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      alert('La imagen no puede ser mayor a 5MB.');
      return;
    }

    onImageSelect({ target: { files: [file] } });
  };

  // Trigger input de archivo
  const triggerFileInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = handleFileSelect;
    input.click();
  };

  const getCharacterCount = () => {
    return value.length;
  };

  const getRemainingChars = () => {
    return Math.max(0, 1000 - value.length);
  };

  const isNearLimit = () => {
    return value.length > 800; // 80% del límite
  };

  const isOverLimit = () => {
    return value.length > 1000;
  };

  return (
    <div className="relative">
      {/* Área de drag & drop */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-blue-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-sm text-blue-600">Suelta la imagen aquí</p>
          </div>
        </div>
      )}

      {/* Contenedor principal */}
      <div 
        className={`flex items-end space-x-2 p-3 border rounded-lg bg-white transition-all ${
          isDragging ? 'border-blue-300' : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Botón de imagen */}
        <button
          type="button"
          onClick={triggerFileInput}
          disabled={disabled}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-500 disabled:opacity-50 transition-colors"
          title="Adjuntar imagen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Textarea para mensaje */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            maxLength={1000}
            className="w-full resize-none border-none outline-none text-sm placeholder-gray-400 bg-transparent max-h-32"
            style={{ minHeight: '24px' }}
          />
          
          {/* Contador de caracteres */}
          <div className={`absolute -bottom-6 right-0 text-xs transition-colors ${
            isOverLimit() ? 'text-red-500' : 
            isNearLimit() ? 'text-yellow-500' : 
            'text-gray-400'
          }`}>
            {getRemainingChars()} caracteres restantes
          </div>
        </div>

        {/* Botón de envío */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim() || isOverLimit()}
          className={`flex-shrink-0 p-2 rounded-full transition-all ${
            !value.trim() || disabled || isOverLimit()
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-blue-500 hover:bg-blue-50 hover:text-blue-600'
          }`}
          title="Enviar mensaje (Enter)"
        >
          {disabled ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {/* Mensaje de validación */}
      {isOverLimit() && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500">
          El mensaje no puede exceder 1000 caracteres
        </div>
      )}

      {/* Configuración de sonido */}
      {settings.soundEnabled && (
        <input 
          type="hidden" 
          value={settings.soundEnabled} 
          name="sound-enabled" 
        />
      )}
    </div>
  );
};

export default MessageInput;