/**
 * Componente mejorado para crear/editar reseñas
 * Incluye validaciones robustas, sanitización y mejor experiencia de usuario
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReviews } from '../context/ReviewContext';
import ImageUpload from './ImageUpload';
import DOMPurify from 'dompurify';

const ReviewForm = ({ servicio_id, onReviewSubmitted }) => {
  const { user } = useAuth();
  const { submitReview, checkReviewEligibility, submittingReview } = useReviews();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [canReview, setCanReview] = useState(false);
  const [checkingReview, setCheckingReview] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  
  // Refs para el scroll y focus
  const commentInputRef = useRef(null);
  const formRef = useRef(null);
  
  // Límites de caracteres
  const MAX_COMMENT_LENGTH = 1000;
  const MIN_COMMENT_LENGTH = 10;
  
  // Verificar si el usuario puede dejar reseña al cargar el componente
  useEffect(() => {
    const checkEligibility = async () => {
      if (!user || !servicio_id) return;

      try {
        setCheckingReview(true);
        const data = await checkReviewEligibility(servicio_id);
        setCanReview(data.canReview);
        if (!data.canReview && data.reason) {
          setError(data.reason);
        }
      } catch (error) {
        console.error('Error verificando elegibilidad para reseña:', error);
        setCanReview(false);
        setError('Error de conexión. Inténtalo de nuevo.');
      } finally {
        setCheckingReview(false);
      }
    };

    checkEligibility();
  }, [user, servicio_id, checkReviewEligibility]);
  
  // Validar comentario en tiempo real
  useEffect(() => {
    if (comment.length > MAX_COMMENT_LENGTH) {
      setError(`El comentario no puede tener más de ${MAX_COMMENT_LENGTH} caracteres`);
    } else if (comment.length > 0 && comment.length < MIN_COMMENT_LENGTH && !previewMode) {
      setError(`El comentario debe tener al menos ${MIN_COMMENT_LENGTH} caracteres`);
    } else if (error && error.includes('caracteres')) {
      setError('');
    }
  }, [comment, MAX_COMMENT_LENGTH, MIN_COMMENT_LENGTH, error, previewMode]);
  
  // Validación de formulario
  const validateForm = () => {
    if (rating < 1 || rating > 5) {
      setError('La calificación debe estar entre 1 y 5 estrellas');
      return false;
    }
    
    if (comment.length > MAX_COMMENT_LENGTH) {
      setError(`El comentario no puede tener más de ${MAX_COMMENT_LENGTH} caracteres`);
      return false;
    }
    
    if (comment.length > 0 && comment.length < MIN_COMMENT_LENGTH) {
      setError(`El comentario debe tener al menos ${MIN_COMMENT_LENGTH} caracteres`);
      return false;
    }
    
    // Validar imagen si existe
    if (photo) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(photo.type)) {
        setError('La imagen debe ser en formato JPG, PNG o GIF');
        return false;
      }
      
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (photo.size > maxSize) {
        setError('La imagen no puede superar los 5MB');
        return false;
      }
    }
    
    return true;
  };
  
  const handleSubmit = useCallback(async (e, isPreview = false) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Si estamos en modo preview, cambiar a modo de edición
    if (isPreview) {
      setPreviewMode(false);
      // Scroll al formulario
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth' });
        // Enfocar al primer input
        if (commentInputRef.current) {
          commentInputRef.current.focus();
        }
      }
      return;
    }

    // Sanitizar comentario
    const sanitizedComment = DOMPurify.sanitize(comment.trim());

    // Validar formulario
    if (!validateForm()) {
      // Scroll al error
      const errorElement = document.querySelector('.error-message');
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const result = await submitReview({
      servicio_id,
      calificacion: rating,
      comentario: sanitizedComment,
      url_foto: photo
    }, (review) => {
      setSuccessMessage('Reseña enviada exitosamente');
      onReviewSubmitted(review);

      // Reset form
      setRating(5);
      setComment('');
      setPhoto(null);
      setCanReview(false);

      // Scroll al mensaje de éxito
      setTimeout(() => {
        const successElement = document.querySelector('.success-message');
        if (successElement) {
          successElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    });

    if (!result.success) {
      setError(result.error);
      // Scroll al error
      const errorElement = document.querySelector('.error-message');
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [servicio_id, rating, comment, photo, submitReview, onReviewSubmitted]);
  
  const handleRatingChange = (newRating) => {
    setRating(newRating);
    setError('');
  };
  
  const handleCommentChange = (e) => {
    setComment(e.target.value);
    setError('');
  };
  
  // Si está verificando la elegibilidad, mostrar mensaje de carga
  if (checkingReview) {
    return (
      <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mr-2"></div>
        <span className="text-gray-600">Verificando elegibilidad...</span>
      </div>
    );
  }
  
  // Si no puede reseñar, mostrar mensaje
  if (!canReview) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-2xl">
        <div className="flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
          {error || 'Ya has dejado una reseña para este servicio. Solo se permite una reseña por servicio.'}
        </div>
      </div>
    );
  }
  
  return (
    <div ref={formRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Mensaje de éxito */}
      {successMessage && (
        <div className="success-message bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {successMessage}
          </div>
        </div>
      )}
      
      {/* Mensaje de error */}
      {error && (
        <div className="error-message bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {/* Formulario */}
      <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
        {/* Modo de vista previa */}
        {previewMode ? (
          <div className="space-y-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-800">Vista previa de tu reseña</h3>
            
            {/* Vista previa de calificación */}
            <div>
              <p className="text-sm text-gray-500 mb-2">Calificación</p>
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                    aria-hidden="true"
                  >
                    ⭐
                  </span>
                ))}
                <span className="ml-2 text-sm text-gray-600">({rating}/5)</span>
              </div>
            </div>
            
            {/* Vista previa de comentario */}
            {comment && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Comentario</p>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-gray-700">{comment}</p>
                </div>
              </div>
            )}
            
            {/* Vista previa de imagen */}
            {photo && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Foto</p>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt="Vista previa"
                    className="max-h-64 rounded-lg mx-auto"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Rating */}
            <div>
              <label className="block text-gray-700 font-medium mb-3">
                Calificación
              </label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleRatingChange(star)}
                    className={`text-3xl transition-colors duration-200 ${
                      star <= rating ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'
                    }`}
                    aria-label={`Calificar con ${star} estrella${star > 1 ? 's' : ''}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {rating === 1 && 'Muy malo'}
                {rating === 2 && 'Malo'}
                {rating === 3 && 'Regular'}
                {rating === 4 && 'Bueno'}
                {rating === 5 && 'Excelente'}
              </p>
            </div>
            
            {/* Comment */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Comentario
              </label>
              <textarea
                ref={commentInputRef}
                value={comment}
                onChange={handleCommentChange}
                className={`w-full px-4 py-3 border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400 resize-none ${
                  comment.length > MAX_COMMENT_LENGTH ? 'border-red-300' : 'border-gray-200'
                }`}
                rows={4}
                placeholder="Comparte tu experiencia con este servicio..."
                maxLength={MAX_COMMENT_LENGTH}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  Mínimo {MIN_COMMENT_LENGTH} caracteres
                </p>
                <p className={`text-xs ${comment.length > MAX_COMMENT_LENGTH ? 'text-red-500' : 'text-gray-500'}`}>
                  {comment.length}/{MAX_COMMENT_LENGTH}
                </p>
              </div>
            </div>
            
            {/* Photo Upload */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Foto (opcional)
              </label>
              <ImageUpload
                onImageSelect={(file) => setPhoto(file)}
                onImageRemove={() => setPhoto(null)}
                placeholder="Seleccionar foto de la reseña"
              />
            </div>
          </>
        )}
        
        {/* Botones de acción */}
        <div className="flex flex-wrap gap-4 pt-4">
          {!previewMode ? (
            <>
              {/* Botón de vista previa */}
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                className="bg-gray-600 text-white px-6 py-3 rounded-2xl hover:bg-gray-700 transition-colors font-medium"
              >
                Vista previa
              </button>
              
              {/* Botón de enviar */}
              <button
                type="submit"
                disabled={submittingReview}
                className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 py-3 rounded-2xl hover:from-amber-500 hover:to-orange-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
              >
                {submittingReview ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Enviando reseña...
                  </>
                ) : (
                  <>
                    <span className="mr-2">⭐</span>
                    Enviar Reseña
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Botones de vista previa */}
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="bg-gray-600 text-white px-6 py-3 rounded-2xl hover:bg-gray-700 transition-colors font-medium"
              >
                Editar reseña
              </button>
              
              {/* Botón de enviar desde vista previa */}
              <button
                type="button"
                onClick={(e) => handleSubmit(e, false)}
                disabled={submittingReview}
                className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 py-3 rounded-2xl hover:from-amber-500 hover:to-orange-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
              >
                {submittingReview ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Enviando reseña...
                  </>
                ) : (
                  <>
                    <span className="mr-2">⭐</span>
                    Confirmar y enviar
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default ReviewForm;
