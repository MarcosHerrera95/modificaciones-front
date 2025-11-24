/**
 * @component MessageInput
 * @description Campo de entrada para escribir y enviar mensajes
 * @required_by REQ-17: Envío de mensajes de texto
 */

import React, { useState, useRef, useEffect } from 'react';

const MessageInput = ({ 
  onSendMessage, 
  disabled = false, 
  isSending = false,
  onTypingStart,
  onTypingStop
}) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-resize del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled || isSending) return;

    const success = await onSendMessage(trimmedMessage);
    if (success) {
      setMessage('');
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);
    
    // Enviar estado de escritura al WebSocket
    if (e.target.value.trim()) {
      if (!isTyping) {
        setIsTyping(true);
        onTypingStart?.();
      }
      
      // Resetear timeout para detener typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTypingStop?.();
      }, 2000);
    } else {
      setIsTyping(false);
      onTypingStop?.();
    }
  };

  const canSend = message.trim().length > 0 && !disabled && !isSending;

  return (
    <form onSubmit={handleSubmit} className="flex items-end space-x-2">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Conectando..." : "Escribe un mensaje..."}
          disabled={disabled}
          className={`w-full resize-none rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled 
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
              : 'bg-white text-gray-900'
          } ${isSending ? 'opacity-75' : ''}`}
          style={{ 
            minHeight: '44px',
            maxHeight: '120px'
          }}
          rows={1}
        />
        
        {/* Contador de caracteres */}
        <div className="absolute bottom-1 right-1 text-xs text-gray-400">
          {message.length}/1000
        </div>
      </div>

      {/* Botón de envío */}
      <button
        type="submit"
        disabled={!canSend}
        className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
          canSend
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        } ${isSending ? 'animate-pulse' : ''}`}
        title={disabled ? "Conectando..." : "Enviar mensaje"}
      >
        {isSending ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        )}
      </button>
    </form>
  );
};

export default MessageInput;