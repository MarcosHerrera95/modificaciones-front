/**
 * @page ServiceReview - Página para crear reseñas de servicios
 * @descripción Página que permite a los clientes dejar reseñas para servicios completados
 * @sprint Sprint 2 – Sistema de Reseñas
 * @tarjeta Tarjeta 9: [Frontend] Implementar Página de Creación de Reseñas
 * @impacto Social: Fomenta la transparencia y calidad en los servicios profesionales
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import ReviewForm from '../components/ReviewForm';

const ServiceReview = () => {
  const { user } = useAuth();
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && (user.role === 'cliente' || user.rol === 'cliente')) {
      fetchServiceDetails();
    } else {
      navigate('/');
    }
  }, [user, serviceId, navigate]);

  const fetchServiceDetails = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('changanet_token');

      if (!token) {
        setError('No se encontró token de autenticación');
        return;
      }

      const response = await fetch(`/api/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const serviceData = await response.json();
        setService(serviceData);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al cargar detalles del servicio');
      }
    } catch (err) {
      console.error('Error loading service details:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmitted = () => {
    // Redirigir a la página de reseñas del cliente con mensaje de éxito
    navigate('/cliente/reseñas', {
      state: {
        message: '¡Reseña enviada exitosamente!',
        type: 'success'
      }
    });
  };

  if (!user || (user.role !== 'cliente' && user.rol !== 'cliente')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton />
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dejar Reseña</h1>
          <p className="mt-2 text-gray-600">
            Comparte tu experiencia con este servicio para ayudar a otros clientes.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Cargando detalles del servicio...</span>
          </div>
        )}

        {/* Service Details */}
        {!loading && service && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Detalles del Servicio</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Profesional</p>
                <p className="font-medium">{service.profesional?.nombre || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Especialidad</p>
                <p className="font-medium">{service.profesional?.perfil_profesional?.especialidad || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha de creación</p>
                <p className="font-medium">
                  {new Date(service.creado_en).toLocaleDateString('es-ES')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado</p>
                <span className={`px-2 py-1 text-sm font-medium rounded-full ${
                  service.estado === 'completado'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {service.estado === 'completado' ? 'Completado' : service.estado}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-500">Descripción</p>
              <p className="text-gray-700">{service.descripcion}</p>
            </div>

            {service.completado_en && (
              <div className="mt-4">
                <p className="text-sm text-gray-500">Completado el</p>
                <p className="font-medium">
                  {new Date(service.completado_en).toLocaleDateString('es-ES')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Review Form */}
        {!loading && service && (
          <ReviewForm
            servicio_id={serviceId}
            onReviewSubmitted={handleReviewSubmitted}
          />
        )}

        {/* Help Section */}
        <div className="mt-12 bg-blue-50 border border-blue-200 p-6 rounded-lg">
          <div className="flex items-start">
            <span className="text-blue-500 mr-3 text-2xl">💡</span>
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">Consejos para una buena reseña</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Sé específico sobre la calidad del trabajo realizado</li>
                <li>• Menciona la puntualidad y profesionalismo del técnico</li>
                <li>• Incluye detalles sobre el resultado final</li>
                <li>• Si adjuntas una foto, asegúrate de que sea del trabajo terminado</li>
                <li>• Recuerda que las reseñas ayudan a otros clientes a elegir bien</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceReview;