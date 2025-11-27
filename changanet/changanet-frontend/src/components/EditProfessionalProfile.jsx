import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfessional } from '../context/useProfessional';
import ImageUploader from './ImageUploader';
import SpecialtySelector from './SpecialtySelector';
import ZoneSelector from './ZoneSelector';
import RateSelector from './RateSelector';
import BackButton from './BackButton';
import LoadingSpinner from './LoadingSpinner';

/**
 * EditProfessionalProfile
 * Componente para editar el perfil profesional existente
 *
 * Características:
 * - Carga automática del perfil actual
 * - Formulario de edición con validación
 * - Actualización en tiempo real del contexto
 * - Feedback visual de cambios
 * - Navegación inteligente
 */

const EditProfessionalProfile = () => {
  const { user } = useAuth();
  const { myProfile, profileLoading, updateMyProfile } = useProfessional();
  const navigate = useNavigate();

  // Estados del formulario
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados de los datos del formulario
  const [profileData, setProfileData] = useState({
    // Datos básicos
    nombre: '',
    email: '',
    telefono: '',
    descripcion: '',

    // Fotos
    profilePhoto: null,
    bannerPhoto: null,

    // Especialidades
    especialidades: [],

    // Experiencia
    anos_experiencia: 0,

    // Zona de cobertura
    zona_seleccionada: null,

    // Tarifas
    tipo_tarifa: 'hora',
    tarifa_hora: null,
    tarifa_servicio: null,
    tarifa_convenio: '',

    // Disponibilidad
    esta_disponible: true
  });

  const totalSteps = 4;

  // Cargar datos del perfil al montar el componente
  useEffect(() => {
    if (myProfile) {
      setProfileData({
        nombre: myProfile.usuario?.nombre || user?.nombre || '',
        email: myProfile.usuario?.email || user?.email || '',
        telefono: myProfile.usuario?.telefono || '',
        descripcion: myProfile.descripcion || '',
        especialidades: myProfile.especialidades || [],
        anos_experiencia: myProfile.anos_experiencia || 0,
        zona_seleccionada: myProfile.coverage_zone || null,
        tipo_tarifa: myProfile.tipo_tarifa || 'hora',
        tarifa_hora: myProfile.tarifa_hora || null,
        tarifa_servicio: myProfile.tarifa_servicio || null,
        tarifa_convenio: myProfile.tarifa_convenio || '',
        esta_disponible: myProfile.esta_disponible !== false,
        profilePhoto: null,
        bannerPhoto: null
      });
    }
  }, [myProfile, user]);

  // Marcar cambios no guardados
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [profileData]);

  const validateCurrentStep = () => {
    const newErrors = {};

    switch (currentStep) {
      case 1: // Datos básicos
        if (!profileData.nombre.trim()) newErrors.nombre = 'El nombre es requerido';
        if (!profileData.email.trim()) newErrors.email = 'El email es requerido';
        if (!profileData.telefono.trim()) newErrors.telefono = 'El teléfono es requerido';
        if (!profileData.descripcion.trim()) newErrors.descripcion = 'La descripción es requerida';
        break;

      case 2: // Especialidades
        if (profileData.especialidades.length === 0) {
          newErrors.especialidades = 'Debe seleccionar al menos una especialidad';
        }
        break;

      case 3: // Zona
        if (!profileData.zona_seleccionada) {
          newErrors.zona = 'Debe seleccionar una zona de cobertura';
        }
        break;

      case 4: // Tarifas
        if (profileData.tipo_tarifa === 'hora' && !profileData.tarifa_hora) {
          newErrors.tarifa_hora = 'La tarifa por hora es requerida';
        }
        if (profileData.tipo_tarifa === 'servicio' && !profileData.tarifa_servicio) {
          newErrors.tarifa_servicio = 'La tarifa por servicio es requerida';
        }
        if (profileData.tipo_tarifa === 'convenio' && !profileData.tarifa_convenio.trim()) {
          newErrors.tarifa_convenio = 'Debe explicar cómo determina sus precios';
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    try {
      setIsLoading(true);
      setErrors({});

      // Preparar datos para envío
      const submitData = {
        nombre: profileData.nombre,
        email: profileData.email,
        telefono: profileData.telefono,
        descripcion: profileData.descripcion,
        especialidad: profileData.especialidades[0]?.name || '',
        specialtyIds: profileData.especialidades.map(s => s.id),
        anos_experiencia: profileData.anos_experiencia,
        zona_cobertura: profileData.zona_seleccionada?.name || '',
        latitud: profileData.zona_seleccionada?.latitude,
        longitud: profileData.zona_seleccionada?.longitude,
        coverage_zone_id: profileData.zona_seleccionada?.id,
        tipo_tarifa: profileData.tipo_tarifa,
        tarifa_hora: profileData.tarifa_hora,
        tarifa_servicio: profileData.tarifa_servicio,
        tarifa_convenio: profileData.tarifa_convenio,
        esta_disponible: profileData.esta_disponible
      };

      const result = await updateMyProfile(submitData, {
        profilePhoto: profileData.profilePhoto,
        bannerPhoto: profileData.bannerPhoto
      });

      if (result.success) {
        setHasUnsavedChanges(false);
        navigate('/professional-dashboard', {
          state: {
            message: 'Perfil profesional actualizado exitosamente',
            type: 'success'
          }
        });
      } else {
        setErrors({ general: result.error || 'Error al actualizar el perfil' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ general: 'Error de conexión. Inténtalo nuevamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfileData = (updates) => {
    setProfileData(prev => ({ ...prev, ...updates }));
  };

  // Componentes de cada paso
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <React.Fragment key={step}>
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
            ${step <= currentStep
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-200 text-gray-500'
            }
          `}>
            {step}
          </div>
          {step < totalSteps && (
            <div className={`
              w-16 h-1 mx-2
              ${step < currentStep ? 'bg-emerald-500' : 'bg-gray-200'}
            `} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const Step1_BasicInfo = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">📝 Editar Información Básica</h2>
        <p className="text-gray-600">Actualiza tus datos personales</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre Completo *
          </label>
          <input
            type="text"
            value={profileData.nombre}
            onChange={(e) => updateProfileData({ nombre: e.target.value })}
            className={`
              w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
              ${errors.nombre ? 'border-red-300 bg-red-50' : 'border-gray-200'}
            `}
            placeholder="Tu nombre completo"
            disabled={isLoading}
          />
          {errors.nombre && <p className="text-red-600 text-sm mt-1">{errors.nombre}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            value={profileData.email}
            onChange={(e) => updateProfileData({ email: e.target.value })}
            className={`
              w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
              ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'}
            `}
            placeholder="tu@email.com"
            disabled={isLoading}
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Teléfono *
        </label>
        <input
          type="tel"
          value={profileData.telefono}
          onChange={(e) => updateProfileData({ telefono: e.target.value })}
          className={`
            w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
            ${errors.telefono ? 'border-red-300 bg-red-50' : 'border-gray-200'}
          `}
          placeholder="+54 11 1234-5678"
          disabled={isLoading}
        />
        {errors.telefono && <p className="text-red-600 text-sm mt-1">{errors.telefono}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción Profesional *
        </label>
        <textarea
          value={profileData.descripcion}
          onChange={(e) => updateProfileData({ descripcion: e.target.value })}
          rows="4"
          className={`
            w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
            ${errors.descripcion ? 'border-red-300 bg-red-50' : 'border-gray-200'}
          `}
          placeholder="Describe tu experiencia y los servicios que ofreces..."
          disabled={isLoading}
        />
        {errors.descripcion && <p className="text-red-600 text-sm mt-1">{errors.descripcion}</p>}
      </div>

      {/* Subir fotos */}
      <ImageUploader
        profilePhoto={profileData.profilePhoto}
        bannerPhoto={profileData.bannerPhoto}
        onProfilePhotoChange={(file) => updateProfileData({ profilePhoto: file })}
        onBannerPhotoChange={(file) => updateProfileData({ bannerPhoto: file })}
        isLoading={isLoading}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Años de Experiencia *
        </label>
        <input
          type="number"
          value={profileData.anos_experiencia}
          onChange={(e) => updateProfileData({ anos_experiencia: parseInt(e.target.value) || 0 })}
          min="0"
          max="50"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="esta_disponible"
          checked={profileData.esta_disponible}
          onChange={(e) => updateProfileData({ esta_disponible: e.target.checked })}
          className="mr-3 h-4 w-4 text-emerald-500 focus:ring-emerald-500 border-gray-300 rounded"
          disabled={isLoading}
        />
        <label htmlFor="esta_disponible" className="text-sm text-gray-700">
          ¿Estás disponible para recibir nuevos trabajos?
        </label>
      </div>
    </div>
  );

  const Step2_Specialties = () => (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">🔧 Editar Especialidades</h2>
        <p className="text-gray-600">Actualiza tus áreas de expertise</p>
      </div>

      <SpecialtySelector
        selectedSpecialties={profileData.especialidades}
        onSpecialtiesChange={(specialties) => updateProfileData({ especialidades: specialties })}
        isLoading={isLoading}
      />
      {errors.especialidades && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mt-4">
          {errors.especialidades}
        </div>
      )}
    </div>
  );

  const Step3_Zone = () => (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">🗺️ Editar Zona de Cobertura</h2>
        <p className="text-gray-600">Actualiza tu área de trabajo</p>
      </div>

      <ZoneSelector
        selectedZone={profileData.zona_seleccionada}
        onZoneChange={(zone) => updateProfileData({ zona_seleccionada: zone })}
        isLoading={isLoading}
      />
      {errors.zona && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mt-4">
          {errors.zona}
        </div>
      )}
    </div>
  );

  const Step4_Rates = () => (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">💰 Editar Tarifas</h2>
        <p className="text-gray-600">Actualiza tus precios y condiciones</p>
      </div>

      <RateSelector
        selectedRates={{
          tipo_tarifa: profileData.tipo_tarifa,
          tarifa_hora: profileData.tarifa_hora,
          tarifa_servicio: profileData.tarifa_servicio,
          tarifa_convenio: profileData.tarifa_convenio
        }}
        onRatesChange={(rates) => updateProfileData(rates)}
        isLoading={isLoading}
        experienceYears={profileData.anos_experiencia}
        primarySpecialty={profileData.especialidades[0]?.category}
      />
      {(errors.tarifa_hora || errors.tarifa_servicio || errors.tarifa_convenio) && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mt-4">
          <p>Error en las tarifas: {Object.values(errors).join(', ')}</p>
        </div>
      )}

      {errors.general && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mt-4">
          {errors.general}
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return <Step1_BasicInfo />;
      case 2: return <Step2_Specialties />;
      case 3: return <Step3_Zone />;
      case 4: return <Step4_Rates />;
      default: return <Step1_BasicInfo />;
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-gray-600 mt-4">Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Indicador de progreso */}
          <div className="bg-white rounded-3xl shadow-2xl mb-6 p-6">
            <StepIndicator />
          </div>

          {/* Contenido del paso actual */}
          <div className="bg-white rounded-3xl shadow-2xl">
            <div className="p-8">
              {renderCurrentStep()}
            </div>
          </div>

          {/* Navegación */}
          <div className="flex justify-between items-center mt-8">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1 || isLoading}
              className="px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Paso {currentStep} de {totalSteps}
              </p>
              {hasUnsavedChanges && (
                <p className="text-xs text-amber-600 mt-1">Cambios sin guardar</p>
              )}
            </div>

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={isLoading}
                className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Guardando...</span>
                  </>
                ) : (
                  '✓ Guardar Cambios'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfessionalProfile;