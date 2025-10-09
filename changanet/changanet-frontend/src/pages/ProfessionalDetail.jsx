// src/pages/ProfessionalDetail.jsx - Página "Mi Perfil" completamente regenerada
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const ProfessionalDetail = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('about');
  const [profile, setProfile] = useState({
    nombre: '',
    email: '',
    especialidad: '',
    anos_experiencia: '',
    zona_cobertura: '',
    tarifa_hora: '',
    descripcion: '',
    url_foto_perfil: ''
  });
  const [gallery, setGallery] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGallery();
      fetchReviews();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfile({
          nombre: data.nombre || user.name || '',
          email: data.email || user.email || '',
          especialidad: data.especialidad || '',
          anos_experiencia: data.anos_experiencia || '',
          zona_cobertura: data.zona_cobertura || '',
          tarifa_hora: data.tarifa_hora || '',
          descripcion: data.descripcion || '',
          url_foto_perfil: data.url_foto_perfil || ''
        });
        setPreview(data.url_foto_perfil || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchGallery = async () => {
    try {
      const response = await fetch('/api/gallery', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGallery(data);
      }
    } catch (error) {
      console.error('Error fetching gallery:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch('/api/reviews/professional', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('changanet_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReviews(data);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadPhoto = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      if (selectedFile) {
        // Simular subida de foto
        profile.url_foto_perfil = preview;
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        setSuccess('Perfil actualizado exitosamente.');
        setSelectedFile(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Error al actualizar el perfil.');
      }
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleAddGalleryPhoto = () => {
    // Simular agregar foto a galería
    const newPhoto = { id: Date.now(), url: 'https://placehold.co/400x300?text=Nueva+Foto' };
    setGallery(prev => [...prev, newPhoto]);
  };

  const renderStars = (rating) => {
    return '★'.repeat(Math.round(rating || 0)).padEnd(5, '☆');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-100/30 to-turquoise-100/30 rounded-full -translate-y-48 translate-x-48"></div>

          <div className="relative flex flex-col lg:flex-row items-center lg:items-start gap-8">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className="relative group">
                <div className="w-40 h-40 rounded-full border-4 border-emerald-200 bg-gray-100 flex items-center justify-center overflow-hidden shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                  {preview ? (
                    <img src={preview} alt="Foto de perfil" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <button
                  onClick={handleUploadPhoto}
                  className="absolute bottom-2 right-2 bg-emerald-500 text-white p-3 rounded-full hover:bg-emerald-600 hover:shadow-lg hover:scale-110 transition-all duration-300"
                  title="Subir foto"
                >
                  📷
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-grow text-center lg:text-left">
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-600 to-turquoise-600 bg-clip-text text-transparent mb-2">
                {profile.nombre || 'Nombre del Profesional'}
              </h1>
              <p className="text-xl text-emerald-600 font-semibold mb-4">
                {profile.especialidad || 'Especialidad'}
              </p>

              <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-6">
                <div className="flex items-center bg-amber-50 px-4 py-2 rounded-full">
                  <span className="text-amber-500 text-xl mr-2">⭐</span>
                  <span className="font-bold text-gray-800">4.8</span>
                  <span className="text-gray-500 ml-1">({reviews.length} reseñas)</span>
                </div>
                <div className="flex items-center bg-emerald-50 px-4 py-2 rounded-full">
                  <span className="text-emerald-600 text-xl mr-2">$</span>
                  <span className="font-bold text-gray-800">{profile.tarifa_hora || '0'}/hora</span>
                </div>
                <div className="flex items-center bg-blue-50 px-4 py-2 rounded-full">
                  <span className="text-blue-600 text-xl mr-2">📍</span>
                  <span className="text-gray-800">{profile.zona_cobertura || 'Zona'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-3 rounded-2xl hover:from-amber-600 hover:to-orange-600 hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold flex items-center justify-center">
                  <span className="mr-2">💰</span>
                  Solicitar Presupuesto
                </button>
                <button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-3 rounded-2xl hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold flex items-center justify-center">
                  <span className="mr-2">📅</span>
                  Agendar Servicio
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex flex-wrap">
              {[
                { id: 'about', label: 'Sobre Mí', icon: '👤' },
                { id: 'gallery', label: 'Galería de Trabajos', icon: '🖼️' },
                { id: 'reviews', label: 'Reseñas', icon: '⭐' },
                { id: 'edit', label: 'Editar Perfil', icon: '⚙️' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 font-semibold transition-all duration-300 flex-1 min-w-0 ${
                    activeTab === tab.id
                      ? 'text-emerald-600 border-b-4 border-emerald-600 bg-emerald-50'
                      : 'text-gray-500 hover:text-emerald-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'about' && (
              <div className="animate-fade-in">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Sobre Mí</h2>
                <div className="prose prose-lg max-w-none text-gray-600 mb-8">
                  {profile.descripcion || 'Soy un profesional dedicado con experiencia en mi especialidad. Me comprometo a brindar servicios de calidad con atención personalizada.'}
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-2xl font-semibold mb-4 text-gray-800">Servicios que Ofrezco</h3>
                    <ul className="space-y-3">
                      {['Servicio 1', 'Servicio 2', 'Servicio 3', 'Servicio 4'].map((service, index) => (
                        <li key={index} className="flex items-center text-gray-600">
                          <span className="text-emerald-500 mr-3">✓</span>
                          {service}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold mb-4 text-gray-800">Mi Experiencia</h3>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">🏆</span>
                        <div>
                          <h4 className="font-medium text-gray-800">{profile.anos_experiencia || '0'} años de experiencia</h4>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">🌱</span>
                        <div>
                          <h4 className="font-medium text-gray-800">Prácticas Sostenibles</h4>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">🤝</span>
                        <div>
                          <h4 className="font-medium text-gray-800">Servicio Personalizado</h4>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'gallery' && (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold text-gray-800">Galería de Trabajos</h2>
                  <button
                    onClick={handleAddGalleryPhoto}
                    className="bg-emerald-500 text-white px-6 py-3 rounded-2xl hover:bg-emerald-600 hover:shadow-lg hover:scale-105 transition-all duration-300 font-semibold flex items-center"
                  >
                    <span className="mr-2">➕</span>
                    Agregar Foto
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gallery.map(photo => (
                    <div key={photo.id} className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
                      <img
                        src={photo.url}
                        alt="Trabajo"
                        className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-lg font-medium">
                          Ver detalle
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="animate-fade-in">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Reseñas de Clientes</h2>

                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 mb-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl font-bold text-gray-800 mb-2">4.8</div>
                      <div className="flex text-amber-400 mb-2 text-2xl">
                        {renderStars(4.8)}
                      </div>
                      <p className="text-gray-600">Basado en {reviews.length} reseñas</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {reviews.map(review => (
                    <div key={review.id} className="border-b border-gray-200 pb-6 last:border-0">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mr-4">
                            <span className="text-emerald-600 font-bold text-lg">
                              {review.cliente.nombre.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800">{review.cliente.nombre}</h4>
                            <div className="flex text-amber-400">
                              {renderStars(review.calificacion)}
                            </div>
                          </div>
                        </div>
                        <span className="text-gray-500 text-sm">
                          {new Date(review.creado_en).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600">{review.comentario || 'Sin comentario'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'edit' && (
              <div className="animate-fade-in">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Editar Perfil</h2>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-6">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl mb-6">
                    {success}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-medium mb-2">Nombre</label>
                      <input
                        type="text"
                        name="nombre"
                        value={profile.nombre}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-medium mb-2">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={profile.email}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-medium mb-2">Especialidad</label>
                      <input
                        type="text"
                        name="especialidad"
                        value={profile.especialidad}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-medium mb-2">Años de Experiencia</label>
                      <input
                        type="number"
                        name="anos_experiencia"
                        value={profile.anos_experiencia}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-medium mb-2">Zona de Cobertura</label>
                      <input
                        type="text"
                        name="zona_cobertura"
                        value={profile.zona_cobertura}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-medium mb-2">Tarifa por Hora ($)</label>
                      <input
                        type="number"
                        name="tarifa_hora"
                        value={profile.tarifa_hora}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Descripción</label>
                    <textarea
                      name="descripcion"
                      value={profile.descripcion}
                      onChange={handleChange}
                      rows="6"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                      placeholder="Describe tus servicios y experiencia..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      'Guardar Cambios'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDetail;
