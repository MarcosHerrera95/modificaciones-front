import { useState, useEffect } from 'react';

const ReputationBadge = ({ userId, size = 'medium', className = '' }) => {
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
        <div className="h-6 bg-gray-200 rounded w-20"></div>
      </div>
    );
  }

  if (!reputation) {
    return null;
  }

  const sizeClasses = {
    small: 'text-xs px-2 py-1',
    medium: 'text-sm px-3 py-1',
    large: 'text-base px-4 py-2'
  };

  const getReputationLevel = (score) => {
    if (score >= 8.0) return { level: 'Excelente', color: 'bg-purple-100 text-purple-800' };
    if (score >= 6.0) return { level: 'Muy Bueno', color: 'bg-blue-100 text-blue-800' };
    if (score >= 4.0) return { level: 'Bueno', color: 'bg-green-100 text-green-800' };
    if (score >= 2.0) return { level: 'Regular', color: 'bg-yellow-100 text-yellow-800' };
    return { level: 'Bajo', color: 'bg-red-100 text-red-800' };
  };

  const { level, color } = getReputationLevel(reputation.ranking_score);

  return (
    <div className={`inline-flex items-center space-x-2 rounded-full font-medium ${color} ${sizeClasses[size]} ${className}`}>
      <span>⭐</span>
      <span>{reputation.ranking_score.toFixed(1)}</span>
      <span className="hidden sm:inline">({level})</span>
    </div>
  );
};

export default ReputationBadge;