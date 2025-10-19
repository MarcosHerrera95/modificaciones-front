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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 7v5H9v-5h6z" />
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
