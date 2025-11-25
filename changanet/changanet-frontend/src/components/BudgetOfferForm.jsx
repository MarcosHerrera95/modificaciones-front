/**
 * @component BudgetOfferForm - Formulario de Oferta del Profesional
 * @descripción Componente para que profesionales respondan a solicitudes de presupuesto (REQ-33)
 * @versión 2.0 - Sistema robusto con validación avanzada y UX optimizada
 * 
 * FUNCIONALIDADES IMPLEMENTADAS:
 * ✅ REQ-33: Profesionales responden con precio y comentarios
 * ✅ Formulario de oferta con precio y tiempo estimado
 * ✅ Comentarios detallados del profesional
 * ✅ Subida de fotos de trabajos anteriores
 * ✅ Detalles de disponibilidad
 * ✅ Validaciones completas de negocio
 * ✅ Previsualización de oferta antes de enviar
 * 
 * CARACTERÍSTICAS UX:
 * - Formulario paso a paso
 * - Validaciones en tiempo real
 * - Ayuda contextual
 * - Estimador de precio sugerido
 * - Previsualización de resultado
 */

import React, { useState, useEffect } from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import ImageUploader from './ImageUploader';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import SuccessAlert from './SuccessAlert';

const PRICE_RANGES = {
  plomeria: { min: 3000, max: 25000, suggested: 8000 },
  electricidad: { min: 4000, max: 30000, suggested: 12000 },
  albañileria: { min: 5000, max: 40000, suggested: 15000 },
  pintura: { min: 3000, max: 20000, suggested: 7000 },
  jardineria: { min: 2000, max: 15000, suggested: 5000 },
  limpieza: { min: 2500, max: 12000, suggested: 4000 },
  gasista: { min: 3500, max: 18000, suggested: 8000 },
  cerrajeria: { min: 2000, max: 10000, suggested: 4000 },
  otros: { min: 3000, max: 25000, suggested: 8000 }
};

const URGENCY_MULTIPLIERS = {
  normal: 1.0,
  soon: 1.2,
  urgent: 1.5,
  emergency: 2.0
};

/**
 * @función BudgetOfferForm - Componente principal del formulario de oferta
 * @descripción Permite a profesionales enviar ofertas competitivas a solicitudes
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.distribution - Datos de la distribución de solicitud
 * @param {Function} props.onClose - Callback para cerrar el modal
 * @param {Function} props.onSuccess - Callback ejecutado al enviar exitosamente
 * @returns {JSX.Element} Formulario de oferta de presupuesto
 */
