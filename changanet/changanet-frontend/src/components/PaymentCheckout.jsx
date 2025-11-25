/**
 * Componente PaymentCheckout - Procesa pagos de servicios
 * Implementa REQ-41: Integración con pasarelas de pago
 * REQ-42: Custodia de fondos hasta aprobación
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';

const PaymentCheckout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { serviceId } = useParams();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentPreference, setPaymentPreference] = useState(null);

  useEffect(() => {
    if (user && serviceId) {
      loadServiceDetails();
    } else if (!user) {
      navigate('/login');
    }
  }, [user, serviceId, navigate]);

  const loadServiceDetails = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('changanet_token') || localStorage.getItem('changanet_token');

      const response = await fetch(`/api/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const serviceData = data.data || data;

        // Verificar que el usuario sea el cliente del servicio
        if (serviceData.cliente_id !== user.id) {
          setError('No tienes permiso para pagar este servicio');
          return;
        }

        // Verificar que el servicio esté en estado correcto
        if (serviceData.estado !== 'AGENDADO' && serviceData.estado !== 'PENDIENTE') {
          setError('El servicio no está en un estado válido para pago');
          return;
        }

        setService(serviceData);

        // Establecer monto sugerido basado en la tarifa del profesional
        if (serviceData.profesional?.perfil_profesional?.tarifa_hora) {
          setAmount(serviceData.profesional.perfil_profesional.tarifa_hora.toString());
        }
      } else {
        setError('Error al cargar detalles del servicio');
      }
    } catch (err) {
      setError('Error al cargar detalles del servicio');
      console.error('Error loading service details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePaymentPreference = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Por favor ingresa un monto válido');
      return;
    }

    try {
      setProcessing(true);
      setError('');

      const token = sessionStorage.getItem('changanet_token') || localStorage.getItem('changanet_token');

      const response = await fetch('/api/payments/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceId,
          amount: parseFloat(amount)
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentPreference(data.data);

        // Redirigir a Mercado Pago si está disponible
        if (data.data.init_point) {
          window.location.href = data.data.init_point;
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al crear preferencia de pago');
      }
    } catch (err) {
      setError('Error al procesar el pago');
      console.error('Error creating payment preference:', err);
    } finally {
      setProcessing(false);
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

  if (error && !service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-[#E30613] text-white px-6 py-2 rounded-lg hover:bg-red-700"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            ← Volver
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Procesar Pago</h1>
            <p className="text-gray-600">
              Completa el pago para confirmar el servicio con {service?.profesional?.nombre}
            </p>
          </div>

          {/* Detalles del Servicio */}
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Detalles del Servicio</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Servicio:</span>
                <span className="font-medium">{service?.descripcion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Profesional:</span>
                <span className="font-medium">{service?.profesional?.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className="font-medium capitalize">{service?.estado?.toLowerCase()}</span>
              </div>
              {service?.fecha_agendada && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha agendada:</span>
                  <span className="font-medium">
                    {new Date(service.fecha_agendada).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Monto del Pago */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto a pagar (ARS)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ingresa el monto"
              min="1"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#E30613] focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Monto sugerido basado en la tarifa del profesional: ${service?.profesional?.perfil_profesional?.tarifa_hora || 'No especificada'}
            </p>
          </div>

          {/* Información sobre Custodia */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <div className="flex items-start">
              <div className="text-blue-500 mr-3">🔒</div>
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Custodia de Fondos
                </h4>
                <p className="text-sm text-blue-800">
                  El dinero quedará retenido en la plataforma hasta que confirmes que el servicio se completó satisfactoriamente. Una vez aprobado, los fondos se liberarán automáticamente al profesional (menos la comisión de la plataforma).
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Botón de Pago */}
          <div className="flex justify-end">
            <button
              onClick={handleCreatePaymentPreference}
              disabled={processing || !amount}
              className="bg-[#E30613] text-white px-8 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                'Proceder al Pago'
              )}
            </button>
          </div>

          {/* Información adicional */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Al proceder, aceptas los términos de servicio y política de pagos de Changánet</p>
            <p>Comisión de plataforma: 5% sobre el monto total (aplicada al liberar fondos)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCheckout;