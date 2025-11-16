import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useSmartNavigation from '../../hooks/useSmartNavigation';

// Backend URL configuration
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';


const ProfessionalDashboard = ({ user }) => {
  const navigate = useNavigate();
  const smartNavigate = useSmartNavigation();
  const [stats, setStats] = useState({
    activeServices: 0,
    completedServices: 0,
    pendingQuotes: 0,
    unreadNotifications: 0,
    averageRating: 0
  });
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch services, quotes, notifications, profile
      const [servicesRes, quotesRes, notificationsRes, profileRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/quotes/professional/services`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        }),
        fetch(`${API_BASE_URL}/api/quotes/professional`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        }),
        fetch(`${API_BASE_URL}/api/notifications`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        }),
        fetch(`${API_BASE_URL}/api/profile`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        })
      ]);

      if (servicesRes.ok) {
        const services = await servicesRes.json();
        setStats(prev => ({
          ...prev,
          activeServices: services.filter(s => s.estado === 'agendado').length,
          completedServices: services.filter(s => s.estado === 'completado').length
        }));
      }

      if (quotesRes.ok) {
        const quotes = await quotesRes.json();
        setRecentQuotes(quotes.slice(0, 3));
        setStats(prev => ({
          ...prev,
          pendingQuotes: quotes.filter(q => q.estado === 'pendiente').length
        }));
      }

      if (notificationsRes.ok) {
        const notificationsResponse = await notificationsRes.json();
        console.log('Notifications API response:', notificationsResponse);
        const notifications = notificationsResponse.notifications || [];
        setStats(prev => ({
          ...prev,
          unreadNotifications: notifications.filter(n => !n.esta_leido).length
        }));
      }

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setStats(prev => ({
          ...prev,
          averageRating: profile.calificacion_promedio || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyClick = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/verification/status`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.verified) {
          setMessage('¡Ya estás verificado! Tu identidad ha sido confirmada exitosamente.');
        } else {
          navigate('/verificar-identidad');
        }
      } else {
        setMessage('Error al verificar el estado. Inténtalo de nuevo.');
      }
    } catch (error) {
      setMessage('Error de conexión. Inténtalo de nuevo.');
    }

    setTimeout(() => setMessage(''), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          ¡Hola, {user.nombre}!
        </h1>
        <p className="text-gray-600">
          Bienvenido a tu panel profesional. Gestiona tus servicios y cotizaciones.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <span className="text-2xl">🔧</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Servicios Activos</p>
              <p className="text-2xl font-bold text-gray-800">{stats.activeServices}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-amber-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Servicios Completados</p>
              <p className="text-2xl font-bold text-gray-800">{stats.completedServices}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <span className="text-2xl">📝</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cotizaciones Pendientes</p>
              <p className="text-2xl font-bold text-gray-800">{stats.pendingQuotes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-amber-100 rounded-lg">
              <span className="text-2xl">⭐</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Calificación Promedio</p>
              <p className="text-2xl font-bold text-gray-800">{stats.averageRating.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
            onClick={() => smartNavigate('/mis-cotizaciones')}
            type="button"
            className="flex items-center p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors duration-200 w-full text-left">
            <span className="text-2xl mr-3">📋</span>
            <div>
              <h3 className="font-semibold text-gray-800">Mis Cotizaciones</h3>
              <p className="text-sm text-gray-600">Responde a solicitudes</p>
          </div>
        </button>

          <button
            onClick={() => smartNavigate('/mi-perfil-profesional')}
            type="button"
            className="flex items-center p-4 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors duration-200 w-full text-left">
            <span className="text-2xl mr-3">👤</span>
            <div>
              <h3 className="font-semibold text-gray-800">Mi Perfil</h3>
              <p className="text-sm text-gray-600">Actualiza tu información</p>
          </div>
        </button>

          <button
            onClick={() => smartNavigate('/disponibilidad')}
            type="button"
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200 w-full text-left">
            <span className="text-2xl mr-3">📅</span>
            <div>
              <h3 className="font-semibold text-gray-800">Disponibilidad</h3>
              <p className="text-sm text-gray-600">Gestiona tu agenda</p>
          </div>
        </button>
        </div>
      </div>

      {/* Recent Quotes */}
      {recentQuotes.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Cotizaciones Recientes</h2>
          <div className="space-y-4">
            {recentQuotes.map(quote => (
              <div key={quote.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-semibold text-gray-800">{quote.descripcion}</h3>
                  <p className="text-sm text-gray-600">
                    Cliente: {quote.cliente.nombre} • Zona: {quote.zona_cobertura}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    quote.estado === 'pendiente' ? 'bg-amber-100 text-amber-800' :
                    quote.estado === 'aceptado' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {quote.estado}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification Status */}
      <div className="bg-gradient-to-r from-emerald-50 to-turquoise-50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Estado de Verificación</h3>
            <p className="text-gray-600 text-sm">
              Completa tu verificación para aparecer en más búsquedas y ganar confianza.
            </p>
            {message && (
              <p className="text-emerald-600 text-sm mt-2 font-medium">{message}</p>
            )}
          </div>
          <button
            onClick={handleVerifyClick}
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors duration-200 font-medium"
          >
            Verificar Identidad
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDashboard;
