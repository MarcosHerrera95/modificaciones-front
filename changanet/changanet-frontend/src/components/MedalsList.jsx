import { useState, useEffect } from 'react';

const MedalsList = ({ userId, size = 'medium', className = '' }) => {
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchReputation();
    }
  }, [userId]);

  const fetchReputation = async () => {
    try {
      const response = await fetch(`/api/ranking/reputation/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReputation(data.data);
      }
    } catch (error) {
      console.error('Error fetching reputation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="flex space-x-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-8 h-8 bg-gray-200 rounded-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!reputation || !reputation.medals) {
    return (
      <div className={`text-gray-500 text-sm ${className}`}>
        Sin medallas aún
      </div>
    );
  }

  const medals = JSON.parse(reputation.medals);

  const getMedalIcon = (medal) => {
    switch (medal) {
      case 'puntualidad': return '⏰';
      case 'excelencia': return '🏆';
      case 'top': return '⭐';
      case 'experto': return '👨‍🔧';
      default: return '🎖️';
    }
  };

  const getMedalColor = (medal) => {
    switch (medal) {
      case 'puntualidad': return 'bg-blue-100 text-blue-800';
      case 'excelencia': return 'bg-purple-100 text-purple-800';
      case 'top': return 'bg-yellow-100 text-yellow-800';
      case 'experto': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMedalLabel = (medal) => {
    switch (medal) {
      case 'puntualidad': return 'Puntualidad';
      case 'excelencia': return 'Excelencia';
      case 'top': return 'Top Profesional';
      case 'experto': return 'Experto';
      default: return medal.charAt(0).toUpperCase() + medal.slice(1);
    }
  };

  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-sm',
    large: 'w-10 h-10 text-base'
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {medals.map((medal, index) => (
        <div
          key={index}
          className={`group relative inline-flex items-center justify-center rounded-full font-medium ${getMedalColor(medal)} ${sizeClasses[size]}`}
          title={getMedalLabel(medal)}
        >
          <span>{getMedalIcon(medal)}</span>

          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
            {getMedalLabel(medal)}
          </div>
        </div>
      ))}

      {medals.length === 0 && (
        <div className="text-gray-500 text-sm">
          Sin medallas aún
        </div>
      )}
    </div>
  );
};

export default MedalsList;