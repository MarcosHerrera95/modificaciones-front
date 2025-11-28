import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { adminStatsAPI } from '../../services/adminApiService';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';

const AdminCharts = () => {
  const { isAdmin, error: adminError } = useAdmin();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, 1y

  // Load stats data
  const loadStats = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError(null);

      const response = await adminStatsAPI.getDetailedStats({ period: timeRange });
      setStats(response);
    } catch (err) {
      console.error('Error loading stats:', err);
      setError(err.message || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [isAdmin, timeRange]);

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

  // Bar chart component
  const BarChart = ({ data, title, color = '#3B82F6' }) => {
    if (!data || data.length === 0) {
      return (
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      );
    }

    const maxValue = Math.max(...data.map(item => item.value));

    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="space-y-2">
          {data.map((item, index) => {
            const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            return (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-24 text-sm text-gray-600 truncate">{item.label}</div>
                <div className="flex-1">
                  <div className="relative">
                    <div
                      className="h-6 rounded"
                      style={{
                        backgroundColor: color,
                        width: `${percentage}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span className="text-xs font-medium text-white">{item.value}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Line chart component (simplified)
  const LineChart = ({ data, title, color = '#10B981' }) => {
    if (!data || data.length === 0) {
      return (
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      );
    }

    const maxValue = Math.max(...data.map(item => item.value));
    const chartWidth = 400;
    const chartHeight = 150;

    // Create points for the line
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * chartWidth;
      const y = chartHeight - (maxValue > 0 ? (item.value / maxValue) * chartHeight : 0);
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="relative">
          <svg width={chartWidth} height={chartHeight} className="overflow-visible">
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#E5E7EB" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Line */}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="3"
              points={points}
            />

            {/* Points */}
            {data.map((item, index) => {
              const x = (index / (data.length - 1)) * chartWidth;
              const y = chartHeight - (maxValue > 0 ? (item.value / maxValue) * chartHeight : 0);
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={color}
                  className="hover:r-6"
                  style={{ transition: 'r 0.2s' }}
                />
              );
            })}
          </svg>

          {/* Labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            {data.map((item, index) => (
              <span key={index}>{item.label}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Pie chart component
  const PieChart = ({ data, title, colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'] }) => {
    if (!data || data.length === 0) {
      return (
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      );
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    const radius = 60;
    const centerX = 80;
    const centerY = 80;

    let currentAngle = -90; // Start from top

    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="flex items-center space-x-6">
          <svg width="160" height="160">
            {data.map((item, index) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              const angle = (percentage / 100) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;

              // Convert angles to radians
              const startAngleRad = (startAngle * Math.PI) / 180;
              const endAngleRad = (endAngle * Math.PI) / 180;

              // Calculate path
              const x1 = centerX + radius * Math.cos(startAngleRad);
              const y1 = centerY + radius * Math.sin(startAngleRad);
              const x2 = centerX + radius * Math.cos(endAngleRad);
              const y2 = centerY + radius * Math.sin(endAngleRad);

              const largeArcFlag = angle > 180 ? 1 : 0;

              const pathData = [
                `M ${centerX} ${centerY}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z'
              ].join(' ');

              currentAngle = endAngle;

              return (
                <path
                  key={index}
                  d={pathData}
                  fill={colors[index % colors.length]}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              );
            })}
          </svg>

          <div className="space-y-2">
            {data.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-sm text-gray-700">{item.label}</span>
                <span className="text-sm font-medium text-gray-900">
                  {item.value} ({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Metric card component
  const MetricCard = ({ title, value, change, changeType, icon, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      red: 'bg-red-50 text-red-600',
      yellow: 'bg-yellow-50 text-yellow-600',
      purple: 'bg-purple-50 text-purple-600'
    };

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {change && (
              <p className={`text-sm flex items-center ${
                changeType === 'positive' ? 'text-green-600' :
                changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
              }`}>
                <span className="mr-1">
                  {changeType === 'positive' ? '↗' : changeType === 'negative' ? '↘' : '→'}
                </span>
                {change}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <span className="text-2xl">{icon}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Analytics y Estadísticas</h2>
          <div className="flex space-x-2">
            {[
              { value: '7d', label: '7 días' },
              { value: '30d', label: '30 días' },
              { value: '90d', label: '90 días' },
              { value: '1y', label: '1 año' }
            ].map(range => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-4 py-2 text-sm rounded-md ${
                  timeRange === range.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Usuarios Totales"
          value={stats?.users?.total || 0}
          change={stats?.users?.growth || '0%'}
          changeType={stats?.users?.growth?.startsWith('+') ? 'positive' : 'neutral'}
          icon="👥"
          color="blue"
        />
        <MetricCard
          title="Servicios Completados"
          value={stats?.services?.completed || 0}
          change={stats?.services?.growth || '0%'}
          changeType={stats?.services?.growth?.startsWith('+') ? 'positive' : 'neutral'}
          icon="✅"
          color="green"
        />
        <MetricCard
          title="Ingresos Totales"
          value={`$${stats?.revenue?.total || 0}`}
          change={stats?.revenue?.growth || '0%'}
          changeType={stats?.revenue?.growth?.startsWith('+') ? 'positive' : 'negative'}
          icon="💰"
          color="yellow"
        />
        <MetricCard
          title="Calificación Promedio"
          value={`${stats?.ratings?.average || 0}/5`}
          change={stats?.ratings?.change || '0'}
          changeType={stats?.ratings?.change?.startsWith('+') ? 'positive' : 'negative'}
          icon="⭐"
          color="purple"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Services by Category */}
        <BarChart
          data={stats?.servicesByCategory || []}
          title="Servicios por Categoría"
          color="#3B82F6"
        />

        {/* Revenue Trend */}
        <LineChart
          data={stats?.revenueTrend || []}
          title="Tendencia de Ingresos"
          color="#10B981"
        />

        {/* User Distribution */}
        <PieChart
          data={stats?.userDistribution || []}
          title="Distribución de Usuarios"
        />

        {/* Service Status */}
        <PieChart
          data={stats?.serviceStatus || []}
          title="Estado de Servicios"
          colors={['#10B981', '#3B82F6', '#F59E0B', '#EF4444']}
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
          <div className="space-y-3">
            {stats?.recentActivity?.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.timestamp}</p>
                </div>
              </div>
            )) || (
              <p className="text-gray-500 text-sm">No hay actividad reciente</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top Profesionales</h3>
          <div className="space-y-3">
            {stats?.topProfessionals?.map((professional, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-700">
                      {professional.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{professional.name}</span>
                </div>
                <span className="text-sm text-gray-600">{professional.services} servicios</span>
              </div>
            )) || (
              <p className="text-gray-500 text-sm">No hay datos disponibles</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Regiones Más Activas</h3>
          <div className="space-y-3">
            {stats?.topRegions?.map((region, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium">{region.name}</span>
                <span className="text-sm text-gray-600">{region.services} servicios</span>
              </div>
            )) || (
              <p className="text-gray-500 text-sm">No hay datos disponibles</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCharts;