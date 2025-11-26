import { useState, useEffect, useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext';
import NotificationPreferences from './NotificationPreferences';

const NotificationCenter = ({ isOpen, onClose }) => {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, unreadCount } = useContext(NotificationContext);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [showPreferences, setShowPreferences] = useState(false);

  const handleNotificationClick = (notification) => {
    // Navegar según el tipo de notificación
    switch (notification.tipo) {
      case 'message': {
        // Navegar al chat usando parámetro ?user= (chat simplificado)
        const senderId = notification.data?.senderId;
        if (senderId) {
          window.location.href = `/chat?user=${senderId}`;
        }
        break;
      }
      case 'system': {
        // Las notificaciones del sistema pueden tener enlaces específicos
        const link = notification.data?.link;
        if (link) {
          window.location.href = link;
        }
        break;
      }
      case 'payment':
        // Navegar a pagos
        window.location.href = '/cliente/pagos';
        break;
      case 'urgent':
        // Navegar a servicios urgentes
        window.location.href = '/cliente/urgentes';
        break;
      case 'review':
        // Navegar a reseñas
        window.location.href = '/cliente/reseñas';
        break;
      default:
        // Mantener en la misma página
        break;
    }
    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.notification-center')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return notification.estado === 'unread';
    if (filter === 'read') return notification.estado === 'read';
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-16 z-50">
      <div className="notification-center bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Notificaciones</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filtros y acciones */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center mb-3">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'all' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'unread' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                No leídas ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('read')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'read' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Leídas ({notifications.length - unreadCount})
              </button>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>

        {/* Lista de notificaciones */}
        <div className="max-h-96 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">🔔</div>
              <p>No hay notificaciones {filter === 'unread' ? 'no leídas' : filter === 'read' ? 'leídas' : ''}</p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                  notification.estado === 'unread' ? 'bg-emerald-50' : ''
                }`}
                onClick={() => {
                  if (notification.estado === 'unread') {
                    markAsRead(notification.id);
                  }
                  handleNotificationClick(notification);
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {notification.titulo}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {notification.mensaje}
                    </p>
                    <div className="flex items-center mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        notification.tipo === 'message' ? 'bg-blue-100 text-blue-800' :
                        notification.tipo === 'system' ? 'bg-gray-100 text-gray-800' :
                        notification.tipo === 'payment' ? 'bg-green-100 text-green-800' :
                        notification.tipo === 'urgent' ? 'bg-red-100 text-red-800' :
                        notification.tipo === 'review' ? 'bg-yellow-100 text-yellow-800' :
                        notification.tipo === 'admin' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {notification.tipo === 'message' && '💬 Mensaje'}
                        {notification.tipo === 'system' && 'ℹ️ Sistema'}
                        {notification.tipo === 'payment' && '💰 Pago'}
                        {notification.tipo === 'urgent' && '🚨 Urgente'}
                        {notification.tipo === 'review' && '⭐ Reseña'}
                        {notification.tipo === 'admin' && '👑 Admin'}
                        {!['message', 'system', 'payment', 'urgent', 'review', 'admin'].includes(notification.tipo) && notification.tipo}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(notification.creado_en).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 ml-3">
                    {notification.estado === 'unread' && (
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    )}

                    <div className="flex space-x-1">
                      {notification.estado === 'unread' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="text-emerald-600 hover:text-emerald-700 p-1"
                          title="Marcar como leída"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Eliminar notificación"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowPreferences(true)}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Configurar preferencias
            </button>
            <p className="text-xs text-gray-500">
              Recibe notificaciones en tiempo real sobre tus actividades en Changánet
            </p>
          </div>
        </div>
      </div>

      {/* Modal de preferencias */}
      <NotificationPreferences
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />
    </div>
  );
};

export default NotificationCenter;
