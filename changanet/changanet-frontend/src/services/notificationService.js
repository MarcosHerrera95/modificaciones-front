/**
 * @service notificationService - Servicio cliente para notificaciones
 * @descripción Funciones para interactuar con la API de notificaciones (REQ-19)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Frontend] Implementar Servicio de Notificaciones
 * @impacto Social: API cliente accesible para gestión de notificaciones
 */

const API_BASE = '/api';

// Función para obtener notificaciones del usuario
export const getNotifications = async () => {
  const token = localStorage.getItem('changanet_token');

  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  const response = await fetch(`${API_BASE}/notifications`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Error al obtener notificaciones');
  }

  return await response.json();
};

// Función para marcar notificación como leída
export const markAsRead = async (notificationId) => {
  const token = localStorage.getItem('changanet_token');

  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Error al marcar notificación como leída');
  }

  return await response.json();
};

// Función para marcar todas las notificaciones como leídas
export const markAllAsRead = async () => {
  const token = localStorage.getItem('changanet_token');

  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  const response = await fetch(`${API_BASE}/notifications/read-all`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Error al marcar todas las notificaciones como leídas');
  }

  return await response.json();
};

// Función para eliminar una notificación
export const deleteNotification = async (notificationId) => {
  const token = localStorage.getItem('changanet_token');

  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  const response = await fetch(`${API_BASE}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Error al eliminar notificación');
  }

  return await response.json();
};