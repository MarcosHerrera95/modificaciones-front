import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MedalsList from './MedalsList';
import ReputationBadge from './ReputationBadge';

const ReputationSummary = ({ userId, showDetails = true, className = '' }) => {
  const { user } = useAuth();
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Usar el userId prop si se proporciona, sino usar el del usuario actual
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchReputation();
    }
  }, [targetUserId]);

  const fetchReputation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ranking/reputation/${targetUserId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReputation(data.data);
      } else {
        setError('Error al cargar reputación');
      }
    } catch (err) {
      console.error('Error fetching reputation:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !reputation) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p>No se pudo cargar la información de reputación</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-xl font-bold mb-6 text-gray-800">🏆 Reputación Profesional</h3>

      <div className="space-y-6">
        {/* Badge de Reputación */}
        <div className="flex items-center justify-center">
          <ReputationBadge userId={targetUserId} size="large" />
        </div>

        {/* Estadísticas Principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{reputation.average_rating?.toFixed(1) || '0.0'}</div>
            <div className="text-sm text-gray-600">Calificación</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{reputation.completed_jobs || 0}</div>
            <div className="text-sm text-gray-600">Trabajos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{reputation.on_time_percentage || 0}%</div>
            <div className="text-sm text-gray-600">Puntualidad</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{reputation.ranking_score?.toFixed(1) || '0.0'}</div>
            <div className="text-sm text-gray-600">Puntuación</div>
          </div>
        </div>

        {/* Medallas */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-3">🏅 Medallas Obtenidas</h4>
          <MedalsList userId={targetUserId} size="medium" />
        </div>

        {/* Información Adicional */}
        {showDetails && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Estado de verificación:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  user?.esta_verificado
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user?.esta_verificado ? '✅ Verificado' : '⏳ Pendiente'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Última actualización:</span>
                <span className="ml-2 text-gray-600">
                  {reputation.updated_at ? new Date(reputation.updated_at).toLocaleDateString('es-ES') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Consejos para mejorar */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">💡 Consejos para mejorar tu reputación</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Completa más servicios para aumentar tu experiencia</li>
            <li>• Mantén una alta calificación respondiendo bien a las reseñas</li>
            <li>• Sé puntual en tus servicios para ganar la medalla de puntualidad</li>
            <li>• Verifica tu identidad para generar más confianza</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReputationSummary;