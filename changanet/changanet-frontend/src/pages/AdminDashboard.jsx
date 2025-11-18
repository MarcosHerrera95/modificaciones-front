import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFilters, setUserFilters] = useState({ page: 1, search: '', role: '', blocked: '' });
  const [serviceFilters, setServiceFilters] = useState({ page: 1, search: '', status: '', urgent: '' });

  useEffect(() => {
    if (user && user.rol === 'admin') {
      loadDashboardData();
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'services') {
      loadServices();
    }
  }, [activeTab, userFilters, serviceFilters]);

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

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams(userFilters);
      const response = await fetch(`/api/admin/users?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadServices = async () => {
    try {
      const params = new URLSearchParams(serviceFilters);
      const response = await fetch(`/api/admin/services?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setServices(data.data);
      }
    } catch (error) {
      console.error('Error loading services:', error);
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

  const handleToggleUserBlock = async (userId, currentlyBlocked) => {
    const action = currentlyBlocked ? 'desbloquear' : 'bloquear';
    const reason = currentlyBlocked ? '' : prompt('Motivo del bloqueo:');
    if (!currentlyBlocked && !reason) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({ blocked: !currentlyBlocked, reason })
      });

      if (response.ok) {
        alert(`Usuario ${action}do exitosamente`);
        loadUsers();
      } else {
        alert(`Error al ${action} usuario`);
      }
    } catch (error) {
      console.error(`Error ${action}ndo usuario:`, error);
      alert(`Error al ${action} usuario`);
    }
  };

  const handleChangeUserRole = async (userId) => {
    const newRole = prompt('Nuevo rol (cliente/profesional/admin):');
    if (!newRole || !['cliente', 'profesional', 'admin'].includes(newRole)) {
      alert('Rol inválido. Debe ser: cliente, profesional o admin');
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({ newRole })
      });

      if (response.ok) {
        alert('Rol del usuario cambiado exitosamente');
        loadUsers();
      } else {
        alert('Error al cambiar rol del usuario');
      }
    } catch (error) {
      console.error('Error cambiando rol del usuario:', error);
      alert('Error al cambiar rol del usuario');
    }
  };

  const handleUpdateServiceStatus = async (serviceId) => {
    const newStatus = prompt('Nuevo estado (PENDIENTE/AGENDADO/EN_PROCESO/COMPLETADO/CANCELADO):');
    const validStatuses = ['PENDIENTE', 'AGENDADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      alert(`Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`);
      return;
    }

    try {
      const response = await fetch(`/api/admin/services/${serviceId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        alert('Estado del servicio actualizado exitosamente');
        loadServices();
      } else {
        alert('Error al actualizar estado del servicio');
      }
    } catch (error) {
      console.error('Error actualizando estado del servicio:', error);
      alert('Error al actualizar estado del servicio');
    }
  };

  const tabs = [
    { id: 'overview', name: 'Resumen', icon: '📊' },
    { id: 'verifications', name: 'Verificaciones', icon: '✅' },
    { id: 'users', name: 'Usuarios', icon: '👥' },
    { id: 'services', name: 'Servicios', icon: '🔧' },
    { id: 'payments', name: 'Pagos', icon: '💳' },
    { id: 'analytics', name: 'Analytics', icon: '📈' }
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

              {/* Filtros */}
              <div className="mb-4 flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={userFilters.search}
                  onChange={(e) => setUserFilters({...userFilters, search: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
                <select
                  value={userFilters.role}
                  onChange={(e) => setUserFilters({...userFilters, role: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Todos los roles</option>
                  <option value="cliente">Cliente</option>
                  <option value="profesional">Profesional</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={userFilters.blocked}
                  onChange={(e) => setUserFilters({...userFilters, blocked: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Todos los estados</option>
                  <option value="false">Activos</option>
                  <option value="true">Bloqueados</option>
                </select>
                <button
                  onClick={loadUsers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Buscar
                </button>
              </div>

              {/* Lista de usuarios */}
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold">{user.nombre}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.rol === 'admin' ? 'bg-purple-100 text-purple-800' :
                            user.rol === 'profesional' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {user.rol}
                          </span>
                          {user.esta_verificado && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Verificado
                            </span>
                          )}
                          {user.bloqueado && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Bloqueado
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm">{user.email}</p>
                        <p className="text-gray-500 text-xs">
                          Creado: {new Date(user.creado_en).toLocaleDateString()}
                        </p>
                        <p className="text-gray-500 text-xs">
                          Servicios: {user._count.servicios_como_cliente} como cliente, {user._count.servicios_como_profesional} como profesional
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleToggleUserBlock(user.id, user.bloqueado)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            user.bloqueado
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          {user.bloqueado ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button
                          onClick={() => handleChangeUserRole(user.id)}
                          className="px-3 py-1 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Cambiar Rol
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Gestión de Servicios</h2>

              {/* Filtros */}
              <div className="mb-4 flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Buscar servicios..."
                  value={serviceFilters.search}
                  onChange={(e) => setServiceFilters({...serviceFilters, search: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
                <select
                  value={serviceFilters.status}
                  onChange={(e) => setServiceFilters({...serviceFilters, status: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Todos los estados</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="AGENDADO">Agendado</option>
                  <option value="EN_PROCESO">En Proceso</option>
                  <option value="COMPLETADO">Completado</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
                <select
                  value={serviceFilters.urgent}
                  onChange={(e) => setServiceFilters({...serviceFilters, urgent: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Todos</option>
                  <option value="true">Urgentes</option>
                  <option value="false">Normales</option>
                </select>
                <button
                  onClick={loadServices}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Buscar
                </button>
              </div>

              {/* Lista de servicios */}
              <div className="space-y-4">
                {services.map((service) => (
                  <div key={service.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold">Servicio #{service.id}</h3>
                          {service.es_urgente && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              🚨 URGENTE
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            service.estado === 'COMPLETADO' ? 'bg-green-100 text-green-800' :
                            service.estado === 'CANCELADO' ? 'bg-red-100 text-red-800' :
                            service.estado === 'EN_PROCESO' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {service.estado}
                          </span>
                        </div>
                        <p className="text-gray-700 mb-1">{service.descripcion}</p>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Cliente:</strong> {service.cliente.nombre} ({service.cliente.email})</p>
                          <p><strong>Profesional:</strong> {service.profesional.nombre} ({service.profesional.email})</p>
                          {service.pago && (
                            <p><strong>Pago:</strong> ${service.pago.monto_total} - {service.pago.estado}</p>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-2">
                          Creado: {new Date(service.creado_en).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => handleUpdateServiceStatus(service.id)}
                          className="px-3 py-1 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Cambiar Estado
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Gestión de Pagos</h2>
              <p className="text-gray-600">Funcionalidad de gestión de pagos próximamente</p>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Analytics y Reportes</h2>
              <p className="text-gray-600">Funcionalidad de analytics próximamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;