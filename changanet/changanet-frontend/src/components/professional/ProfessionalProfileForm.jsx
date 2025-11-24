import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// Components
import LoadingSpinner from '../ui/LoadingSpinner';
import ImageUploadSection from './ImageUploadSection';
import SpecialtySelector from './SpecialtySelector';
import ExperienceSection from './ExperienceSection';
import CoverageZoneSelector from './CoverageZoneSelector';
import RateConfiguration from './RateConfiguration';
import PersonalInfoSection from './PersonalInfoSection';
import ValidationSummary from './ValidationSummary';

// Services
import professionalProfileService from '../../services/professionalProfileService';

const ProfessionalProfileForm = ({ initialData = null, onSave = null }) => {
  const navigate = useNavigate();

  // Estados principales
  const [profileData, setProfileData] = useState({
    // Información personal
    nombre: '',
    email: '',
    telefono: '',
    
    // REQ-07: Especialidades
    especialidades: [],
    specialtyIds: [],
    
    // REQ-08: Años de experiencia
    anos_experiencia: 0,
    
    // REQ-09: Zona de cobertura geográfica
    zona_cobertura: '',
    coverage_zone_id: '',
    latitud: null,
    longitud: null,
    coverage_zone: null,
    
    // REQ-10: Tarifas
    tipo_tarifa: 'hora',
    tarifa_hora: 0,
    tarifa_servicio: 0,
    tarifa_convenio: '',
    
    // Información adicional
    descripcion: '',
    esta_disponible: true,
    
    // Fotos
    url_foto_perfil: '',
    url_foto_portada: ''
  });

  // Estados de control
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [completionScore, setCompletionScore] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados para datos de catálogo
  const [specialties, setSpecialties] = useState([]);
  const [coverageZones, setCoverageZones] = useState([]);
  const [rateTypes, setRateTypes] = useState([]);
  const [rateRanges, setRateRanges] = useState({});

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Calcular completitud cuando cambian los datos
  useEffect(() => {
    const score = professionalProfileService.calculateCompletionScore(profileData);
    setCompletionScore(score.score);
  }, [profileData]);

  // Detectar cambios no guardados
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [profileData]);

  /**
   * Carga todos los datos iniciales necesarios
   */
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Cargar datos del perfil si existen
      if (initialData) {
        setProfileData(prev => ({
          ...prev,
          ...professionalProfileService.formatProfileData(initialData)
        }));
      } else {
        // Cargar perfil del servidor
        const myProfile = await professionalProfileService.getMyProfile();
        setProfileData(prev => ({
          ...prev,
          ...professionalProfileService.formatProfileData(myProfile)
        }));
      }

      // Cargar catálogos
      const [specialtiesData, zonesData, rateTypesData, rateRangesData] = await Promise.all([
        professionalProfileService.getSpecialties(true),
        professionalProfileService.getCoverageZones({ grouped: true }),
        professionalProfileService.getRateTypes(),
        professionalProfileService.getRateRanges()
      ]);

      setSpecialties(specialtiesData);
      setCoverageZones(zonesData);
      setRateTypes(rateTypesData);
      setRateRanges(rateRangesData);

    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Error al cargar los datos del perfil');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja el cambio de un campo del formulario
   */
  const handleFieldChange = useCallback((field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar errores de validación para este campo
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [validationErrors]);

  /**
   * Maneja el cambio de especialidades
   */
  const handleSpecialtiesChange = useCallback((selectedSpecialties) => {
    handleFieldChange('specialtyIds', selectedSpecialties.map(s => s.id));
    handleFieldChange('especialidades', selectedSpecialties);
  }, [handleFieldChange]);

  /**
   * Maneja el cambio de zona de cobertura
   */
  const handleCoverageZoneChange = useCallback((zoneData) => {
    handleFieldChange('coverage_zone_id', zoneData.id || '');
    handleFieldChange('zona_cobertura', zoneData.label || '');
    handleFieldChange('latitud', zoneData.latitude || null);
    handleFieldChange('longitud', zoneData.longitude || null);
    handleFieldChange('coverage_zone', zoneData);
  }, [handleFieldChange]);

  /**
   * Maneja el cambio de tarifas
   */
  const handleRatesChange = useCallback((rateData) => {
    Object.keys(rateData).forEach(key => {
      handleFieldChange(key, rateData[key]);
    });
  }, [handleFieldChange]);

  /**
   * Maneja la subida de fotos
   */
  const handlePhotoUpload = useCallback((photoType, file, previewUrl) => {
    handleFieldChange(`url_foto_${photoType}`, previewUrl);
    handleFieldChange(`${photoType}File`, file);
  }, [handleFieldChange]);

  /**
   * Valida el formulario antes de guardar
   */
  const validateForm = () => {
    const errors = {};

    // Validar campos requeridos
    if (!profileData.nombre?.trim()) {
      errors.nombre = 'El nombre es requerido';
    }

    if (!profileData.especialidades?.length) {
      errors.especialidades = 'Debe seleccionar al menos una especialidad';
    }

    if (!profileData.anos_experiencia || profileData.anos_experiencia < 0) {
      errors.anos_experiencia = 'Los años de experiencia deben ser un número positivo';
    }

    if (!profileData.zona_cobertura?.trim()) {
      errors.zona_cobertura = 'La zona de cobertura es requerida';
    }

    if (!profileData.descripcion?.trim() || profileData.descripcion.length < 10) {
      errors.descripcion = 'La descripción debe tener al menos 10 caracteres';
    }

    // Validar tarifas según el tipo
    if (profileData.tipo_tarifa === 'hora' && (!profileData.tarifa_hora || profileData.tarifa_hora <= 0)) {
      errors.tarifa_hora = 'La tarifa por hora debe ser mayor a 0';
    }

    if (profileData.tipo_tarifa === 'servicio' && (!profileData.tarifa_servicio || profileData.tarifa_servicio <= 0)) {
      errors.tarifa_servicio = 'La tarifa por servicio debe ser mayor a 0';
    }

    if (profileData.tipo_tarifa === 'convenio' && (!profileData.tarifa_convenio || profileData.tarifa_convenio.length < 5)) {
      errors.tarifa_convenio = 'La descripción "a convenir" debe tener al menos 5 caracteres';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Maneja el envío del formulario
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor corrige los errores en el formulario');
      return;
    }

    setSaving(true);
    try {
      // Preparar datos para envío
      const dataToSend = {
        nombre: profileData.nombre,
        email: profileData.email,
        telefono: profileData.telefono,
        especialidad: profileData.especialidades[0]?.name || profileData.especialidad,
        specialtyIds: profileData.specialtyIds,
        anos_experiencia: profileData.anos_experiencia,
        zona_cobertura: profileData.zona_cobertura,
        coverage_zone_id: profileData.coverage_zone_id,
        latitud: profileData.latitud,
        longitud: profileData.longitud,
        tipo_tarifa: profileData.tipo_tarifa,
        tarifa_hora: profileData.tarifa_hora,
        tarifa_servicio: profileData.tarifa_servicio,
        tarifa_convenio: profileData.tarifa_convenio,
        descripcion: profileData.descripcion,
        esta_disponible: profileData.esta_disponible
      };

      // Preparar archivos de fotos
      const profilePhoto = profileData.profilePhotoFile || null;
      const bannerPhoto = profileData.bannerPhotoFile || null;

      const result = await professionalProfileService.updateMyProfile(
        dataToSend,
        profilePhoto,
        bannerPhoto
      );

      toast.success('Perfil actualizado exitosamente');
      setHasUnsavedChanges(false);
      
      // Callback personalizado si se proporciona
      if (onSave) {
        onSave(result.profile);
      } else {
        // Navegar de vuelta al dashboard por defecto
        navigate('/professional/dashboard');
      }

    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Error al guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Calcula el progreso del formulario
   */
  const getProgressPercentage = () => {
    const requiredFields = [
      'nombre', 'especialidades', 'anos_experiencia', 
      'zona_cobertura', 'tipo_tarifa', 'descripcion'
    ];
    
    const filledFields = requiredFields.filter(field => {
      const value = profileData[field];
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== '' && value !== 0;
    });

    return Math.round((filledFields.length / requiredFields.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header con progreso */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800">
            Mi Perfil Profesional
          </h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Completado: {getProgressPercentage()}%
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        {hasUnsavedChanges && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-yellow-800 text-sm">
                Tienes cambios sin guardar
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Sección de fotos (REQ-06) */}
        <ImageUploadSection
          profilePhoto={profileData.url_foto_perfil}
          bannerPhoto={profileData.url_foto_portada}
          onPhotoUpload={handlePhotoUpload}
          errors={validationErrors}
        />

        {/* Sección de información personal */}
        <PersonalInfoSection
          data={profileData}
          onChange={handleFieldChange}
          errors={validationErrors}
        />

        {/* Selección de especialidades (REQ-07) */}
        <SpecialtySelector
          specialties={specialties}
          selectedSpecialties={profileData.especialidades}
          onChange={handleSpecialtiesChange}
          errors={validationErrors}
        />

        {/* Años de experiencia (REQ-08) */}
        <ExperienceSection
          years={profileData.anos_experiencia}
          onChange={(value) => handleFieldChange('anos_experiencia', value)}
          errors={validationErrors}
        />

        {/* Zona de cobertura geográfica (REQ-09) */}
        <CoverageZoneSelector
          zones={coverageZones}
          selectedZone={profileData.coverage_zone}
          zoneText={profileData.zona_cobertura}
          onChange={handleCoverageZoneChange}
          errors={validationErrors}
        />

        {/* Configuración de tarifas (REQ-10) */}
        <RateConfiguration
          rateTypes={rateTypes}
          rateRanges={rateRanges}
          rateData={{
            tipo_tarifa: profileData.tipo_tarifa,
            tarifa_hora: profileData.tarifa_hora,
            tarifa_servicio: profileData.tarifa_servicio,
            tarifa_convenio: profileData.tarifa_convenio
          }}
          specialty={profileData.especialidades[0]?.name || ''}
          experienceYears={profileData.anos_experiencia}
          onChange={handleRatesChange}
          errors={validationErrors}
        />

        {/* Resumen de validación */}
        <ValidationSummary
          profileData={profileData}
          completionScore={completionScore}
          errors={validationErrors}
        />

        {/* Botones de acción */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={loadInitialData}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Restablecer
            </button>
            
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="small" color="white" className="mr-2" />
                  Guardando...
                </>
              ) : (
                'Guardar Perfil'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProfessionalProfileForm;