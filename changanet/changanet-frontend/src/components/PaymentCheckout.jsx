/**
 * Componente PaymentCheckout - Procesa pagos de servicios con validaciones robustas
 * Implementa REQ-41: Integración con pasarelas de pago
 * REQ-42: Custodia de fondos hasta aprobación
 * Seguridad: Validaciones client-side, protección CSRF, sanitización de inputs
 * Validaciones: Monto (500-500,000 ARS), permisos de usuario, estado del servicio
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { secureFetch } from '../utils/csrf';

const PaymentCheckout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { serviceId } = useParams();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Constantes de validación
  const VALIDATION_RULES = {
    amount: {
      min: 500, // Monto mínimo según PRD
      max: 500000, // Monto máximo según PRD
      pattern: /^\d+(\.\d{1,2})?$/, // Solo números con hasta 2 decimales
      required: true
    }
  };

  // Función de validación del monto
  const validateAmount = (value) => {
    const errors = [];

    if (!value || value.trim() === '') {
      errors.push('El monto es obligatorio');
      return errors;
    }

    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      errors.push('El monto debe ser un número válido');
      return errors;
    }

    if (numValue < VALIDATION_RULES.amount.min) {
      errors.push(`El monto mínimo es $${VALIDATION_RULES.amount.min}`);
    }

    if (numValue > VALIDATION_RULES.amount.max) {
      errors.push(`El monto máximo es $${VALIDATION_RULES.amount.max}`);
    }

    if (!VALIDATION_RULES.amount.pattern.test(value)) {
      errors.push('El monto debe tener máximo 2 decimales');
    }

    return errors;
  };

  // Función de validación general
  const validateField = (fieldName, value) => {
    const errors = [];

    switch (fieldName) {
      case 'amount':
        errors.push(...validateAmount(value));
        break;
      default:
        break;
    }

    return errors;
  };

  // Actualizar validaciones en tiempo real
  const handleAmountChange = (e) => {
    const value = e.target.value;
    setAmount(value);

    // Validar en tiempo real si el campo ha sido tocado
    if (touched.amount) {
      const errors = validateField('amount', value);
      setValidationErrors(prev => ({
        ...prev,
        amount: errors
      }));
    }
  };

  // Marcar campo como tocado
  const handleAmountBlur = () => {
    setTouched(prev => ({ ...prev, amount: true }));

    const errors = validateField('amount', amount);
    setValidationErrors(prev => ({
      ...prev,
      amount: errors
    }));
  };

  // Validar servicio
  const validateService = (serviceData) => {
    const errors = [];

    if (!serviceData) {
      errors.push('Servicio no encontrado');
      return errors;
    }

    // Verificar que el usuario sea el cliente
    if (serviceData.cliente_id !== user.id) {
      errors.push('No tienes permiso para pagar este servicio');
    }

    // Verificar estado del servicio
    const validStates = ['AGENDADO', 'PENDIENTE'];
    if (!validStates.includes(serviceData.estado)) {
      errors.push(`El servicio debe estar en estado ${validStates.join(' o ')} para poder pagarlo`);
    }

    // Verificar que no haya un pago existente
    if (serviceData.pagos && serviceData.pagos.length > 0) {
      const activePayment = serviceData.pagos.find(p =>
        ['PENDIENTE', 'APROBADO', 'LIBERADO'].includes(p.estado)
      );
      if (activePayment) {
        errors.push('Este servicio ya tiene un pago activo');
      }
    }

    return errors;
  };

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
      setError('');

      // Validar serviceId
      if (!serviceId || !/^[a-zA-Z0-9_-]+$/.test(serviceId)) {
        setError('ID de servicio inválido');
        return;
      }

      const token = sessionStorage.getItem('changanet_token') || localStorage.getItem('changanet_token');

      if (!token) {
        setError('Sesión expirada. Por favor inicia sesión nuevamente.');
        navigate('/login');
        return;
      }

      const response = await secureFetch(`/api/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const serviceData = data.data || data;

        // Validar servicio con reglas de negocio
        const serviceErrors = validateService(serviceData);
        if (serviceErrors.length > 0) {
          setError(serviceErrors.join('. '));
          return;
        }

        setService(serviceData);

        // Establecer monto sugerido basado en la tarifa del profesional
        if (serviceData.profesional?.perfil_profesional?.tarifa_hora) {
          const suggestedAmount = serviceData.profesional.perfil_profesional.tarifa_hora.toString();
          setAmount(suggestedAmount);

          // Validar el monto sugerido
          const amountErrors = validateAmount(suggestedAmount);
          if (amountErrors.length > 0) {
            console.warn('Monto sugerido inválido:', amountErrors);
          }
        }
      } else if (response.status === 401) {
        setError('Sesión expirada. Por favor inicia sesión nuevamente.');
        navigate('/login');
      } else if (response.status === 403) {
        setError('No tienes permiso para acceder a este servicio.');
      } else if (response.status === 404) {
        setError('Servicio no encontrado.');
      } else {
        setError('Error al cargar detalles del servicio. Inténtalo de nuevo.');
      }
    } catch (err) {
      console.error('Error loading service details:', err);
      setError('Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePaymentPreference = async () => {
    // Reset errors
    setError('');
    setValidationErrors({});

    // Marcar campos como tocados para mostrar validaciones
    setTouched({ amount: true });

    // Validar todos los campos
    const amountErrors = validateField('amount', amount);
    const serviceErrors = validateService(service);

    const allErrors = {
      ...amountErrors.length > 0 && { amount: amountErrors },
      ...serviceErrors.length > 0 && { service: serviceErrors }
    };

    setValidationErrors(allErrors);

    // Si hay errores, no continuar
    if (Object.keys(allErrors).length > 0) {
      setError('Por favor corrige los errores antes de continuar.');
      return;
    }

    // Validación adicional de sesión
    const token = sessionStorage.getItem('changanet_token') || localStorage.getItem('changanet_token');
    if (!token) {
      setError('Sesión expirada. Por favor inicia sesión nuevamente.');
      navigate('/login');
      return;
    }

    // Validación de rate limiting (informar al usuario)
    if (processing) {
      setError('Ya hay un pago en proceso. Espera a que termine.');
      return;
    }

    try {
      setProcessing(true);

      const paymentData = {
        serviceId: serviceId.trim(),
        amount: parseFloat(amount),
        description: `Servicio profesional: ${service.descripcion || 'Servicio'}`.substring(0, 255) // Limitar longitud
      };

      // Validar datos del pago
      if (paymentData.amount < VALIDATION_RULES.amount.min || paymentData.amount > VALIDATION_RULES.amount.max) {
        throw new Error(`Monto fuera de rango permitido ($${VALIDATION_RULES.amount.min} - $${VALIDATION_RULES.amount.max})`);
      }

      const response = await secureFetch('/api/payments/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(paymentData)
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.data) {
          // Redirigir a Mercado Pago si está disponible
          if (data.data.init_point) {
            // Log para debugging (solo en desarrollo)
            if (import.meta.env.DEV) {
              console.log('Redirecting to MercadoPago:', data.data.init_point);
            }
            window.location.href = data.data.init_point;
          } else if (data.data.sandbox_init_point) {
            // Modo sandbox
            window.location.href = data.data.sandbox_init_point;
          } else {
            // Modo simulado - mostrar confirmación
            alert(`Pago simulado procesado exitosamente. Monto: $${paymentData.amount}. Tu dinero está seguro en custodia.`);
            navigate('/dashboard');
          }
        } else {
          throw new Error(data.error || 'Respuesta inválida del servidor');
        }
      } else if (response.status === 400) {
        const errorData = await response.json();
        setError(errorData.error || 'Datos de pago inválidos');
      } else if (response.status === 401) {
        setError('Sesión expirada. Por favor inicia sesión nuevamente.');
        navigate('/login');
      } else if (response.status === 403) {
        setError('No tienes permiso para realizar este pago.');
      } else if (response.status === 429) {
        setError('Demasiados intentos de pago. Espera unos minutos antes de intentar nuevamente.');
      } else {
        throw new Error('Error del servidor al procesar el pago');
      }
    } catch (err) {
      console.error('Error creating payment preference:', err);

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Error de conexión. Verifica tu conexión a internet.');
      } else {
        setError(err.message || 'Error al procesar el pago. Inténtalo de nuevo.');
      }
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
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              placeholder="Ingresa el monto"
              min={VALIDATION_RULES.amount.min}
              max={VALIDATION_RULES.amount.max}
              step="0.01"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                validationErrors.amount && validationErrors.amount.length > 0
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-[#E30613]'
              }`}
              aria-invalid={validationErrors.amount && validationErrors.amount.length > 0}
              aria-describedby="amount-error"
            />
            {validationErrors.amount && validationErrors.amount.length > 0 && (
              <div id="amount-error" className="text-red-600 text-sm mt-1" role="alert">
                {validationErrors.amount.map((error, index) => (
                  <div key={index}>• {error}</div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Monto sugerido basado en la tarifa del profesional: ${service?.profesional?.perfil_profesional?.tarifa_hora || 'No especificada'}
              <br />
              Rango permitido: ${VALIDATION_RULES.amount.min} - ${VALIDATION_RULES.amount.max} ARS
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
              disabled={
                processing ||
                !amount ||
                (validationErrors.amount && validationErrors.amount.length > 0) ||
                (validationErrors.service && validationErrors.service.length > 0)
              }
              className="bg-[#E30613] text-white px-8 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              aria-describedby="payment-button-status"
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