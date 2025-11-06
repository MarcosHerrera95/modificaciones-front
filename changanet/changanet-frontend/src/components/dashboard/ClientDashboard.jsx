import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const ClientDashboard = ({ user }) => {
  const [stats, setStats] = useState({
    activeServices: 0,
    pendingQuotes: 0,
    unreadNotifications: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch essential data only
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
        setStats(prev => ({
          ...prev,
          activeServices: services.filter(s => s.estado === 'agendado').length
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simple Welcome */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-gray-800">
          ¡Hola, {user.nombre}!
        </h1>
        <p className="text-gray-600 mt-1">
          ¿Qué necesitas hoy?
        </p>
      </div>

      {/* Key Stats - Simplified to 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <span className="text-xl">🔧</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Servicios Activos</p>
              <p className="text-xl font-bold text-gray-800">{stats.activeServices}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-xl">📝</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Cotizaciones</p>
              <p className="text-xl font-bold text-gray-800">{stats.pendingQuotes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-xl">🔔</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Notificaciones</p>
              <p className="text-xl font-bold text-gray-800">{stats.unreadNotifications}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Actions - Simplified to 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/profesionales"
          className="bg-emerald-600 text-white p-6 rounded-xl hover:bg-emerald-700 transition-colors duration-200 text-center"
        >
          <span className="text-3xl block mb-2">🔍</span>
          <h3 className="text-lg font-semibold mb-1">Buscar Profesionales</h3>
          <p className="text-sm opacity-90">Encuentra el servicio que necesitas</p>
        </Link>

        <Link
          to="/mis-cotizaciones"
          className="bg-white text-gray-800 p-6 rounded-xl hover:bg-gray-50 transition-colors duration-200 text-center border border-gray-200"
        >
          <span className="text-3xl block mb-2">📋</span>
          <h3 className="text-lg font-semibold mb-1">Mis Cotizaciones</h3>
          <p className="text-sm text-gray-600">Revisa tus solicitudes</p>
        </Link>
      </div>
    </div>
  );
};

export default ClientDashboard;
