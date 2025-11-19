/**
 * @page Chat - Página de chat completo entre usuarios
 * @descripción Interfaz completa para conversaciones entre clientes y profesionales
 * @sprint Sprint 2 – Dashboard y Gestión
 * @tarjeta Nueva funcionalidad: Chat completo
 * @impacto Social: Mejora la comunicación directa entre usuarios
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import ChatWidget from '../components/ChatWidget';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';

const Chat = () => {
  const { userId } = useParams(); // ID del otro usuario en el chat
  const { user } = useAuth();
  const { loadMessageHistory } = useChat();
  const navigate = useNavigate();
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verificar permisos
    if (!user) {
      navigate('/');
      return;
    }

    // Cargar información del otro usuario
    loadOtherUserInfo();
  }, [user, userId, navigate]);

  const loadOtherUserInfo = async () => {
    try {
      setLoading(true);

      // Obtener información del otro usuario
      const response = await fetch(`/api/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOtherUser(data);
      } else {
        setError('No se pudo cargar la información del usuario');
      }
    } catch (err) {
      console.error('Error loading user info:', err);
      setError('Error al cargar la información del usuario');
    } finally {
      setLoading(false);
    }
  };

  // Cargar historial de mensajes cuando se monta el componente
  useEffect(() => {
    if (user && userId) {
      loadMessageHistory(userId);
    }
  }, [user, userId, loadMessageHistory]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <BackButton />
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Chat con {otherUser?.usuario?.nombre || 'Usuario'}
            </h1>
            <p className="mt-2 text-gray-600">
              Conversación privada entre tú y {otherUser?.usuario?.nombre || 'este usuario'}
            </p>
          </div>
        </div>

        {/* Chat Widget */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <ChatWidget
            otherUserId={userId}
            otherUserName={otherUser?.usuario?.nombre || 'Usuario'}
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
                Tú ({user.nombre}) ↔ {otherUser?.usuario?.nombre || 'Usuario'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tipo de chat:</p>
              <p className="font-medium">Conversación privada</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Consejo:</strong> Este chat es privado y seguro. Puedes discutir detalles de servicios,
              coordinar citas o resolver cualquier duda directamente con el otro usuario.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;