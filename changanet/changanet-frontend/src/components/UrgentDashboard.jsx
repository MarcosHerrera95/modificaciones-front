/**
 * @component UrgentDashboard - Dashboard principal de servicios urgentes
 * @description Panel de control principal para gestión de servicios urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 */

import { useState, useEffect } from 'react';
import { useUrgentContext } from '../context/UrgentContext';
import { useAuth } from '../context/AuthContext';
import UrgentRequestsList from './UrgentRequestsList';
import UrgentRequestForm from './UrgentRequestForm';

const UrgentDashboard = () => {
  const { user } = useAuth();
  const {
    userRequests,
    nearbyRequests,
    isConnected,
    realTimeUpdates,
    loadUserRequests,
    loadNearbyRequests,
    setShowCreateForm,
    showCreateForm
  } = useUrgentContext();

  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    completed: 0,
    cancelled: 0
  });

  // Determine user type
  const userType = user?.tipo_usuario === 'profesional' ? 'professional' : 'client';

  // Load data on mount
  useEffect(() => {
    if (userType === 'professional') {
      loadNearbyRequests();
    } else {
      loadUserRequests();
    }
  }, [userType, loadUserRequests, loadNearbyRequests]);

  // Calculate stats
  useEffect(() => {
    const requests = userType === 'professional' ? nearbyRequests : userRequests;

    const newStats = requests.reduce((acc, req) => {
      acc.total++;
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {
      total: 0,
      pending: 0,
      assigned: 0,
      completed: 0,
      cancelled: 0,
      in_progress: 0
    });

    setStats(newStats);
  }, [userRequests, nearbyRequests, userType]);

  // Handle create new request
  const handleCreateRequest = () => {
    if (userType === 'client') {
      setShowCreateForm(true);
    }
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Servicios Urgentes
              </h1>
              <p className="text-gray-600 mt-1">
                {userType === 'professional'
                  ? 'Gestiona las solicitudes de emergencia en tu área'
                  : 'Solicita ayuda inmediata para problemas urgentes'
                }
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              {/* Create Button */}
              {userType === 'client' && (
                <button
                  onClick={handleCreateRequest}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors flex items-center space-x-2 shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Solicitar Urgente</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Asignadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.assigned}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completadas</p>
                <p className="text-2xl font-bold text-purple-600">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Canceladas</p>
                <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Updates Alert */}
        {realTimeUpdates.length > 0 && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="flex-1">
                <p className="text-blue-800 font-medium">Actualización en tiempo real</p>
                <p className="text-blue-600 text-sm">
                  {realTimeUpdates[0].message || 'Hay cambios en tus solicitudes urgentes'}
                </p>
              </div>
              <button
                onClick={() => {
                  // Refresh data
                  if (userType === 'professional') {
                    loadNearbyRequests();
                  } else {
                    loadUserRequests();
                  }
                }}
                className="ml-4 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
              >
                Actualizar
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => handleTabChange('overview')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {userType === 'professional' ? 'Solicitudes Cercanas' : 'Mis Solicitudes'}
              </button>

              {userType === 'client' && (
                <button
                  onClick={() => handleTabChange('history')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'history'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Historial
                </button>
              )}

              {userType === 'professional' && (
                <button
                  onClick={() => handleTabChange('earnings')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'earnings'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Ganancias
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <UrgentRequestsList userType={userType} />
            )}

            {activeTab === 'history' && userType === 'client' && (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium">Historial de Solicitudes</p>
                <p className="text-sm">Esta funcionalidad estará disponible próximamente.</p>
              </div>
            )}

            {activeTab === 'earnings' && userType === 'professional' && (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <p className="text-lg font-medium">Reporte de Ganancias</p>
                <p className="text-sm">Esta funcionalidad estará disponible próximamente.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Emergency Contacts */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contactos de Emergencia</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Bomberos</span>
                <a href="tel:100" className="text-red-500 hover:text-red-600 font-medium">
                  100
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Policía</span>
                <a href="tel:101" className="text-red-500 hover:text-red-600 font-medium">
                  101
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Ambulancia</span>
                <a href="tel:107" className="text-red-500 hover:text-red-600 font-medium">
                  107
                </a>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Consejos para Emergencias</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Describe claramente el problema</li>
              <li>• Incluye fotos si es posible</li>
              <li>• Especifica la urgencia del caso</li>
              <li>• Mantén la calma y sé específico</li>
            </ul>
          </div>

          {/* Support */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">¿Necesitas Ayuda?</h3>
            <p className="text-gray-600 text-sm mb-4">
              Nuestro equipo de soporte está disponible para ayudarte con cualquier duda sobre los servicios urgentes.
            </p>
            <button className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
              Contactar Soporte
            </button>
          </div>
        </div>
      </div>

      {/* Create Request Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Nueva Solicitud Urgente</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <UrgentRequestForm onClose={() => setShowCreateForm(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UrgentDashboard;