import { useState, useEffect } from 'react';

const VerificationStatus = ({ userId, className = '' }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchStatus();
    }
  }, [userId]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/verification/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case 'approved':
        return {
          text: 'Verificado',
          color: 'bg-emerald-100 text-emerald-800',
          icon: '✅'
        };
      case 'pending':
        return {
          text: 'Pendiente',
          color: 'bg-yellow-100 text-yellow-800',
          icon: '⏳'
        };
      case 'rejected':
        return {
          text: 'Rechazado',
          color: 'bg-red-100 text-red-800',
          icon: '❌'
        };
      default:
        return {
          text: 'No solicitado',
          color: 'bg-gray-100 text-gray-800',
          icon: '❓'
        };
    }
  };

  const config = getStatusConfig(status.status);

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${config.color} ${className}`}>
      <span>{config.icon}</span>
      <span>{config.text}</span>
      {status.admin_review_notes && (
        <div className="group relative">
          <span className="cursor-help">ℹ️</span>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
            {status.admin_review_notes}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationStatus;