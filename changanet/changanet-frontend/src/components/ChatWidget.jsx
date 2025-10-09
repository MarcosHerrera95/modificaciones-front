// src/components/ChatWidget.jsx
import { useState, useEffect, useContext } from 'react';
import io from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';

const ChatWidget = ({ otherUserId }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CONECTAR A SOCKET.IO
    const newSocket = io('http://localhost:3002');
    setSocket(newSocket);

    // ESCUCHAR MENSAJES EN TIEMPO REAL
    newSocket.on('receiveMessage', (message) => {
      setMessages(prev => [...prev, message]);
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
    if (newMessage.trim() && socket) {
      // ENVIAR MENSAJE A TRAVÉS DE SOCKET.IO
      socket.emit('sendMessage', {
        remitente_id: user.id,
        destinatario_id: otherUserId,
        contenido: newMessage,
        url_imagen: null
      });
      setNewMessage('');
    }
  };

  if (loading) {
    return <div className="p-4">Cargando chat...</div>;
  }

  return (
    <div className="border rounded-lg shadow p-4">
      <h2 className="text-xl font-bold mb-4">Chat</h2>
      
      <div className="h-64 overflow-y-auto mb-4 p-2 bg-gray-50 rounded">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`mb-2 p-2 rounded ${message.remitente_id === user.id ? 'bg-primary text-white ml-auto' : 'bg-white border'}`}
            style={{ maxWidth: '80%', textAlign: message.remitente_id === user.id ? 'right' : 'left' }}
          >
            {message.contenido}
          </div>
        ))}
      </div>
      
      <div className="flex">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-grow px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Escribe un mensaje..."
        />
        <button
          onClick={sendMessage}
          className="bg-emerald-500 text-black px-4 py-2 rounded-r-md hover:bg-emerald-600 hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex items-center justify-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatWidget;
