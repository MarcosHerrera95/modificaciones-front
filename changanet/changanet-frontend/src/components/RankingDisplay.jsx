// src/components/RankingDisplay.jsx
import { useState, useEffect } from 'react';

const RankingDisplay = () => {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRanking();
  }, []);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ranking');
      if (response.ok) {
        const data = await response.json();
        setRanking(data);
      }
    } catch (error) {
      console.error('Error fetching ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-xl font-bold mb-6 text-gray-800">Ranking de Profesionales</h3>

      <div className="space-y-4">
        {ranking.map((item) => (
          <div key={item.profesional.usuario_id} className="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
              item.posicion === 1 ? 'bg-yellow-500' :
              item.posicion === 2 ? 'bg-gray-400' :
              item.posicion === 3 ? 'bg-amber-600' :
              'bg-emerald-500'
            }`}>
              {item.posicion}
            </div>

            <div className="flex-1">
              <h4 className="font-semibold text-gray-800">{item.profesional.usuario.nombre}</h4>
              <p className="text-sm text-gray-600">{item.profesional.especialidad}</p>
            </div>

            <div className="text-right">
              <div className="flex items-center">
                <span className="text-amber-500 mr-1">⭐</span>
                <span className="font-bold text-lg">{item.calificacion.toFixed(1)}</span>
              </div>
              <p className="text-xs text-gray-500">{item.profesional.zona_cobertura}</p>
            </div>
          </div>
        ))}
      </div>

      {ranking.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🏆</div>
          <p className="text-gray-600">No hay profesionales rankeados aún</p>
        </div>
      )}
    </div>
  );
};

export default RankingDisplay;