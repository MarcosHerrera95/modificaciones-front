// src/components/AvailabilityCalendar.jsx
import { useState, useEffect } from 'react';

const AvailabilityCalendar = ({ professionalId, onScheduleService }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availabilities, setAvailabilities] = useState([]);
  const [newSlot, setNewSlot] = useState({ hora_inicio: '', hora_fin: '' });
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(null);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        // INTEGRACIÓN CON BACKEND: Obtener disponibilidad
        const response = await fetch(`/api/availability/${professionalId}?date=${selectedDate}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          setAvailabilities(data);
        } else {
          console.error('Error al cargar disponibilidad:', data.error);
          setAvailabilities([]);
        }
      } catch (error) {
        console.error('Error al cargar disponibilidad:', error);
        setAvailabilities([]);
      }
    };

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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Mi Agenda</h2>
      
      <div className="mb-6">
        <label className="block text-gray-700 mb-2">Seleccionar Fecha</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Agregar Nuevo Horario</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="time"
            value={newSlot.hora_inicio}
            onChange={(e) => setNewSlot({...newSlot, hora_inicio: e.target.value})}
            className="flex-grow px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="self-center">a</span>
          <input
            type="time"
            value={newSlot.hora_fin}
            onChange={(e) => setNewSlot({...newSlot, hora_fin: e.target.value})}
            className="flex-grow px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleCreateSlot}
            disabled={loading}
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-emerald-600 transition disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Horarios Disponibles para {selectedDate}</h3>
        {availabilities.length > 0 ? (
          <div className="space-y-2">
            {availabilities.map(slot => (
              <div key={slot.id} className="flex justify-between items-center p-3 border rounded-md">
                <span>{new Date(slot.hora_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(slot.hora_fin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${slot.esta_disponible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {slot.esta_disponible ? 'Disponible' : 'Ocupado'}
                  </span>
                  {onScheduleService && slot.esta_disponible ? (
                    <button
                      onClick={async () => {
                        try {
                          await onScheduleService(slot);
                          // REQ-30: Confirmación automática al agendar
                          alert(`✅ Servicio agendado exitosamente para ${new Date(slot.hora_inicio).toLocaleString()}. Recibirás una confirmación por email y notificación push.`);
                        } catch (error) {
                          console.error('Error agendando servicio:', error);
                          alert('Error al agendar el servicio. Inténtalo de nuevo.');
                        }
                      }}
                      className="bg-emerald-500 text-white px-3 py-1 rounded text-sm hover:bg-emerald-600 transition-colors"
                      title="Agendar servicio en este horario"
                    >
                      📅 Agendar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleAvailability(slot.id, slot.esta_disponible)}
                        disabled={toggleLoading === slot.id}
                        className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                        title={slot.esta_disponible ? 'Marcar como no disponible' : 'Marcar como disponible'}
                      >
                        {toggleLoading === slot.id ? '⏳' : (slot.esta_disponible ? '❌' : '✅')}
                      </button>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        title="Eliminar horario"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No hay horarios disponibles para esta fecha.</p>
        )}
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
