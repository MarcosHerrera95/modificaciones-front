import { createContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [typingUsers, setTypingUsers] = useState({}); // Estado para usuarios escribiendo

  useEffect(() => {
    // Habilitar Socket.IO para funcionalidad de chat en tiempo real
    if (user) {
      console.log('🔄 Inicializando Socket.IO para chat en tiempo real...');
      
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';
      const newSocket = io(API_BASE_URL, {
        auth: {
          token: localStorage.getItem('changanet_token')
        }
      });

      // Manejar conexión
      newSocket.on('connect', () => {
        console.log('✅ Socket.IO conectado para chat');
        setIsConnected(true);
      });

      // Manejar desconexión
      newSocket.on('disconnect', () => {
        console.log('⚠️ Socket.IO desconectado');
        setIsConnected(false);
      });

      // Manejar errores de conexión
      newSocket.on('connect_error', (error) => {
        console.error('❌ Error de conexión Socket.IO:', error.message);
        setIsConnected(false);
      });

      setSocket(newSocket);

      // Cleanup al desmontar
      return () => {
        console.log('🧹 Cerrando conexión Socket.IO');
        newSocket.disconnect();
      };
    }
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