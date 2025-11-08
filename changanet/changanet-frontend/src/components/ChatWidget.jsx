// src/components/ChatWidget.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChatHook } from '../hooks/useChat';
import { uploadChatImage } from '../services/storageService';

const ChatWidget = ({ otherUserId, servicioId }) => {
  const { user } = useAuth();
  const {
    messages,
    unreadCount,
    isLoading,
    error,
    isConnected,
    sendMessage,
    markAsRead
  } = useChatHook(otherUserId);

  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Marcar mensajes como leídos cuando se abre el chat
  useEffect(() => {
    if (otherUserId && unreadCount > 0) {
      markAsRead();
    }
  }, [otherUserId, unreadCount, markAsRead]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;

    let imageUrl = null;

    // Subir imagen si hay una seleccionada
    if (selectedImage) {
      setUploadingImage(true);
      try {
        // Crear nombre único para la imagen del chat
        const fileName = `chat-${user.id}-${otherUserId}-${Date.now()}.${selectedImage.name.split('.').pop()}`;
        const result = await uploadChatImage(user.id, otherUserId, selectedImage, fileName);
        if (result.success) {
          imageUrl = result.url;
        } else {
          console.error('Error uploading image:', result.error);
          alert('Error al subir la imagen. Inténtalo de nuevo.');
          setUploadingImage(false);
          return;
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Error al subir la imagen. Inténtalo de nuevo.');
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    // Enviar mensaje con o sin imagen
    const messageContent = newMessage.trim() || (imageUrl ? '📷 Imagen' : '');
    if (sendMessage(messageContent, imageUrl, servicioId)) {
      setNewMessage('');
      setSelectedImage(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!user || !otherUserId || !servicioId) {
    return (
      <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm border">
        <span className="text-gray-600">Selecciona un servicio para iniciar el chat</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm border">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mr-2"></div>
        <span className="text-gray-600">Cargando chat...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm border">
        <span className="text-red-600">{error}</span>
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
                {message.url_imagen && (
                  <img
                    src={message.url_imagen}
                    alt="Imagen del mensaje"
                    className="max-w-full h-auto rounded-lg mb-2 cursor-pointer"
                    onClick={() => window.open(message.url_imagen, '_blank')}
                  />
                )}
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
        {/* Vista previa de imagen seleccionada */}
        {selectedImage && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img
                  src={URL.createObjectURL(selectedImage)}
                  alt="Vista previa"
                  className="w-10 h-10 object-cover rounded"
                />
                <span className="text-sm text-gray-600">{selectedImage.name}</span>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {/* Botón para seleccionar imagen */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file && file.type.startsWith('image/')) {
                setSelectedImage(file);
              } else if (file) {
                alert('Por favor selecciona solo archivos de imagen (JPG, PNG)');
              }
            }}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="bg-gray-100 text-gray-600 p-3 rounded-full hover:bg-gray-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
            aria-label="Adjuntar imagen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            placeholder="Escribe tu mensaje..."
            disabled={!isConnected || uploadingImage}
            maxLength={500}
          />
          <button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedImage) || !isConnected || uploadingImage}
            className="bg-emerald-500 text-white p-3 rounded-full hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
            aria-label="Enviar mensaje"
          >
            {uploadingImage ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
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
