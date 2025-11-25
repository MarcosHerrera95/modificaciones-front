import { useState, useEffect } from 'react';

const VerificationReviewPanel = ({ className = '' }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/verification/admin/verification-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/verification/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reviewNotes: reviewNotes.trim() || 'Documento aprobado'
        })
      });

      if (response.ok) {
        alert('Solicitud aprobada exitosamente');
        setSelectedRequest(null);
        setReviewNotes('');
        fetchPendingRequests();
      } else {
        const error = await response.json();
        alert('Error al aprobar: ' + error.error);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    if (!reviewNotes.trim()) {
      alert('Debe proporcionar una razón para el rechazo');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/verification/${requestId}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reviewNotes: reviewNotes
        })
      });

      if (response.ok) {
        alert('Solicitud rechazada');
        setSelectedRequest(null);
        setReviewNotes('');
        fetchPendingRequests();
      } else {
        const error = await response.json();
        alert('Error al rechazar: ' + error.error);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDocument = async (requestId) => {
    try {
      const response = await fetch(`/api/verification/${requestId}/document`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Abrir documentos en nuevas pestañas
        if (data.data.front) {
          window.open(data.data.front, '_blank');
        }
        if (data.data.back) {
          window.open(data.data.back, '_blank');
        }
      } else {
        alert('Error al obtener documentos');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Error de conexión');
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-800">Revisión de Verificaciones</h3>
        <p className="text-sm text-gray-600 mt-1">
          Solicitudes pendientes: {pendingRequests.length}
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {pendingRequests.map((request) => (
          <div key={request.id} className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      Usuario ID: {request.usuario_id}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Tipo: {request.documento_url ? 'DNI' : 'Otro'}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pendiente
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Solicitado: {new Date(request.creado_en).toLocaleDateString()}
                </p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => handleViewDocument(request.id)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                >
                  Ver Documento
                </button>
                <button
                  onClick={() => setSelectedRequest(request)}
                  className="px-3 py-1 text-sm bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200"
                >
                  Revisar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingRequests.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-gray-600">No hay solicitudes pendientes</p>
        </div>
      )}

      {/* Modal de revisión */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Revisar Solicitud</h3>
            <p className="text-sm text-gray-600 mb-4">
              Usuario ID: {selectedRequest.usuario_id}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas de revisión
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="Comentarios sobre la revisión..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => handleApprove(selectedRequest.id)}
                disabled={actionLoading}
                className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading ? 'Procesando...' : 'Aprobar'}
              </button>
              <button
                onClick={() => handleReject(selectedRequest.id)}
                disabled={actionLoading}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Procesando...' : 'Rechazar'}
              </button>
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationReviewPanel;