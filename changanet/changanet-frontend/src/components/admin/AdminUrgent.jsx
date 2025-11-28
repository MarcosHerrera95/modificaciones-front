import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { adminUrgentAPI } from '../../services/adminApiService';
import AdminTable from './AdminTable';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';

const AdminUrgent = () => {
  const { isAdmin, error: adminError } = useAdmin();
  const [urgentRequests, setUrgentRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  // Load urgent requests and stats
  const loadData = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError(null);

      const [requestsRes, statsRes] = await Promise.all([
        adminUrgentAPI.getAll(filters),
        adminUrgentAPI.getUrgentStats()
      ]);

      setUrgentRequests(requestsRes.data || []);
      setStats(statsRes);
    } catch (err) {
      console.error('Error loading urgent data:', err);
      setError(err.message || 'Error al cargar solicitudes urgentes');
    } finally {
      setLoading(false);
    }
  };

  // Handle urgent request actions
  const handleUrgentAction = async (urgentId, action, data = {}) => {
    try {
      setActionLoading(urgentId);

      switch (action) {
        case 'assign_professional':
          if (!data.professionalId) {
            alert('Debes seleccionar un profesional');
            return;
          }
          await adminUrgentAPI.assignProfessional(urgentId, data.professionalId);
          alert('Profesional asignado exitosamente');
          break;

        case 'update_status':
          await adminUrgentAPI.updateStatus(urgentId, data.status, data.notes);
          alert('Estado actualizado exitosamente');
          break;

        case 'view_details':
          // This would open a detailed modal
          alert('Vista detallada próximamente');
          break;

        case 'contact_client':
          // This would open contact modal
          alert('Función de contacto próximamente');
          break;

        default:
          throw new Error('Acción no válida');
      }

      await loadData();
    } catch (err) {
      console.error(`Error ${action} urgent request:`, err);
      alert(`Error al ${action === 'assign_professional' ? 'asignar profesional' : action === 'update_status' ? 'actualizar estado' : 'realizar acción'}: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1
    }));
  };

  useEffect(() => {
    loadData();
  }, [isAdmin, filters]);

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">{adminError || 'No tienes permisos para acceder a esta sección'}</p>
        </div>
      </div>
    );
  }

  // Table columns
  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (value) => `#${value.substring(0, 8)}...`
    },
    {
      key: 'cliente',
      label: 'Cliente',
      render: (value) => (
        <div>
          <div className="font-medium">{value?.nombre || 'N/A'}</div>
          <div className="text-sm text-gray-500">{value?.email || ''}</div>
        </div>
      )
    },
    {
      key: 'descripcion',
      label: 'Descripción',
      render: (value) => (
        <div className="max-w-xs truncate" title={value}>
          {value || 'Sin descripción'}
        </div>
      )
    },
    {
      key: 'prioridad',
      label: 'Prioridad',
      type: 'status',
      statusConfig: {
        'ALTA': { label: 'Alta', className: 'bg-red-100 text-red-800' },
        'MEDIA': { label: 'Media', className: 'bg-yellow-100 text-yellow-800' },
        'BAJA': { label: 'Baja', className: 'bg-green-100 text-green-800' }
      }
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'status',
      statusConfig: {
        'PENDIENTE': { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
        'ASIGNADO': { label: 'Asignado', className: 'bg-blue-100 text-blue-800' },
        'EN_PROCESO': { label: 'En Proceso', className: 'bg-purple-100 text-purple-800' },
        'COMPLETADO': { label: 'Completado', className: 'bg-green-100 text-green-800' },
        'CANCELADO': { label: 'Cancelado', className: 'bg-red-100 text-red-800' }
      }
    },
    {
      key: 'profesional_asignado',
      label: 'Profesional',
      render: (value) => value?.nombre || 'Sin asignar'
    },
    {
      key: 'creado_en',
      label: 'Creado',
      type: 'datetime'
    },
    {
      key: 'fecha_limite',
      label: 'Límite',
      type: 'datetime'
    }
  ];

  // Actions for each row
  const actions = (urgent) => (
    <div className="flex flex-col space-y-1">
      <div className="flex space-x-2">
        <button
          onClick={() => handleUrgentAction(urgent.id, 'view_details')}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Ver detalles
        </button>

        {urgent.estado === 'PENDIENTE' && (
          <button
            onClick={() => {
              const professionalId = prompt('ID del profesional a asignar:');
              if (professionalId) {
                handleUrgentAction(urgent.id, 'assign_professional', { professionalId });
              }
            }}
            disabled={actionLoading === urgent.id}
            className="text-green-600 hover:text-green-800 text-sm disabled:opacity-50"
          >
            {actionLoading === urgent.id ? '...' : 'Asignar'}
          </button>
        )}

        <button
          onClick={() => handleUrgentAction(urgent.id, 'contact_client')}
          className="text-purple-600 hover:text-purple-800 text-sm"
        >
          Contactar
        </button>
      </div>

      {/* Status update dropdown */}
      <select
        onChange={(e) => {
          if (e.target.value) {
            const notes = prompt('Notas (opcional):');
            handleUrgentAction(urgent.id, 'update_status', {
              status: e.target.value,
              notes: notes || ''
            });
            e.target.value = ''; // Reset select
          }
        }}
        disabled={actionLoading === urgent.id}
        className="text-xs border border-gray-300 rounded px-2 py-1 disabled:opacity-50"
      >
        <option value="">Cambiar estado</option>
        <option value="PENDIENTE">Pendiente</option>
        <option value="ASIGNADO">Asignado</option>
        <option value="EN_PROCESO">En Proceso</option>
        <option value="COMPLETADO">Completado</option>
        <option value="CANCELADO">Cancelado</option>
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Gestión de Servicios Urgentes</h2>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Actualizar
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">Pendientes</p>
                  <p className="text-2xl font-bold">{stats.pending || 0}</p>
                </div>
                <div className="text-4xl">⏳</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Asignados</p>
                  <p className="text-2xl font-bold">{stats.assigned || 0}</p>
                </div>
                <div className="text-4xl">👷</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">En Proceso</p>
                  <p className="text-2xl font-bold">{stats.inProgress || 0}</p>
                </div>
                <div className="text-4xl">🔄</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Completados Hoy</p>
                  <p className="text-2xl font-bold">{stats.completedToday || 0}</p>
                </div>
                <div className="text-4xl">✅</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ASIGNADO">Asignado</option>
              <option value="EN_PROCESO">En Proceso</option>
              <option value="COMPLETADO">Completado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioridad
            </label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Cliente, descripción..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Error display */}
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* Urgent requests table */}
        <AdminTable
          columns={columns}
          data={urgentRequests}
          loading={loading}
          error={error}
          pagination={{
            currentPage: filters.page,
            pages: Math.ceil((urgentRequests.length || 0) / filters.limit),
            total: urgentRequests.length || 0
          }}
          onPageChange={(page) => handleFilterChange('page', page)}
          actions={actions}
          emptyMessage="No se encontraron solicitudes urgentes"
          emptyIcon="🚨"
        />
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => alert('Función próximamente: Notificar profesionales disponibles')}
            className="p-4 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <div className="text-2xl mb-2">📢</div>
            <div className="font-medium">Notificar Profesionales</div>
            <div className="text-sm text-gray-600">Alertar sobre servicios urgentes disponibles</div>
          </button>

          <button
            onClick={() => alert('Función próximamente: Generar reporte de urgentes')}
            className="p-4 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-medium">Generar Reporte</div>
            <div className="text-sm text-gray-600">Exportar datos de servicios urgentes</div>
          </button>

          <button
            onClick={() => alert('Función próximamente: Configurar alertas')}
            className="p-4 border border-yellow-200 rounded-lg hover:bg-yellow-50 transition-colors"
          >
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-medium">Configurar Alertas</div>
            <div className="text-sm text-gray-600">Personalizar notificaciones de urgentes</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUrgent;