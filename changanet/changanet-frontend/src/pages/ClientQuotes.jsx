/**
 * @page ClientQuotes - Gestión de cotizaciones para clientes
 * @descripción Página que muestra todas las solicitudes de presupuesto enviadas por el cliente (REQ-31 a REQ-35)
 * @sprint Sprint 2 – Solicitudes y Presupuestos
 * @tarjeta Tarjeta 6: [Frontend] Implementar Gestión de Cotizaciones Cliente
 * @impacto Económico: Transparencia en el proceso de solicitud y respuesta de presupuestos
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';

const ClientQuotes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, accepted, rejected
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && (user.role === 'cliente' || user.rol === 'cliente')) {
      loadQuotes();
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('changanet_token');

      if (!token) {
        setError('No se encontró token de autenticación');
        return;
      }

      const response = await fetch('/api/quotes/client', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setQuotes(data.quotes || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al cargar cotizaciones');
      }
    } catch (err) {
      console.error('Error loading quotes:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const respondToQuote = async (quoteId, action) => {
    try {
      const token = sessionStorage.getItem('changanet_token');
      const response = await fetch(`/api/quotes/${quoteId}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        // Reload quotes to reflect changes
        loadQuotes();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al responder cotización');
      }
    } catch (err) {
      console.error('Error responding to quote:', err);
      setError('Error de conexión');
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    if (filter === 'all') return true;
    return quote.estado === filter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      case 'aceptado': return 'bg-green-100 text-green-800';
      case 'rechazado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pendiente': return 'Pendiente';
      case 'aceptado': return 'Aceptado';
      case 'rechazado': return 'Rechazado';
      default: return status;
    }
  };

  const canRespondToQuote = (quote) => {
    return quote.estado === 'pendiente';
  };

  const canCreateService = (quote) => {
    return quote.estado === 'aceptado';
  };

  if (!user || (user.role !== 'cliente' && user.rol !== 'cliente')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton />
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mis Cotizaciones</h1>
          <p className="mt-2 text-gray-600">
            Gestiona todas tus solicitudes de presupuesto y sus respuestas.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas ({quotes.length})
            </button>
            <button
              onClick={() => setFilter('pendiente')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'pendiente'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pendientes ({quotes.filter(q => q.estado === 'pendiente').length})
            </button>
            <button
              onClick={() => setFilter('aceptado')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'aceptado'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Aceptadas ({quotes.filter(q => q.estado === 'aceptado').length})
            </button>
            <button
              onClick={() => setFilter('rechazado')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'rechazado'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rechazadas ({quotes.filter(q => q.estado === 'rechazado').length})
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Cargando cotizaciones...</span>
          </div>
        )}

        {/* Quotes List */}
        {!loading && (
          <div className="space-y-6">
            {filteredQuotes.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <div className="text-6xl mb-4">💰</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {filter === 'all' ? 'No tienes cotizaciones' : `No hay cotizaciones ${getStatusText(filter).toLowerCase()}`}
                </h3>
                <p className="text-gray-600 mb-6">
                  {filter === 'all'
                    ? 'Cuando solicites presupuestos a profesionales, aparecerán aquí.'
                    : `No tienes cotizaciones en estado "${getStatusText(filter).toLowerCase()}".`
                  }
                </p>
                <button
                  onClick={() => navigate('/profesionales')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Solicitar Presupuesto
                </button>
              </div>
            ) : (
              filteredQuotes.map((quote) => (
                <div key={quote.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mr-4">
                          Cotización #{quote.id}
                        </h3>
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(quote.estado)}`}>
                          {getStatusText(quote.estado)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Profesional</p>
                          <p className="font-medium">{quote.profesional?.nombre || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Especialidad</p>
                          <p className="font-medium">{quote.profesional?.perfil_profesional?.especialidad || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Fecha de solicitud</p>
                          <p className="font-medium">
                            {new Date(quote.creado_en).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        {quote.estado === 'aceptado' && quote.precio && (
                          <div>
                            <p className="text-sm text-gray-500">Precio acordado</p>
                            <p className="font-medium text-green-600">${quote.precio}</p>
                          </div>
                        )}
                        {quote.aceptado_en && (
                          <div>
                            <p className="text-sm text-gray-500">Aceptado el</p>
                            <p className="font-medium">
                              {new Date(quote.aceptado_en).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        )}
                        {quote.rechazado_en && (
                          <div>
                            <p className="text-sm text-gray-500">Rechazado el</p>
                            <p className="font-medium">
                              {new Date(quote.rechazado_en).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mb-4">
                        <p className="text-sm text-gray-500">Descripción del trabajo</p>
                        <p className="text-gray-700">{quote.descripcion}</p>
                      </div>

                      {quote.zona_cobertura && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500">Zona de cobertura</p>
                          <p className="text-gray-700">{quote.zona_cobertura}</p>
                        </div>
                      )}

                      {quote.estado === 'aceptado' && quote.comentario && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500">Comentario del profesional</p>
                          <p className="text-gray-700 italic">"{quote.comentario}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                    {canRespondToQuote(quote) && (
                      <>
                        <button
                          onClick={() => respondToQuote(quote.id, 'accept')}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          Aceptar Cotización
                        </button>
                        <button
                          onClick={() => respondToQuote(quote.id, 'reject')}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          Rechazar Cotización
                        </button>
                      </>
                    )}

                    {canCreateService(quote) && (
                      <button
                        onClick={() => navigate(`/servicio/crear?quoteId=${quote.id}`)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        Agendar Servicio
                      </button>
                    )}

                    <button
                      onClick={() => navigate(`/chat/${quote.profesional?.id}`)}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                      Contactar Profesional
                    </button>

                    <button
                      onClick={() => navigate(`/profesional/${quote.profesional?.id}`)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      Ver Perfil
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientQuotes;