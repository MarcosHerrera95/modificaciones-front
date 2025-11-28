// src/components/AvailabilityCalendar.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AvailabilityEditor from './AvailabilityEditor';

const AvailabilityCalendar = ({ professionalId, onScheduleService }) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availabilities, setAvailabilities] = useState([]);
  const [newSlot, setNewSlot] = useState({ hora_inicio: '', hora_fin: '' });
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const fetchAvailability = async () => {
    try {
      // INTEGRACIÓN CON BACKEND: Obtener disponibilidad
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/availability/${professionalId}?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setAvailabilities(data.slots || []);
      } else {
        console.error('Error al cargar disponibilidad:', data.error);
        setAvailabilities([]);
      }
    } catch (error) {
      console.error('Error al cargar disponibilidad:', error);
      setAvailabilities([]);
    }
  };

  useEffect(() => {
    if (professionalId && selectedDate) {
      fetchAvailability();
    }
  }, [professionalId, selectedDate]);

  const handleCreateSlot = async () => {
    if (!newSlot.hora_inicio || !newSlot.hora_fin) return;

    // Validar que la hora de fin sea posterior a la hora de inicio
    if (newSlot.hora_inicio >= newSlot.hora_fin) {
      alert('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }

    setLoading(true);
    try {
      // INTEGRACIÓN CON BACKEND: Crear disponibilidad
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({
          fecha: selectedDate,
          hora_inicio: `${selectedDate}T${newSlot.hora_inicio}:00`,
          hora_fin: `${selectedDate}T${newSlot.hora_fin}:00`,
          esta_disponible: true
        })
      });
      const data = await response.json();

      if (response.ok) {
        setAvailabilities(prev => [...prev, data]);
        setNewSlot({ hora_inicio: '', hora_fin: '' });
      } else {
        alert(data.error || 'Error al crear disponibilidad');
      }
    } catch (error) {
      console.error('Error al crear disponibilidad:', error);
      alert('Error de red. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (slotId, currentStatus) => {
    setToggleLoading(slotId);
    try {
      const response = await fetch(`/api/availability/${slotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({
          esta_disponible: !currentStatus
        })
      });

      if (response.ok) {
        setAvailabilities(prev => prev.map(slot =>
          slot.id === slotId ? { ...slot, esta_disponible: !currentStatus } : slot
        ));
      } else {
        const data = await response.json();
        alert(data.error || 'Error al actualizar disponibilidad');
      }
    } catch (error) {
      console.error('Error al actualizar disponibilidad:', error);
      alert('Error de red. Intenta nuevamente.');
    } finally {
      setToggleLoading(null);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este horario?')) return;

    try {
      const response = await fetch(`/api/availability/${slotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        setAvailabilities(prev => prev.filter(slot => slot.id !== slotId));
      } else {
        const data = await response.json();
        alert(data.error || 'Error al eliminar el horario');
      }
    } catch (error) {
      console.error('Error al eliminar disponibilidad:', error);
      alert('Error de red. Intenta nuevamente.');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mr-4">
            <span className="text-emerald-600 text-xl">📅</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Mi Agenda</h2>
            <p className="text-gray-600">Gestiona tu disponibilidad para clientes</p>
          </div>
        </div>
        <div className="bg-emerald-50 px-4 py-2 rounded-full">
          <span className="text-emerald-700 font-medium text-sm">
            {availabilities.length} horario{availabilities.length !== 1 ? 's' : ''} disponible{availabilities.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      <div className="mb-8">
        <label className="block text-gray-700 font-medium mb-3">📅 Seleccionar Fecha</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200"
        />
      </div>

      <div className="mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <span className="text-emerald-600 mr-2">➕</span>
          Agregar Nuevo Horario
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Hora inicio</label>
            <input
              type="time"
              value={newSlot.hora_inicio}
              onChange={(e) => setNewSlot({...newSlot, hora_inicio: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200"
            />
          </div>
          <div className="md:col-span-1 flex items-center justify-center">
            <span className="text-gray-500 text-xl">→</span>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Hora fin</label>
            <input
              type="time"
              value={newSlot.hora_fin}
              onChange={(e) => setNewSlot({...newSlot, hora_fin: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200"
            />
          </div>
        </div>
        <div className="mt-4 flex space-x-3">
          <button
            onClick={() => setShowEditor(true)}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg"
          >
            <span className="flex items-center justify-center">
              <span className="mr-2">⚡</span>
              Crear Disponibilidad Avanzada
            </span>
          </button>
          <button
            onClick={handleCreateSlot}
            disabled={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Agregando...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <span className="mr-2">➕</span>
                Horario Rápido
              </span>
            )}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <span className="text-emerald-600 mr-2">📋</span>
            Horarios para {new Date(selectedDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Disponible</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span className="text-gray-600">No disponible</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
              <span className="text-gray-600">Reservado</span>
            </div>
          </div>
        </div>
        
        {availabilities.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {availabilities.map(slot => (
              <div 
                key={slot.id} 
                className={`p-6 rounded-2xl border-2 transition-all duration-200 hover:shadow-lg ${
                  slot.reservado_por 
                    ? 'border-gray-300 bg-gray-50' 
                    : slot.esta_disponible 
                    ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-300' 
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                      slot.reservado_por 
                        ? 'bg-gray-200' 
                        : slot.esta_disponible 
                        ? 'bg-emerald-200' 
                        : 'bg-red-200'
                    }`}>
                      <span className={`font-bold text-lg ${
                        slot.reservado_por 
                          ? 'text-gray-600' 
                          : slot.esta_disponible 
                          ? 'text-emerald-700' 
                          : 'text-red-700'
                      }`}>
                        {new Date(slot.hora_inicio).toLocaleTimeString([], {hour: '2-digit'})}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-800">
                        {new Date(slot.hora_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(slot.hora_fin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {new Date(slot.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    slot.reservado_por 
                      ? 'bg-gray-200 text-gray-700' 
                      : slot.esta_disponible 
                      ? 'bg-emerald-200 text-emerald-800' 
                      : 'bg-red-200 text-red-800'
                  }`}>
                    {slot.reservado_por ? 'Reservado' : slot.esta_disponible ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
                
                <div className="flex justify-end space-x-2">
                  {onScheduleService && slot.esta_disponible && !slot.reservado_por ? (
                    <button
                      disabled={toggleLoading === slot.id}
                      onClick={async () => {
                        try {
                          setToggleLoading(slot.id); // Use loading state for booking

                          // Validar disponibilidad en tiempo real antes de agendar
                          const checkResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/availability/${professionalId}?date=${selectedDate}`, {
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
                            }
                          });

                          if (!checkResponse.ok) {
                            throw new Error('Error al verificar disponibilidad. Inténtalo de nuevo.');
                          }

                          const currentAvailability = await checkResponse.json();
                          const currentSlot = currentAvailability.find(s => s.id === slot.id);

                          if (!currentSlot) {
                            alert('⚠️ Este horario ya no existe. Refresca la página.');
                            setAvailabilities(currentAvailability);
                            return;
                          }

                          if (!currentSlot.esta_disponible || currentSlot.reservado_por) {
                            alert('⚠️ Este horario ya no está disponible. Por favor, selecciona otro.');
                            setAvailabilities(currentAvailability);
                            return;
                          }

                          await onScheduleService(slot);
                          // Refresh availability after successful booking
                          fetchAvailability();
                        } catch (error) {
                          console.error('Error agendando servicio:', error);
                          if (error.message.includes('ya no está disponible')) {
                            alert(error.message);
                          } else {
                            alert('❌ Error al agendar el servicio. Verifica tu conexión e inténtalo de nuevo.');
                          }
                        } finally {
                          setToggleLoading(null);
                        }
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 hover:shadow-lg disabled:cursor-not-allowed"
                      title="Agendar servicio en este horario"
                    >
                      {toggleLoading === slot.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Agendando...</span>
                        </>
                      ) : (
                        <>
                          <span>📅</span>
                          <span>Agendar</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleAvailability(slot.id, slot.esta_disponible)}
                        disabled={toggleLoading === slot.id || slot.reservado_por}
                        className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-lg hover:bg-blue-50 transition-colors"
                        title={slot.esta_disponible ? 'Marcar como no disponible' : 'Marcar como disponible'}
                      >
                        {toggleLoading === slot.id ? (
                          <span className="animate-spin text-blue-600">⏳</span>
                        ) : slot.esta_disponible ? (
                          <span title="Deshabilitar">🚫</span>
                        ) : (
                          <span title="Habilitar">✅</span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        disabled={slot.reservado_por}
                        className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar horario"
                      >
                        <span>🗑️</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-2xl">
            <div className="text-gray-400 text-6xl mb-4">📅</div>
            <h4 className="text-xl font-semibold text-gray-600 mb-2">No hay horarios disponibles</h4>
            <p className="text-gray-500">Agrega nuevos horarios para que los clientes puedan agendar servicios contigo.</p>
          </div>
        )}
      </div>

      {/* Editor de Disponibilidad Avanzada */}
      {showEditor && (
        <AvailabilityEditor
          professionalId={professionalId}
          onSlotCreated={() => {
            // Actualizar la lista de disponibilidad
            fetchAvailability();
            setShowEditor(false);
          }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
};

export default AvailabilityCalendar;
