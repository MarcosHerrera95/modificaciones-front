import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ClientDashboard = ({ user }) => {
  const [stats, setStats] = useState({
    activeServices: 0,
    completedServices: 0,
    pendingQuotes: 0,
    unreadNotifications: 0
  });
  const [recentServices, setRecentServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch services, quotes, notifications
      const [servicesRes, quotesRes, notificationsRes] = await Promise.all([
        fetch('/api/quotes/client/services', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        }),
        fetch('/api/quotes/client', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        }),
        fetch('/api/notifications', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        })
      ]);

      if (servicesRes.ok) {
        const services = await servicesRes.json();
        setRecentServices(services.slice(0, 3));
        setStats(prev => ({
          ...prev,
          activeServices: services.filter(s => s.estado === 'agendado').length,
          completedServices: services.filter(s => s.estado === 'completado').length
        }));
      }

      if (quotesRes.ok) {
        const quotes = await quotesRes.json();
        setStats(prev => ({
          ...prev,
          pendingQuotes: quotes.filter(q => q.estado === 'pendiente').length
        }));
      }

      if (notificationsRes.ok) {
        const notifications = await notificationsRes.json();
        setStats(prev => ({
          ...prev,
          unreadNotifications: notifications.filter(n => !n.esta_leido).length
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="bg-gradient-to-r from-emerald-50 to-turquoise-50 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          ¡Hola, {user.name}!
        </h1>
        <p className="text-gray-600">
          Bienvenido a tu panel de cliente. Gestiona tus servicios y encuentra nuevos profesionales.
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
            <div className="p-3 bg-red-100 rounded-lg">
              <span className="text-2xl">🔔</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Notificaciones</p>
              <p className="text-2xl font-bold text-gray-800">{stats.unreadNotifications}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/mis-cotizaciones"
            className="flex items-center p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors duration-200"
          >
            <span className="text-2xl mr-3">📋</span>
            <div>
              <h3 className="font-semibold text-gray-800">Mis Cotizaciones</h3>
              <p className="text-sm text-gray-600">Gestiona tus solicitudes de presupuesto</p>
            </div>
          </Link>

          <Link
            to="/mi-perfil-cliente"
            className="flex items-center p-4 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors duration-200"
          >
            <span className="text-2xl mr-3">👤</span>
            <div>
              <h3 className="font-semibold text-gray-800">Mi Perfil</h3>
              <p className="text-sm text-gray-600">Actualiza tu información</p>
            </div>
          </Link>

          <Link
            to="/disponibilidad"
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
          >
            <span className="text-2xl mr-3">📅</span>
            <div>
              <h3 className="font-semibold text-gray-800">Disponibilidad</h3>
              <p className="text-sm text-gray-600">Gestiona tu agenda</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Services */}
      {recentServices.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Servicios Recientes</h2>
          <div className="space-y-4">
            {recentServices.map(service => (
              <div key={service.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-semibold text-gray-800">{service.descripcion}</h3>
                  <p className="text-sm text-gray-600">
                    Profesional: {service.profesional.nombre} • Estado: {service.estado}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    service.estado === 'completado' ? 'bg-emerald-100 text-emerald-800' :
                    service.estado === 'agendado' ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {service.estado}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
