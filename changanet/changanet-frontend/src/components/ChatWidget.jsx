// src/components/ChatWidget.jsx
import { useState, useEffect, useContext, useRef } from 'react';
import io from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';

const ChatWidget = ({ otherUserId }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // CONECTAR A SOCKET.IO
    const newSocket = io('http://localhost:3002', {
      transports: ['websocket', 'polling'],
      upgrade: true,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Conectado al servidor Socket.IO');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Desconectado del servidor Socket.IO');
    });

    // ESCUCHAR MENSAJES EN TIEMPO REAL
    newSocket.on('receiveMessage', (message) => {
      setMessages(prev => [...prev, message]);
      // Mostrar notificación visual
      if (Notification.permission === 'granted') {
        new Notification('Nuevo mensaje', {
          body: message.contenido,
          icon: '/vite.svg'
        });
      }
    });

    newSocket.on('messageSent', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user || !otherUserId) return;

      try {
        // INTEGRACIÓN CON BACKEND: Obtener historial de mensajes
        const response = await fetch(`/api/messages?with=${otherUserId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          setMessages(data);
        }
      } catch (error) {
        console.error('Error al cargar mensajes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [user, otherUserId]);

  const sendMessage = () => {
    if (newMessage.trim() && socket && isConnected) {
      // ENVIAR MENSAJE A TRAVÉS DE SOCKET.IO
      socket.emit('sendMessage', {
        remitente_id: user.id,
        destinatario_id: otherUserId,
        contenido: newMessage.trim(),
        url_imagen: null
      });
      setNewMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm border">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mr-2"></div>
        <span className="text-gray-600">Cargando chat...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header del Chat */}
      <div className="bg-emerald-500 text-white p-3 flex items-center justify-between">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-300' : 'bg-red-300'}`}></div>
          <h2 className="text-lg font-semibold">Chat en Tiempo Real</h2>
        </div>
        <span className="text-sm opacity-90">
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>

      {/* Área de Mensajes */}
      <div className="h-80 overflow-y-auto p-4 bg-gray-50 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>No hay mensajes aún. ¡Inicia la conversación!</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.remitente_id === user.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                  message.remitente_id === user.id
                    ? 'bg-emerald-500 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                }`}
              >
                <p className="break-words">{message.contenido}</p>
                <span className={`text-xs mt-1 block ${
                  message.remitente_id === user.id ? 'text-emerald-100' : 'text-gray-500'
                }`}>
                  {new Date(message.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Mensaje */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            placeholder="Escribe tu mensaje..."
            disabled={!isConnected}
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className="bg-emerald-500 text-white p-3 rounded-full hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
            aria-label="Enviar mensaje"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        {newMessage.length > 400 && (
          <div className="text-xs text-gray-500 mt-1">
            {newMessage.length}/500 caracteres
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWidget;
