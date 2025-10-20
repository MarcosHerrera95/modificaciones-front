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

  useEffect(() => {
    if (user) {
      // Conectar Socket.IO
      const newSocket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:3002', {
        auth: {
          token: localStorage.getItem('token') // Asumiendo que el token JWT está en localStorage
        }
      });

      newSocket.on('connect', () => {
        console.log('Conectado a Socket.IO');
        setIsConnected(true);
        // Unirse a la sala personal del usuario
        newSocket.emit('join', user.id);
      });

      newSocket.on('disconnect', () => {
        console.log('Desconectado de Socket.IO');
        setIsConnected(false);
      });

      newSocket.on('receiveMessage', (message) => {
        // Agregar mensaje recibido
        setMessages(prev => ({
          ...prev,
          [message.destinatario_id]: [
            ...(prev[message.destinatario_id] || []),
            message
          ]
        }));

        // Incrementar contador de no leídos si no es del usuario actual
        if (message.remitente_id !== user.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [message.remitente_id]: (prev[message.remitente_id] || 0) + 1
          }));
        }
      });

      newSocket.on('messageSent', (message) => {
        // Confirmación de que el mensaje fue enviado
        console.log('Mensaje enviado:', message);
      });

      newSocket.on('messagesRead', (data) => {
        // Resetear contador de no leídos cuando el otro usuario lee los mensajes
        if (data.by === user.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [data.by]: 0
          }));
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
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

  const loadMessageHistory = async (otherUserId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3002'}/api/messages?with=${otherUserId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
    sendMessage,
    markAsRead,
    loadMessageHistory
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export { ChatContext };