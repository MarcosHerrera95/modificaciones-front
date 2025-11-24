/**
 * @component MessageBubble
 * @description Burbuja individual de mensaje con texto e imágenes
 * @required_by REQ-17: Mensajes de texto
 * @required_by REQ-18: Imágenes
 */

import React from 'react';

const MessageBubble = ({ message, isOwn, otherUser }) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return 'Hoy';
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
        {/* Avatar del usuario (solo para mensajes recibidos) */}
        {!isOwn && (
          <div className="flex items-end space-x-2 mb-1">
            {otherUser?.foto_perfil ? (
              <img
                src={otherUser.foto_perfil}
                alt={otherUser.nombre}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-600">
                  {otherUser?.nombre?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <span className="text-xs text-gray-600">{otherUser?.nombre || 'Usuario'}</span>
          </div>
        )}

        {/* Burbuja del mensaje */}
        <div
          className={`rounded-lg px-4 py-3 ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-gray-200 text-gray-900 rounded-bl-sm'
          }`}
        >
          {/* Mensaje de texto */}
          {message.content && (
            <p className={`text-sm ${isOwn ? 'text-white' : 'text-gray-900'}`}>
              {message.content}
            </p>
          )}

          {/* Imagen */}
          {message.image_url && (
            <div className="mt-2">
              <img
                src={message.image_url}
                alt="Imagen enviada"
                className="max-w-full h-auto rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.image_url, '_blank')}
              />
            </div>
          )}

          {/* Timestamp y estado */}
          <div className={`flex items-center justify-between mt-2 text-xs ${
            isOwn ? 'text-blue-100' : 'text-gray-500'
          }`}>
            <span>{formatTime(message.created_at)}</span>
            <div className="flex items-center space-x-2">
              {/* Fecha (solo mostrar si es diferente al día actual) */}
              {formatDate(message.created_at) !== 'Hoy' && (
                <span className="text-xs opacity-75">
                  {formatDate(message.created_at)}
                </span>
              )}
              
              {/* Estado del mensaje (solo para mensajes propios) */}
              {isOwn && (
                <div className="flex items-center">
                  {message.status === 'sent' && (
                    <span className="text-blue-200">✓</span>
                  )}
                  {message.status === 'delivered' && (
                    <span className="text-blue-200">✓✓</span>
                  )}
                  {message.status === 'read' && (
                    <span className="text-blue-200">✓✓</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tiempo relativo (información adicional) */}
        <div className={`mt-1 text-xs text-gray-400 ${
          isOwn ? 'text-right' : 'text-left'
        }`}>
          {new Date(message.created_at).toLocaleString('es-ES', {
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;