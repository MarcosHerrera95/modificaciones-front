/**
 * Componente para mostrar una lista paginada de reseñas
 * Optimizado para manejar grandes volúmenes de datos
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviews } from '../context/ReviewContext';

const PaginatedReviewsList = ({ professionalId }) => {
  const { loadProfessionalReviews, reviewsByProfessional, reviewsLoading, reviewsError, calculateAverageRating } = useReviews();
  const [currentPage, setCurrentPage] = useState(1);

  // Cargar reseñas al montar el componente y cuando cambia la página
  useEffect(() => {
    if (professionalId) {
      loadProfessionalReviews(professionalId, currentPage);
    }
  }, [professionalId, currentPage, loadProfessionalReviews]);

  // Función para cambiar de página
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    // Scroll al inicio de la lista
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Obtener datos del contexto
  const cacheKey = `${professionalId}-${currentPage}`;
  const reviewData = reviewsByProfessional.get(cacheKey);
  const loading = reviewsLoading.has(cacheKey);
  const error = reviewsError.get(cacheKey);
  const reviews = reviewData?.reviews || [];
  const pagination = reviewData?.pagination || {};

  // Función para renderizar las estrellas
  const renderStars = (rating) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-lg ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            aria-hidden="true"
          >
            ★
          </span>
        ))}
        <span className="ml-2 text-sm text-gray-600" aria-label={`(${rating} de 5)`}>({rating}/5)</span>
      </div>
    );
  };

  // Función para formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Función para manejar errores
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl">
        <p>{error}</p>
        <button
          onClick={() => loadProfessionalReviews(professionalId, currentPage, true)}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Total de reseñas: {pagination.totalReviews}
            </h3>
            <p className="text-sm text-gray-600">
              Página {currentPage} de {pagination.totalPages}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de reseñas */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3 text-gray-600">Cargando reseñas...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Aún no hay reseñas
          </h3>
          <p className="text-gray-600">
            Este profesional aún no ha recibido ninguna reseña.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mr-4">
                      {review.cliente?.nombre || 'Cliente'}
                    </h3>
                    {renderStars(review.calificacion)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Fecha del servicio</p>
                      <p className="font-medium">
                        {review.servicio?.completado_en
                          ? formatDate(review.servicio.completado_en)
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Fecha de la reseña</p>
                      <p className="font-medium">{formatDate(review.creado_en)}</p>
                    </div>
                  </div>

                  {review.comentario && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">Comentario</p>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-gray-700 italic">"{review.comentario}"</p>
                      </div>
                    </div>
                  )}

                  {review.url_foto && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">Foto del servicio</p>
                      <img
                        src={review.url_foto}
                        alt="Foto del servicio"
                        className="w-32 h-32 object-cover rounded-lg border"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!pagination.hasPreviousPage}
            className={`px-4 py-2 rounded-lg ${
              pagination.hasPreviousPage
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            } transition-colors`}
          >
            Anterior
          </button>

          <div className="flex items-center space-x-2">
            {/* Mostrar números de página */}
            {[...Array(pagination.totalPages)].map((_, index) => {
              const pageNum = index + 1;
              // Mostrar solo algunas páginas para evitar demasiados botones
              const isVisiblePage =
                pageNum === 1 ||
                pageNum === pagination.totalPages ||
                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);
              
              if (!isVisiblePage) {
                // Mostrar elipsis
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return (
                    <span key={`ellipsis-${pageNum}`} className="text-gray-500">
                      ...
                    </span>
                  );
                }
                return null;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-10 h-10 rounded-lg ${
                    pageNum === currentPage
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } transition-colors`}
                  aria-label={`Página ${pageNum}`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!pagination.hasNextPage}
            className={`px-4 py-2 rounded-lg ${
              pagination.hasNextPage
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            } transition-colors`}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default PaginatedReviewsList;