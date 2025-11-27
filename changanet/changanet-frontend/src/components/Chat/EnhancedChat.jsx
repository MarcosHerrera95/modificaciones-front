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
import DOMPurify from 'isomorphic-dompurify';

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
    settings,
    archiveConversation
  } = useChat();

  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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
      msg.recipient_id === user.id && msg.status !== 'read'
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

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearTop = scrollTop <= 100; // Trigger when within 100px of top

    if (isNearTop && hasMore && !isLoadingMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  }, [hasMore, isLoadingMessages, isLoadingMore, loadMoreMessages]);

  // Add scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

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
        fileUrl = await uploadImageToServer(imageFile);
      }

      // Sanitizar mensaje antes de enviar
      const sanitizedMessage = DOMPurify.sanitize(newMessage.trim(), {
        ALLOWED_TAGS: [], // No permitir HTML
        ALLOWED_ATTR: []  // No permitir atributos
      });

      // Enviar mensaje
      await sendMessage(conversationId, sanitizedMessage, messageType, fileUrl);

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
    // Sanitizar mensaje en tiempo real
    const sanitizedValue = DOMPurify.sanitize(value, {
      ALLOWED_TAGS: [], // No permitir HTML
      ALLOWED_ATTR: []  // No permitir atributos
    });

    setNewMessage(sanitizedValue);

    // Enviar indicador de typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (sanitizedValue.trim()) {
      setTyping(conversationId, true);
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(conversationId, false);
      }, 2000);
    } else {
      setTyping(conversationId, false);
    }
  }, [conversationId, setTyping]);

  // Cargar más mensajes (paginación infinita)
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || isLoadingMessages || isLoadingMore) return;

    try {
      setIsLoadingMore(true);
      const nextPage = page + 1;
      const newMessages = await loadMessages(conversationId, nextPage, 50);

      if (newMessages.length === 0) {
        setHasMore(false);
      } else {
        setPage(nextPage);
      }
    } catch (error) {
      console.error('Error cargando más mensajes:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, hasMore, isLoadingMessages, isLoadingMore, conversationId, loadMessages]);

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

  // Función para subir imagen al servidor
  const uploadImageToServer = useCallback(async (file) => {
    try {
      const token = localStorage.getItem('changanet_token');
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';

      // Primero obtener URL de subida
      const uploadUrlResponse = await fetch(`${API_BASE_URL}/api/chat/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type
        })
      });

      if (!uploadUrlResponse.ok) {
        throw new Error('Error obteniendo URL de subida');
      }

      const uploadData = await uploadUrlResponse.json();

      // Subir archivo directamente a storage
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(uploadData.upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Error subiendo archivo');
      }

      return uploadData.file_url;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      throw new Error('Error al subir la imagen. Inténtalo de nuevo.');
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

            {/* Botón archivar */}
            <button
              onClick={async () => {
                if (window.confirm('¿Estás seguro de que quieres archivar esta conversación? Ya no aparecerá en tu lista de conversaciones.')) {
                  try {
                    await archiveConversation(conversationId);
                    if (onClose) onClose();
                  } catch (error) {
                    alert('Error al archivar la conversación. Inténtalo de nuevo.');
                  }
                }
              }}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Archivar conversación"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>

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
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {/* Indicador de carga para scroll infinito */}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <LoadingSpinner message="Cargando mensajes..." />
          </div>
        )}

        {/* Mensajes */}
        {conversationMessages.map((message, index) => {
          const isOwn = message.sender_id === user.id;
          const showAvatar = index === 0 ||
            conversationMessages[index - 1].sender_id !== message.sender_id;

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