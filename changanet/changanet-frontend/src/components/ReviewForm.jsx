import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const ReviewForm = ({ servicio_id, onReviewSubmitted }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('servicio_id', servicio_id);
      formData.append('calificacion', rating);
      formData.append('comentario', comment);
      if (photo) {
        formData.append('url_foto', photo);
      }

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: formData
      });

      if (response.ok) {
        const review = await response.json();
        onReviewSubmitted(review);
        // Reset form
        setRating(5);
        setComment('');
        setPhoto(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Error al enviar la reseña');
      }
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona una imagen válida');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('La imagen debe ser menor a 5MB');
        return;
      }
      setPhoto(file);
      setError('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl">
          {error}
        </div>
      )}

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
              onClick={() => setRating(star)}
              className={`text-3xl transition-colors duration-200 ${
                star <= rating ? 'text-amber-400' : 'text-gray-300'
              }`}
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
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400 resize-none"
          rows={4}
          placeholder="Comparte tu experiencia con este servicio..."
          required
        />
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-gray-700 font-medium mb-2">
          Foto (opcional)
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className="flex items-center px-4 py-2 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-emerald-500 transition-colors duration-200"
          >
            <span className="text-gray-600 mr-2">📷</span>
            <span className="text-sm text-gray-600">
              {photo ? photo.name : 'Seleccionar foto'}
            </span>
          </label>
          {photo && (
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Remover
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Máximo 5MB. Formatos: JPG, PNG, GIF
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white py-4 rounded-2xl hover:from-amber-500 hover:to-orange-600 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
      >
        {loading ? (
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
    </form>
  );
};

export default ReviewForm;
