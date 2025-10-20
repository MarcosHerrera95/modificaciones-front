import { useState, useEffect, useCallback } from 'react';
import { useChat as useChatContext } from '../context/ChatContext';

export const useChatHook = (otherUserId) => {
  const {
    messages,
    unreadCounts,
    sendMessage: contextSendMessage,
    markAsRead: contextMarkAsRead,
    loadMessageHistory,
    isConnected
  } = useChatContext();

  const [localMessages, setLocalMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar historial cuando cambia el usuario
  useEffect(() => {
    if (otherUserId) {
      setIsLoading(true);
      loadMessageHistory(otherUserId)
        .then(() => {
          setIsLoading(false);
        })
        .catch((err) => {
          setError('Error al cargar mensajes');
          setIsLoading(false);
        });
    }
  }, [otherUserId, loadMessageHistory]);

  // Actualizar mensajes locales cuando cambian en el contexto
  useEffect(() => {
    if (otherUserId && messages[otherUserId]) {
      setLocalMessages(messages[otherUserId]);
    }
  }, [messages, otherUserId]);

  const sendMessage = useCallback((content, url_imagen = null) => {
    if (!content.trim() || !otherUserId || !isConnected) {
      return false;
    }

    try {
      contextSendMessage(otherUserId, content.trim(), url_imagen);
      return true;
    } catch (err) {
      setError('Error al enviar mensaje');
      return false;
    }
  }, [otherUserId, isConnected, contextSendMessage]);

  const markAsRead = useCallback(() => {
    if (otherUserId) {
      contextMarkAsRead(otherUserId);
    }
  }, [otherUserId, contextMarkAsRead]);

  const unreadCount = unreadCounts[otherUserId] || 0;

  return {
    messages: localMessages,
    unreadCount,
    isLoading,
    error,
    isConnected,
    sendMessage,
    markAsRead
  };
};