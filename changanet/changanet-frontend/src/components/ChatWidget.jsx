/**
 * @component ChatWidget
 * @description Widget integrado de chat para usar en cualquier página
 * @required_by REQ-16: Chat interno en página del perfil
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ChatWidget = ({ professionalId, professionalName, onChatStart }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleStartChat = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      // Determinar roles
      const isProfessional = user.rol === 'profesional';
      const clientId = isProfessional ? professionalId : user.id;
      const professionalId_final = isProfessional ? user.id : professionalId;

      const token = localStorage.getItem('changanet_token');
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

      // Crear o obtener conversación
      const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId,
          professionalId: professionalId_final
        })
      });

      if (!response.ok) {
        throw new Error(`Error al crear conversación: ${response.status}`);
      }

      const data = await response.json();
      const conversationId = data.conversation.id;

      // Callback opcional para el componente padre
      if (onChatStart) {
        onChatStart(data.conversation);
      } else {
        // Navegación por defecto al chat
        navigate(`/chat/${conversationId}`);
      }

    } catch (error) {
      console.error('Error iniciando chat:', error);
      alert('Error al iniciar el chat. Por favor, inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Si no hay usuario autenticado, mostrar botón de login
  if (!user) {
    return (
      <button
        onClick={() => navigate('/login')}
        className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        title="Inicia sesión para chatear"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Iniciar sesión para chatear
      </button>
    );
  }

  // Si el usuario es el mismo profesional, no mostrar botón
  if (user.id === professionalId) {
    return null;
  }

  return (
    <button
      onClick={handleStartChat}
      disabled={loading}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
        loading
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
      }`}
      title={`Chatear con ${professionalName}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          Conectando...
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chatear con {professionalName}
        </>
      )}
    </button>
  );
};

export default ChatWidget;
