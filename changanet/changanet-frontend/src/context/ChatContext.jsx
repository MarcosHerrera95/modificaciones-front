import { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat debe usarse dentro de ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [typingUsers, setTypingUsers] = useState({}); // Estado para usuarios escribiendo

  useEffect(() => {
    // COMPLETELY DISABLE Socket.IO to prevent any connection attempts
    if (user) {
      console.log('🔇 Socket.IO completamente deshabilitado');
      setIsConnected(false);
      setSocket(null);
    }

    // No cleanup needed since we're not creating any connections
    return () => {};
  }, [user]);

  const sendMessage = (destinatario_id, contenido, url_imagen = null) => {
    if (socket && isConnected && user) {
      socket.emit('sendMessage', {
        remitente_id: user.id,
        destinatario_id,
        contenido,
        url_imagen
      });
    }
  };

  const markAsRead = (senderId) => {
    if (socket && isConnected && user) {
      socket.emit('markAsRead', {
        senderId,
        recipientId: user.id
      });
      // Resetear contador local
      setUnreadCounts(prev => ({
        ...prev,
        [senderId]: 0
      }));
    }
  };

  const emitTyping = (to) => {
    if (socket && isConnected && user) {
      socket.emit('typing', {
        from: user.id,
        to,
        isTyping: true
      });
    }
  };

  const stopTyping = (to) => {
    if (socket && isConnected && user) {
      socket.emit('typing', {
        from: user.id,
        to,
        isTyping: false
      });
    }
  };

  const loadMessageHistory = async (otherUserId) => {
    try {
      const response = await fetch(`/api/messages?with=${otherUserId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const history = await response.json();
        setMessages(prev => ({
          ...prev,
          [otherUserId]: history
        }));
      }
    } catch (error) {
      console.error('Error al cargar historial de mensajes:', error);
    }
  };

  const value = {
    socket,
    isConnected,
    messages,
    unreadCounts,
    typingUsers,
    sendMessage,
    markAsRead,
    loadMessageHistory,
    emitTyping,
    stopTyping
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export { ChatContext };