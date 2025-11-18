import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.rol === 'admin') {
      loadDashboardData();
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, verificationsRes] = await Promise.all([
        fetch('/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        }),
        fetch('/api/admin/verifications/pending', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
        })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      if (verificationsRes.ok) {
        const verificationsData = await verificationsRes.json();
        setPendingVerifications(verificationsData.data);
      }
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveVerification = async (requestId) => {
    try {
      const response = await fetch(`/api/admin/verifications/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
      });

      if (response.ok) {
        alert('Verificación aprobada exitosamente');
        loadDashboardData(); // Recargar datos
      } else {
        alert('Error al aprobar verificación');
      }
    } catch (error) {
      console.error('Error approving verification:', error);
      alert('Error al aprobar verificación');
    }
  };

  const handleRejectVerification = async (requestId) => {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/admin/verifications/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({ motivo_rechazo: reason })
      });

      if (response.ok) {
        alert('Verificación rechazada');
        loadDashboardData(); // Recargar datos
      } else {
        alert('Error al rechazar verificación');
      }
    } catch (error) {
      console.error('Error rejecting verification:', error);
      alert('Error al rechazar verificación');
    }
  };

  const tabs = [
    { id: 'overview', name: 'Resumen', icon: '📊' },
    { id: 'verifications', name: 'Verificaciones', icon: '✅' },
    { id: 'users', name: 'Usuarios', icon: '👥' },
    { id: 'payments', name: 'Pagos', icon: '💳' }
  ];

  if (!user || user.rol !== 'admin') {
    return <div>No tienes permisos para acceder a esta página</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="mt-2 text-gray-600">Gestiona usuarios, verificaciones y pagos de la plataforma</p>
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
                    ? 'bg-red-600 text-white'
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
          {activeTab === 'overview' && stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Usuarios</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.users.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Usuarios Verificados</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.users.verified}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Verificaciones Pendientes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.users.pendingVerifications}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-gray-900">${stats.payments.totalRevenue}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'verifications' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Solicitudes de Verificación Pendientes</h2>

              {pendingVerifications.length === 0 ? (
                <p className="text-gray-600">No hay solicitudes pendientes</p>
              ) : (
                <div className="space-y-4">
                  {pendingVerifications.map((request) => (
                    <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{request.usuario.nombre}</h3>
                          <p className="text-gray-600">{request.usuario.email}</p>
                          <p className="text-sm text-gray-500">
                            Solicitado: {new Date(request.fecha_solicitud).toLocaleDateString()}
                          </p>
                          {request.documento_url && (
                            <a
                              href={request.documento_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Ver documento
                            </a>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApproveVerification(request.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleRejectVerification(request.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Gestión de Usuarios</h2>
              <p className="text-gray-600">Funcionalidad de gestión de usuarios próximamente</p>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Gestión de Pagos</h2>
              <p className="text-gray-600">Funcionalidad de gestión de pagos próximamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;