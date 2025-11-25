/**
 * Componente PaymentStatus - Muestra el estado de un pago en tiempo real
 * Implementa seguimiento de pagos según REQ-41
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useParams } from 'react-router-dom';

const PaymentStatus = () => {
  const { user } = useAuth();
  const { paymentId } = useParams();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user && paymentId) {
      loadPaymentStatus();
    }
  }, [user, paymentId]);

  const loadPaymentStatus = async () => {
    try {
      setRefreshing(true);
      const token = sessionStorage.getItem('changanet_token') || localStorage.getItem('changanet_token');

      const response = await fetch(`/api/payments/status/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPayment(data.data);
        setError('');
      } else {
        setError('Error al cargar estado del pago');
      }
    } catch (err) {
      setError('Error al cargar estado del pago');
      console.error('Error loading payment status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pendiente':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: '⏳',
          title: 'Pago Pendiente',
          description: 'El pago ha sido iniciado pero aún no se ha completado.'
        };
      case 'aprobado':
        return {
          color: 'bg-blue-100 text-blue-800',
          icon: '✅',
          title: 'Pago Aprobado',
          description: 'El pago ha sido aprobado y los fondos están en custodia.'
        };
      case 'liberado':
        return {
          color: 'bg-green-100 text-green-800',
          icon: '💰',
          title: 'Fondos Liberados',
          description: 'Los fondos han sido liberados al profesional.'
        };
      case 'reembolsado':
        return {
          color: 'bg-red-100 text-red-800',
          icon: '↩️',
          title: 'Pago Reembolsado',
          description: 'El pago ha sido reembolsado al cliente.'
        };
      case 'fallido':
        return {
          color: 'bg-red-100 text-red-800',
          icon: '❌',
          title: 'Pago Fallido',
          description: 'El pago no pudo ser procesado.'
        };
      case 'en_disputa':
        return {
          color: 'bg-orange-100 text-orange-800',
          icon: '⚖️',
          title: 'En Disputa',
          description: 'El pago está siendo revisado por un administrador.'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: '❓',
          title: 'Estado Desconocido',
          description: 'El estado del pago no está disponible.'
        };
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E30613]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#E30613] text-white px-6 py-2 rounded-lg hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(payment?.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${statusInfo.color.split(' ')[0]} mb-4`}>
              <span className="text-2xl">{statusInfo.icon}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{statusInfo.title}</h1>
            <p className="text-gray-600">{statusInfo.description}</p>
          </div>

          {/* Detalles del Pago */}
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Detalles del Pago</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">ID del Pago:</span>
                <span className="font-mono text-sm">{paymentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monto Total:</span>
                <span className="font-semibold">${payment?.transaction_amount || payment?.amount || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                  {payment?.status?.toUpperCase()}
                </span>
              </div>
              {payment?.date_approved && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Aprobación:</span>
                  <span className="font-medium">
                    {new Date(payment.date_approved).toLocaleDateString()} {new Date(payment.date_approved).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {payment?.date_created && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Creación:</span>
                  <span className="font-medium">
                    {new Date(payment.date_created).toLocaleDateString()} {new Date(payment.date_created).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Información según estado */}
          {payment?.status === 'aprobado' && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
              <div className="flex items-start">
                <div className="text-blue-500 mr-3">⏳</div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">
                    Fondos en Custodia
                  </h4>
                  <p className="text-sm text-blue-800">
                    Los fondos están retenidos en la plataforma. Se liberarán automáticamente en 24 horas o cuando confirmes que el servicio se completó satisfactoriamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {payment?.status === 'liberado' && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6">
              <div className="flex items-start">
                <div className="text-green-500 mr-3">✅</div>
                <div>
                  <h4 className="text-sm font-medium text-green-900 mb-1">
                    Fondos Liberados
                  </h4>
                  <p className="text-sm text-green-800">
                    Los fondos han sido transferidos al profesional. Si tienes algún problema, puedes iniciar una disputa.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={loadPaymentStatus}
              disabled={refreshing}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {refreshing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Actualizando...
                </>
              ) : (
                'Actualizar Estado'
              )}
            </button>

            {(payment?.status === 'aprobado' || payment?.status === 'liberado') && (
              <button
                onClick={() => window.open(`/payment/receipt/${paymentId}`, '_blank')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Ver Comprobante
              </button>
            )}
          </div>

          {/* Información adicional */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>¿Necesitas ayuda? Contacta a nuestro soporte</p>
            <p className="mt-1">Email: soporte@changanet.com | Tel: (011) 1234-5678</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatus;