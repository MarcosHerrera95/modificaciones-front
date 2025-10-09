// src/components/NotificationCenter.jsx
import { useState } from 'react';

const NotificationCenter = ({ notifications, onClose, onMarkAsRead }) => {
  const [filter, setFilter] = useState('all');

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.está_leído;
    if (filter === 'read') return n.está_leído;
    return true;
  });

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });
      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        // Refrescar notificaciones
        window.location.reload();
      }
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50 border">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Notificaciones</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex space-x-2 mt-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${filter === 'all' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 text-sm rounded ${filter === 'unread' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          >
            Sin leer
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-3 py-1 text-sm rounded ${filter === 'read' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          >
            Leídas
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`p-4 border-b hover:bg-gray-50 ${!notification.está_leído ? 'bg-blue-50' : ''}`}
            >
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium">{notification.mensaje}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(notification.creado_en).toLocaleString()}
                  </p>
                </div>
                {!notification.está_leído && (
                  <button
                    onClick={() => onMarkAsRead(notification.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    Marcar como leída
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">
            No hay notificaciones
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <button
          onClick={markAllAsRead}
          className="w-full text-center text-primary hover:underline"
        >
          Marcar todas como leídas
        </button>
      </div>
    </div>
  );
};

export default NotificationCenter;
