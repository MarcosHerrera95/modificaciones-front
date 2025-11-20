/**
 * Hook personalizado para funcionalidad de chat
 * Separado para evitar conflictos de ESLint con Fast Refresh
 */

import { useContext } from 'react';
import { ChatContext } from '../context/ChatContext';

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat debe usarse dentro de ChatProvider');
  }
  return context;
};