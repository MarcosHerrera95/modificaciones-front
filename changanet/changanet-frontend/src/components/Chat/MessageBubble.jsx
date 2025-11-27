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
      case 'sending':
        return (
          <svg className="w-3 h-3 text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'sent':
        return (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'delivered':
        return (
          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" transform="translate(2, 0)" />
          </svg>
        );
      case 'read':
        return (
          <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  const renderMessageContent = () => {
    switch (message.message_type || (message.url_imagen ? 'image' : 'text')) {
      case 'image':
        return (
          <div className="space-y-2">
            {message.image_url && (
              <img
                src={message.image_url}
                alt="Imagen compartida"
                className="max-w-xs rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => window.open(message.image_url, '_blank')}
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbiBubyBkaXNwb25pYmxlPC90ZXh0Pjwvc3ZnPg==';
                }}
              />
            )}
            {message.message && (
              <p className="text-sm">{message.message}</p>
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
              {message.message}
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-1">
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.message}
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
              {formatTime(message.created_at)}
            </span>
            
            {/* Estado del mensaje */}
            {isOwn && (
              <span className="text-xs ml-1 flex items-center">
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