/**
 * @component UrgentRequestsMonitor - Monitor de solicitudes urgentes
 * @descripción Panel de administración para monitorear y gestionar solicitudes urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Social: Supervisión administrativa del sistema de emergencias
 */

import { useState, useEffect } from 'react';
import { useNotificationContext } from '../context/NotificationContext';

const UrgentRequestsMonitor = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, assigned, completed, cancelled
  const [refreshing, setRefreshing] = useState(false);
  const notificationContext = useNotificationContext();

  // Cargar solicitudes urgentes (simulado - en implementación real vendría de API)
  const loadUrgentRequests = async () => {
    try {
      setRefreshing(true);
      // En implementación real, esto sería una llamada a la API
      // const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/urgent-requests`, {
      //   headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
      // });
      // const data = await response.json();

      // Datos simulados para demostración
      const mockRequests = [
        {
          id: 'req_001',
          client: { nombre: 'María González', email: 'maria@email.com' },
          description: 'Fuga de agua en cocina',
          location: { lat: -34.6118, lng: -58.3960 },
          radius_km: 5,
          status: 'pending',
          price_estimate: 2500,
          created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
          candidates: [
            { professional: { nombre: 'Carlos López' }, responded: false, accepted: false },
            { professional: { nombre: 'Ana Martínez' }, responded: true, accepted: false }
          ]
        },
        {
          id: 'req_002',
          client: { nombre: 'Juan Pérez', email: 'juan@email.com' },
          description: 'Cortocircuito en living',
          location: { lat: -34.5881, lng: -58.4165 },
          radius_km: 3,
          status: 'assigned',
          price_estimate: 3200,
          created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
          assignments: [{
            professional: { nombre: 'Roberto García', telefono: '1123456789' },
            assigned_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          }]
        },
        {
          id: 'req_003',
          client: { nombre: 'Laura Rodríguez', email: 'laura@email.com' },
          description: 'Techo con goteras',
          location: { lat: -34.5622, lng: -58.4572 },
          radius_km: 8,
          status: 'completed',
          price_estimate: 4500,
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          assignments: [{
            professional: { nombre: 'Miguel Sánchez' },
            assigned_at: new Date(Date.now() - 90 * 60 * 1000).toISOString()
          }]
        }
      ];

      setRequests(mockRequests);
    } catch (err) {
      console.error('Error loading urgent requests:', err);
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudieron cargar las solicitudes urgentes.',
          duration: 4000
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filtrar solicitudes
  const filteredRequests = requests.filter(request => {
    if (filter === 'all') return true;
    return request.status === filter;
  });

  // Obtener estadísticas
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    assigned: requests.filter(r => r.status === 'assigned').length,
    completed: requests.filter(r => r.status === 'completed').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length
  };

  // Calcular tiempo transcurrido
  const getTimeElapsed = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  // Obtener color por estado
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'assigned': return 'green';
      case 'completed': return 'blue';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  // Obtener texto del estado
  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'assigned': return 'Asignada';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  useEffect(() => {
    loadUrgentRequests();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3"></div>
          <span className="text-gray-600">Cargando solicitudes urgentes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Monitor de Solicitudes Urgentes
            </h2>
            <p className="text-red-100 text-sm">
              Supervisa y gestiona todas las solicitudes de emergencia
            </p>
          </div>
          <button
            onClick={loadUrgentRequests}
            disabled={refreshing}
            className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg hover:bg-opacity-30 transition-colors flex items-center space-x-2"
          >
            {refreshing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-800">{stats.pending}</div>
            <div className="text-sm text-yellow-600">Pendientes</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-800">{stats.assigned}</div>
            <div className="text-sm text-green-600">Asignadas</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-800">{stats.completed}</div>
            <div className="text-sm text-blue-600">Completadas</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-800">{stats.cancelled}</div>
            <div className="text-sm text-red-600">Canceladas</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Todas', count: stats.total },
            { key: 'pending', label: 'Pendientes', count: stats.pending },
            { key: 'assigned', label: 'Asignadas', count: stats.assigned },
            { key: 'completed', label: 'Completadas', count: stats.completed },
            { key: 'cancelled', label: 'Canceladas', count: stats.cancelled }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="p-6">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No hay solicitudes {filter !== 'all' ? `en estado "${getStatusText(filter)}"` : ''}.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Solicitud #{request.id.slice(-6)}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(request.status)}-100 text-${getStatusColor(request.status)}-800`}>
                        {getStatusText(request.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Cliente:</span> {request.client.nombre}
                      </div>
                      <div>
                        <span className="font-medium">Tiempo:</span> {getTimeElapsed(request.created_at)}
                      </div>
                      <div>
                        <span className="font-medium">Radio:</span> {request.radius_km} km
                      </div>
                      <div>
                        <span className="font-medium">Precio est.:</span> ${request.price_estimate?.toLocaleString('es-AR') || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2 ml-4">
                    {request.status === 'pending' && (
                      <>
                        <button className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors">
                          Asignar Manual
                        </button>
                        <button className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors">
                          Cancelar
                        </button>
                      </>
                    )}
                    {request.status === 'assigned' && (
                      <button className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors">
                        Ver Detalles
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="mb-3">
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {request.description}
                  </p>
                </div>

                {/* Assignment/Candidates Info */}
                {request.status === 'assigned' && request.assignments?.[0] && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-800 font-medium text-sm">
                        Asignado a {request.assignments[0].professional.nombre}
                      </span>
                      {request.assignments[0].professional.telefono && (
                        <span className="text-green-600 text-sm">
                          ({request.assignments[0].professional.telefono})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {request.status === 'pending' && request.candidates && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.493-1.646 1.743-2.98l-4.243-5.5a3.54 3.54 0 00-.514-1.332l-1.243-2.24a1.5 1.5 0 00-.514-1.332l-4.243-5.5A1.5 1.5 0 004.14 4.5L6.5 5.5c1.046.667 1.7 1.81 1.7 3.135 0 .88-.34 1.684-.916 2.257L4.5 7.5A1.5 1.5 0 004.5 5.5L2 4.5A1.5 1.5 0 001.5 3H1c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v6.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 018 9.5V8" />
                      </svg>
                      <span className="text-yellow-800 font-medium text-sm">
                        {request.candidates.length} candidato{request.candidates.length !== 1 ? 's' : ''} notificado{request.candidates.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UrgentRequestsMonitor;