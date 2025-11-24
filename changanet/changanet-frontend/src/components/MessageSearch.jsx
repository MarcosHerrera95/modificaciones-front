/**
 * @component MessageSearch
 * @description Componente de búsqueda avanzada en el historial de mensajes
 * @required_by FUNCIONALIDAD ADICIONAL: Búsqueda en historial
 */

import React, { useState, useEffect } from 'react';

const MessageSearch = ({ 
  conversationId, 
  onSearchResults, 
  onClearSearch,
  disabled = false 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    includeImages: true,
    dateFrom: null,
    dateTo: null,
    senderId: null
  });

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

  // Función para realizar búsqueda
  const performSearch = async (query = searchQuery) => {
    if (!query.trim() || disabled) {
      setSearchResults([]);
      onClearSearch?.();
      return;
    }

    try {
      setIsSearching(true);
      const token = localStorage.getItem('changanet_token');
      
      const searchParams = new URLSearchParams({
        q: query,
        include_images: searchFilters.includeImages.toString(),
        ...(searchFilters.dateFrom && { date_from: searchFilters.dateFrom }),
        ...(searchFilters.dateTo && { date_to: searchFilters.dateTo }),
        ...(searchFilters.senderId && { sender_id: searchFilters.senderId })
      });

      const response = await fetch(
        `${API_BASE_URL}/api/chat/search/${conversationId}?${searchParams}`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Error en búsqueda: ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(data.messages || []);
      onSearchResults?.(data.messages || []);
      
    } catch (error) {
      console.error('Error en búsqueda de mensajes:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce para búsqueda en tiempo real
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchFilters]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchFilters({
      includeImages: true,
      dateFrom: null,
      dateTo: null,
      senderId: null
    });
    onClearSearch?.();
  };

  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  };

  return (
    <div className="bg-gray-50 border-b p-4">
      {/* Barra de búsqueda principal */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar en la conversación..."
          disabled={disabled}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Filtros de búsqueda avanzados */}
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={searchFilters.includeImages}
            onChange={(e) => setSearchFilters(prev => ({ ...prev, includeImages: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Incluir imágenes</span>
        </label>
        
        <input
          type="date"
          value={searchFilters.dateFrom || ''}
          onChange={(e) => setSearchFilters(prev => ({ ...prev, dateFrom: e.target.value || null }))}
          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
          placeholder="Fecha desde"
        />
        
        <input
          type="date"
          value={searchFilters.dateTo || ''}
          onChange={(e) => setSearchFilters(prev => ({ ...prev, dateTo: e.target.value || null }))}
          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
          placeholder="Fecha hasta"
        />
      </div>

      {/* Resultados de búsqueda */}
      {searchResults.length > 0 && (
        <div className="mt-3 p-2 bg-white rounded border max-h-64 overflow-y-auto">
          <div className="text-sm text-gray-600 mb-2">
            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
          </div>
          
          {searchResults.map((result) => (
            <div 
              key={result.id} 
              className="p-2 hover:bg-gray-50 rounded cursor-pointer border-b last:border-b-0"
              onClick={() => {
                // Scroll to message in chat
                const element = document.getElementById(`message-${result.id}`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  element.classList.add('bg-yellow-100');
                  setTimeout(() => element.classList.remove('bg-yellow-100'), 2000);
                }
              }}
            >
              <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                <span>{result.sender?.nombre}</span>
                <span>•</span>
                <span>{new Date(result.created_at).toLocaleString('es-ES')}</span>
              </div>
              
              {result.content && (
                <div 
                  className="text-sm"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightText(result.content, searchQuery) 
                  }}
                />
              )}
              
              {result.image_url && (
                <div className="mt-1">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    📷 Imagen
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageSearch;