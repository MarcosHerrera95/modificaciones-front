import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ImageUpload from './ImageUpload';
import { uploadProfilePicture, getFileURL } from '../services/storageService';

const ProfilePicture = ({ userId, size = 'w-24 h-24', editable = false, className = '' }) => {
  const { user } = useAuth();
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfilePicture = async () => {
      if (!userId) return;

      try {
        // INTEGRACIÓN CON FIREBASE: Obtener URL de la foto de perfil
        const result = await getFileURL(`profile-pictures/${userId}/profile.jpg`);
        if (result.success) {
          setProfileImageUrl(result.url);
        }
      } catch (error) {
        console.error('Error al cargar foto de perfil:', error);
      }
    };

    loadProfilePicture();
  }, [userId]);

  const handleImageSelect = async (file) => {
    if (!user || !editable) return;

    setLoading(true);
    setError('');

    try {
      // INTEGRACIÓN CON FIREBASE: Subir foto de perfil a Storage
      const result = await uploadProfilePicture(user.uid, file);
      if (result.success) {
        setProfileImageUrl(result.url);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error al subir la imagen');
    } finally {
      setLoading(false);
    }
  };

  const handleImageRemove = () => {
    setProfileImageUrl(null);
    setError('');
  };

  if (editable && user?.uid === userId) {
    return (
      <div className={`relative ${className}`}>
        <ImageUpload
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          placeholder="Seleccionar foto de perfil"
          showPreview={true}
          className="w-full"
          disabled={loading}
        />
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
          </div>
        )}
        {error && (
          <div className="text-red-600 text-sm mt-2">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${size} rounded-full overflow-hidden bg-gray-200 flex items-center justify-center ${className}`}>
      {profileImageUrl ? (
        <img
          src={profileImageUrl}
          alt="Foto de perfil"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-gray-400 text-2xl">👤</div>
      )}
    </div>
  );
};

export default ProfilePicture;