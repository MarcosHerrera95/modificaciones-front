import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import NotificationCenter from './NotificationCenter';

const NotificationBell = () => {
  const { user } = useAuth();
  const { unreadCount } = useContext(NotificationContext);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  // El estado de notificaciones ahora se maneja en NotificationContext

  if (!user) return null;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowNotificationCenter(!showNotificationCenter)}
          className="relative p-2 text-gray-700 hover:text-emerald-600 transition-colors duration-200"
          aria-label="Notificaciones"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM14 20a2 2 0 01-2 2H8a2 2 0 01-2-2 2 2 0 012-2h2a2 2 0 012 2zM12 2a6 6 0 00-6 6v6a3 3 0 01-3 3H3a1 1 0 010-2h1a1 1 0 001-1V8a8 8 0 0116 0v6a1 1 0 001 1h1a1 1 0 010 2h-1a3 3 0 01-3-3V8a6 6 0 00-6-6z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      <NotificationCenter
        isOpen={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
      />
    </>
  );
};

export default NotificationBell;
