import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { adminUsersAPI } from '../../services/adminApiService';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';

const AdminUsers = () => {
  const { isAdmin, error: adminError } = useAdmin();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    role: '',
    blocked: '',
    verified: ''
  });
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    currentPage: 1
  });
  const [actionLoading, setActionLoading] = useState(null);

  // Load users with filters
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError(null);

      const response = await adminUsersAPI.getAll(filters);
      setUsers(response.data || []);
      setPagination({
        total: response.total || 0,
        pages: response.pages || 0,
        currentPage: response.currentPage || 1
      });
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1 // Reset to page 1 when changing filters
    }));
  };

  // Handle user actions
  const handleUserAction = async (userId, action, data = {}) => {
    if (!isAdmin) return;

    try {
      setActionLoading(userId);

      switch (action) {
        case 'block':
          await adminUsersAPI.blockUser(userId, data.reason);
          break;
        case 'unblock':
          await adminUsersAPI.unblockUser(userId);
          break;
        case 'changeRole':
          await adminUsersAPI.updateRole(userId, data.newRole);
          break;
        case 'resetPassword':
          await adminUsersAPI.resetPassword(userId);
          break;
        case 'delete':
          if (window.confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.')) {
            await adminUsersAPI.deleteUser(userId, data.reason);
          } else {
            return;
          }
          break;
        default:
          throw new Error('Acción no válida');
      }

      // Reload users after action
      await loadUsers();

      // Show success message
      alert(`Usuario ${action === 'block' ? 'bloqueado' : action === 'unblock' ? 'desbloqueado' : action === 'changeRole' ? 'actualizado' : action === 'resetPassword' ? 'contraseña reseteada' : 'eliminado'} exitosamente`);

    } catch (err) {
      console.error(`Error ${action} user:`, err);
      alert(`Error al ${action === 'block' ? 'bloquear' : action === 'unblock' ? 'desbloquear' : action === 'changeRole' ? 'cambiar rol' : action === 'resetPassword' ? 'resetear contraseña' : 'eliminar'} usuario: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle role change with validation
  const handleRoleChange = (userId, currentRole) => {
    const roles = ['cliente', 'profesional', 'admin'];
    const newRole = prompt(`Cambiar rol de "${currentRole}" a: (${roles.join('/')})`);

    if (!newRole) return;

    const normalizedRole = newRole.toLowerCase().trim();
    if (!roles.includes(normalizedRole)) {
      alert(`Rol inválido. Debe ser uno de: ${roles.join(', ')}`);
      return;
    }

    if (normalizedRole === currentRole) {
      alert('El rol seleccionado es el mismo que el actual');
      return;
    }

    handleUserAction(userId, 'changeRole', { newRole: normalizedRole });
  };

  // Handle block/unblock with reason
  const handleBlockToggle = (userId, currentlyBlocked) => {
    if (currentlyBlocked) {
      handleUserAction(userId, 'unblock');
    } else {
      const reason = prompt('Motivo del bloqueo:');
      if (!reason || !reason.trim()) {
        alert('Debes proporcionar un motivo para el bloqueo');
        return;
      }
      handleUserAction(userId, 'block', { reason: reason.trim() });
    }
  };

  // Handle delete with reason
  const handleDelete = (userId) => {
    const reason = prompt('Motivo de la eliminación (obligatorio):');
    if (!reason || !reason.trim()) {
      alert('Debes proporcionar un motivo para la eliminación');
      return;
    }
    handleUserAction(userId, 'delete', { reason: reason.trim() });
  };

  // Load users on mount and when filters change
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Gestión de Usuarios</h2>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nombre, email..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los roles</option>
              <option value="cliente">Cliente</option>
              <option value="profesional">Profesional</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filters.blocked}
              onChange={(e) => handleFilterChange('blocked', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="false">Activos</option>
              <option value="true">Bloqueados</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verificación
            </label>
            <select
              value={filters.verified}
              onChange={(e) => handleFilterChange('verified', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Verificados</option>
              <option value="false">No verificados</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600">
            Mostrando {users.length} de {pagination.total} usuarios
          </p>
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* Users table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estadísticas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registro
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {user.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.nombre || 'Sin nombre'}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.rol === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : user.rol === 'profesional'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {user.rol}
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col space-y-1">
                    {user.esta_verificado && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        ✅ Verificado
                      </span>
                    )}
                    {user.bloqueado && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        🚫 Bloqueado
                      </span>
                    )}
                    {!user.esta_verificado && !user.bloqueado && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        ⏳ Pendiente
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    <div>Cliente: {user._count?.servicios_como_cliente || 0}</div>
                    <div>Profesional: {user._count?.servicios_como_profesional || 0}</div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.creado_en).toLocaleDateString('es-ES')}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => handleBlockToggle(user.id, user.bloqueado)}
                      disabled={actionLoading === user.id}
                      className={`px-2 py-1 text-xs rounded ${
                        user.bloqueado
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      } disabled:opacity-50`}
                    >
                      {actionLoading === user.id ? '...' : user.bloqueado ? 'Desbloquear' : 'Bloquear'}
                    </button>

                    <button
                      onClick={() => handleRoleChange(user.id, user.rol)}
                      disabled={actionLoading === user.id}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading === user.id ? '...' : 'Cambiar Rol'}
                    </button>

                    <button
                      onClick={() => handleUserAction(user.id, 'resetPassword')}
                      disabled={actionLoading === user.id}
                      className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {actionLoading === user.id ? '...' : 'Reset Pass'}
                    </button>

                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={actionLoading === user.id}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading === user.id ? '...' : 'Eliminar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Página {pagination.currentPage} de {pagination.pages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleFilterChange('page', Math.max(1, filters.page - 1))}
              disabled={filters.page <= 1}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              Anterior
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(pagination.pages - 4, filters.page - 2)) + i;
              if (pageNum > pagination.pages) return null;

              return (
                <button
                  key={pageNum}
                  onClick={() => handleFilterChange('page', pageNum)}
                  className={`px-3 py-1 text-sm rounded ${
                    pageNum === filters.page
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => handleFilterChange('page', Math.min(pagination.pages, filters.page + 1))}
              disabled={filters.page >= pagination.pages}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {users.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron usuarios</h3>
          <p className="text-gray-600">Intenta ajustar los filtros de búsqueda</p>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;