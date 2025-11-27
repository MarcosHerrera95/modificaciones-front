import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfessional } from '../context/useProfessional';
import { useReviews } from '../context/ReviewContext';
import BackButton from './BackButton';
import VerifiedBadge from './VerifiedBadge';
import RatingDisplay from './RatingDisplay';
import LoadingSpinner from './LoadingSpinner';
import PaginatedReviewsList from './PaginatedReviewsList';

/**
 * ProfessionalPublicView
 * Componente para visualizar el perfil público de un profesional
 *
 * Características:
 * - Vista pública del perfil profesional
 * - Información completa del profesional
 * - Sistema de contacto y presupuestos
 * - Verificación de identidad
 * - Reseñas y calificaciones
 * - Galería de trabajos
 */

const ProfessionalPublicView = () => {
  const { professionalId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getProfessionalById } = useProfessional();

  const [professional, setProfessional] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulación de datos del profesional (hasta implementar API)
  useEffect(() => {
    const loadProfessional = async () => {
      try {
        setLoading(true);
        setError(null);

        // Intentar obtener del contexto primero
        const result = await getProfessionalById(professionalId);

        if (result.success) {
          setProfessional(result.professional);
        } else {
          // Datos simulados para desarrollo
          const mockProfessional = {
            usuario_id: professionalId,
            usuario: {
              nombre: 'María González',
              email: 'maria@example.com',
              telefono: '+54 11 1234-5678',
              url_foto_perfil: 'https://ui-avatars.com/api/?name=María+González&size=200&background=random&color=fff'
            },
            descripcion: 'Profesional con más de 8 años de experiencia en limpieza residencial y comercial. Especializada en limpieza profunda y mantenimiento regular. Trabajo con productos ecológicos y técnicas modernas para garantizar resultados excepcionales.',
            especialidad: 'Limpieza Residencial',
            especialidades: [
              { id: 1, name: 'Limpieza Residencial', category: 'limpieza' },
              { id: 2, name: 'Limpieza de Oficinas', category: 'limpieza' },
              { id: 3, name: 'Limpieza Post-Obra', category: 'limpieza' }
            ],
            anos_experiencia: 8,
            zona_cobertura: 'Palermo, Buenos Aires',
            coverage_zone: {
              name: 'Palermo, Buenos Aires',
              city: 'Buenos Aires',
              state: 'Buenos Aires',
              latitude: -34.6037,
              longitude: -58.3816
            },
            tarifa_hora: 1500,
            tipo_tarifa: 'hora',
            tarifa_servicio: null,
            tarifa_convenio: '',
            esta_disponible: true,
            estado_verificacion: 'verificado',
            calificacion_promedio: 4.8,
            total_resenas: 47,
            url_foto_portada: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=800&h=400&fit=crop',
            fecha_creacion: '2023-01-15T00:00:00Z',
            ultimo_acceso: '2024-11-27T12:00:00Z'
          };

          setProfessional(mockProfessional);
        }
      } catch (err) {
        console.error('Error loading professional:', err);
        setError('Error al cargar el perfil del profesional');
      } finally {
        setLoading(false);
      }
    };

    if (professionalId) {
      loadProfessional();
    }
  }, [professionalId, getProfessionalById]);

  const handleContact = () => {
    if (!user) {
      alert('Debes iniciar sesión para contactar al profesional');
      navigate('/login');
      return;
    }

    if (user.rol !== 'cliente') {
      alert('Solo los clientes pueden contactar profesionales');
      return;
    }

    // TODO: Implementar modal de contacto o navegación a chat
    alert('Funcionalidad de contacto próximamente disponible');
  };

  const handleQuoteRequest = () => {
    if (!user) {
      alert('Debes iniciar sesión para solicitar un presupuesto');
      navigate('/login');
      return;
    }

    // Navegar a la página de solicitud de presupuesto
    navigate(`/quote-request/${professionalId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-gray-600 mt-4">Cargando perfil profesional...</p>
        </div>
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Profesional no encontrado</h2>
          <p className="text-gray-600 mb-6">{error || 'El perfil que buscas no existe o no está disponible.'}</p>
          <button
            onClick={() => navigate('/professionals')}
            className="bg-emerald-500 text-white px-6 py-3 rounded-lg hover:bg-emerald-600 transition-colors"
          >
            Ver otros profesionales
          </button>
        </div>
      </div>
    );
  }

  const nombreProfesional = professional.usuario?.nombre || 'Profesional';
  const fotoPerfil = professional.usuario?.url_foto_perfil ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreProfesional)}&size=200&background=random&color=fff`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con botón de retorno */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <BackButton />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Portada */}
          {professional.url_foto_portada && (
            <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-8 shadow-lg">
              <img
                src={professional.url_foto_portada}
                alt={`Portada de ${nombreProfesional}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Perfil principal */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            {/* Header del perfil */}
            <div className="relative">
              {/* Foto de perfil */}
              <div className="absolute -bottom-16 left-8">
                <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                  <img
                    src={fotoPerfil}
                    alt={`Foto de perfil de ${nombreProfesional}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Información básica */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-8 pb-20">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="md:ml-40">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold">{nombreProfesional}</h1>
                      {professional.estado_verificacion === 'verificado' && (
                        <VerifiedBadge size="lg" />
                      )}
                    </div>
                    <p className="text-emerald-100 text-lg mb-2">{professional.especialidad}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {professional.zona_cobertura}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {professional.anos_experiencia} años de experiencia
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 md:mt-0 md:text-right">
                    <div className="flex items-center gap-2 mb-2">
                      <RatingDisplay
                        rating={professional.calificacion_promedio || 0}
                        size="lg"
                        showLabel={true}
                      />
                      <span className="text-emerald-100">
                        ({professional.total_resenas || 0} reseñas)
                      </span>
                    </div>
                    <div className="text-2xl font-bold">
                      ${professional.tarifa_hora?.toLocaleString()}
                      <span className="text-lg font-normal">/hora</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contenido del perfil */}
            <div className="p-8">
              {/* Estado de disponibilidad */}
              <div className="flex items-center gap-2 mb-6">
                <div className={`w-3 h-3 rounded-full ${professional.esta_disponible ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`font-medium ${professional.esta_disponible ? 'text-green-700' : 'text-red-700'}`}>
                  {professional.esta_disponible ? 'Disponible para nuevos trabajos' : 'No disponible actualmente'}
                </span>
              </div>

              {/* Descripción */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Sobre mí</h2>
                <p className="text-gray-600 leading-relaxed">{professional.descripcion}</p>
              </div>

              {/* Especialidades */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Especialidades</h2>
                <div className="flex flex-wrap gap-2">
                  {professional.especialidades?.map((specialty) => (
                    <span
                      key={specialty.id}
                      className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-medium"
                    >
                      {specialty.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Información de contacto */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Información de contacto</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{professional.usuario?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Teléfono</p>
                      <p className="font-medium">{professional.usuario?.telefono}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Zona de cobertura */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Zona de cobertura</h2>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium">{professional.zona_cobertura}</span>
                  </div>
                </div>
              </div>

              {/* Estadísticas */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Estadísticas</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{professional.total_resenas || 0}</div>
                    <div className="text-sm text-gray-600">Reseñas</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{professional.anos_experiencia}</div>
                    <div className="text-sm text-gray-600">Años exp.</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {professional.calificacion_promedio?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-sm text-gray-600">Calificación</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {professional.esta_disponible ? 'Sí' : 'No'}
                    </div>
                    <div className="text-sm text-gray-600">Disponible</div>
                  </div>
                </div>
              </div>

              {/* Reseñas y valoraciones */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Reseñas y valoraciones</h2>
                <PaginatedReviewsList professionalId={professionalId} />
              </div>
            </div>

            {/* Acciones */}
            {user && user.rol === 'cliente' && (
              <div className="bg-gray-50 px-8 py-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleContact}
                    className="flex-1 bg-emerald-500 text-white px-6 py-3 rounded-xl hover:bg-emerald-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Contactar
                  </button>

                  <button
                    onClick={handleQuoteRequest}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Solicitar Presupuesto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalPublicView;