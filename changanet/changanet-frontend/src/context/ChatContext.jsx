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

  const sendMessage = async (destinatario_id, contenido, url_imagen = null) => {
    try {
      // Usar el endpoint REST del chat simplificado
      const token = localStorage.getItem('changanet_token');
      if (!token) {
        throw new Error('Usuario no autenticado');
      }

      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          destinatario_id,
          contenido,
          url_imagen
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Agregar el mensaje localmente
          setMessages(prev => ({
            ...prev,
            [destinatario_id]: [
              ...(prev[destinatario_id] || []),
              data.data
            ]
          }));
        }
        return true;
      } else {
        console.error('Error enviando mensaje:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      return false;
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
      const response = await fetch(`/api/chat/messages/${otherUserId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // El backend devuelve la estructura: { success: true, messages: [...] }
        if (data.success && data.messages) {
          setMessages(prev => ({
            ...prev,
            [otherUserId]: data.messages
          }));
        }
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