/**
 * @page Chat - Página de chat SIMPLIFICADO usando solo IDs de usuario
 * @descripción Chat directo usuario-a-usuario sin conversationId
 * @sprint Chat simplificado sin tabla conversaciones
 * @tarjeta Chat directo usando modelo mensajes únicamente
 * @impacto Social: Chat directo y eficiente usando solo IDs
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatWidget from '../components/ChatWidget';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';

const Chat = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Obtener el ID del otro usuario desde la URL: /chat?user=<id>
  const otherUserId = searchParams.get('user');

  useEffect(() => {
    // Verificar permisos
    if (!user) {
      navigate('/');
      return;
    }

    // Validar que existe el parámetro user
    if (!otherUserId) {
      setError('Parámetro user es requerido. Use: /chat?user=<id_otro_usuario>');
      setLoading(false);
      return;
    }

    // No permitir chat con uno mismo
    if (otherUserId === user.id) {
      setError('No puedes iniciar un chat contigo mismo');
      setLoading(false);
      return;
    }

    // Cargar información del otro usuario
    loadOtherUserInfo();
  }, [user, otherUserId, navigate]);

  const loadOtherUserInfo = async () => {
    try {
      setLoading(true);
      setError('');

      // Obtener información del otro usuario desde el endpoint de usuarios
      const token = localStorage.getItem('changanet_token');
      if (!token) {
        throw new Error('Usuario no autenticado');
      }

      const response = await fetch(`http://localhost:3003/api/profile/${otherUserId}`, {
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
      // Para profesionales: el usuario está en userData.usuario
      // Para clientes: los datos del usuario están directamente en userData
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
      setError(`Error al cargar información del usuario: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
              Conversación directa entre {user.nombre} y {otherUser.nombre}
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
              <p className="text-sm text-gray-600">URL del chat:</p>
              <p className="font-medium text-blue-600 break-all">
                /chat?user={otherUser.id}
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Chat Simplificado:</strong> Este chat usa el modelo de mensajes directamente. 
              Los mensajes se almacenan usando los IDs de los usuarios como remitente y destinatario.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;