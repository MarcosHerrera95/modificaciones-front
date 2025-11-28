import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { adminPaymentsAPI } from '../../services/adminApiService';
import AdminTable from './AdminTable';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';

const AdminPayments = () => {
  const { isAdmin, error: adminError } = useAdmin();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [commissionHistory, setCommissionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Filters for transactions
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    type: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  // Commission form state
  const [commissionForm, setCommissionForm] = useState({
    commission_percentage: 5,
    minimum_fee: 0
  });

  // Load data based on active tab
  const loadData = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'overview') {
        // Load stats from AdminDashboard or separate endpoint
        // For now, we'll use placeholder data
        setStats({
          totalRevenue: 125000,
          totalCommissions: 6250,
          pendingWithdrawals: 8750,
          disputedPayments: 3
        });
      } else if (activeTab === 'transactions') {
        const response = await adminPaymentsAPI.getTransactions(filters);
        setTransactions(response.data || []);
      } else if (activeTab === 'commissions') {
        const [settingsRes, historyRes] = await Promise.all([
          adminPaymentsAPI.getCommissionSettings(),
          adminPaymentsAPI.getCommissionHistory()
        ]);

        if (settingsRes) {
          setCommissionForm({
            commission_percentage: (settingsRes.commission_percentage || 0.05) * 100,
            minimum_fee: settingsRes.minimum_fee || 0
          });
        }

        setCommissionHistory(historyRes || []);
      }
    } catch (err) {
      console.error('Error loading payment data:', err);
      setError(err.message || 'Error al cargar datos de pagos');
    } finally {
      setLoading(false);
    }
  };

  // Handle commission settings update
  const handleUpdateCommissionSettings = async () => {
    try {
      setActionLoading('commission');

      const settings = {
        commission_percentage: commissionForm.commission_percentage / 100, // Convert to decimal
        minimum_fee: parseFloat(commissionForm.minimum_fee)
      };

      await adminPaymentsAPI.updateCommissionSettings(settings);
      alert('Configuración de comisiones actualizada exitosamente');
      await loadData();
    } catch (err) {
      console.error('Error updating commission settings:', err);
      alert(`Error al actualizar configuración: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle transaction actions
  const handleTransactionAction = async (transactionId, action, data = {}) => {
    try {
      setActionLoading(transactionId);

      switch (action) {
        case 'refund':
          if (!data.amount || !data.reason) {
            alert('Debes especificar el monto y motivo del reembolso');
            return;
          }
          await adminPaymentsAPI.refundPayment(transactionId, data.amount, data.reason);
          alert('Reembolso procesado exitosamente');
          break;
        case 'view_details':
          // This would open a modal with transaction details
          alert('Funcionalidad de detalles próximamente');
          break;
        default:
          throw new Error('Acción no válida');
      }

      await loadData();
    } catch (err) {
      console.error(`Error ${action} transaction:`, err);
      alert(`Error al ${action === 'refund' ? 'procesar reembolso' : 'realizar acción'}: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1 // Reset to page 1 when changing filters
    }));
  };

  useEffect(() => {
    loadData();
  }, [isAdmin, activeTab, filters]);

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

  const tabs = [
    { id: 'overview', name: 'Resumen', icon: '📊' },
    { id: 'transactions', name: 'Transacciones', icon: '💳' },
    { id: 'commissions', name: 'Comisiones', icon: '💰' },
    { id: 'withdrawals', name: 'Retiros', icon: '🏦' }
  ];

  // Transaction table columns
  const transactionColumns = [
    {
      key: 'id',
      label: 'ID',
      render: (value) => `#${value.substring(0, 8)}...`
    },
    {
      key: 'cliente',
      label: 'Cliente',
      render: (value) => value?.nombre || 'N/A'
    },
    {
      key: 'profesional',
      label: 'Profesional',
      render: (value) => value?.nombre || 'N/A'
    },
    {
      key: 'monto_total',
      label: 'Monto',
      type: 'currency'
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'status',
      statusConfig: {
        'COMPLETADO': { label: 'Completado', className: 'bg-green-100 text-green-800' },
        'PENDIENTE': { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
        'CANCELADO': { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
        'EN_DISPUTA': { label: 'En Disputa', className: 'bg-orange-100 text-orange-800' }
      }
    },
    {
      key: 'creado_en',
      label: 'Fecha',
      type: 'datetime'
    }
  ];

  // Transaction actions
  const transactionActions = (transaction) => (
    <div className="flex space-x-2">
      <button
        onClick={() => handleTransactionAction(transaction.id, 'view_details')}
        className="text-blue-600 hover:text-blue-800 text-sm"
      >
        Ver detalles
      </button>
      {transaction.estado === 'COMPLETADO' && (
        <button
          onClick={() => {
            const amount = prompt('Monto a reembolsar:');
            const reason = prompt('Motivo del reembolso:');
            if (amount && reason) {
              handleTransactionAction(transaction.id, 'refund', { amount: parseFloat(amount), reason });
            }
          }}
          disabled={actionLoading === transaction.id}
          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
        >
          {actionLoading === transaction.id ? '...' : 'Reembolsar'}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 p-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Error display */}
          {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

          {activeTab === 'overview' && stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Ingresos Totales</p>
                    <p className="text-2xl font-bold">${stats.totalRevenue?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-4xl">💰</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Comisiones</p>
                    <p className="text-2xl font-bold">${stats.totalCommissions?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-4xl">📊</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-100 text-sm">Retiros Pendientes</p>
                    <p className="text-2xl font-bold">${stats.pendingWithdrawals?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm">Pagos en Disputa</p>
                    <p className="text-2xl font-bold">{stats.disputedPayments || 0}</p>
                  </div>
                  <div className="text-4xl">⚠️</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
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
                    <option value="COMPLETADO">Completado</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="CANCELADO">Cancelado</option>
                    <option value="EN_DISPUTA">En Disputa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="SERVICIO">Servicio</option>
                    <option value="URGENTE">Urgente</option>
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
              </div>

              {/* Transactions table */}
              <AdminTable
                columns={transactionColumns}
                data={transactions}
                loading={loading}
                error={error}
                pagination={{
                  currentPage: filters.page,
                  pages: Math.ceil((transactions.length || 0) / filters.limit),
                  total: transactions.length || 0
                }}
                onPageChange={(page) => handleFilterChange('page', page)}
                actions={transactionActions}
                emptyMessage="No se encontraron transacciones"
                emptyIcon="💳"
              />
            </div>
          )}

          {activeTab === 'commissions' && (
            <div className="space-y-6">
              {/* Current Settings */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Configuración Actual</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comisión Estándar (%)
                    </label>
                    <input
                      type="number"
                      value={commissionForm.commission_percentage}
                      onChange={(e) => setCommissionForm(prev => ({
                        ...prev,
                        commission_percentage: parseFloat(e.target.value) || 0
                      }))}
                      min="0"
                      max="20"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Comisión aplicada a servicios completados</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto Mínimo de Comisión ($)
                    </label>
                    <input
                      type="number"
                      value={commissionForm.minimum_fee}
                      onChange={(e) => setCommissionForm(prev => ({
                        ...prev,
                        minimum_fee: parseFloat(e.target.value) || 0
                      }))}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Monto mínimo por transacción</p>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleUpdateCommissionSettings}
                    disabled={actionLoading === 'commission'}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading === 'commission' ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                </div>
              </div>

              {/* Commission History */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold">Historial de Cambios</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {commissionHistory.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-500">
                      No hay historial de cambios
                    </div>
                  ) : (
                    commissionHistory.map((entry, index) => (
                      <div key={index} className="px-6 py-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">
                              Comisión: {(entry.commission_percentage * 100).toFixed(1)}% |
                              Mínimo: ${entry.minimum_fee}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(entry.updated_at).toLocaleString('es-ES')}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            entry.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.active ? 'Activa' : 'Anterior'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'withdrawals' && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🏦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Gestión de Retiros</h3>
              <p className="text-gray-600">Funcionalidad próximamente disponible</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;