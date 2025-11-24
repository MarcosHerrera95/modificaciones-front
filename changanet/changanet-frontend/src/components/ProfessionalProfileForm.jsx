import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { professionalProfileAPI } from '../services/professionalProfileAPIService';
import ImageUploader from './ImageUploader';
import SpecialtySelector from './SpecialtySelector';
import ZoneSelector from './ZoneSelector';
import RateSelector from './RateSelector';
import BackButton from './BackButton';

/**
 * ProfessionalProfileForm
 * Formulario completo de perfil profesional
 * 
 * Implementa REQ-06 a REQ-10 del PRD:
 * - REQ-06: Subir foto de perfil y portada
 * - REQ-07: Seleccionar especialidades múltiples
 * - REQ-08: Ingresar años de experiencia
 * - REQ-09: Definir zona de cobertura geográfica
 * - REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 * 
 * Características:
 * - Formulario multi-step con validación
 * - Score de completitud en tiempo real
 * - Integración completa con backend
 * - Manejo de estados de carga y errores
 * - UX optimizada con componentes modernos
 */

const ProfessionalProfileForm = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  
  // Estados del formulario
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [profileData, setProfileData] = useState({
    // Datos básicos
    nombre: '',
    email: '',
    telefono: '',
    descripcion: '',
    esta_disponible: true,
    
    // REQ-06: Fotos
    profilePhoto: null,
    bannerPhoto: null,
    
    // REQ-07: Especialidades
    especialidades: [],
    
    // REQ-08: Experiencia
    anos_experiencia: 0,
    
    // REQ-09: Zona de cobertura
    zona_seleccionada: null,
    
    // REQ-10: Tarifas
    tipo_tarifa: 'hora',
    tarifa_hora: null,
    tarifa_servicio: null,
    tarifa_convenio: ''
  });

  // Estados de completitud
  const [completionScore, setCompletionScore] = useState(0);

  const totalSteps = 5;

  useEffect(() => {
    if (user) {
      loadExistingProfile();
    }
  }, [user]);

  useEffect(() => {
    calculateCompletionScore();
  }, [profileData]);

  const loadExistingProfile = async () => {
    try {
      setIsLoading(true);
      const result = await professionalProfileAPI.getMyProfile();
      
      if (result.success && result.profile) {
        const profile = result.profile;
        setProfileData({
          nombre: profile.usuario?.nombre || user.nombre || '',
          email: profile.usuario?.email || user.email || '',
          telefono: profile.usuario?.telefono || '',
          descripcion: profile.descripcion || '',
          esta_disponible: profile.esta_disponible !== false,
          anos_experiencia: profile.anos_experiencia || 0,
          especialidades: profile.especialidades || [],
          zona_seleccionada: profile.coverage_zone || null,
          tipo_tarifa: profile.tipo_tarifa || 'hora',
          tarifa_hora: profile.tarifa_hora,
          tarifa_servicio: profile.tarifa_servicio,
          tarifa_convenio: profile.tarifa_convenio || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCompletionScore = () => {
    const score = professionalProfileAPI.calculateCompletionScore(profileData);
    setCompletionScore(score.score);
  };

  const validateCurrentStep = () => {
    const newErrors = {};
    
    switch (currentStep) {
      case 1: // Datos básicos
        if (!profileData.nombre.trim()) newErrors.nombre = 'El nombre es requerido';
        if (!profileData.email.trim()) newErrors.email = 'El email es requerido';
        if (!profileData.telefono.trim()) newErrors.telefono = 'El teléfono es requerido';
        if (!profileData.descripcion.trim()) newErrors.descripcion = 'La descripción es requerida';
        break;
        
      case 2: // REQ-07: Especialidades
        if (profileData.especialidades.length === 0) {
          newErrors.especialidades = 'Debe seleccionar al menos una especialidad';
        }
        break;
        
      case 3: // REQ-09: Zona
        if (!profileData.zona_seleccionada) {
          newErrors.zona = 'Debe seleccionar una zona de cobertura';
        }
        break;
        
      case 4: // REQ-10: Tarifas
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

      const result = await professionalProfileAPI.updateMyProfile(
        submitData,
        {
          profilePhoto: profileData.profilePhoto,
          bannerPhoto: profileData.bannerPhoto
        }
      );

      if (result.success) {
        // Actualizar contexto de usuario si es necesario
        if (updateUser) {
          updateUser({
            ...user,
            nombre: profileData.nombre,
            url_foto_perfil: result.profile.url_foto_perfil
          });
        }
        
        navigate('/professional-dashboard', { 
          state: { 
            message: 'Perfil profesional actualizado exitosamente',
            type: 'success'
          }
        });
      } else {
        setErrors({ general: result.message || 'Error al actualizar el perfil' });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
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
        <h2 className="text-3xl font-bold text-gray-800 mb-2">📋 Información Básica</h2>
        <p className="text-gray-600">Comencemos con tus datos personales</p>
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

      {/* REQ-06: Subir fotos */}
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
    </div>
  );

  const Step5_Review = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">📋 Revisión Final</h2>
        <p className="text-gray-600">Confirma que toda la información sea correcta</p>
      </div>

      {/* Resumen del perfil */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Información Personal</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Nombre:</strong> {profileData.nombre}</p>
              <p><strong>Email:</strong> {profileData.email}</p>
              <p><strong>Teléfono:</strong> {profileData.telefono}</p>
              <p><strong>Experiencia:</strong> {profileData.anos_experiencia} años</p>
              <p><strong>Disponible:</strong> {profileData.esta_disponible ? 'Sí' : 'No'}</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔧 Especialidades</h3>
            <div className="space-y-1">
              {profileData.especialidades.map((specialty, index) => (
                <div key={specialty.id} className="flex items-center text-sm">
                  <span className="mr-2">{index === 0 ? '⭐' : '🔧'}</span>
                  <span>{specialty.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🗺️ Zona de Cobertura</h3>
            {profileData.zona_seleccionada && (
              <div className="text-sm">
                <p><strong>Área:</strong> {profileData.zona_seleccionada.name}</p>
                <p><strong>Ubicación:</strong> {profileData.zona_seleccionada.city}, {profileData.zona_seleccionada.state}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">💰 Tarifas</h3>
            <div className="text-sm">
              {profileData.tipo_tarifa === 'hora' && profileData.tarifa_hora && (
                <p><strong>Por hora:</strong> ${profileData.tarifa_hora.toLocaleString()}</p>
              )}
              {profileData.tipo_tarifa === 'servicio' && profileData.tarifa_servicio && (
                <p><strong>Por servicio:</strong> ${profileData.tarifa_servicio.toLocaleString()}</p>
              )}
              {profileData.tipo_tarifa === 'convenio' && (
                <p><strong>A convenir:</strong> {profileData.tarifa_convenio}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score de completitud */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-emerald-800">📊 Completitud del Perfil</h3>
          <span className="text-2xl font-bold text-emerald-600">{completionScore}%</span>
        </div>
        <div className="w-full bg-emerald-200 rounded-full h-3 mb-4">
          <div 
            className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${completionScore}%` }}
          ></div>
        </div>
        <p className="text-sm text-emerald-700">
          {completionScore >= 90 ? '¡Excelente! Tu perfil está casi completo.' :
           completionScore >= 70 ? 'Muy bien! Aún puedes mejorar algunos aspectos.' :
           completionScore >= 50 ? 'Buen comienzo, completa más información para destacar.' :
           'Completa más secciones para mejorar tu visibilidad.'}
        </p>
      </div>

      {errors.general && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl">
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
      case 5: return <Step5_Review />;
      default: return <Step1_BasicInfo />;
    }
  };

  if (isLoading && currentStep === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando tu perfil...</p>
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
          {/* Indicador de pasos */}
          <StepIndicator />

          {/* Contenido del paso actual */}
          <div className="bg-white rounded-3xl shadow-2xl">
            {renderCurrentStep()}
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
                disabled={isLoading || completionScore < 50}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  '✓ Finalizar y Guardar'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalProfileForm;