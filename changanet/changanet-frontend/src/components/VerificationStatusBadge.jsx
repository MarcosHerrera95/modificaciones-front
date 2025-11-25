import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const VerificationStatusBadge = ({ userId, showDetails = false, className = '' }) => {
  const { user } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Usar el userId prop si se proporciona, sino usar el del usuario actual
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchVerificationStatus();
    }
  }, [targetUserId]);

  const fetchVerificationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/verification/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVerificationStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 animate-pulse ${className}`}>
        <div className="w-4 h-4 bg-gray-300 rounded mr-2"></div>
        Cargando...
      </div>
    );
  }

  if (!verificationStatus) {
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 ${className}`}>
        <span className="mr-2">❓</span>
        Estado desconocido
      </div>
    );
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case 'approved':
        return {
          icon: '✅',
          text: 'Verificado',
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-800',
          description: 'Tu identidad ha sido verificada exitosamente'
        };
      case 'pending':
        return {
          icon: '⏳',
          text: 'En revisión',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          description: 'Tu solicitud está siendo revisada por nuestro equipo'
        };
      case 'rejected':
        return {
          icon: '❌',
          text: 'Rechazado',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          description: verificationStatus.admin_review_notes || 'Tu solicitud fue rechazada. Revisa las notas del administrador.'
        };
      case 'not_requested':
      default:
        return {
          icon: '📝',
          text: 'No solicitado',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          description: 'Aún no has solicitado verificación de identidad'
        };
    }
  };

  const config = getStatusConfig(verificationStatus.status);

  return (
    <div className={className}>
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor}`}>
        <span className="mr-2">{config.icon}</span>
        {config.text}
      </div>

      {showDetails && (
        <div className="mt-2 text-sm text-gray-600">
          <p>{config.description}</p>
          {verificationStatus.created_at && (
            <p className="mt-1">
              Solicitado el: {new Date(verificationStatus.created_at).toLocaleDateString('es-ES')}
            </p>
          )}
          {verificationStatus.status === 'rejected' && verificationStatus.admin_review_notes && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
              <p className="font-medium text-red-800">Notas del administrador:</p>
              <p className="text-red-700">{verificationStatus.admin_review_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerificationStatusBadge;