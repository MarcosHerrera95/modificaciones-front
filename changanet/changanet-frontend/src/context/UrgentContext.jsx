/**
 * @component UrgentContext - Global state management for urgent services
 * @description Context provider for managing urgent request state across the application
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 */

import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { useNotificationContext } from './NotificationContext';
import { useAuth } from './AuthContext';
import * as urgentApi from '../services/urgentApi';
import socketService from '../services/socketService';

// Initial state
const initialState = {
  // User requests (for clients)
  userRequests: [],
  userRequestsLoading: false,
  userRequestsError: null,

  // Nearby requests (for professionals)
  nearbyRequests: [],
  nearbyRequestsLoading: false,
  nearbyRequestsError: null,

  // Current request being viewed
  currentRequest: null,
  currentRequestLoading: false,
  currentRequestError: null,

  // Real-time updates
  realTimeUpdates: [],
  isConnected: false,

  // Filters and pagination
  filters: {
    status: 'all',
    serviceCategory: 'all',
    radius: 5
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0
  },

  // UI state
  showCreateForm: false,
  selectedRequest: null,

  // Location
  userLocation: null,
  locationLoading: false
};

// Action types
const ACTION_TYPES = {
  // User requests
  SET_USER_REQUESTS_LOADING: 'SET_USER_REQUESTS_LOADING',
  SET_USER_REQUESTS_SUCCESS: 'SET_USER_REQUESTS_SUCCESS',
  SET_USER_REQUESTS_ERROR: 'SET_USER_REQUESTS_ERROR',
  ADD_USER_REQUEST: 'ADD_USER_REQUEST',
  UPDATE_USER_REQUEST: 'UPDATE_USER_REQUEST',
  REMOVE_USER_REQUEST: 'REMOVE_USER_REQUEST',

  // Nearby requests
  SET_NEARBY_REQUESTS_LOADING: 'SET_NEARBY_REQUESTS_LOADING',
  SET_NEARBY_REQUESTS_SUCCESS: 'SET_NEARBY_REQUESTS_SUCCESS',
  SET_NEARBY_REQUESTS_ERROR: 'SET_NEARBY_REQUESTS_ERROR',

  // Current request
  SET_CURRENT_REQUEST_LOADING: 'SET_CURRENT_REQUEST_LOADING',
  SET_CURRENT_REQUEST_SUCCESS: 'SET_CURRENT_REQUEST_SUCCESS',
  SET_CURRENT_REQUEST_ERROR: 'SET_CURRENT_REQUEST_ERROR',

  // Real-time
  ADD_REAL_TIME_UPDATE: 'ADD_REAL_TIME_UPDATE',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  CLEAR_REAL_TIME_UPDATES: 'CLEAR_REAL_TIME_UPDATES',

  // Filters and pagination
  SET_FILTERS: 'SET_FILTERS',
  SET_PAGINATION: 'SET_PAGINATION',

  // UI state
  SET_SHOW_CREATE_FORM: 'SET_SHOW_CREATE_FORM',
  SET_SELECTED_REQUEST: 'SET_SELECTED_REQUEST',

  // Location
  SET_USER_LOCATION_LOADING: 'SET_USER_LOCATION_LOADING',
  SET_USER_LOCATION_SUCCESS: 'SET_USER_LOCATION_SUCCESS',
  SET_USER_LOCATION_ERROR: 'SET_USER_LOCATION_ERROR'
};

