import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import notificationService from '../services/notificationService';

const NotificationPreferences = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Tipos de notificación disponibles
  const notificationTypes = [
    { key: 'system', label: 'Notificaciones del Sistema', description: 'Actualizaciones importantes de la plataforma' },
    { key: 'message', label: 'Mensajes', description: 'Nuevos mensajes de chat' },
    { key: 'payment', label: 'Pagos', description: 'Confirmaciones y actualizaciones de pagos' },
    { key: 'urgent', label: 'Servicios Urgentes', description: 'Solicitudes de servicios urgentes' },
    { key: 'review', label: 'Reseñas', description: 'Nuevas reseñas y valoraciones' },
    { key: 'admin', label: 'Administrativas', description: 'Comunicados administrativos' }
  ];

  useEffect(() => {
    if (isOpen && user) {
      loadPreferences();
    }
  }, [isOpen, user]);

  const loadPreferences = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationService.getUserPreferences(user.id);
      setPreferences(data);
    } catch (err) {
      console.error('Error loading preferences:', err);
      setError('Error al cargar preferencias');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (type, channel, value) => {
    setPreferences(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [channel]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await notificationService.updateUserPreferences(user.id, preferences);
      onClose();
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('Error al guardar preferencias');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to defaults
    const defaults = {};
    notificationTypes.forEach(type => {
      defaults[type.key] = { inapp: true, push: true, email: true };
    });
    setPreferences(defaults);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Preferencias de Notificación</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Configura cómo quieres recibir las notificaciones de Changánet
          </p>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={loadPreferences}
                className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {notificationTypes.map(type => (
                <div key={type.key} className="border border-gray-200 rounded-lg p-4">
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-800">{type.label}</h3>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* In-App */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`${type.key}-inapp`}
                        checked={preferences[type.key]?.inapp ?? true}
                        onChange={(e) => handlePreferenceChange(type.key, 'inapp', e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor={`${type.key}-inapp`} className="text-sm text-gray-700">
                        En la app
                      </label>
                    </div>

                    {/* Push */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`${type.key}-push`}
                        checked={preferences[type.key]?.push ?? true}
                        onChange={(e) => handlePreferenceChange(type.key, 'push', e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor={`${type.key}-push`} className="text-sm text-gray-700">
                        Push móvil
                      </label>
                    </div>

                    {/* Email */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`${type.key}-email`}
                        checked={preferences[type.key]?.email ?? true}
                        onChange={(e) => handlePreferenceChange(type.key, 'email', e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor={`${type.key}-email`} className="text-sm text-gray-700">
                        Email
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={saving}
            >
              Restablecer
            </button>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferences;