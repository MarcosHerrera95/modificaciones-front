import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/apiService';

/**
 * ReviewContext
 * Contexto global para gestión de reseñas y valoraciones
 *
 * Proporciona estado centralizado para:
 * - Reseñas de profesionales
 * - Estado de carga y errores
 * - Métodos para crear, leer y gestionar reseñas
 */

const ReviewContext = createContext();

export const ReviewProvider = ({ children }) => {
  const { user } = useAuth();

  // Estado de reseñas por profesional
  const [reviewsByProfessional, setReviewsByProfessional] = useState(new Map());
  const [reviewsLoading, setReviewsLoading] = useState(new Set());
  const [reviewsError, setReviewsError] = useState(new Map());

  // Estado de envío de reseñas
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  /**
   * Cargar reseñas de un profesional
   */
  const loadProfessionalReviews = useCallback(async (professionalId, page = 1, force = false) => {
    if (!professionalId) return;

    const cacheKey = `${professionalId}-${page}`;

    // Si ya está cargando o tiene datos y no es forzado, no recargar
    if (reviewsLoading.has(cacheKey) || (reviewsByProfessional.has(cacheKey) && !force)) {
      return;
    }

    try {
      setReviewsLoading(prev => new Set(prev).add(cacheKey));
      setReviewsError(prev => new Map(prev).set(cacheKey, null));

      const response = await api.get(`/api/reviews/professional/${professionalId}?page=${page}&limit=10`);

      setReviewsByProfessional(prev => new Map(prev).set(cacheKey, response));
      console.log('✅ Reviews loaded for professional:', professionalId);
    } catch (error) {
      console.error('❌ Error loading reviews:', error);
      setReviewsError(prev => new Map(prev).set(cacheKey, error.message));
    } finally {
      setReviewsLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(cacheKey);
        return newSet;
      });
    }
  }, []);

  /**
   * Enviar una nueva reseña
   */
  const submitReview = useCallback(async (reviewData, onSuccess) => {
    try {
      setSubmittingReview(true);
      setSubmitError(null);

      const formData = new FormData();
      formData.append('servicio_id', reviewData.servicio_id);
      formData.append('calificacion', reviewData.calificacion);
      formData.append('comentario', reviewData.comentario);
      if (reviewData.url_foto) {
        formData.append('url_foto', reviewData.url_foto);
      }

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar la reseña');
      }

      const newReview = await response.json();

      // Limpiar caché de reseñas del profesional
      const professionalId = newReview.profesional_id;
      setReviewsByProfessional(prev => {
        const newMap = new Map(prev);
        // Limpiar todas las páginas del profesional
        for (const key of newMap.keys()) {
          if (key.startsWith(`${professionalId}-`)) {
            newMap.delete(key);
          }
        }
        return newMap;
      });

      console.log('✅ Review submitted successfully');
      onSuccess?.(newReview);
      return { success: true, review: newReview };
    } catch (error) {
      console.error('❌ Error submitting review:', error);
      setSubmitError(error.message);
      return { success: false, error: error.message };
    } finally {
      setSubmittingReview(false);
    }
  }, []);

  /**
   * Verificar elegibilidad para reseñar
   */
  const checkReviewEligibility = useCallback(async (servicioId) => {
    try {
      const response = await fetch(`/api/reviews/check/${servicioId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error verificando elegibilidad');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error checking review eligibility:', error);
      return { canReview: false, reason: 'Error de conexión' };
    }
  }, []);

  /**
   * Calcular promedio de calificaciones
   */
  const calculateAverageRating = useCallback((reviews) => {
    if (!reviews || reviews.length === 0) return 0;

    const sum = reviews.reduce((acc, review) => acc + review.calificacion, 0);
    return sum / reviews.length;
  }, []);

  /**
   * Limpiar estado al cambiar de usuario
   */
  const clearReviewsData = useCallback(() => {
    setReviewsByProfessional(new Map());
    setReviewsLoading(new Set());
    setReviewsError(new Map());
    setSubmitError(null);
  }, []);

  // Limpiar datos cuando el usuario cambia
  useEffect(() => {
    if (!user) {
      clearReviewsData();
    }
  }, [user, clearReviewsData]);

  const value = {
    // Estado
    reviewsByProfessional,
    reviewsLoading,
    reviewsError,
    submittingReview,
    submitError,

    // Métodos
    loadProfessionalReviews,
    submitReview,
    checkReviewEligibility,
    calculateAverageRating,
    clearReviewsData
  };

  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  );
};

export const useReviews = () => {
  const context = React.useContext(ReviewContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewProvider');
  }
  return context;
};

export default ReviewContext;