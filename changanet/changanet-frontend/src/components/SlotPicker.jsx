// src/components/SlotPicker.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const SlotPicker = ({
  professionalId,
  professionalName,
  serviceId,
  onAppointmentCreated,
  onClose
}) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    notes: '',
    service_description: ''
  });

  useEffect(() => {
    fetchAvailability();
  }, [professionalId, selectedDate]);

  const fetchAvailability = async () => {
    if (!professionalId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/advanced-availability/${professionalId}?from=${selectedDate}&to=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailability(data.slots || []);
      } else {
        console.error('Error cargando disponibilidad');
        setAvailability([]);
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setAvailability([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slot) => {
    if (!slot.is_available) return;

    setBookingSlot(slot);
    setShowBookingModal(true);
  };

  const handleBookingConfirm = async () => {
    if (!bookingSlot || !user) return;

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({
          professional_id: professionalId,
          service_id: serviceId,
          start_datetime: bookingSlot.start_datetime,
          end_datetime: bookingSlot.end_datetime,
          notes: bookingForm.notes,
          source: 'web'
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ ¡Cita agendada exitosamente!\n\nRecibirás una confirmación por email y notificación push.`);

        if (onAppointmentCreated) {
          onAppointmentCreated(data.appointment);
        }

        setShowBookingModal(false);
        setBookingSlot(null);
        // Actualizar disponibilidad
        fetchAvailability();
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error agendando cita:', error);
      alert('❌ Error de conexión. Inténtalo de nuevo.');
    }
  };

  const getNextDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('es-AR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        }),
        isToday: i === 0,
        isPast: date < today
      });
    }
    return days;
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const availableSlots = availability.filter(slot => slot.is_available);
  const unavailableSlots = availability.filter(slot => !slot.is_available);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Seleccionar Horario</h3>
          <p className="text-gray-600">con {professionalName}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl"
        >
          ×
        </button>
      </div>

      {/* Selector de fechas */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-3">Seleccionar Fecha</h4>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {getNextDays().map(day => (
            <button
              key={day.value}
              onClick={() => setSelectedDate(day.value)}
              disabled={day.isPast}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedDate === day.value
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : day.isPast
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : day.isToday
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {day.label}
              {day.isToday && <span className="ml-1 text-xs">(Hoy)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de horarios */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-800">
            Horarios para {new Date(selectedDate).toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </h4>
          <div className="text-sm text-gray-600">
            {availableSlots.length} disponible{availableSlots.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando horarios disponibles...</p>
          </div>
        ) : availableSlots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableSlots.map(slot => (
              <button
                key={slot.id}
                onClick={() => handleSlotSelect(slot)}
                className="p-4 border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100 rounded-xl text-left transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">
                        {formatTime(slot.start_datetime).split(':')[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800">
                        {formatTime(slot.start_datetime)} - {formatTime(slot.end_datetime)}
                      </p>
                      <p className="text-sm text-emerald-600">
                        {Math.round((new Date(slot.end_datetime) - new Date(slot.start_datetime)) / (1000 * 60))} min
                      </p>
                    </div>
                  </div>
                  <div className="text-emerald-600">
                    <span className="text-lg">📅</span>
                  </div>
                </div>
                <p className="text-xs text-emerald-700">
                  Hacer clic para agendar
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <div className="text-gray-400 text-4xl mb-4">📅</div>
            <h5 className="text-lg font-semibold text-gray-600 mb-2">
              No hay horarios disponibles
            </h5>
            <p className="text-gray-500">
              El profesional no tiene disponibilidad para esta fecha.
              Intenta seleccionar otra fecha.
            </p>
          </div>
        )}

        {/* Horarios no disponibles */}
        {unavailableSlots.length > 0 && (
          <div className="mt-6">
            <h5 className="text-sm font-medium text-gray-500 mb-3">
              Horarios no disponibles ({unavailableSlots.length})
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {unavailableSlots.map(slot => (
                <div
                  key={slot.id}
                  className="p-3 bg-gray-100 rounded-lg opacity-60"
                  title={slot.conflict_reason || 'Horario ocupado'}
                >
                  <p className="text-sm text-gray-600">
                    {formatTime(slot.start_datetime)} - {formatTime(slot.end_datetime)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {slot.conflict_reason || 'No disponible'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación de agendamiento */}
      {showBookingModal && bookingSlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Confirmar Agendamiento</h3>
            </div>

            <div className="px-6 py-4">
              <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-emerald-800 mb-2">Detalles de la Cita</h4>
                <div className="space-y-2 text-emerald-700">
                  <p><strong>Profesional:</strong> {professionalName}</p>
                  <p><strong>Fecha:</strong> {new Date(bookingSlot.start_datetime).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}</p>
                  <p><strong>Horario:</strong> {formatTime(bookingSlot.start_datetime)} - {formatTime(bookingSlot.end_datetime)}</p>
                  <p><strong>Duración:</strong> {Math.round((new Date(bookingSlot.end_datetime) - new Date(bookingSlot.start_datetime)) / (1000 * 60))} minutos</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción del servicio (opcional)
                </label>
                <textarea
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm({...bookingForm, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Describe brevemente el servicio que necesitas..."
                />
              </div>

              <div className="bg-blue-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️</strong> Al confirmar, recibirás una notificación push y email de confirmación.
                  El profesional será notificado automáticamente.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  setBookingSlot(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBookingConfirm}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Confirmar Agendamiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotPicker;