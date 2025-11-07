/**
 * @page ClientDashboard - Dashboard principal para clientes
 * @descripción Panel de control completo para gestión de servicios y cotizaciones (REQ-01 a REQ-45)
 * @sprint Sprint 2 – Dashboard y Gestión
 * @tarjeta Tarjeta 3: [Frontend] Implementar Dashboard Cliente
 * @impacto Social: Herramientas para que clientes encuentren servicios de triple impacto
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ClientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalServices: 0,
    pendingQuotes: 0,
    completedServices: 0,
    totalSpent: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);

  // Verificar permisos
  useEffect(() => {
    console.log('ClientDashboard - User:', user);
    console.log('ClientDashboard - User role:', user?.role || user?.rol);
    if (!user || (user.role !== 'cliente' && user.rol !== 'cliente')) {
      console.log('ClientDashboard - Redirecting because user is not cliente');
      navigate('/');
      return;
    }
    // Don't load data immediately, wait for user to be fully set
    const timer = setTimeout(() => {
      if (user && (user.role === 'cliente' || user.rol === 'cliente')) {
        loadDashboardData();
      }
    }, 100); // Small delay to ensure user state is fully updated

    return () => clearTimeout(timer);
  }, [user, navigate]);

  const loadDashboardData = async () => {
    try {
      console.log('Loading client dashboard data for user:', user);
      const token = sessionStorage.getItem('changanet_token');
      console.log('Token from sessionStorage:', token ? 'present' : 'missing');

      if (!token) {
        console.log('No token found, skipping API calls');
        return;
      }

      // For now, just set default stats since the API endpoints don't exist yet
      console.log('Setting default client stats (API endpoints not implemented yet)');
      setStats({
        totalServices: 0,
        pendingQuotes: 0,
        completedServices: 0,
        totalSpent: 0
      });
      setRecentActivity([]);

      // TODO: Uncomment when API endpoints are implemented
      /*
      // Cargar estadísticas del cliente
      const statsResponse = await fetch('/api/client/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Client stats response:', statsResponse.status);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('Client stats data:', statsData);
        setStats(statsData.data || stats);
      } else {
        console.error('Failed to load client stats:', statsResponse.status);
      }

      // Cargar actividad reciente
      const activityResponse = await fetch('/api/client/activity', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Client activity response:', activityResponse.status);

      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        console.log('Client activity data:', activityData);
        setRecentActivity(activityData.data || []);
      } else {
        console.error('Failed to load client activity:', activityResponse.status);
      }
      */
    } catch (error) {
      console.error('Error cargando datos del dashboard cliente:', error);
    }
  };

  const tabs = [
    { id: 'overview', name: 'Resumen', icon: '📊' },
    { id: 'profile', name: 'Mi Perfil', icon: '👤' },
    { id: 'services', name: 'Mis Servicios', icon: '🔧' },
    { id: 'quotes', name: 'Cotizaciones', icon: '💰' },
    { id: 'professionals', name: 'Profesionales', icon: '👥' },
    { id: 'reviews', name: 'Mis Reseñas', icon: '⭐' },
    { id: 'payments', name: 'Pagos', icon: '💳' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Estadísticas principales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-2xl">🔧</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Servicios Totales</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalServices}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Cotizaciones Pendientes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pendingQuotes}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Servicios Completados</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.completedServices}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Gastado</p>
                    <p className="text-2xl font-bold text-gray-900">${stats.totalSpent}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actividad reciente */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actividad Reciente</h3>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay actividad reciente</p>
                ) : (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm">📋</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                          <p className="text-xs text-gray-500">{activity.timestamp}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                        activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {activity.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mi Perfil de Cliente</h3>
            <button
              onClick={() => navigate('/mi-perfil-cliente')}
              className="bg-[#E30613] text-white px-4 py-2 rounded-lg hover:bg-[#C9050F] transition-colors"
            >
              Editar Perfil
            </button>
          </div>
        );

      case 'services':
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mis Servicios Contratados</h3>
            <button
              onClick={() => navigate('/mis-servicios-cliente')}
              className="bg-[#E30613] text-white px-4 py-2 rounded-lg hover:bg-[#C9050F] transition-colors"
            >
              Ver Servicios
            </button>
          </div>
        );

      case 'quotes':
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mis Cotizaciones</h3>
            <button
              onClick={() => navigate('/cotizaciones-cliente')}
              className="bg-[#E30613] text-white px-4 py-2 rounded-lg hover:bg-[#C9050F] transition-colors"
            >
              Gestionar Cotizaciones
            </button>
          </div>
        );

      case 'professionals':
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Profesionales Favoritos</h3>
            <button
              onClick={() => navigate('/profesionales')}
              className="bg-[#E30613] text-white px-4 py-2 rounded-lg hover:bg-[#C9050F] transition-colors"
            >
              Explorar Profesionales
            </button>
          </div>
        );

      case 'reviews':
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mis Reseñas</h3>
            <button
              onClick={() => navigate('/mis-resenas')}
              className="bg-[#E30613] text-white px-4 py-2 rounded-lg hover:bg-[#C9050F] transition-colors"
            >
              Ver Reseñas
            </button>
          </div>
        );

      case 'payments':
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Historial de Pagos</h3>
            <button
              onClick={() => navigate('/pagos-cliente')}
              className="bg-[#E30613] text-white px-4 py-2 rounded-lg hover:bg-[#C9050F] transition-colors"
            >
              Ver Pagos
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  if (!user || (user.role !== 'cliente' && user.rol !== 'cliente')) {
    console.log('ClientDashboard - Not rendering because user is not cliente:', user);
    return null; // No renderizar si no es cliente
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Cliente</h1>
          <p className="mt-2 text-gray-600">
            ¡Hola, {user.nombre}! Gestiona tus servicios y encuentra los mejores profesionales.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-white p-1 rounded-lg shadow">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#E30613] text-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;