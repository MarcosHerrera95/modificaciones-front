/**
 * @component BudgetRequestForm - Formulario Mejorado de Solicitud de Presupuesto
 * @descripción Componente para crear solicitudes de presupuesto siguiendo el diseño mejorado (REQ-31)
 * @versión 2.0 - Sistema robusto con validaciones y UX optimizada
 * 
 * FUNCIONALIDADES IMPLEMENTADAS:
 * ✅ REQ-31: Cliente crea solicitud con descripción y fotos
 * ✅ Validaciones completas de formulario
 * ✅ Subida de fotos con preview
 * ✅ Selección de categoría de servicio
 * ✅ Configuración de presupuesto esperado
 * ✅ Programación de fecha preferida
 * ✅ Detalles adicionales de requerimientos
 * 
 * MEJORAS UX:
 * - Interfaz más intuitiva y moderna
 * - Validaciones en tiempo real
 * - Indicadores de progreso
 * - Feedback visual mejorado
 * - Manejo de errores elegante
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../context/NotificationContext';
import ImageUploader from './ImageUploader';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import SuccessAlert from './SuccessAlert';

const CATEGORIES = [
  { value: 'plomeria', label: 'Plomería', icon: '🔧' },
  { value: 'electricidad', label: 'Electricidad', icon: '⚡' },
  { value: 'albañileria', label: 'Albañilería', icon: '🧱' },
  { value: 'pintura', label: 'Pintura', icon: '🎨' },
  { value: 'jardineria', label: 'Jardinería', icon: '🌱' },
  { value: 'limpieza', label: 'Limpieza', icon: '🧽' },
  { value: 'gasista', label: 'Gasista', icon: '🔥' },
  { value: 'cerrajeria', label: 'Cerrajería', icon: '🔐' },
  { value: 'otros', label: 'Otros', icon: '🔨' }
];

const BUDGET_RANGES = [
  { value: '0-5000', label: 'Hasta $5.000', min: 0, max: 5000 },
  { value: '5000-15000', label: '$5.000 - $15.000', min: 5000, max: 15000 },
  { value: '15000-30000', label: '$15.000 - $30.000', min: 15000, max: 30000 },
  { value: '30000-50000', label: '$30.000 - $50.000', min: 30000, max: 50000 },
  { value: '50000+', label: 'Más de $50.000', min: 50000, max: null },
  { value: 'a-convenir', label: 'A convenir', min: null, max: null }
];

const URGENCY_LEVELS = [
  { value: 'normal', label: 'Normal', description: 'No hay prisa', color: 'gray' },
  { value: 'soon', label: 'Pronto', description: 'Esta semana', color: 'yellow' },
  { value: 'urgent', label: 'Urgente', description: 'Hoy o mañana', color: 'red' },
  { value: 'emergency', label: 'Emergencia', description: 'Inmediato', color: 'red' }
];

/**
 * @función BudgetRequestForm - Componente principal del formulario
 * @descripción Maneja la creación de solicitudes de presupuesto con UX mejorada
 * @param {Object} props - Propiedades del componente
 * @param {Function} props.onClose - Callback para cerrar el modal
 * @param {Function} props.onSuccess - Callback ejecutado al crear exitosamente
 * @returns {JSX.Element} Formulario de solicitud de presupuesto
 */
