/**
 * TypingIndicator - Componente para mostrar indicadores de escritura
 * Muestra cuando otros usuarios están escribiendo en la conversación
 */

import React from 'react';

const TypingIndicator = ({ users, otherUserName }) => {
  if (!users || users.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (users.length === 1) {
      const userName = otherUserName || 'El usuario';
      return `${userName} está escribiendo...`;
    } else if (users.length === 2) {
      return `${users.length} personas están escribiendo...`;
    } else {
      return `${users.length} personas están escribiendo...`;
    }
  };

  const getDotAnimationDelay = (index) => {
    return `${index * 0.2}s`;
  };

  return (
    <div className="flex items-center justify-start mb-4">
      <div className="flex items-center space-x-3">
        {/* Avatar placeholder */}
        <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 bg-gray-400 rounded-full animate-pulse" />
        </div>

        {/* Bubble de typing */}
        <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-600 mr-2">
              {getTypingText()}
            </span>
            
            {/* Animated dots */}
            <div className="flex space-x-1">
              <div 
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: getDotAnimationDelay(0) }}
              />
              <div 
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: getDotAnimationDelay(1) }}
              />
              <div 
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: getDotAnimationDelay(2) }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Estilos de animación personalizados */}
      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
        
        .animate-bounce {
          animation: bounce 1.4s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default TypingIndicator;