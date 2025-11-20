/**
 * @page Chat - Página de chat usando conversationId
 * @descripción Chat que funciona con conversationId en la URL
 * @sprint Chat corregido con formato de URL /chat/{conversationId}
 * @tarjeta Chat basado en conversationId válido
 * @impacto Social: Chat funcional entre profesional y cliente
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatWidget from '../components/ChatWidget';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';

const Chat = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const UNUSED_CONVERSATION = conversation;
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verificar permisos
    if (!user) {
      navigate('/');
      return;
    }

    // Validar que existe el conversationId
    if (!conversationId) {
      setError('ConversationId es requerido. Use el botón "Chat con el Cliente" para abrir el chat.');
      setLoading(false);
      return;
    }

    // Cargar conversación y datos del otro usuario
    loadConversationAndUserData();
  }, [user, conversationId, navigate]);

  const loadConversationAndUserData = async () => {
    try {
      setLoading(true);
      setError('');

      // Obtener información de la conversación
      const token = localStorage.getItem('changanet_token');
      if (!token) {
        throw new Error('Usuario no autenticado');
      }

      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      
      // Cargar datos de la conversación
      const conversationResponse = await fetch(`${apiBaseUrl}/api/chat/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!conversationResponse.ok) {
        if (conversationResponse.status === 404) {
          // Intentar resolver el conversationId
          console.log('ConversationId inválido, intentando resolver...');
          await resolveConversationId();
          return;
        }
        throw new Error(`Error al cargar conversación: ${conversationResponse.status}`);
      }

      const conversationData = await conversationResponse.json();
      console.log('Datos de conversación cargados:', conversationData);
      setConversation(conversationData);

      // Determinar cuál es el otro usuario (no el actual)
      const otherUserId = conversationData.usuario1_id === user.id ? 
        conversationData.usuario2_id : conversationData.usuario1_id;

      if (!otherUserId) {
        throw new Error('No se pudo determinar el otro usuario en la conversación');
      }

      // Cargar información del otro usuario
      await loadOtherUserInfo(otherUserId);

    } catch (err) {
      console.error('Error loading conversation data:', err);
      setError(`Error al cargar la conversación: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resolveConversationId = async () => {
    try {
      console.log('🔄 ConversationId inválido detectado, analizando formato...');

      // ✅ CORRECCIÓN: Parsear conversationId y validar formato UUID-UUID
      const parts = conversationId.split('-');
      
      // Para UUID-UUID el string tendrá más de 2 partes separadas por '-'
      if (parts.length < 2) {
        throw new Error('ConversationId debe tener formato: UUID1-UUID2');
      }

      // Reconstruir UUIDs (cada UUID tiene 4 partes separadas por '-')
      // Formato esperado: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
      if (parts.length !== 10) {
        throw new Error(`ConversationId debe tener 10 partes separadas por '-', recibidas: ${parts.length}`);
      }

      const uuid1 = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
      const uuid2 = `${parts[5]}-${parts[6]}-${parts[7]}-${parts[8]}-${parts[9]}`;
      
      // ✅ VALIDACIÓN: Verificar que los IDs son UUIDs válidos
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(uuid1) || !uuidRegex.test(uuid2)) {
        throw new Error(`ConversationId contiene UUIDs inválidos. Recibido: "${conversationId}"`);
      }
      
      console.log('UUIDs extraídos:', { uuid1, uuid2 });
      
      // Verificar si el usuario actual está en la conversación
      const currentUserId = user.id;
      if (currentUserId !== uuid1 && currentUserId !== uuid2) {
        throw new Error('Usuario actual no está autorizado para acceder a esta conversación');
      }

      // ✅ CONVERSATIONID VÁLIDO: UUID1-UUID2
      console.log(`✅ ConversationId válido detectado: ${conversationId}`);
      
      // Verificar que el conversationId está en el formato correcto (orden lexicográfico)
      const sortedIds = [uuid1, uuid2].sort();
      const expectedConversationId = `${sortedIds[0]}-${sortedIds[1]}`;
      
      if (conversationId === expectedConversationId) {
        console.log('✅ ConversationId correctamente ordenado');
        // Reintentar cargar la conversación
        await loadConversationAndUserData();
        return;
      } else {
        console.log(`🔄 Redirigiendo a conversationId correcto: ${expectedConversationId}`);
        navigate(`/chat/${expectedConversationId}`, { replace: true });
        return;
      }

    } catch (err) {
      console.error('Error resolving conversationId:', err);
      setError(`Error al resolver el conversationId: ${err.message}`);
    }
  };

  const loadOtherUserInfo = async (otherUserId) => {
    try {
      const token = localStorage.getItem('changanet_token');
      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';

      const response = await fetch(`${apiBaseUrl}/api/profile/${otherUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Usuario no encontrado');
        }
        throw new Error(`Error al cargar usuario: ${response.status}`);
      }

      const userData = await response.json();
      
      // El endpoint /api/profile/:id puede devolver diferentes estructuras
      const user = userData.usuario || userData;
      
      setOtherUser({
        id: user.id,
        nombre: user.nombre,
        rol: user.rol || userData.rol || 'cliente',
        email: user.email,
        url_foto_perfil: user.url_foto_perfil
      });

    } catch (err) {
      console.error('Error loading other user info:', err);
      setOtherUser(null);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Cargando conversación..." />
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
          <div className="space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Volver
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Ir al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Usuario no encontrado</h2>
          <p className="text-gray-600 mb-4">No se pudo cargar la información del usuario para el chat.</p>
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
              <p className="text-sm text-gray-600">Tipo de usuario:</p>
              <p className="font-medium">
                {otherUser.rol === 'cliente' ? 'Cliente' : 'Profesional'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">ID de conversación:</p>
              <p className="font-medium text-blue-600 break-all">
                {conversationId}
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Chat Mejorado:</strong> Este chat usa conversationId válido para garantizar 
              una comunicación segura entre usuarios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;