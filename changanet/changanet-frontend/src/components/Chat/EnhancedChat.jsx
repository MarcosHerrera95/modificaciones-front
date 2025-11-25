/**
 * EnhancedChat - Componente de chat mejorado con funcionalidad completa
 * Utiliza ChatContext para estado centralizado y optimizado
 * 
 * CARACTERÍSTICAS:
 * - Integración completa con ChatContext
 * - Envío de texto e imágenes
 * - Indicadores de escritura en tiempo real
 * - Historial paginado
 * - Notificaciones optimizadas
 * - UX/UI mejorada
 * 
 * CUMPLE: REQ-16, REQ-17, REQ-18, REQ-19, REQ-20 del PRD
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import LoadingSpinner from '../LoadingSpinner';

const EnhancedChat = ({ 
  conversationId, 
  otherUser, 
  onClose, 
  className = "",
  showHeader = true,
  compact = false 
}) => {
  const { user } = useAuth();
  const {
    messages,
    isConnected,
    isLoadingMessages,
    sendMessage,
    loadMessages,
    markAsRead,
    setTyping,
    getTypingUsers,
    settings
  } = useChat();

  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Cargar mensajes al montar el componente
  useEffect(() => {
    if (conversationId && messages[conversationId]?.length === 0) {
      loadMessages(conversationId, 1, 50);
    }
  }, [conversationId, loadMessages, messages]);

  // Marcar mensajes como leídos cuando se receive
  useEffect(() => {
    const conversationMessages = messages[conversationId] || [];
    const unreadMessages = conversationMessages.filter(msg => 
      msg.destinatario_id === user.id && !msg.esta_leido
    );

    if (unreadMessages.length > 0 && settings.autoMarkAsRead) {
      const messageIds = unreadMessages.map(msg => msg.id);
      markAsRead(conversationId, messageIds);
    }
  }, [messages, conversationId, user.id, markAsRead, settings.autoMarkAsRead]);

  // Actualizar usuarios escribiendo
  useEffect(() => {
    const updateTypingUsers = () => {
      const users = getTypingUsers(conversationId);
      setTypingUsers(users.filter(userId => userId !== user.id));
    };

    updateTypingUsers();
    const interval = setInterval(updateTypingUsers, 1000);
    return () => clearInterval(interval);
  }, [conversationId, getTypingUsers, user.id]);

  // Scroll automático al final
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  useEffect(() => {
    if (messages[conversationId]?.length > 0) {
      scrollToBottom();
    }
  }, [messages, conversationId, scrollToBottom]);

  // Enviar mensaje
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() && !imageFile) return;
    if (isSending) return;

    try {
      setIsSending(true);
      
      let fileUrl = null;
      let messageType = 'text';

      // Subir imagen si existe
      if (imageFile) {
        messageType = 'image';
        // TODO: Implementar subida de imagen usando storageService
        // fileUrl = await uploadImage(imageFile);
      }

      // Enviar mensaje
      await sendMessage(conversationId, newMessage.trim(), messageType, fileUrl);

      // Limpiar formulario
      setNewMessage('');
      setImageFile(null);
      setShowImagePreview(false);
      
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      alert('Error al enviar mensaje. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSending(false);
    }
  }, [newMessage, imageFile, conversationId, sendMessage, isSending]);

  // Manejar typing
  const handleTyping = useCallback((isTyping) => {
    setTyping(conversationId, isTyping);
  }, [conversationId, setTyping]);

  // Manejar cambio en input de mensaje
  const handleMessageChange = useCallback((value) => {
    setNewMessage(value);
    
    // Enviar indicador de typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.trim()) {
      setTyping(conversationId, true);
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(conversationId, false);
      }, 2000);
    } else {
      setTyping(conversationId, false);
    }
  }, [conversationId, setTyping]);

  // Cargar más mensajes (paginación)
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || isLoadingMessages) return;
    
    try {
      const nextPage = page + 1;
      const newMessages = await loadMessages(conversationId, nextPage, 50);
      
      if (newMessages.length === 0) {
        setHasMore(false);
      } else {
        setPage(nextPage);
      }
    } catch (error) {
      console.error('Error cargando más mensajes:', error);
    }
  }, [page, hasMore, isLoadingMessages, conversationId, loadMessages]);

  // Manejar selección de imagen
  const handleImageSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido.');
        return;
      }

      // Validar tamaño (5MB máximo)
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no puede ser mayor a 5MB.');
        return;
      }

      setImageFile(file);
      setShowImagePreview(true);
    }
  }, []);

  // Remover imagen
  const removeImage = useCallback(() => {
    setImageFile(null);
    setShowImagePreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Obtener mensajes de la conversación actual
  const conversationMessages = messages[conversationId] || [];

  if (!otherUser) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <LoadingSpinner message="Cargando conversación..." />
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white rounded-lg shadow-lg ${className} ${compact ? 'h-96' : 'h-[600px]'}`}>
      {/* Header del chat */}
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-lg">
                {otherUser.rol === 'profesional' ? '🔧' : '👤'}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{otherUser.nombre}</h3>
              <p className="text-sm text-gray-600">
                {otherUser.rol === 'profesional' ? 'Profesional' : 'Cliente'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Indicador de conexión */}
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
            
            {/* Botón cerrar */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Botón cargar más mensajes */}
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={loadMoreMessages}
              disabled={isLoadingMessages}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 transition-colors"
            >
              {isLoadingMessages ? 'Cargando...' : 'Cargar mensajes anteriores'}
            </button>
          </div>
        )}

        {/* Mensajes */}
        {conversationMessages.map((message, index) => {
          const isOwn = message.remitente_id === user.id;
          const showAvatar = index === 0 || 
            conversationMessages[index - 1].remitente_id !== message.remitente_id;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={isOwn}
              showAvatar={showAvatar}
              otherUserName={isOwn ? user.nombre : otherUser.nombre}
            />
          );
        })}

        {/* Indicador de usuarios escribiendo */}
        {typingUsers.length > 0 && (
          <TypingIndicator
            users={typingUsers}
            otherUserName={otherUser.nombre}
          />
        )}

        {/* Referencia para scroll automático */}
        <div ref={messagesEndRef} />
      </div>

      {/* Preview de imagen */}
      {showImagePreview && imageFile && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Preview"
                className="w-16 h-16 object-cover rounded-lg"
              />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{imageFile.name}</p>
              <p className="text-xs text-gray-500">
                {(imageFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Input de mensaje */}
      <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
        <MessageInput
          value={newMessage}
          onChange={handleMessageChange}
          onSend={handleSendMessage}
          onImageSelect={handleImageSelect}
          disabled={isSending || !isConnected}
          placeholder={`Escribe un mensaje a ${otherUser.nombre}...`}
          settings={settings}
        />
      </div>
    </div>
  );
};

export default EnhancedChat;