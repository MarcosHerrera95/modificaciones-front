/**
 * @component UrgentRequestForm - Formulario completo para solicitudes urgentes
 * @description Formulario con carga de fotos, geolocalización y validaciones avanzadas
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrgentContext } from '../context/UrgentContext';
import { validateUrgentRequest, calculateUrgentPrice } from '../services/urgentApi';

const UrgentRequestForm = ({ onClose }) => {
  const navigate = useNavigate();
  const { createRequest, getUserLocation, userLocation, locationLoading } = useUrgentContext();

  const [formData, setFormData] = useState({
    description: '',
    serviceCategory: 'general',
    radiusKm: 5,
    photos: []
  });

  const [location, setLocation] = useState(userLocation);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [photoPreview, setPhotoPreview] = useState([]);

  const fileInputRef = useRef(null);
  const maxPhotos = 5;
  const maxFileSize = 5 * 1024 * 1024; // 5MB

  // Handle input changes
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }

    // Update price estimate when category or radius changes
    if (name === 'serviceCategory' || name === 'radiusKm') {
      updatePriceEstimate();
    }
  }, [errors]);

  // Update price estimate
  const updatePriceEstimate = useCallback(async () => {
    try {
      const price = await calculateUrgentPrice(formData.serviceCategory, formData.radiusKm);
      setPriceEstimate(price);
    } catch (error) {
      console.error('Error calculating price:', error);
      setPriceEstimate(null);
    }
  }, [formData.serviceCategory, formData.radiusKm]);

  // Get current location
  const handleGetLocation = useCallback(async () => {
    try {
      const loc = await getUserLocation();
      setLocation(loc);
      setErrors(prev => ({ ...prev, location: null }));
    } catch (error) {
      console.error('Error getting location:', error);
      setErrors(prev => ({
        ...prev,
        location: 'No se pudo obtener la ubicación. Verifica los permisos del navegador.'
      }));
    }
  }, [getUserLocation]);

  // Handle photo upload
  const handlePhotoUpload = useCallback((e) => {
    const files = Array.from(e.target.files);

    // Validate files
    const validFiles = [];
    const newErrors = [];

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        newErrors.push(`${file.name} no es una imagen válida`);
        return;
      }

      if (file.size > maxFileSize) {
        newErrors.push(`${file.name} es demasiado grande (máx. 5MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (newErrors.length > 0) {
      setErrors(prev => ({ ...prev, photos: newErrors.join(', ') }));
      return;
    }

    // Check total photos limit
    const totalPhotos = formData.photos.length + validFiles.length;
    if (totalPhotos > maxPhotos) {
      setErrors(prev => ({
        ...prev,
        photos: `Máximo ${maxPhotos} fotos permitidas. Ya tienes ${formData.photos.length}.`
      }));
      return;
    }

    // Add photos
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...validFiles]
    }));

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(prev => [...prev, {
          file,
          preview: e.target.result,
          id: Date.now() + Math.random()
        }]);
      };
      reader.readAsDataURL(file);
    });

    setErrors(prev => ({ ...prev, photos: null }));
  }, [formData.photos]);

  // Remove photo
  const removePhoto = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
    setPhotoPreview(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validate form
      const validation = validateUrgentRequest({
        description: formData.description,
        location,
        radiusKm: formData.radiusKm,
        photos: formData.photos
      });

      if (!validation.isValid) {
        setErrors(validation.errors.reduce((acc, error) => {
          if (error.includes('descripción')) acc.description = error;
          else if (error.includes('ubicación')) acc.location = error;
          else if (error.includes('radio')) acc.radiusKm = error;
          else if (error.includes('foto')) acc.photos = error;
          return acc;
        }, {}));
        setLoading(false);
        return;
      }

      // Create request
      const requestData = {
        description: formData.description,
        location,
        radiusKm: formData.radiusKm,
        serviceCategory: formData.serviceCategory,
        photos: formData.photos
      };

      const newRequest = await createRequest(requestData);

      // Close form and navigate
      if (onClose) onClose();
      navigate(`/urgent/${newRequest.id}/status`);

    } catch (error) {
      console.error('Error creating urgent request:', error);
      setErrors({ general: error.message || 'Error al crear la solicitud urgente' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.493-1.646 1.743-2.98l-4.243-5.5a3.54 3.54 0 00-.514-1.332l-1.243-2.24a1.5 1.5 0 00-.514-1.332l-4.243-5.5A1.5 1.5 0 004.14 4.5L6.5 5.5c1.046.667 1.7 1.81 1.7 3.135 0 .88-.34 1.684-.916 2.257L4.5 7.5A1.5 1.5 0 004.5 5.5L2 4.5A1.5 1.5 0 001.5 3H1c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v6.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 018 9.5V8" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Solicitud Urgente</h1>
            <p className="text-red-100 text-sm">Servicio de emergencia disponible 24/7</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6">
        {errors.general && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <p className="text-red-700 font-medium">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-2">
              ¿Cuál es el problema urgente? *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 text-gray-900 placeholder-gray-500 resize-none ${
                errors.description ? 'border-red-500' : 'border-gray-200'
              }`}
              rows="4"
              placeholder="Describe detalladamente el problema que necesitas resolver urgentemente..."
              required
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Sé específico: qué sucede, desde cuándo, síntomas, etc.
            </p>
          </div>

          {/* Service Category */}
          <div>
            <label htmlFor="serviceCategory" className="block text-sm font-semibold text-gray-900 mb-2">
              Tipo de servicio *
            </label>
            <select
              id="serviceCategory"
              name="serviceCategory"
              value={formData.serviceCategory}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 text-gray-900"
            >
              <option value="general">Servicio General</option>
              <option value="plomero">Plomería</option>
              <option value="electricista">Electricidad</option>
              <option value="albañil">Albañilería</option>
              <option value="pintor">Pintura</option>
              <option value="gasista">Gas</option>
              <option value="herrero">Herrería</option>
              <option value="carpintero">Carpintería</option>
              <option value="jardinero">Jardinería</option>
              <option value="mecanico">Mecánica</option>
              <option value="informatica">Informática</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Ubicación *
            </label>

            {!location ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-all duration-300 text-blue-700 font-medium disabled:opacity-50"
                >
                  {locationLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                      Obteniendo ubicación...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Compartir mi ubicación actual
                    </>
                  )}
                </button>

                {errors.location && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {errors.location}
                  </p>
                )}

                <p className="text-sm text-gray-500">
                  Necesitamos tu ubicación para encontrar profesionales cercanos disponibles.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-green-800 font-medium">Ubicación compartida</p>
                    <p className="text-green-600 text-sm">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="text-green-600 hover:text-green-800 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Radius */}
          <div>
            <label htmlFor="radiusKm" className="block text-sm font-semibold text-gray-900 mb-2">
              Radio de búsqueda: {formData.radiusKm} km
            </label>
            <input
              type="range"
              id="radiusKm"
              name="radiusKm"
              min="1"
              max="50"
              value={formData.radiusKm}
              onChange={(e) => setFormData(prev => ({ ...prev, radiusKm: parseInt(e.target.value) }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 km</span>
              <span>25 km</span>
              <span>50 km</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Buscaremos profesionales dentro de este radio desde tu ubicación.
            </p>
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Fotos del problema (opcional)
            </label>

            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={formData.photos.length >= maxPhotos}
                className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition-all duration-300 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {formData.photos.length >= maxPhotos ? 'Límite alcanzado' : 'Seleccionar fotos'}
                <span className="ml-1 text-sm">
                  ({formData.photos.length}/{maxPhotos})
                </span>
              </button>

              {errors.photos && (
                <p className="text-sm text-red-600">{errors.photos}</p>
              )}

              {/* Photo Previews */}
              {photoPreview.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photoPreview.map((photo, index) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.preview}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-gray-500">
                Máximo {maxPhotos} fotos, 5MB cada una. Formatos: JPG, PNG, GIF
              </p>
            </div>
          </div>

          {/* Price Estimate */}
          {priceEstimate && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <div>
                  <p className="text-blue-800 font-medium">Precio estimado</p>
                  <p className="text-blue-600 text-lg font-bold">
                    ${priceEstimate.toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Important Information */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-yellow-800 font-medium">Información importante</h4>
                <ul className="mt-1 text-yellow-700 text-sm space-y-1">
                  <li>• Los servicios urgentes tienen precios especiales</li>
                  <li>• Recibirás notificaciones cuando un profesional acepte</li>
                  <li>• Solo el primer profesional que acepte será asignado</li>
                  <li>• Puedes cancelar la solicitud en cualquier momento</li>
                  <li>• Las fotos ayudan a los profesionales a entender mejor el problema</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 font-medium"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !location}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-6 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creando solicitud...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Enviar Solicitud Urgente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UrgentRequestForm;