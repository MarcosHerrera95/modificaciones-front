/**
 * Componente PaymentHistory - Historial de pagos del cliente
 * Implementa REQ-45: Generación de comprobantes de pago
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const PaymentHistory = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, completed, failed

  useEffect(() => {
    if (user) {
      loadPaymentHistory();
    }
  }, [user, filter]);

  const loadPaymentHistory = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('changanet_token') || localStorage.getItem('changanet_token');

      // Cargar servicios del cliente con información de pagos
      const response = await fetch('/api/services/client', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const services = data.data || data || [];

        // Filtrar y mapear pagos
        let paymentsData = services
          .filter(service => service.pago)
          .map(service => ({
            id: service.pago.id,
            serviceId: service.id,
            serviceDescription: service.descripcion,
            professionalName: service.profesional?.nombre || 'Profesional',
            amount: service.pago.monto_total,
            commission: service.pago.comision_plataforma,
            netAmount: service.pago.monto_profesional,
            status: service.pago.estado,
            paymentDate: service.pago.fecha_pago,
            createdAt: service.pago.created_at,
            receiptUrl: service.pago.url_comprobante,
            mercadoPagoId: service.pago.mercado_pago_id
          }));

        // Aplicar filtro
        if (filter !== 'all') {
          paymentsData = paymentsData.filter(payment => {
            switch (filter) {
              case 'pending':
                return ['pendiente', 'aprobado'].includes(payment.status);
              case 'completed':
                return payment.status === 'liberado';
              case 'failed':
                return ['fallido', 'reembolsado'].includes(payment.status);
              default:
                return true;
            }
          });
        }

        // Ordenar por fecha de creación (más reciente primero)
        paymentsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setPayments(paymentsData);
        setError('');
      } else {
        setError('Error al cargar historial de pagos');
      }
    } catch (err) {
      setError('Error al cargar historial de pagos');
      console.error('Error loading payment history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pendiente':
        return { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' };
      case 'aprobado':
        return { color: 'bg-blue-100 text-blue-800', text: 'Aprobado' };
      case 'liberado':
        return { color: 'bg-green-100 text-green-800', text: 'Completado' };
      case 'reembolsado':
        return { color: 'bg-red-100 text-red-800', text: 'Reembolsado' };
      case 'fallido':
        return { color: 'bg-red-100 text-red-800', text: 'Fallido' };
      default:
        return { color: 'bg-gray-100 text-gray-800', text: status };
    }
  };

  const downloadReceipt = async (paymentId) => {
    try {
      const token = sessionStorage.getItem('changanet_token') || localStorage.getItem('changanet_token');

      const response = await fetch(`/api/payments/receipt/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Crear blob y descargar
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-pago-${paymentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error al descargar comprobante');
      }
    } catch (err) {
      alert('Error al descargar comprobante');
      console.error('Error downloading receipt:', err);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Historial de Pagos</h3>

          {/* Filtros */}
          <div className="flex space-x-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="completed">Completados</option>
              <option value="failed">Fallidos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E30613]"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600">{error}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💳</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No hay pagos aún</h3>
            <p className="text-gray-600">
              {filter === 'all'
                ? 'Los pagos aparecerán aquí cuando contrates servicios.'
                : 'No hay pagos con el filtro seleccionado.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => {
              const statusInfo = getStatusInfo(payment.status);
              return (
                <div key={payment.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          Servicio #{payment.serviceId}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-1">
                        {payment.serviceDescription}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        Profesional: {payment.professionalName}
                      </p>

                      <div className="text-xs text-gray-500">
                        {payment.paymentDate
                          ? `Pagado: ${new Date(payment.paymentDate).toLocaleDateString()}`
                          : `Creado: ${new Date(payment.createdAt).toLocaleDateString()}`
                        }
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <p className="text-lg font-semibold text-gray-900">
                        ${payment.amount}
                      </p>
                      {payment.commission > 0 && (
                        <p className="text-sm text-gray-600">
                          Comisión: ${payment.commission}
                        </p>
                      )}
                      {payment.netAmount && (
                        <p className="text-sm font-medium text-green-600">
                          Neto: ${payment.netAmount}
                        </p>
                      )}

                      {/* Acciones */}
                      <div className="mt-2 flex flex-col space-y-1">
                        {(payment.status === 'liberado' || payment.status === 'aprobado') && (
                          <button
                            onClick={() => downloadReceipt(payment.id)}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            📄 Comprobante
                          </button>
                        )}

                        {payment.status === 'aprobado' && (
                          <button
                            onClick={() => window.location.href = `/payment/status/${payment.id}`}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                          >
                            ✅ Liberar Fondos
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Información sobre el sistema de pagos */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <p className="font-medium mb-1">💡 Información sobre pagos:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Los fondos quedan en custodia hasta la aprobación del servicio</li>
            <li>La comisión de la plataforma (5%) se deduce al liberar fondos</li>
            <li>Puedes descargar comprobantes de todos tus pagos completados</li>
            <li>Si hay problemas, puedes disputar pagos dentro de las 24 horas</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistory;