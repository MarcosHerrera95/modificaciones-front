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
    let newSocket = null;

    if (user) {
      // Skip Socket.IO in development to avoid connection errors
      if (import.meta.env.DEV) {
        console.log('Socket.IO omitido en modo desarrollo');
        setIsConnected(false);
        return;
      }

      // Diagnostic logs for Socket.IO connection
      const backendUrl = 'http://localhost:3002'; // Updated to match backend port
      const token = localStorage.getItem('changanet_token');
      console.log('🔍 Socket.IO Connection Diagnostics:');
      console.log('🔍 Backend URL:', backendUrl);
      console.log('🔍 VITE_BACKEND_URL env var:', import.meta.env.VITE_BACKEND_URL);
      console.log('🔍 Token present:', !!token);
      console.log('🔍 Token length:', token ? token.length : 0);
      console.log('🔍 User ID:', user.id);
      console.log('🔍 Current timestamp:', new Date().toISOString());

      // Test backend connectivity
      const healthUrl = `${import.meta.env.VITE_BACKEND_URL}/health`;
      console.log('🔍 Attempting health check fetch to:', healthUrl);
      fetch(healthUrl, { method: 'GET' })
        .then(response => {
          console.log('🔍 Backend health check:', response.status, response.ok ? 'OK' : 'FAILED');
          if (!response.ok) {
            console.error('🔍 Backend health check failed - server may not be running or wrong port');
          }
        })
        .catch(error => {
          console.error('🔍 Backend health check error:', error.message);
          console.error('🔍 Full error:', error);
          console.error('🔍 This suggests the backend server is not running or unreachable on', backendUrl);
        });

      // Conectar Socket.IO
      newSocket = io(backendUrl, {
        auth: {
          token: localStorage.getItem('changanet_token') // Token correcto de Changánet
        },
        transports: ['websocket', 'polling'], // Prefer WebSocket over polling
        timeout: 5000, // Timeout de conexión
        reconnection: true, // Reconexión automática
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true // Force new connection
      });

      newSocket.on('connect', () => {
        console.log('✅ Conectado a Socket.IO');
        setIsConnected(true);
        // Unirse a la sala personal del usuario
        newSocket.emit('join', user.id);
      });

      newSocket.on('reconnect', () => {
        console.log('✅ Reconectado a Socket.IO');
        setIsConnected(true);
        // Re-unirse a la sala personal del usuario
        newSocket.emit('join', user.id);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Desconectado de Socket.IO:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Error de conexión Socket.IO:', error);
        console.error('❌ Error details:', {
          message: error.message,
          description: error.description,
          context: error.context,
          type: error.type
        });
        console.error('❌ Socket.IO connection config:', {
          url: backendUrl,
          transports: ['websocket', 'polling'],
          timeout: 5000,
          reconnection: true,
          reconnectionAttempts: 5
        });
        console.error('❌ Browser network info:', {
          userAgent: navigator.userAgent,
          online: navigator.onLine,
          protocol: window.location.protocol
        });

        // Only set disconnected if this is not a reconnection attempt
        if (!newSocket.reconnecting) {
          setIsConnected(false);
        }
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
        console.log('📤 Mensaje enviado:', message);
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
    }

    // Cleanup function para cerrar conexiones
    return () => {
      if (newSocket) {
        console.log('🧹 Limpiando conexión Socket.IO');
        newSocket.off('connect');
        newSocket.off('disconnect');
        newSocket.off('connect_error');
        newSocket.off('receiveMessage');
        newSocket.off('messageSent');
        newSocket.off('messagesRead');
        newSocket.close();
        setIsConnected(false);
      }
    };
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