// src/components/ProfessionalAvailabilityCalendar.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const ProfessionalAvailabilityCalendar = ({ 
  professionalId, 
  professionalName, 
  onScheduleService,
  className = "" 
}) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(null);

  useEffect(() => {
    fetchAvailability();
  }, [professionalId, selectedDate]);

  const fetchAvailability = async () => {
    if (!professionalId) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/availability/${professionalId}?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailabilities(data);
      } else {
        setError('Error al cargar disponibilidad');
      }
    } catch (error) {
      console.error('Error al cargar disponibilidad:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleService = async (slot) => {
    if (!user) {
      alert('Debes iniciar sesión para agendar un servicio');
      return;
    }

    if (user.rol !== 'cliente') {
      alert('Solo los clientes pueden agendar servicios');
      return;
    }

    setShowScheduleModal(slot);
  };

  const confirmSchedule = async (slot, serviceDescription) => {
    try {
      const response = await fetch(`/api/availability/${slot.id}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({
          descripcion: serviceDescription || `Servicio agendado con ${professionalName} para ${new Date(slot.fecha).toLocaleDateString()} de ${new Date(slot.hora_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} a ${new Date(slot.hora_fin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Mostrar mensaje de éxito
        alert(`✅ Servicio agendado exitosamente.\n\nRecibirás una confirmación por email y notificación push.\n\nEl profesional ${professionalName} ha sido notificado de tu reserva.`);
        
        // Actualizar la disponibilidad
        setAvailabilities(prev => 
          prev.map(s => 
            s.id === slot.id 
              ? { ...s, esta_disponible: false, reservado_por: user.id }
              : s
          )
        );

        // Llamar callback si existe
        if (onScheduleService) {
          onScheduleService(data);
        }

        setShowScheduleModal(null);
      } else {
        const data = await response.json();
        alert(`⚠️ ${data.error || 'Error al agendar el servicio'}`);
      }
    } catch (error) {
      console.error('Error agendando servicio:', error);
      alert('❌ Error al agendar el servicio. Inténtalo de nuevo.');
    }
  };

  // Generar fechas para el selector (próximos 14 días)
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
        isToday: i === 0
      });
    }
    return days;
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`}>
      <div className="flex items-center mb-6">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mr-4">
          <span className="text-emerald-600 text-xl">📅</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Disponibilidad</h3>
          <p className="text-gray-600">Selecciona una fecha para ver horarios disponibles</p>
        </div>
      </div>

      {/* Selector de fechas */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {getNextDays().map(day => (
            <button
              key={day.value}
              onClick={() => setSelectedDate(day.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedDate === day.value
                  ? 'bg-emerald-500 text-white shadow-lg'
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

      {/* Lista de disponibilidad */}
      <div>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando disponibilidad...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <p className="text-gray-600">{error}</p>
          </div>
        ) : availabilities.length > 0 ? (
          <div className="space-y-3">
            {availabilities.map(slot => (
              <div 
                key={slot.id} 
                className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                    <span className="text-emerald-600 font-semibold">
                      {new Date(slot.hora_inicio).toLocaleTimeString([], {hour: '2-digit'})}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      {new Date(slot.hora_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(slot.hora_fin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(slot.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
                
                {user && user.rol === 'cliente' && slot.esta_disponible && !slot.reservado_por ? (
                  <button
                    onClick={() => handleScheduleService(slot)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 hover:shadow-lg"
                  >
                    <span>📅</span>
                    <span>Agendar</span>
                  </button>
                ) : (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    slot.reservado_por 
                      ? 'bg-red-100 text-red-800' 
                      : slot.esta_disponible 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {slot.reservado_por ? 'Reservado' : slot.esta_disponible ? 'Disponible' : 'No disponible'}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-4">📅</div>
            <p className="text-gray-600">No hay disponibilidad para esta fecha</p>
          </div>
        )}
      </div>

      {/* Modal de confirmación de agendamiento */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Confirmar Agendamiento</h3>
            </div>
            
            <div className="px-6 py-4">
              <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-emerald-800 mb-2">Detalles del Servicio</h4>
                <p className="text-emerald-700">
                  <strong>Profesional:</strong> {professionalName}
                </p>
                <p className="text-emerald-700">
                  <strong>Fecha:</strong> {new Date(showScheduleModal.fecha).toLocaleDateString('es-AR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
                <p className="text-emerald-700">
                  <strong>Horario:</strong> {new Date(showScheduleModal.hora_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(showScheduleModal.hora_fin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción del servicio (opcional)
                </label>
                <textarea
                  id="serviceDescription"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Describe brevemente el servicio que necesitas..."
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={() => setShowScheduleModal(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const description = document.getElementById('serviceDescription').value;
                  confirmSchedule(showScheduleModal, description);
                }}
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

export default ProfessionalAvailabilityCalendar;