const BudgetRequestForm = ({ onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    budgetRangeMin: '',
    budgetRangeMax: '',
    budgetRange: 'a-convenir',
    preferredDate: '',
    urgency: 'normal',
    location: {
      address: '',
      city: '',
      coordinates: null
    },
    requirements: {
      accessInstructions: '',
      specialInstructions: '',
      serviceFrequency: 'once',
      additionalServices: []
    },
    photos: []
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const notificationContext = useNotificationContext();
  const navigate = useNavigate();

  /**
   * Validar paso actual del formulario
   */
  const validateStep = useCallback((step) => {
    const newErrors = {};

    switch (step) {
      case 1: // Información básica
        if (!formData.title.trim() || formData.title.length < 10) {
          newErrors.title = 'El título debe tener al menos 10 caracteres';
        }
        if (!formData.description.trim() || formData.description.length < 50) {
          newErrors.description = 'La descripción debe tener al menos 50 caracteres';
        }
        if (!formData.category) {
          newErrors.category = 'Debes seleccionar una categoría';
        }
        break;

      case 2: // Presupuesto y fechas
        if (formData.budgetRange !== 'a-convenir') {
          const range = BUDGET_RANGES.find(r => r.value === formData.budgetRange);
          if (range && range.min !== null) {
            formData.budgetRangeMin = range.min.toString();
          }
          if (range && range.max !== null) {
            formData.budgetRangeMax = range.max.toString();
          }
        }
        break;

      case 3: // Ubicación
        if (!formData.location.address.trim()) {
          newErrors.location = 'Debes ingresar una dirección';
        }
        if (!formData.location.city.trim()) {
          newErrors.city = 'Debes ingresar una ciudad';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  /**
   * Manejar cambios en el formulario
   */
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  /**
   * Manejar cambios en ubicación
   */
  const handleLocationChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: value
      }
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  /**
   * Manejar subida de fotos
   */
  const handlePhotoUpload = useCallback(async (files) => {
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: true,
      progress: 0
    }));

    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos]
    }));

    // Simular progreso de subida (en implementación real usarías el servicio real)
    newPhotos.forEach((photo, index) => {
      setTimeout(() => {
        setFormData(prev => ({
          ...prev,
          photos: prev.photos.map((p) => 
            p.file === photo.file ? { ...p, uploading: false, progress: 100 } : p
          )
        }));
      }, (index + 1) * 500);
    });
  }, []);

  /**
   * Remover foto
   */
  const handlePhotoRemove = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  /**
   * Navegar entre pasos
   */
  const goToStep = (step) => {
    if (step < currentStep || validateStep(currentStep)) {
      setCurrentStep(step);
    }
  };

  /**
   * Enviar solicitud
   */
  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setLoading(true);
    setErrors({});

    try {
      const formDataToSend = new FormData();
      
      // Agregar campos del formulario
      Object.keys(formData).forEach(key => {
        if (key === 'photos') return; // Manejar fotos por separado
        if (key === 'location' || key === 'requirements') {
          formDataToSend.append(key, JSON.stringify(formData[key]));
        } else {
          formDataToSend.append(key, formData[key]);
        }
      });

      // Agregar fotos
      formData.photos.forEach((photo) => {
        if (!photo.uploading) {
          formDataToSend.append(`photos`, photo.file);
        }
      });

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/budget-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: formDataToSend
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        
        // Notificación de éxito
        if (notificationContext) {
          notificationContext.showNotification({
            type: 'success',
            title: 'Solicitud creada',
            message: 'Tu solicitud de presupuesto ha sido creada exitosamente'
          });
        }

        // Callback de éxito
        if (onSuccess) {
          onSuccess(data.data);
        }

        // Navegar o cerrar
        setTimeout(() => {
          if (onClose) onClose();
          navigate('/mi-cuenta/presupuestos');
        }, 2000);

      } else {
        setErrors(data.details || { submit: data.error });
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      setErrors({ submit: 'Error de red. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Renderizar paso 1: Información básica
   */
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">¿Qué trabajo necesitas?</h2>
        <p className="text-gray-600">Cuéntanos los detalles para conseguir mejores presupuestos</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Título de la solicitud *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              errors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ej: Reparación de grifo que gotea en cocina"
            maxLength={255}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${errors.title ? 'text-red-500' : 'text-gray-500'}`}>
              {errors.title || `${formData.title.length}/255 caracteres`}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción detallada *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={4}
            placeholder="Describe el trabajo en detalle: qué necesitas, dónde está ubicado, materiales necesarios, etc."
            maxLength={2000}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${errors.description ? 'text-red-500' : 'text-gray-500'}`}>
              {errors.description || `${formData.description.length}/2000 caracteres`}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Categoría del servicio *
          </label>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(category => (
              <button
                key={category.value}
                type="button"
                onClick={() => handleInputChange('category', category.value)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  formData.category === category.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{category.icon}</span>
                  <span className="font-medium">{category.label}</span>
                </div>
              </button>
            ))}
          </div>
          {errors.category && (
            <p className="mt-1 text-xs text-red-500">{errors.category}</p>
          )}
        </div>
      </div>
    </div>
  );

  /**
   * Renderizar paso 2: Presupuesto y fechas
   */
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Presupuesto y timing</h2>
        <p className="text-gray-600">Ayúdanos a encontrar los profesionales adecuados</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Presupuesto esperado
          </label>
          <div className="space-y-2">
            {BUDGET_RANGES.map(range => (
              <label key={range.value} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="budgetRange"
                  value={range.value}
                  checked={formData.budgetRange === range.value}
                  onChange={(e) => handleInputChange('budgetRange', e.target.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700">{range.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha preferida para el servicio
          </label>
          <input
            type="date"
            value={formData.preferredDate}
            onChange={(e) => handleInputChange('preferredDate', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Nivel de urgencia
          </label>
          <div className="space-y-2">
            {URGENCY_LEVELS.map(level => (
              <label key={level.value} className="flex items-center space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                <input
                  type="radio"
                  name="urgency"
                  value={level.value}
                  checked={formData.urgency === level.value}
                  onChange={(e) => handleInputChange('urgency', e.target.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-700">{level.label}</div>
                  <div className="text-sm text-gray-500">{level.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /**
   * Renderizar paso 3: Ubicación
   */
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">¿Dónde necesitas el servicio?</h2>
        <p className="text-gray-600">Esto nos ayuda a encontrar profesionales cercanos</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dirección completa *
          </label>
          <input
            type="text"
            value={formData.location.address}
            onChange={(e) => handleLocationChange('address', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.location ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ej: Av. Corrientes 1234, Palermo"
          />
          {errors.location && (
            <p className="mt-1 text-xs text-red-500">{errors.location}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ciudad/Barrio *
          </label>
          <input
            type="text"
            value={formData.location.city}
            onChange={(e) => handleLocationChange('city', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.city ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ej: Palermo, Buenos Aires"
          />
          {errors.city && (
            <p className="mt-1 text-xs text-red-500">{errors.city}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instrucciones de acceso
          </label>
          <textarea
            value={formData.requirements.accessInstructions}
            onChange={(e) => handleInputChange('requirements', {
              ...formData.requirements,
              accessInstructions: e.target.value
            })}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder="Ej: Es departamento 3B, timbre 'García'. El lunes no estoy disponible."
            maxLength={300}
          />
        </div>
      </div>
    </div>
  );

  /**
   * Renderizar paso 4: Fotos y revisión
   */
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Fotos y revisión final</h2>
        <p className="text-gray-600">Las fotos ayudan a los profesionales a dar mejores presupuestos</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Fotos del trabajo (máximo 5)
          </label>
          <ImageUploader
            onImageSelect={handlePhotoUpload}
            onImageRemove={handlePhotoRemove}
            images={formData.photos}
            maxImages={5}
            maxSize={5 * 1024 * 1024} // 5MB
            acceptedFormats={['image/jpeg', 'image/png', 'image/webp']}
          />
          <p className="text-xs text-gray-500 mt-2">
            Formatos aceptados: JPG, PNG, WebP. Máximo 5MB por imagen.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instrucciones adicionales
          </label>
          <textarea
            value={formData.requirements.specialInstructions}
            onChange={(e) => handleInputChange('requirements', {
              ...formData.requirements,
              specialInstructions: e.target.value
            })}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder="Cualquier información adicional que consideres importante..."
            maxLength={500}
          />
        </div>

        {/* Resumen de la solicitud */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Resumen de tu solicitud</h3>
          <div className="space-y-2 text-sm">
            <div><strong>Título:</strong> {formData.title}</div>
            <div><strong>Categoría:</strong> {CATEGORIES.find(c => c.value === formData.category)?.label}</div>
            <div><strong>Presupuesto:</strong> {BUDGET_RANGES.find(r => r.value === formData.budgetRange)?.label}</div>
            {formData.preferredDate && (
              <div><strong>Fecha preferida:</strong> {new Date(formData.preferredDate).toLocaleDateString()}</div>
            )}
            <div><strong>Urgencia:</strong> {URGENCY_LEVELS.find(u => u.value === formData.urgency)?.label}</div>
            <div><strong>Ubicación:</strong> {formData.location.address}, {formData.location.city}</div>
            <div><strong>Fotos:</strong> {formData.photos.length} imagen(es)</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">¡Solicitud enviada!</h3>
        <p className="text-gray-600">
          Tu solicitud de presupuesto ha sido creada y será enviada a profesionales cercanos.
          Te notificaremos cuando reciban tus solicitudes.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header con progreso */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Nueva solicitud de presupuesto</h1>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Indicador de progreso */}
        <div className="flex items-center">
          {[1, 2, 3, 4].map(step => (
            <React.Fragment key={step}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step <= currentStep 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step}
              </div>
              {step < 4 && (
                <div className={`flex-1 h-1 mx-2 ${
                  step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Contenido del formulario */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

        {/* Errores generales */}
        {errors.submit && (
          <ErrorAlert 
            message={errors.submit} 
            className="mt-4"
          />
        )}

        {/* Navegación */}
        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={() => goToStep(currentStep - 1)}
            disabled={currentStep === 1}
            className={`px-6 py-2 rounded-lg font-medium ${
              currentStep === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Anterior
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => goToStep(currentStep + 1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              <span>{loading ? 'Enviando...' : 'Crear Solicitud'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetRequestForm;