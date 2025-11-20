/**
 * @page Chat - Página de chat completo entre usuarios usando conversationId
 * @descripción Interfaz completa para conversaciones entre clientes y profesionales
 * @sprint Sprint 2 – Dashboard y Gestión
 * @tarjeta Nueva funcionalidad: Chat completo con conversationId
 * @impacto Social: Mejora la comunicación directa entre usuarios
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import ChatWidget from '../components/ChatWidget';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';

const Chat = () => {
  const { conversationId } = useParams(); // ID de la conversación (formato: userId1-userId2)
  const { user } = useAuth();
  const { loadMessageHistory } = useChat();
  const navigate = useNavigate();
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Backend URL configuration
  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';

  useEffect(() => {
    // Verificar permisos
    if (!user) {
      navigate('/');
      return;
    }

    if (!conversationId) {
      setError('ID de conversación no válido');
      setLoading(false);
      return;
    }

    // Validar formato básico del conversationId
    if (conversationId.includes('-')) {
      const parts = conversationId.split('-');
      if (parts.length !== 2) {
        setError(`Formato de conversationId incorrecto. Se esperaban 2 partes pero se encontraron ${parts.length}. Ejemplo válido: "userId1-userId2"`);
        setLoading(false);
        return;
      }
    } else {
      setError('Formato de conversationId incorrecto. Debe seguir el patrón "userId1-userId2"');
      setLoading(false);
      return;
    }

    // Cargar información de la conversación
    loadConversationInfo();
  }, [user, conversationId, navigate]);

  const loadConversationInfo = async () => {
    try {
      setLoading(true);

      // Obtener información de la conversación
      const token = localStorage.getItem('changanet_token');
      if (!token) {
        throw new Error('Usuario no autenticado');
      }

      const response = await fetch(`${API_BASE_URL}/api/chat/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Detectar si es un UUID y intentar resolución automática
        if (conversationId.length === 36 && conversationId.includes('-')) {
          console.log('🔄 Detectado UUID, intentando resolución automática...');
          
          try {
            const resolveResponse = await fetch(`${API_BASE_URL}/api/chat/resolve-conversation/${conversationId}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (resolveResponse.ok) {
              const resolveData = await resolveResponse.json();
              if (resolveData.status === 'resolved' && resolveData.redirect) {
                console.log('✅ Conversación resuelta automáticamente:', resolveData);
                navigate(resolveData.redirect.replace('/chat/', '/chat/'), { replace: true });
                return;
              }
            }
          } catch (resolveError) {
            console.log('⚠️ No se pudo resolver automáticamente:', resolveError);
          }
        }
        
        throw new Error(errorData.error || 'Error al cargar la conversación');
      }

      const conversationData = await response.json();

      // Determinar el otro usuario en la conversación
      const otherUserId = conversationData.client.id === user.id 
        ? conversationData.professional.id 
        : conversationData.client.id;
      
      // Obtener información adicional del otro usuario si es necesario
      const otherUserData = conversationData.client.id === user.id 
        ? conversationData.professional 
        : conversationData.client;
        
      setOtherUser({
        ...otherUserData,
        // Para compatibilidad con ChatWidget
        id: otherUserId
      });

    } catch (err) {
      console.error('Error loading conversation info:', err);
      setError('Error al cargar la información de la conversación');
    } finally {
      setLoading(false);
    }
  };

  // Cargar historial de mensajes cuando se monta el componente
  useEffect(() => {
    if (user && otherUser) {
      loadMessageHistory(otherUser.id);
    }
  }, [user, otherUser, loadMessageHistory]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Cargando chat..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Conversación no encontrada</h2>
          <p className="text-gray-600 mb-4">No se pudo cargar la información del chat.</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <BackButton />
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Chat con {otherUser.nombre}
            </h1>
            <p className="mt-2 text-gray-600">
              Conversación entre {user.nombre} y {otherUser.nombre}
            </p>
          </div>
        </div>

        {/* Chat Widget */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <ChatWidget
            otherUserId={otherUser.id}
            otherUserName={otherUser.nombre}
            servicioId={null} // Chat general, no asociado a un servicio específico
          />
        </div>

        {/* Información adicional */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Información del chat</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Participantes:</p>
              <p className="font-medium">
                Tú ({user.nombre}) ↔ {otherUser.nombre}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tipo de chat:</p>
              <p className="font-medium">
                {otherUser.rol === 'cliente' ? 'Cliente' : 'Profesional'}
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Consejo:</strong> Este chat es privado y seguro. Puedes discutir detalles de servicios,
              coordinar citas o resolver cualquier duda directamente con {otherUser.nombre}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;