// Reducer
function urgentReducer(state, action) {
  switch (action.type) {
    // User requests
    case ACTION_TYPES.SET_USER_REQUESTS_LOADING:
      return { ...state, userRequestsLoading: true, userRequestsError: null };
    case ACTION_TYPES.SET_USER_REQUESTS_SUCCESS:
      return {
        ...state,
        userRequests: action.payload.requests,
        userRequestsLoading: false,
        pagination: { ...state.pagination, total: action.payload.total }
      };
    case ACTION_TYPES.SET_USER_REQUESTS_ERROR:
      return { ...state, userRequestsLoading: false, userRequestsError: action.payload };
    case ACTION_TYPES.ADD_USER_REQUEST:
      return { ...state, userRequests: [action.payload, ...state.userRequests] };
    case ACTION_TYPES.UPDATE_USER_REQUEST:
      return {
        ...state,
        userRequests: state.userRequests.map(req =>
          req.id === action.payload.id ? { ...req, ...action.payload } : req
        ),
        currentRequest: state.currentRequest?.id === action.payload.id
          ? { ...state.currentRequest, ...action.payload }
          : state.currentRequest
      };
    case ACTION_TYPES.REMOVE_USER_REQUEST:
      return {
        ...state,
        userRequests: state.userRequests.filter(req => req.id !== action.payload),
        currentRequest: state.currentRequest?.id === action.payload ? null : state.currentRequest
      };

    // Nearby requests
    case ACTION_TYPES.SET_NEARBY_REQUESTS_LOADING:
      return { ...state, nearbyRequestsLoading: true, nearbyRequestsError: null };
    case ACTION_TYPES.SET_NEARBY_REQUESTS_SUCCESS:
      return { ...state, nearbyRequests: action.payload, nearbyRequestsLoading: false };
    case ACTION_TYPES.SET_NEARBY_REQUESTS_ERROR:
      return { ...state, nearbyRequestsLoading: false, nearbyRequestsError: action.payload };

    // Current request
    case ACTION_TYPES.SET_CURRENT_REQUEST_LOADING:
      return { ...state, currentRequestLoading: true, currentRequestError: null };
    case ACTION_TYPES.SET_CURRENT_REQUEST_SUCCESS:
      return { ...state, currentRequest: action.payload, currentRequestLoading: false };
    case ACTION_TYPES.SET_CURRENT_REQUEST_ERROR:
      return { ...state, currentRequestLoading: false, currentRequestError: action.payload };

    // Real-time
    case ACTION_TYPES.ADD_REAL_TIME_UPDATE:
      return {
        ...state,
        realTimeUpdates: [action.payload, ...state.realTimeUpdates.slice(0, 9)] // Keep last 10
      };
    case ACTION_TYPES.SET_CONNECTION_STATUS:
      return { ...state, isConnected: action.payload };
    case ACTION_TYPES.CLEAR_REAL_TIME_UPDATES:
      return { ...state, realTimeUpdates: [] };

    // Filters and pagination
    case ACTION_TYPES.SET_FILTERS:
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case ACTION_TYPES.SET_PAGINATION:
      return { ...state, pagination: { ...state.pagination, ...action.payload } };

    // UI state
    case ACTION_TYPES.SET_SHOW_CREATE_FORM:
      return { ...state, showCreateForm: action.payload };
    case ACTION_TYPES.SET_SELECTED_REQUEST:
      return { ...state, selectedRequest: action.payload };

    // Location
    case ACTION_TYPES.SET_USER_LOCATION_LOADING:
      return { ...state, locationLoading: true };
    case ACTION_TYPES.SET_USER_LOCATION_SUCCESS:
      return { ...state, userLocation: action.payload, locationLoading: false };
    case ACTION_TYPES.SET_USER_LOCATION_ERROR:
      return { ...state, locationLoading: false };

    default:
      return state;
  }
}

// Context
const UrgentContext = createContext();

