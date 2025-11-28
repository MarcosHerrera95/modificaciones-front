import { useState, useEffect, useContext, useRef } from 'react';
import { NotificationContext } from '../context/NotificationContext';

const NotificationDropdown = ({ isOpen, onClose, position = 'right' }) => {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useContext(NotificationContext);
  const [filter, setFilter] = useState('all');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleNotificationClick = (notification) => {
    if (notification.estado === 'unread') {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.tipo) {
      case 'message': {
        const senderId = notification.data?.senderId;
        if (senderId) {
          window.location.href = `/chat?user=${senderId}`;
        }
        break;
      }
      case 'payment':
        window.location.href = '/cliente/pagos';
        break;
      case 'urgent':
        window.location.href = '/cliente/urgentes';
        break;
      case 'review':
        window.location.href = '/cliente/reseñas';
        break;
      default:
        // Stay on same page
        break;
    }
    onClose();
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return notification.estado === 'unread';
    if (filter === 'read') return notification.estado === 'read';
    return true;
  });

  const recentNotifications = filteredNotifications.slice(0, 5); // Show only 5 most recent

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 ${
        position === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-800">Notificaciones</h3>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Marcar todas como leídas
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex space-x-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filter === 'all' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filter === 'unread' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            No leídas ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div className="max-h-80 overflow-y-auto">
        {recentNotifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <div className="text-2xl mb-1">🔔</div>
            <p className="text-sm">No hay notificaciones</p>
          </div>
        ) : (
          recentNotifications.map(notification => (
            <div
              key={notification.id}
              className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                notification.estado === 'unread' ? 'bg-emerald-50' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {notification.titulo}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {notification.mensaje}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      notification.tipo === 'message' ? 'bg-blue-100 text-blue-800' :
                      notification.tipo === 'system' ? 'bg-gray-100 text-gray-800' :
                      notification.tipo === 'payment' ? 'bg-green-100 text-green-800' :
                      notification.tipo === 'urgent' ? 'bg-red-100 text-red-800' :
                      notification.tipo === 'review' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {notification.tipo === 'message' && '💬'}
                      {notification.tipo === 'system' && 'ℹ️'}
                      {notification.tipo === 'payment' && '💰'}
                      {notification.tipo === 'urgent' && '🚨'}
                      {notification.tipo === 'review' && '⭐'}
                      {!['message', 'system', 'payment', 'urgent', 'review'].includes(notification.tipo) && notification.tipo}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(notification.creado_en).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {notification.estado === 'unread' && (
                  <div className="w-2 h-2 bg-emerald-500 rounded-full ml-2 flex-shrink-0"></div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 5 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              // Open full notification center
              onClose();
              // This would need to be handled by parent component
            }}
            className="w-full text-center text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Ver todas las notificaciones ({notifications.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;