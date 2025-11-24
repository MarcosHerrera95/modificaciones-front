/**
 * @component ConversationList
 * @description Lista de conversaciones del usuario
 * @required_by REQ-20: Historial de conversaciones
 * @required_by REQ-16: Chat interno
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

const ConversationList = ({ onSelectConversation }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.id) {
      loadConversations();
    }
  }, [user?.id]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('changanet_token');
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

      const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error al cargar conversaciones: ${response.status}`);
      }

      const data = await response.json();
      setConversations(data.conversations || []);

    } catch (error) {
      console.error('Error cargando conversaciones:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conversation) => {
    // Callback para el componente padre
    if (onSelectConversation) {
      onSelectConversation(conversation);
    } else {
      // Navegación por defecto
      navigate(`/chat/${conversation.id}`);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('es-ES', { 
        weekday: 'short',
        day: 'numeric'
      });
    } else {
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" message="Cargando conversaciones..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        <p className="font-semibold">Error al cargar conversaciones</p>
        <p className="text-sm text-gray-600">{error}</p>
        <button
          onClick={loadConversations}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center text-gray-500 p-8">
        <div className="text-6xl mb-4">💬</div>
        <h3 className="text-lg font-semibold mb-2">No hay conversaciones</h3>
        <p className="text-sm">
          Cuando inicies una conversación con un profesional, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">
          Conversaciones ({conversations.length})
        </h2>
      </div>
      
      <div className="divide-y divide-gray-200">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            onClick={() => handleSelectConversation(conversation)}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              {/* Avatar del usuario */}
              <div className="flex-shrink-0">
                {conversation.otherUser.foto_perfil ? (
                  <img
                    src={conversation.otherUser.foto_perfil}
                    alt={conversation.otherUser.nombre}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-600">
                      {conversation.otherUser.nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Información de la conversación */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {conversation.otherUser.nombre}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {conversation.lastMessage 
                      ? formatTime(conversation.lastMessage.created_at)
                      : formatTime(conversation.created_at)
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-gray-600 truncate">
                    {conversation.lastMessage ? (
                      conversation.lastMessage.image_url ? (
                        <span className="italic">📷 Imagen enviada</span>
                      ) : (
                        conversation.lastMessage.content
                      )
                    ) : (
                      <span className="italic text-gray-400">Sin mensajes</span>
                    )}
                  </p>
                  
                  {/* Indicador de verificación */}
                  {conversation.otherUser.verificado && (
                    <span className="ml-2 text-green-500" title="Verificado">
                      ✓
                    </span>
                  )}
                </div>

                {/* Rol del usuario */}
                <div className="flex items-center mt-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    conversation.otherUser.rol === 'profesional' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {conversation.otherUser.rol === 'profesional' ? 'Profesional' : 'Cliente'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Botón para cargar más conversaciones (paginación futura) */}
      {conversations.length >= 20 && (
        <div className="p-4 border-t text-center">
          <button className="text-sm text-blue-600 hover:text-blue-800">
            Cargar más conversaciones
          </button>
        </div>
      )}
    </div>
  );
};

export default ConversationList;