/**
 * MessageBubble - Componente para mostrar mensajes individuales
 * Con soporte para texto, imágenes y diferentes estados de mensaje
 */

import React from 'react';

const MessageBubble = ({ message, isOwn, showAvatar, otherUserName }) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return (
          <span className="text-blue-500">
            ✓✓
          </span>
        );
      case 'failed':
        return '❌';
      default:
        return '';
    }
  };

  const renderMessageContent = () => {
    switch (message.message_type || (message.url_imagen ? 'image' : 'text')) {
      case 'image':
        return (
          <div className="space-y-2">
            {message.url_imagen && (
              <img
                src={message.url_imagen}
                alt="Imagen compartida"
                className="max-w-xs rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => window.open(message.url_imagen, '_blank')}
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbiBubyBkaXNwb25pYmxlPC90ZXh0Pjwvc3ZnPg==';
                }}
              />
            )}
            {message.contenido && (
              <p className="text-sm">{message.contenido}</p>
            )}
          </div>
        );

      case 'file':
        return (
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {message.file_name || 'Archivo'}
              </p>
              {message.file_size && (
                <p className="text-xs text-gray-500">
                  {(message.file_size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            {message.file_url && (
              <a
                href={message.file_url}
                download
                className="flex-shrink-0 p-2 text-blue-500 hover:text-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>
            )}
          </div>
        );

      case 'system':
        return (
          <div className="flex items-center justify-center p-2">
            <div className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
              {message.contenido}
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-1">
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.contenido}
            </p>
            
            {/* Indicador de mensaje editado */}
            {message.is_edited && (
              <p className="text-xs text-gray-400 italic">
                (editado)
              </p>
            )}
          </div>
        );
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'failed':
        return 'border-red-300 bg-red-50';
      default:
        return isOwn ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white';
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 ${isOwn ? 'space-x-reverse' : ''}`}>
        {/* Avatar */}
        {showAvatar && !isOwn && (
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-blue-600">
              {otherUserName?.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        
        {/* Espaciado si no hay avatar */}
        {!showAvatar && !isOwn && (
          <div className="w-8" />
        )}

        {/* Bubble del mensaje */}
        <div className={`relative px-4 py-2 rounded-2xl shadow-sm ${getStatusColor(message.status)} ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
          {/* Contenido del mensaje */}
          {renderMessageContent()}
          
          {/* Footer con tiempo y estado */}
          <div className={`flex items-center justify-end mt-1 space-x-1 ${isOwn ? 'text-blue-600' : 'text-gray-500'}`}>
            <span className="text-xs">
              {formatTime(message.creado_en || message.created_at)}
            </span>
            
            {/* Estado del mensaje */}
            {isOwn && (
              <span className="text-xs ml-1">
                {getStatusIcon(message.status || 'sent')}
              </span>
            )}
          </div>
          
          {/* Indicador de fallo */}
          {message.status === 'failed' && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
              !
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;