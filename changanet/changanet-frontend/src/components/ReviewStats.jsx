/**
 * Componente para mostrar estadísticas de reseñas de un profesional
 * Incluye visualizaciones para una mejor comprensión de los datos
 */

import { useState, useEffect } from 'react';

const ReviewStats = ({ professionalId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(`/api/reviews/professional/${professionalId}/stats`);
        
        if (!response.ok) {
          throw new Error('Error al cargar estadísticas de reseñas');
        }
        
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error:', err);
        setError('Error al cargar estadísticas de reseñas. Por favor, inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    if (professionalId) {
      fetchStats();
    }
  }, [professionalId]);

  // Función para renderizar las estrellas
  const renderStars = (rating, size = 'text-lg') => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`${size} ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            aria-hidden="true"
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  // Función para renderizar la barra de distribución
  const renderDistributionBar = (count, total, label) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    
    return (
      <div className="flex items-center space-x-3">
        <div className="w-20 text-sm text-gray-600">{label}</div>
        <div className="flex-1 bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-yellow-400 h-2.5 rounded-full"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <div className="w-12 text-right text-sm text-gray-600">{count}</div>
      </div>
    );
  };

  // Función para formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mr-2"></div>
        <span className="text-gray-600">Cargando estadísticas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl">
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  if (!stats || stats.totalReviews === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 text-gray-700 p-6 rounded-2xl text-center">
        <div className="text-4xl mb-2">⭐</div>
        <h3 className="text-lg font-medium text-gray-800 mb-2">
          Aún no hay reseñas
        </h3>
        <p className="text-gray-600">
          Este profesional aún no ha recibido ninguna reseña.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-6">Valoraciones de clientes</h3>
      
      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Calificación promedio */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-600 mb-2">Calificación promedio</p>
          <div className="flex items-center">
            <span className="text-3xl font-bold text-gray-900 mr-2">
              {stats.averageRating}
            </span>
            <div>
              {renderStars(stats.averageRating, 'text-lg')}
              <p className="text-xs text-gray-500 mt-1">de {stats.totalReviews} reseñas</p>
            </div>
          </div>
        </div>
        
        {/* Reseñas positivas */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-600 mb-2">Reseñas positivas</p>
          <div className="flex items-center">
            <span className="text-3xl font-bold text-gray-900 mr-2">
              {stats.positivePercentage}%
            </span>
            <p className="text-sm text-gray-600">
              ({Math.round((stats.totalReviews * stats.positivePercentage) / 100)} de {stats.totalReviews} reseñas)
            </p>
          </div>
        </div>
        
        {/* Última reseña */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-600 mb-2">Última reseña</p>
          <p className="text-sm text-gray-700">{formatDate(stats.lastReviewDate)}</p>
        </div>
      </div>
      
      {/* Distribución de calificaciones */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-gray-800 mb-4">Distribución de calificaciones</h4>
        
        <div className="space-y-3">
          {renderDistributionBar(stats.ratingDistribution[5], stats.totalReviews, '5 estrellas')}
          {renderDistributionBar(stats.ratingDistribution[4], stats.totalReviews, '4 estrellas')}
          {renderDistributionBar(stats.ratingDistribution[3], stats.totalReviews, '3 estrellas')}
          {renderDistributionBar(stats.ratingDistribution[2], stats.totalReviews, '2 estrellas')}
          {renderDistributionBar(stats.ratingDistribution[1], stats.totalReviews, '1 estrella')}
        </div>
      </div>
      
      {/* Gráfico circular de distribución */}
      <div className="mt-8">
        <h4 className="text-lg font-medium text-gray-800 mb-4">Proporción de calificaciones</h4>
        
        <div className="flex flex-col md:flex-row items-center">
          {/* Gráfico circular simulado */}
          <div className="relative w-48 h-48 mb-4 md:mb-0 md:mr-8">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#eee"
                strokeWidth="3"
              />
              {/* 5 estrellas */}
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray={`${(stats.ratingDistribution[5] / stats.totalReviews) * 100}, 100`}
              />
              {/* 4 estrellas */}
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray={`${(stats.ratingDistribution[4] / stats.totalReviews) * 100}, 100`}
                strokeDashoffset={-((stats.ratingDistribution[5] / stats.totalReviews) * 100)}
              />
              {/* 3 estrellas */}
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray={`${(stats.ratingDistribution[3] / stats.totalReviews) * 100}, 100`}
                strokeDashoffset={-(((stats.ratingDistribution[5] + stats.ratingDistribution[4]) / stats.totalReviews) * 100)}
              />
              {/* 2 estrellas */}
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray={`${(stats.ratingDistribution[2] / stats.totalReviews) * 100}, 100`}
                strokeDashoffset={-(((stats.ratingDistribution[5] + stats.ratingDistribution[4] + stats.ratingDistribution[3]) / stats.totalReviews) * 100)}
              />
              {/* 1 estrella */}
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray={`${(stats.ratingDistribution[1] / stats.totalReviews) * 100}, 100`}
                strokeDashoffset={-(((stats.ratingDistribution[5] + stats.ratingDistribution[4] + stats.ratingDistribution[3] + stats.ratingDistribution[2]) / stats.totalReviews) * 100)}
              />
              
              {/* Texto en el centro */}
              <text x="18" y="20" textAnchor="middle" className="fill-gray-800" fontSize="8" fontWeight="bold">
                {stats.averageRating}
              </text>
              <text x="18" y="27" textAnchor="middle" className="fill-gray-600" fontSize="4">
                de 5 estrellas
              </text>
            </svg>
          </div>
          
          {/* Leyenda */}
          <div className="space-y-2">
            {Object.entries(stats.ratingDistribution).map(([stars, count]) => (
              <div key={stars} className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-400 rounded-sm"></div>
                <span className="text-sm text-gray-700">
                  {stars} estrella{parseInt(stars) > 1 ? 's' : ''}: {count} ({stats.totalReviews > 0 ? Math.round((count / stats.totalReviews) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewStats;