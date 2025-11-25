// src/components/AvailabilityEditor.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const AvailabilityEditor = ({ professionalId, onSlotCreated, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    recurrence_type: 'single',
    start_datetime: '',
    end_datetime: '',
    timezone: 'America/Argentina/Buenos_Aires',
    meta: {
      slot_duration: 60, // minutos
      buffer_minutes: 15,
      days: [] // Para recurrencia semanal
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/advanced-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        alert('✅ Disponibilidad creada exitosamente');

        if (onSlotCreated) {
          onSlotCreated(result.availability);
        }

        if (onClose) {
          onClose();
        }
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creando disponibilidad:', error);
      alert('❌ Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecurrenceChange = (type) => {
    setFormData(prev => ({
      ...prev,
      recurrence_type: type,
      meta: {
        ...prev.meta,
        days: type === 'weekly' ? [] : undefined
      }
    }));
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        days: prev.meta.days.includes(day)
          ? prev.meta.days.filter(d => d !== day)
          : [...prev.meta.days, day]
      }
    }));
  };

  const daysOfWeek = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Crear Disponibilidad</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Tipo de recurrencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Disponibilidad
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'single', label: 'Única vez', icon: '📅' },
                { value: 'daily', label: 'Diaria', icon: '📆' },
                { value: 'weekly', label: 'Semanal', icon: '🗓️' },
                { value: 'monthly', label: 'Mensual', icon: '📊' }
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRecurrenceChange(option.value)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    formData.recurrence_type === option.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.icon}</div>
                  <div className="text-sm font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fechas y horas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha y Hora de Inicio
              </label>
              <input
                type="datetime-local"
                value={formData.start_datetime}
                onChange={(e) => setFormData({...formData, start_datetime: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha y Hora de Fin
              </label>
              <input
                type="datetime-local"
                value={formData.end_datetime}
                onChange={(e) => setFormData({...formData, end_datetime: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Días de la semana (solo para semanal) */}
          {formData.recurrence_type === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Días de la Semana
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {daysOfWeek.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={`p-2 rounded-lg border text-sm transition-all ${
                      formData.meta.days.includes(day.value)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Configuración avanzada */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Configuración Avanzada</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duración de Slots (minutos)
                </label>
                <select
                  value={formData.meta.slot_duration}
                  onChange={(e) => setFormData({
                    ...formData,
                    meta: {...formData.meta, slot_duration: parseInt(e.target.value)}
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1.5 horas</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buffer entre Servicios (minutos)
                </label>
                <select
                  value={formData.meta.buffer_minutes}
                  onChange={(e) => setFormData({
                    ...formData,
                    meta: {...formData.meta, buffer_minutes: parseInt(e.target.value)}
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value={0}>Sin buffer</option>
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                </select>
              </div>
            </div>
          </div>

          {/* Zona horaria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zona Horaria
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="America/Argentina/Buenos_Aires">Argentina (Buenos Aires)</option>
              <option value="America/Argentina/Cordoba">Argentina (Córdoba)</option>
              <option value="America/Santiago">Chile (Santiago)</option>
              <option value="America/Montevideo">Uruguay (Montevideo)</option>
            </select>
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando...
                </span>
              ) : (
                'Crear Disponibilidad'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AvailabilityEditor;