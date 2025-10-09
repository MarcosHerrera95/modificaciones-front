// src/components/AvailabilityCalendar.jsx
import { useState, useEffect } from 'react';

const AvailabilityCalendar = ({ professionalId }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availabilities, setAvailabilities] = useState([]);
  const [newSlot, setNewSlot] = useState({ hora_inicio: '', hora_fin: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        // INTEGRACIÓN CON BACKEND: Obtener disponibilidad
        const response = await fetch(`/api/availability/${professionalId}?date=${selectedDate}`);
        const data = await response.json();
        if (response.ok) {
          setAvailabilities(data);
        }
      } catch (error) {
        console.error('Error al cargar disponibilidad:', error);
      }
    };

    fetchAvailability();
  }, [professionalId, selectedDate]);

  const handleCreateSlot = async () => {
    if (!newSlot.hora_inicio || !newSlot.hora_fin) return;

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
          hora_inicio: `${selectedDate}T${newSlot.hora_inicio}`,
          hora_fin: `${selectedDate}T${newSlot.hora_fin}`
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
        alert('Error al eliminar el horario');
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
                  <span className={`px-2 py-1 rounded-full text-xs ${slot.está_disponible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {slot.está_disponible ? 'Disponible' : 'Ocupado'}
                  </span>
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                    title="Eliminar horario"
                  >
                    🗑️
                  </button>
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
