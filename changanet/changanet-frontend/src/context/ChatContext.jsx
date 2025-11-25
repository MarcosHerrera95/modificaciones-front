/**
 * ChatContext - Estado global centralizado para el sistema de chat
 * Implementa gestión de estado unificada para toda la funcionalidad de chat
 * 
 * CARACTERÍSTICAS:
 * - Estado centralizado de conversaciones, mensajes y conexiones
 * - Gestión de WebSocket con reconexión automática
 * - Manejo de notificaciones en tiempo real
 * - Optimización de rendimiento con memoización
 * 
 * CUMPLE: REQ-16, REQ-17, REQ-18, REQ-19, REQ-20 del PRD
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/socketService';

// Estado inicial del chat
const initialState = {
  // Conversaciones
  conversations: [],
  activeConversation: null,
  unreadCount: 0,
  
  // Mensajes
  messages: {},
  messageLoading: {},
  
  // Conexión
  isConnected: false,
  connectionError: null,
  reconnectAttempts: 0,
  
  // Estado de usuarios
  onlineUsers: new Set(),
  typingUsers: {},
  
  // Configuración
  settings: {
    notifications: true,
    sound: true,
    autoMarkAsRead: true
  }
};

// Tipos de acciones para el reducer
const ActionTypes = {
  // Conexión
  SET_CONNECTED: 'SET_CONNECTED',
  SET_CONNECTION_ERROR: 'SET_CONNECTION_ERROR',
  SET_RECONNECT_ATTEMPTS: 'SET_RECONNECT_ATTEMPTS',
  
  // Conversaciones
  SET_CONVERSATIONS: 'SET_CONVERSATIONS',
  ADD_CONVERSATION: 'ADD_CONVERSATION',
  UPDATE_CONVERSATION: 'UPDATE_CONVERSATION',
  SET_ACTIVE_CONVERSATION: 'SET_ACTIVE_CONVERSATION',
  
  // Mensajes
  SET_MESSAGES: 'SET_MESSAGES',
  ADD_MESSAGE: 'ADD_MESSAGE',
  UPDATE_MESSAGE: 'UPDATE_MESSAGE',
  SET_MESSAGE_LOADING: 'SET_MESSAGE_LOADING',
  MARK_MESSAGES_AS_READ: 'MARK_MESSAGES_AS_READ',
  
  // Estado de usuarios
  SET_ONLINE_USERS: 'SET_ONLINE_USERS',
  ADD_ONLINE_USER: 'ADD_ONLINE_USER',
  REMOVE_ONLINE_USER: 'REMOVE_ONLINE_USER',
  SET_TYPING_USER: 'SET_TYPING_USER',
  REMOVE_TYPING_USER: 'REMOVE_TYPING_USER',
  
  // Configuración
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  
  // Utilidades
  CLEAR_MESSAGES: 'CLEAR_MESSAGES',
  RESET_STATE: 'RESET_STATE'
};

// Reducer para manejar el estado del chat
const chatReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_CONNECTED:
      return { ...state, isConnected: action.payload, connectionError: null };
    
    case ActionTypes.SET_CONNECTION_ERROR:
      return { ...state, connectionError: action.payload };
    
    case ActionTypes.SET_RECONNECT_ATTEMPTS:
      return { ...state, reconnectAttempts: action.payload };
    
    case ActionTypes.SET_CONVERSATIONS:
      return { ...state, conversations: action.payload };
    
    case ActionTypes.ADD_CONVERSATION: {
      const exists = state.conversations.find(c => c.id === action.payload.id);
      if (exists) return state;
      return { 
        ...state, 
        conversations: [action.payload, ...state.conversations] 
      };
    }
    
    case ActionTypes.UPDATE_CONVERSATION:
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.id 
            ? { ...conv, ...action.payload.updates }
            : conv
        )
      };
    
    case ActionTypes.SET_ACTIVE_CONVERSATION:
      return { ...state, activeConversation: action.payload };
    
    case ActionTypes.SET_MESSAGES: {
      const { conversationId, messages } = action.payload;
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: messages
        }
      };
    }
    
    case ActionTypes.ADD_MESSAGE: {
      const { conversationId, message } = action.payload;
      const conversationMessages = state.messages[conversationId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: [...conversationMessages, message]
        },
        conversations: state.conversations.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              lastMessage: message,
              lastMessageAt: message.created_at
            };
          }
          return conv;
        })
      };
    }
    
    case ActionTypes.UPDATE_MESSAGE: {
      const { conversationId, messageId, updates } = action.payload;
      const conversationMessages = state.messages[conversationId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: conversationMessages.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          )
        }
      };
    }
    
    case ActionTypes.SET_MESSAGE_LOADING:
      return {
        ...state,
        messageLoading: {
          ...state.messageLoading,
          [action.payload.conversationId]: action.payload.loading
        }
      };
    
    case ActionTypes.MARK_MESSAGES_AS_READ: {
      const { conversationId, messageIds } = action.payload;
      const conversationMessages = state.messages[conversationId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: conversationMessages.map(msg =>
            messageIds.includes(msg.id) 
              ? { ...msg, status: 'read', read_at: new Date().toISOString() }
              : msg
          )
        }
      };
    }
    
    case ActionTypes.SET_ONLINE_USERS:
      return { ...state, onlineUsers: new Set(action.payload) };
    
    case ActionTypes.ADD_ONLINE_USER: {
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.add(action.payload);
      return { ...state, onlineUsers: newOnlineUsers };
    }
    
    case ActionTypes.REMOVE_ONLINE_USER: {
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.delete(action.payload);
      return { ...state, onlineUsers: newOnlineUsers };
    }
    
    case ActionTypes.SET_TYPING_USER: {
      const { conversationId, userId, isTyping } = action.payload;
      const currentTyping = state.typingUsers[conversationId] || new Set();
      const newTyping = new Set(currentTyping);
      
      if (isTyping) {
        newTyping.add(userId);
      } else {
        newTyping.delete(userId);
      }
      
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: newTyping
        }
      };
    }
    
    case ActionTypes.REMOVE_TYPING_USER: {
      const { conversationId, userId } = action.payload;
      const currentTyping = state.typingUsers[conversationId] || new Set();
      const newTyping = new Set(currentTyping);
      newTyping.delete(userId);
      
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: newTyping
        }
      };
    }
    
    case ActionTypes.UPDATE_SETTINGS:
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload
        }
      };
    
    case ActionTypes.CLEAR_MESSAGES: {
      const { conversationId } = action.payload;
      const newMessages = { ...state.messages };
      delete newMessages[conversationId];
      return { ...state, messages: newMessages };
    }
    
    case ActionTypes.RESET_STATE:
      return initialState;
    
    default:
      return state;
  }
};

// Crear el contexto
const ChatContext = createContext();

// Provider del contexto
export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef({});

  // Inicializar conexión WebSocket
  const initializeConnection = useCallback(() => {
    console.log('🔌 Inicializando conexión WebSocket...');
    
    // Configurar listeners de conexión
    socketService.addConnectionListener((isConnected) => {
      dispatch({ type: ActionTypes.SET_CONNECTED, payload: isConnected });
      
      if (isConnected) {
        dispatch({ type: ActionTypes.SET_RECONNECT_ATTEMPTS, payload: 0 });
        // Unirse a sala personal del usuario
        const user = JSON.parse(localStorage.getItem('changanet_user') || '{}');
        if (user.id) {
          socketService.joinUserRoom(user.id);
        }
      }
    });

    // Configurar listeners de mensajes
    socketService.addMessageListener('message', (message) => {
      dispatch({
        type: ActionTypes.ADD_MESSAGE,
        payload: {
          conversationId: message.conversation_id || message.conversationId,
          message
        }
      });
      
      // Reproducir sonido si está habilitado
      if (state.settings.sound) {
        playMessageSound();
      }
    });

    socketService.addMessageListener('messageSent', (data) => {
      dispatch({
        type: ActionTypes.UPDATE_MESSAGE,
        payload: {
          conversationId: data.message.conversation_id,
          messageId: data.message.id,
          updates: { status: 'sent' }
        }
      });
    });

    socketService.addMessageListener('messagesRead', (data) => {
      dispatch({
        type: ActionTypes.MARK_MESSAGES_AS_READ,
        payload: data
      });
    });

    socketService.addMessageListener('typing', (data) => {
      dispatch({
        type: ActionTypes.SET_TYPING_USER,
        payload: data
      });
      
      // Auto-clear typing después de 3 segundos
      if (data.isTyping) {
        setTimeout(() => {
          dispatch({
            type: ActionTypes.SET_TYPING_USER,
            payload: { ...data, isTyping: false }
          });
        }, 3000);
      }
    });

    // Conectar Socket.IO
    socketService.connect();
    socketRef.current = socketService;
  }, [state.settings.sound]);

  // Cargar conversaciones del usuario
  const loadConversations = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('changanet_user') || '{}');
      const token = localStorage.getItem('changanet_token');
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

      if (!user.id || !token) {
        throw new Error('Usuario no autenticado');
      }

      const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      dispatch({ type: ActionTypes.SET_CONVERSATIONS, payload: data.conversations || [] });
      
      return data.conversations;
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
      throw error;
    }
  }, []);

  // Cargar mensajes de una conversación
  const loadMessages = useCallback(async (conversationId, page = 1, limit = 50) => {
    try {
      const token = localStorage.getItem('changanet_token');
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

      dispatch({
        type: ActionTypes.SET_MESSAGE_LOADING,
        payload: { conversationId, loading: true }
      });

      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages/${conversationId}?page=${page}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      dispatch({
        type: ActionTypes.SET_MESSAGES,
        payload: { conversationId, messages: data.messages || [] }
      });

      return data.messages;
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      throw error;
    } finally {
      dispatch({
        type: ActionTypes.SET_MESSAGE_LOADING,
        payload: { conversationId, loading: false }
      });
    }
  }, []);

  // Enviar mensaje
  const sendMessage = useCallback(async (conversationId, content, type = 'text', fileUrl = null) => {
    if (!socketRef.current?.isConnected) {
      throw new Error('No hay conexión WebSocket');
    }

    const user = JSON.parse(localStorage.getItem('changanet_user') || '{}');
    if (!user.id) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Enviar via WebSocket para tiempo real
      socketRef.current.sendMessage(user.id, conversationId, content, fileUrl);
      
      // También guardar via API para persistencia
      const token = localStorage.getItem('changanet_token');
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

      const response = await fetch(`${API_BASE_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          content,
          type,
          fileUrl
        })
      });

      if (!response.ok) {
        console.warn('Error guardando mensaje via API:', response.status);
      }

    } catch (error) {
      console.error('Error enviando mensaje:', error);
      throw error;
    }
  }, []);

  // Marcar mensajes como leídos
  const markAsRead = useCallback(async (conversationId, messageIds = []) => {
    try {
      const token = localStorage.getItem('changanet_token');
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

      const response = await fetch(`${API_BASE_URL}/api/chat/messages/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          messageIds
        })
      });

      if (response.ok) {
        dispatch({
          type: ActionTypes.MARK_MESSAGES_AS_READ,
          payload: { conversationId, messageIds }
        });
      }
    } catch (error) {
      console.error('Error marcando mensajes como leídos:', error);
    }
  }, []);

  // Indicador de escritura
  const setTyping = useCallback((conversationId, isTyping) => {
    if (!socketRef.current?.isConnected) return;

    const user = JSON.parse(localStorage.getItem('changanet_user') || '{}');
    if (!user.id) return;

    socketRef.current.emit?.('typing', { conversationId, isTyping });
  }, []);

  // Función para crear o abrir conversación
  const openConversation = useCallback(async (clientId, professionalId) => {
    try {
      const token = localStorage.getItem('changanet_token');
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

      const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId,
          professionalId
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      dispatch({ type: ActionTypes.SET_ACTIVE_CONVERSATION, payload: data.conversationId });
      
      // Cargar mensajes de la conversación
      await loadMessages(data.conversationId);
      
      return data.conversationId;
    } catch (error) {
      console.error('Error abriendo conversación:', error);
      throw error;
    }
  }, [loadMessages]);

  // Configuración
  const updateSettings = useCallback((newSettings) => {
    dispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: newSettings });
  }, []);

  // Utilidad para reproducir sonido de mensaje
  const playMessageSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/message-notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Silently fail if audio can't play
      });
    } catch (error) {
      console.warn('No se pudo reproducir sonido:', error);
    }
  }, []);

  // Cleanup en desmontaje
  useEffect(() => {
    initializeConnection();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, [initializeConnection]);

  // Auto-reconexión
  useEffect(() => {
    if (!state.isConnected && state.reconnectAttempts < 5) {
      reconnectTimeoutRef.current = setTimeout(() => {
        dispatch({ type: ActionTypes.SET_RECONNECT_ATTEMPTS, payload: state.reconnectAttempts + 1 });
        socketService.connect();
      }, Math.pow(2, state.reconnectAttempts) * 1000); // Backoff exponencial
    }
  }, [state.isConnected, state.reconnectAttempts]);

  // Valor del contexto
  const contextValue = {
    // Estado
    ...state,
    
    // Acciones
    loadConversations,
    loadMessages,
    sendMessage,
    markAsRead,
    setTyping,
    openConversation,
    updateSettings,
    
    // Utilidades
    getMessages: (conversationId) => state.messages[conversationId] || [],
    isUserOnline: (userId) => state.onlineUsers.has(userId),
    getTypingUsers: (conversationId) => Array.from(state.typingUsers[conversationId] || []),
    isLoadingMessages: (conversationId) => state.messageLoading[conversationId] || false
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat debe ser usado dentro de un ChatProvider');
  }
  return context;
};

export default ChatContext;
export { ActionTypes };