// Provider component
export const UrgentProvider = ({ children }) => {
  const [state, dispatch] = useReducer(urgentReducer, initialState);
  const { user } = useAuth();
  const notificationContext = useNotificationContext();

  // WebSocket setup
  useEffect(() => {
    if (user?.id) {
      // Connect to WebSocket
      socketService.connect();

      // Join user room for urgent notifications
      socketService.joinUserRoom(user.id);

      // Set up urgent request listeners
      const handleUrgentUpdate = (data) => {
        console.log('Urgent request update received:', data);

        // Update request in state
        if (data.type === 'status_change') {
          dispatch({ type: ACTION_TYPES.UPDATE_USER_REQUEST, payload: data.request });
        } else if (data.type === 'new_request') {
          dispatch({ type: ACTION_TYPES.ADD_USER_REQUEST, payload: data.request });
        } else if (data.type === 'request_cancelled') {
          dispatch({ type: ACTION_TYPES.REMOVE_USER_REQUEST, payload: data.requestId });
        }

        // Add to real-time updates
        dispatch({ type: ACTION_TYPES.ADD_REAL_TIME_UPDATE, payload: {
          id: Date.now(),
          type: 'urgent_update',
          message: data.message || 'Actualización en solicitud urgente',
          timestamp: new Date()
        }});

        // Show notification
        if (notificationContext?.addNotification) {
          notificationContext.addNotification({
            type: 'info',
            title: 'Actualización Urgente',
            message: data.message || 'Hay cambios en tus solicitudes urgentes',
            duration: 5000
          });
        }
      };

      const handleNewUrgentRequest = (data) => {
        console.log('New urgent request available:', data);

        // For professionals, add to nearby requests
        if (user.tipo_usuario === 'profesional') {
          dispatch({ type: ACTION_TYPES.SET_NEARBY_REQUESTS_SUCCESS, payload: [...state.nearbyRequests, data.request] });
        }

        // Add to real-time updates
        dispatch({ type: ACTION_TYPES.ADD_REAL_TIME_UPDATE, payload: {
          id: Date.now(),
          type: 'new_urgent_request',
          message: 'Nueva solicitud urgente disponible en tu área',
          timestamp: new Date()
        }});

        // Show notification
        if (notificationContext?.addNotification) {
          notificationContext.addNotification({
            type: 'success',
            title: 'Nueva Solicitud Urgente',
            message: 'Hay una nueva solicitud de emergencia en tu área',
            duration: 7000
          });
        }
      };

      // Add WebSocket listeners
      socketService.addMessageListener('urgentRequestUpdate', handleUrgentUpdate);
      socketService.addMessageListener('newUrgentRequest', handleNewUrgentRequest);

      // Update connection status
      const handleConnectionChange = (isConnected) => {
        dispatch({ type: ACTION_TYPES.SET_CONNECTION_STATUS, payload: isConnected });
      };

      socketService.addConnectionListener(handleConnectionChange);

      // Cleanup
      return () => {
        socketService.removeMessageListener('urgentRequestUpdate', handleUrgentUpdate);
        socketService.removeMessageListener('newUrgentRequest', handleNewUrgentRequest);
        socketService.removeConnectionListener(handleConnectionChange);
      };
    }
  }, [user?.id, user?.tipo_usuario, state.nearbyRequests, notificationContext]);

  // Actions

  // User requests actions
  const loadUserRequests = useCallback(async (filters = {}) => {
    dispatch({ type: ACTION_TYPES.SET_USER_REQUESTS_LOADING });
    try {
      const requests = await urgentApi.getUserUrgentRequests({
        ...state.filters,
        ...filters,
        page: state.pagination.page,
        limit: state.pagination.limit
      });
      dispatch({
        type: ACTION_TYPES.SET_USER_REQUESTS_SUCCESS,
        payload: { requests: requests.data || requests, total: requests.total || requests.length }
      });
    } catch (error) {
      dispatch({ type: ACTION_TYPES.SET_USER_REQUESTS_ERROR, payload: error.message });
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudieron cargar las solicitudes urgentes.',
          duration: 4000
        });
      }
    }
  }, [state.filters, state.pagination, notificationContext]);

  const createRequest = useCallback(async (requestData) => {
    try {
      // Check for duplicates
      const isDuplicate = await urgentApi.checkForDuplicates(requestData.location, requestData.description);
      if (isDuplicate) {
        throw new Error('Ya existe una solicitud similar en tu área. Revisa tus solicitudes activas.');
      }

      const newRequest = await urgentApi.createUrgentRequest(requestData);
      dispatch({ type: ACTION_TYPES.ADD_USER_REQUEST, payload: newRequest });

      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'success',
          title: 'Solicitud Creada',
          message: 'Tu solicitud de servicio urgente ha sido enviada exitosamente.',
          duration: 5000
        });
      }

      return newRequest;
    } catch (error) {
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: error.message || 'Error al crear la solicitud urgente.',
          duration: 5000
        });
      }
      throw error;
    }
  }, [notificationContext]);

  const cancelRequest = useCallback(async (requestId) => {
    try {
      await urgentApi.cancelUrgentRequest(requestId);
      dispatch({ type: ACTION_TYPES.UPDATE_USER_REQUEST, payload: { id: requestId, status: 'cancelled' } });

      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'success',
          title: 'Solicitud Cancelada',
          message: 'La solicitud urgente ha sido cancelada.',
          duration: 4000
        });
      }
    } catch (error) {
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudo cancelar la solicitud.',
          duration: 4000
        });
      }
      throw error;
    }
  }, [notificationContext]);

  // Nearby requests actions (for professionals)
  const loadNearbyRequests = useCallback(async (location) => {
    if (!location) return;

    dispatch({ type: ACTION_TYPES.SET_NEARBY_REQUESTS_LOADING });
    try {
      const requests = await urgentApi.getNearbyUrgentRequests(location, state.filters);
      dispatch({ type: ACTION_TYPES.SET_NEARBY_REQUESTS_SUCCESS, payload: requests });
    } catch (error) {
      dispatch({ type: ACTION_TYPES.SET_NEARBY_REQUESTS_ERROR, payload: error.message });
    }
  }, [state.filters]);

  const acceptRequest = useCallback(async (requestId) => {
    try {
      await urgentApi.acceptUrgentRequest(requestId);
      dispatch({ type: ACTION_TYPES.UPDATE_USER_REQUEST, payload: { id: requestId, status: 'assigned' } });

      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'success',
          title: 'Solicitud Aceptada',
          message: 'Has aceptado la solicitud urgente.',
          duration: 4000
        });
      }
    } catch (error) {
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudo aceptar la solicitud.',
          duration: 4000
        });
      }
      throw error;
    }
  }, [notificationContext]);

  const rejectRequest = useCallback(async (requestId, reason) => {
    try {
      await urgentApi.rejectUrgentRequest(requestId, reason);
      // Remove from nearby requests
      dispatch({
        type: ACTION_TYPES.SET_NEARBY_REQUESTS_SUCCESS,
        payload: state.nearbyRequests.filter(req => req.id !== requestId)
      });
    } catch (error) {
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudo rechazar la solicitud.',
          duration: 4000
        });
      }
      throw error;
    }
  }, [state.nearbyRequests, notificationContext]);

  // Current request actions
  const loadRequestDetails = useCallback(async (requestId) => {
    dispatch({ type: ACTION_TYPES.SET_CURRENT_REQUEST_LOADING });
    try {
      const request = await urgentApi.getUrgentRequestStatus(requestId);
      dispatch({ type: ACTION_TYPES.SET_CURRENT_REQUEST_SUCCESS, payload: request });
    } catch (error) {
      dispatch({ type: ACTION_TYPES.SET_CURRENT_REQUEST_ERROR, payload: error.message });
    }
  }, []);

  // Real-time actions
  const addRealTimeUpdate = useCallback((update) => {
    dispatch({ type: ACTION_TYPES.ADD_REAL_TIME_UPDATE, payload: update });
  }, []);

  const setConnectionStatus = useCallback((connected) => {
    dispatch({ type: ACTION_TYPES.SET_CONNECTION_STATUS, payload: connected });
  }, []);

  const clearRealTimeUpdates = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_REAL_TIME_UPDATES });
  }, []);

  // Filter and pagination actions
  const setFilters = useCallback((filters) => {
    dispatch({ type: ACTION_TYPES.SET_FILTERS, payload: filters });
  }, []);

  const setPagination = useCallback((pagination) => {
    dispatch({ type: ACTION_TYPES.SET_PAGINATION, payload: pagination });
  }, []);

  // UI actions
  const setShowCreateForm = useCallback((show) => {
    dispatch({ type: ACTION_TYPES.SET_SHOW_CREATE_FORM, payload: show });
  }, []);

  const setSelectedRequest = useCallback((request) => {
    dispatch({ type: ACTION_TYPES.SET_SELECTED_REQUEST, payload: request });
  }, []);

  // Location actions
  const getUserLocation = useCallback(() => {
    dispatch({ type: ACTION_TYPES.SET_USER_LOCATION_LOADING });

    if (!navigator.geolocation) {
      dispatch({ type: ACTION_TYPES.SET_USER_LOCATION_ERROR });
      return Promise.reject(new Error('Geolocalización no soportada'));
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          dispatch({ type: ACTION_TYPES.SET_USER_LOCATION_SUCCESS, payload: location });
          resolve(location);
        },
        (error) => {
          dispatch({ type: ACTION_TYPES.SET_USER_LOCATION_ERROR });
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  }, []);

  // Context value
  const value = {
    // State
    ...state,

    // Actions
    loadUserRequests,
    createRequest,
    cancelRequest,
    loadNearbyRequests,
    acceptRequest,
    rejectRequest,
    loadRequestDetails,
    addRealTimeUpdate,
    setConnectionStatus,
    clearRealTimeUpdates,
    setFilters,
    setPagination,
    setShowCreateForm,
    setSelectedRequest,
    getUserLocation
  };

  return (
    <UrgentContext.Provider value={value}>
      {children}
    </UrgentContext.Provider>
  );
};

// Custom hook
export const useUrgentContext = () => {
  const context = useContext(UrgentContext);
  if (!context) {
    throw new Error('useUrgentContext must be used within an UrgentProvider');
  }
  return context;
};

export default UrgentContext;