const BudgetOfferForm = ({ distribution, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    price: '',
    estimatedDays: '',
    comments: '',
    availabilityDetails: '',
    photos: [],
    serviceType: 'standard', // standard, premium, emergency
    materials: {
      included: true,
      cost: 0,
      description: ''
    },
    warranty: {
      included: false,
      duration: '',
      terms: ''
    }
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [preview, setPreview] = useState(null);

  const notificationContext = useNotificationContext();

  /**
   * Calcular precio sugerido basado en categoría y urgencia
   */
  useEffect(() => {
    if (distribution?.request?.category) {
      const range = PRICE_RANGES[distribution.request.category];
      const urgency = distribution.request.urgency || 'normal';
      const multiplier = URGENCY_MULTIPLIERS[urgency] || 1.0;
      
      const suggested = Math.round(range.suggested * multiplier);
      setPriceSuggestion({
        min: Math.round(range.min * multiplier),
        max: Math.round(range.max * multiplier),
        suggested,
        category: distribution.request.category,
        urgency
      });
    }
  }, [distribution]);

  /**
   * Validar paso actual del formulario
   */
  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 1: // Información básica de precio
        if (!formData.price || parseFloat(formData.price) <= 0) {
          newErrors.price = 'Debes ingresar un precio válido';
        } else if (priceSuggestion && (parseFloat(formData.price) < priceSuggestion.min || parseFloat(formData.price) > priceSuggestion.max * 2)) {
          newErrors.price = `El precio está fuera del rango típico ($${priceSuggestion.min.toLocaleString()} - $${(priceSuggestion.max * 2).toLocaleString()})`;
        }
        if (!formData.estimatedDays || parseInt(formData.estimatedDays) < 1) {
          newErrors.estimatedDays = 'Debes especificar días de trabajo';
        } else if (parseInt(formData.estimatedDays) > 30) {
          newErrors.estimatedDays = 'El tiempo estimado no puede exceder 30 días';
        }
        break;

      case 2: // Comentarios y detalles
        if (!formData.comments || formData.comments.length < 20) {
          newErrors.comments = 'Los comentarios deben tener al menos 20 caracteres';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Manejar cambios en el formulario
   */
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }

    // Generar preview en tiempo real
    if (field === 'price' || field === 'comments' || field === 'estimatedDays') {
      generatePreview();
    }
  };

  /**
   * Manejar cambios en objetos anidados
   */
  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  /**
   * Manejar subida de fotos
   */
  const handlePhotoUpload = (files) => {
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false
    }));

    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos]
    }));
  };

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
   * Generar preview de la oferta
   */
  const generatePreview = () => {
    const preview = {
      price: parseFloat(formData.price) || 0,
      estimatedDays: parseInt(formData.estimatedDays) || 0,
      comments: formData.comments || '',
      serviceType: formData.serviceType,
      materials: formData.materials,
      warranty: formData.warranty,
      photos: formData.photos,
      requestInfo: {
        title: distribution?.request?.title,
        category: distribution?.request?.category,
        urgency: distribution?.request?.urgency,
        clientName: distribution?.request?.client?.nombre
      },
      comparison: priceSuggestion ? {
        isCompetitive: formData.price && priceSuggestion ? 
          parseFloat(formData.price) >= priceSuggestion.min && parseFloat(formData.price) <= priceSuggestion.max : false,
        priceVsSuggested: formData.price && priceSuggestion ? 
          ((parseFloat(formData.price) - priceSuggestion.suggested) / priceSuggestion.suggested * 100) : 0
      } : null
    };

    setPreview(preview);
  };

  /**
   * Navegar entre pasos
   */
  const goToStep = (step) => {
    if (step < currentStep || validateStep(currentStep)) {
      setCurrentStep(step);
      if (step === 4) generatePreview(); // Generar preview en el paso de revisión
    }
  };

  /**
   * Enviar oferta
   */
  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setLoading(true);
    setErrors({});

    try {
      const formDataToSend = new FormData();
      
      // Agregar campos del formulario
      Object.keys(formData).forEach(key => {
        if (key === 'photos') return;
        if (typeof formData[key] === 'object') {
          formDataToSend.append(key, JSON.stringify(formData[key]));
        } else {
          formDataToSend.append(key, formData[key]);
        }
      });

      // Agregar fotos
      formData.photos.forEach((photo) => {
        if (photo.file) {
          formDataToSend.append('photos', photo.file);
        }
      });

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/budget-requests/${distribution.requestId}/offers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
          },
          body: formDataToSend
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Notificación de éxito
        if (notificationContext) {
          notificationContext.showNotification({
            type: 'success',
            title: 'Oferta enviada',
            message: 'Tu oferta ha sido enviada exitosamente al cliente.'
          });
        }

        // Callback de éxito
        if (onSuccess) {
          onSuccess(result.data);
        }
      } else {
        setErrors(result.details || { submit: result.error });
      }
    } catch (error) {
      console.error('Error submitting offer:', error);
      setErrors({ submit: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Enviar Oferta</h2>
            <p className="text-gray-600 text-sm">{distribution?.request?.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-6 py-4 border-b border-gray-200">
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
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Precio</span>
            <span>Detalles</span>
            <span>Fotos</span>
            <span>Revisar</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between p-6 border-t border-gray-200 bg-gray-50">
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
              <span>{loading ? 'Enviando...' : 'Enviar Oferta'}</span>
            </button>
          )}
        </div>

        {/* Errors */}
        {errors.submit && (
          <div className="p-4 border-t border-red-200 bg-red-50">
            <ErrorAlert message={errors.submit} className="m-0" />
          </div>
        )}
      </div>
    </div>
  );

  /**
   * Renderizar paso 1: Precio y tiempo
   */
  function renderStep1() {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Precio y tiempo de trabajo</h3>
          <p className="text-gray-600">Establece tu propuesta competitiva</p>
        </div>

        {/* Información de la solicitud */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Detalles de la solicitud:</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div><strong>Categoría:</strong> {distribution?.request?.category}</div>
            <div><strong>Cliente:</strong> {distribution?.request?.client?.nombre}</div>
            {distribution?.request?.urgency && (
              <div><strong>Urgencia:</strong> {distribution.request.urgency}</div>
            )}
          </div>
        </div>

        {/* Precio sugerido */}
        {priceSuggestion && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Rango de precios típico para {priceSuggestion.category}:</h4>
            <div className="text-sm text-green-800">
              <div>Rango: {formatPrice(priceSuggestion.min)} - {formatPrice(priceSuggestion.max)}</div>
              <div>Precio sugerido: <strong>{formatPrice(priceSuggestion.suggested)}</strong></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Precio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio total (ARS) *
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.price ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ej: 8500"
              min="1"
              max="1000000"
              step="100"
            />
            {errors.price && (
              <p className="mt-1 text-xs text-red-500">{errors.price}</p>
            )}
            {formData.price && (
              <p className="mt-1 text-xs text-gray-500">
                {formatPrice(parseFloat(formData.price))}
              </p>
            )}
          </div>

          {/* Días estimados */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días de trabajo *
            </label>
            <input
              type="number"
              value={formData.estimatedDays}
              onChange={(e) => handleInputChange('estimatedDays', e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.estimatedDays ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ej: 2"
              min="1"
              max="30"
            />
            {errors.estimatedDays && (
              <p className="mt-1 text-xs text-red-500">{errors.estimatedDays}</p>
            )}
          </div>
        </div>

        {/* Tipo de servicio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Tipo de servicio
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: 'standard', label: 'Estándar', description: 'Precio normal' },
              { value: 'premium', label: 'Premium', description: 'Servicio premium +20%' },
              { value: 'emergency', label: 'Emergencia', description: 'Atención inmediata +50%' }
            ].map(type => (
              <label key={type.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="serviceType"
                  value={type.value}
                  checked={formData.serviceType === type.value}
                  onChange={(e) => handleInputChange('serviceType', e.target.value)}
                  className="sr-only"
                />
                <div className={`p-3 border-2 rounded-lg transition-all ${
                  formData.serviceType === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="font-medium text-gray-900">{type.label}</div>
                  <div className="text-sm text-gray-600">{type.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /**
   * Renderizar paso 2: Comentarios y detalles
   */
  function renderStep2() {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Detalles de tu propuesta</h3>
          <p className="text-gray-600">Explica tu propuesta al cliente</p>
        </div>

        {/* Comentarios */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comentarios y explicación *
          </label>
          <textarea
            value={formData.comments}
            onChange={(e) => handleInputChange('comments', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
              errors.comments ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={6}
            placeholder="Explica tu propuesta: qué incluye el trabajo, materiales, metodología, garantías, etc. Sé específico para generar confianza."
            maxLength={1000}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${errors.comments ? 'text-red-500' : 'text-gray-500'}`}>
              {errors.comments || `${formData.comments.length}/1000 caracteres`}
            </span>
          </div>
        </div>

        {/* Disponibilidad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Detalles de disponibilidad
          </label>
          <textarea
            value={formData.availabilityDetails}
            onChange={(e) => handleInputChange('availabilityDetails', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none"
            rows={3}
            placeholder="Ej: Disponible de lunes a viernes de 8 a 18hs. Puedo comenzar la próxima semana."
            maxLength={300}
          />
          <p className="mt-1 text-xs text-gray-500">
            Cuándo puedes comenzar y tu horario de trabajo
          </p>
        </div>

        {/* Materiales */}
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.materials.included}
              onChange={(e) => handleNestedChange('materials', 'included', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">
              Los materiales están incluidos en el precio
            </label>
          </div>

          {formData.materials.included && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Costo estimado de materiales
                </label>
                <input
                  type="number"
                  value={formData.materials.cost}
                  onChange={(e) => handleNestedChange('materials', 'cost', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  max="50000"
                  step="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción de materiales
                </label>
                <input
                  type="text"
                  value={formData.materials.description}
                  onChange={(e) => handleNestedChange('materials', 'description', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Caños PVC, conexiones, etc."
                  maxLength={200}
                />
              </div>
            </div>
          )}
        </div>

        {/* Garantía */}
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.warranty.included}
              onChange={(e) => handleNestedChange('warranty', 'included', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">
              Ofrezco garantía en el trabajo
            </label>
          </div>

          {formData.warranty.included && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duración de la garantía
                </label>
                <select
                  value={formData.warranty.duration}
                  onChange={(e) => handleNestedChange('warranty', 'duration', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar</option>
                  <option value="7 days">1 semana</option>
                  <option value="15 days">15 días</option>
                  <option value="30 days">1 mes</option>
                  <option value="90 days">3 meses</option>
                  <option value="180 days">6 meses</option>
                  <option value="365 days">1 año</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Términos de la garantía
                </label>
                <input
                  type="text"
                  value={formData.warranty.terms}
                  onChange={(e) => handleNestedChange('warranty', 'terms', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Garantía por defectos de instalación"
                  maxLength={150}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * Renderizar paso 3: Fotos
   */
  function renderStep3() {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Trabajos anteriores</h3>
          <p className="text-gray-600">Muestra ejemplos de tu trabajo para generar confianza</p>
        </div>

        <ImageUploader
          onImageSelect={handlePhotoUpload}
          onImageRemove={handlePhotoRemove}
          images={formData.photos}
          maxImages={5}
          maxSize={5 * 1024 * 1024} // 5MB
          acceptedFormats={['image/jpeg', 'image/png', 'image/webp']}
        />

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 Consejos para mejores fotos:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Usa fotos de trabajos similares al solicitado</li>
            <li>• Muestra el antes y después cuando sea posible</li>
            <li>• Las fotos deben estar bien iluminadas y enfocadas</li>
            <li>• Máximo 5 fotos de hasta 5MB cada una</li>
          </ul>
        </div>
      </div>
    );
  }

  /**
   * Renderizar paso 4: Revisión
   */
  function renderStep4() {
    if (!preview) return null;

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Revisar tu oferta</h3>
          <p className="text-gray-600">Confirma que toda la información sea correcta</p>
        </div>

        {/* Resumen de la oferta */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-bold text-lg text-gray-900 mb-4">Resumen de tu oferta</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Precio y tiempo */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Precio total:</span>
                <span className="font-bold text-xl text-green-600">{formatPrice(preview.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tiempo estimado:</span>
                <span className="font-medium">{preview.estimatedDays} días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo de servicio:</span>
                <span className="capitalize">{preview.serviceType}</span>
              </div>
            </div>

            {/* Indicadores de competitividad */}
            <div className="space-y-3">
              {preview.comparison && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vs. precio sugerido:</span>
                    <span className={`font-medium ${
                      preview.comparison.priceVsSuggested <= 0 ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {preview.comparison.priceVsSuggested > 0 ? '+' : ''}{preview.comparison.priceVsSuggested.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Competitividad:</span>
                    <span className={`font-medium ${
                      preview.comparison.isCompetitive ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {preview.comparison.isCompetitive ? 'Precio competitivo' : 'Precio elevado'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Comentarios */}
          {preview.comments && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="font-medium text-gray-900 mb-2">Comentarios:</h5>
              <p className="text-gray-600 text-sm leading-relaxed">{preview.comments}</p>
            </div>
          )}

          {/* Disponibilidad */}
          {preview.availabilityDetails && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="font-medium text-gray-900 mb-2">Disponibilidad:</h5>
              <p className="text-gray-600 text-sm">{preview.availabilityDetails}</p>
            </div>
          )}

          {/* Materiales */}
          {preview.materials.included && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="font-medium text-gray-900 mb-2">Materiales:</h5>
              <p className="text-gray-600 text-sm">
                {preview.materials.included ? 'Incluidos en el precio' : 'No incluidos'}
                {preview.materials.cost > 0 && ` ($${preview.materials.cost.toLocaleString()})`}
                {preview.materials.description && ` - ${preview.materials.description}`}
              </p>
            </div>
          )}

          {/* Garantía */}
          {preview.warranty.included && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="font-medium text-gray-900 mb-2">Garantía:</h5>
              <p className="text-gray-600 text-sm">
                {preview.warranty.duration} - {preview.warranty.terms}
              </p>
            </div>
          )}

          {/* Fotos */}
          {preview.photos.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="font-medium text-gray-900 mb-2">Fotos incluidas ({preview.photos.length}):</h5>
              <div className="flex space-x-2 overflow-x-auto">
                {preview.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo.preview}
                    alt={`Trabajo ${index + 1}`}
                    className="w-16 h-16 object-cover rounded border flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Información final */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Importante:</p>
              <ul className="space-y-1">
                <li>• Una vez enviada, no podrás modificar tu oferta</li>
                <li>• El cliente podrá ver tu oferta junto con otras</li>
                <li>• Si es seleccionada, te contactaremos para coordinar</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default BudgetOfferForm;