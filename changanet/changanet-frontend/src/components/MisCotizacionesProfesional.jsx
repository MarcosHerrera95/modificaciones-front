import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import './MisCotizacionesProfesional.css';

const MisCotizacionesProfesional = ({ onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // eslint-disable-next-line no-unused-vars
  const UNUSED_VAR_USER = user;

  // ✅ CORRECCIÓN: useEffect para cargar datos al montar el componente
  useEffect(() => {
    if (user && user.rol === 'profesional') {
      loadCotizacionesReales();
    }
  }, [user]);

  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState('');
  
  // Estados para manejar detalles y sub-modales
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [tipoSeccion, setTipoSeccion] = useState(''); // 'recibidas' o 'enviadas'
  const [loading, setLoading] = useState(false);
  
  // ✅ CORRECCIÓN: Estados para datos reales desde API
  const [cotizacionesRecibidas, setCotizacionesRecibidas] = useState([]);
  const [cotizacionesEnviadas, setCotizacionesEnviadas] = useState([]);
  const [datosCargados, setDatosCargados] = useState(false);

  // Función para abrir el sub-modal con la cotización específica
  const handleOpenDetails = (cotizacion, tipo) => {
    setCotizacionSeleccionada(cotizacion);
    setShowDetails(true);
    setTipoSeccion(tipo);
  };

  // Función para cerrar el sub-modal
  const handleCloseDetails = () => {
    setShowDetails(false);
    setCotizacionSeleccionada(null);
    setTipoSeccion('');
  };

  // Función para procesar la aceptación de la cotización (enviar respuesta)
  const handleEnviarRespuesta = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const precio = formData.get('precio');
    const tiempo = formData.get('tiempo');
    const comentarios = formData.get('comentarios');

    console.log("Enviando respuesta:", {
      ...cotizacionSeleccionada,
      respuesta: {
        precio: parseFloat(precio),
        tiempo: parseInt(tiempo),
        comentarios
      }
    });

    // ✅ CORRECCIÓN CRÍTICA: Integración real con API backend
    try {
      setLoading(true);
      
      const token = sessionStorage.getItem('changanet_token');
      if (!token) {
        throw new Error('Token de autenticación no encontrado');
      }

      // Validar que el precio es un número válido
      const precioNumero = parseFloat(precio);
      if (isNaN(precioNumero) || precioNumero <= 0) {
        throw new Error('El precio debe ser un número válido mayor a 0');
      }

      const response = await fetch('/api/quotes/respond', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteId: cotizacionSeleccionada.id,
          action: 'accept',
          precio: precioNumero,
          comentario: comentarios || `Tiempo estimado: ${tiempo} horas`
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Respuesta enviada exitosamente:', data);
        alert(`¡Respuesta enviada exitosamente! Precio: ${precio}, Tiempo: ${tiempo} horas`);
        handleCloseDetails();
        // TODO: Recargar la lista de cotizaciones desde la API
        // loadCotizaciones(); // Función que debería implementar para recargar datos
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al enviar la respuesta');
      }
    } catch (error) {
      console.error('❌ Error al enviar respuesta:', error);
      alert(`Error al enviar respuesta: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para simular la finalización de un trabajo
  const handleFinalizarTrabajo = (e) => {
    e.preventDefault();
    console.log("Finalizando trabajo:", cotizacionSeleccionada);
    alert(`¡Trabajo marcado como completado!`);
    handleCloseDetails();
  };

  // Función para validar formato JWT básico
  // eslint-disable-next-line no-unused-vars
  const IS_VALID_JWT_TOKEN = (token) => {
    if (!token) return false;
    
    // Verificar formato básico JWT (3 partes separadas por .)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('❌ Token JWT inválido: no tiene 3 partes');
      return false;
    }
    
    // Verificar que cada parte tenga contenido
    const [header, payload, signature] = parts;
    if (!header || !payload || !signature) {
      console.log('❌ Token JWT inválido: alguna parte está vacía');
      return false;
    }
    
    try {
      // Intentar decodificar el payload para verificar que es JSON válido
      JSON.parse(atob(payload));
      console.log('✅ Token JWT tiene formato válido');
      return true;
    } catch {
      console.log('❌ Token JWT inválido: payload no es JSON válido');
      return false;
    }
  };

  // ✅ CORRECCIÓN: Función para cargar cotizaciones reales desde API
  const loadCotizacionesReales = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = sessionStorage.getItem('changanet_token');
      if (!token) {
        throw new Error('Token de autenticación no encontrado');
      }

      // Cargar cotizaciones recibidas por el profesional
      const response = await fetch('/api/quotes/professional', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Cotizaciones cargadas:', data);
        setCotizacionesRecibidas(data);
        setDatosCargados(true);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cargar cotizaciones');
      }
    } catch (error) {
      console.error('❌ Error cargando cotizaciones:', error);
      setError(error.message);
      // Fallback a datos mock si falla la carga
      setCotizacionesRecibidas([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CORRECCIÓN: Función para rechazar cotización
  const handleRechazarCotizacion = async (cotizacionId) => {
    try {
      setLoading(true);
      
      const token = sessionStorage.getItem('changanet_token');
      if (!token) {
        throw new Error('Token de autenticación no encontrado');
      }

      const response = await fetch('/api/quotes/respond', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteId: cotizacionId,
          action: 'reject',
          comentario: 'No disponible en este momento'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Cotización rechazada exitosamente:', data);
        alert('✅ Cotización rechazada exitosamente');
        // Recargar datos
        loadCotizacionesReales();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al rechazar la cotización');
      }
    } catch (error) {
      console.error('❌ Error rechazando cotización:', error);
      alert(`Error al rechazar cotización: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para limpiar token corrupto
  // eslint-disable-next-line no-unused-vars
  const CLEAR_CORRUPTED_TOKEN = () => {
    console.warn('🧹 Limpiando token JWT corrupto');
    localStorage.removeItem('changanet_token');
    localStorage.removeItem('changanet_user');
    // Forzar logout del contexto de auth si está disponible
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  };

  // Función para abrir chat con el cliente usando UUIDs reales de la BD
  const handleOpenChat = async (clientData, clientName) => {
    try {
      setLoading(true);
      
      // Validar que tenemos datos válidos del cliente
      if (!clientData || !clientData.id) {
        throw new Error('Datos de cliente no válidos');
      }
      
      // Obtener token de autenticación
      const token = localStorage.getItem('changanet_token');
      if (!token) {
        throw new Error('Usuario no autenticado');
      }
      
      console.log('Abriendo chat con cliente:', clientData.id, clientData.nombre || clientName);
      
      // ✅ CORRECCIÓN: Usar UUIDs reales de la base de datos
      let clientId, professionalId;
      
      if (user.rol === 'profesional') {
        // Soy profesional, necesito el UUID del cliente
        clientId = clientData.id; // UUID del cliente
        professionalId = user.id; // Mi UUID profesional
      } else if (user.rol === 'cliente') {
        // Soy cliente, necesito el UUID del profesional
        clientId = user.id; // Mi UUID cliente
        professionalId = clientData.id; // UUID del profesional
      } else {
        throw new Error('Rol de usuario no reconocido');
      }
      
      // ✅ VALIDACIÓN: Verificar que los IDs son UUIDs válidos
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(clientId) || !uuidRegex.test(professionalId)) {
        throw new Error(`IDs deben ser UUIDs válidos. clientId: ${clientId}, professionalId: ${professionalId}`);
      }
      
      console.log('UUIDs validados:', { clientId, professionalId });
      
      // ✅ GENERAR conversationId correcto: UUID1-UUID2 (orden lexicográfico)
      const ids = [clientId, professionalId].sort();
      const conversationId = `${ids[0]}-${ids[1]}`;
      
      console.log('ConversationId generado:', conversationId);
      
      // Llamar al endpoint para crear o abrir conversación
      const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
      const response = await fetch(`${apiBaseUrl}/api/chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          clientId: clientId,
          professionalId: professionalId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear la conversación');
      }
      
      const data = await response.json();

      // Navegar al chat usando el conversationId
      if (data.conversation && data.conversation.id) {
        navigate(`/chat/${data.conversation.id}`);
      } else {
        throw new Error('No se pudo obtener el ID de conversación');
      }
      
      // Cerrar el modal de cotizaciones
      onClose();
      
    } catch (error) {
      console.error('Error al abrir el chat:', error);
      alert(`Error al abrir el chat: ${error.message}. Inténtalo de nuevo.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Mis Cotizaciones</h2>
          <button 
            onClick={onClose} 
            className="close-button"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          <p className="modal-subtitle">Gestiona las solicitudes de tus clientes y tus respuestas.</p>

          {/* Sección de Solicitudes Recibidas */}
          <div className="quote-section">
            <h4>Solicitudes Recibidas</h4>
            <p className="section-description">Solicitudes de clientes que necesitan tus servicios</p>
            <div className="quotes-list">
              {loading ? (
                <div className="loading-state">
                  <p>Cargando solicitudes...</p>
                </div>
              ) : cotizacionesRecibidas.length === 0 ? (
                <div className="empty-state">
                  <p>No tienes solicitudes pendientes en este momento.</p>
                </div>
              ) : (
                cotizacionesRecibidas.map((cotizacion) => (
                  <div key={cotizacion.id} className="quote-item pending">
                    <div className="quote-info">
                      <h5>{cotizacion.title || 'Solicitud de presupuesto'}</h5>
                      <p className="client-info">
                        <strong>Cliente:</strong> {cotizacion.cliente?.nombre || 'Cliente'}<br/>
                        <strong>Zona:</strong> {cotizacion.zona_cobertura || 'No especificada'}<br/>
                        <strong>Ubicación:</strong> {cotizacion.location || 'Buenos Aires'}<br/>
                        <strong>Fecha:</strong> {new Date(cotizacion.creado_en).toLocaleDateString('es-AR')}
                      </p>
                      <p className="quote-description">
                        <strong>Descripción:</strong> {cotizacion.descripcion || cotizacion.description}
                      </p>
                      {cotizacion.fotos_urls && JSON.parse(cotizacion.fotos_urls || '[]').length > 0 && (
                        <p className="photos-info">
                          📷 {JSON.parse(cotizacion.fotos_urls).length} foto(s) adjunta(s)
                        </p>
                      )}
                    </div>
                    <div className="quote-actions">
                      <span className="status-badge pending">PENDIENTE</span>
                      <div className="action-buttons-group">
                        <button
                          onClick={() => handleOpenDetails({
                            id: cotizacion.id,
                            titulo: cotizacion.title || 'Solicitud de presupuesto',
                            cliente: {
                              nombre: cotizacion.cliente?.nombre || 'Cliente',
                              zona: cotizacion.zona_cobertura || 'No especificada'
                            },
                            descripcion: cotizacion.descripcion || cotizacion.description,
                            ubicacion: cotizacion.location || 'Buenos Aires',
                            fecha: new Date(cotizacion.creado_en).toLocaleDateString('es-AR'),
                            estado: 'PENDIENTE',
                            fotos: cotizacion.fotos_urls ? JSON.parse(cotizacion.fotos_urls) : []
                          }, 'recibidas')}
                          className="btn-details"
                        >
                          Ver Detalles y Responder
                        </button>
                        <button
                          onClick={() => handleOpenChat({
                            id: cotizacion.cliente?.id || cotizacion.cliente_id,
                            nombre: cotizacion.cliente?.nombre || 'Cliente',
                            rol: 'cliente'
                          }, cotizacion.cliente?.nombre || 'Cliente')}
                          disabled={loading}
                          className="btn-chat"
                          style={{
                            backgroundColor: '#009688',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginLeft: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>💬</span>
                          Chat con el Cliente
                        </button>
                        <button
                          onClick={() => handleRechazarCotizacion(cotizacion.id)}
                          disabled={loading}
                          className="btn-reject"
                          style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginLeft: '8px'
                          }}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Placeholder para futuras implementaciones - por ahora vacío */}
              <div className="empty-state">
                <p>Las respuestas enviadas se mostrarán aquí próximamente.</p>
              </div>
            </div>
          </div>

          {/* Sección de Respuestas Recientes - Futura implementación */}
          <div className="quote-section">
            <h4>Mis Respuestas Recientes</h4>
            <p className="section-description">Las últimas respuestas que has enviado a solicitudes de clientes</p>
            <div className="quotes-list">
              <div className="empty-state">
                <p>Esta sección se implementará próximamente con el historial de respuestas.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-modal para detalles y respuesta */}
        {showDetails && cotizacionSeleccionada && (
          <div className="modal-overlay-details" onClick={handleCloseDetails}>
            <div className="modal-content-details" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {tipoSeccion === 'recibidas' && cotizacionSeleccionada.estado === 'PENDIENTE' 
                    ? 'Responder Solicitud' 
                    : 'Detalles de la Solicitud'}
                </h3>
                <button 
                  onClick={handleCloseDetails} 
                  className="close-button"
                  aria-label="Cerrar detalles"
                >
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                <div className="request-details">
                  <h4>{cotizacionSeleccionada.titulo}</h4>
                  <div className="detail-group">
                    <p><strong>Cliente:</strong> {cotizacionSeleccionada.cliente.nombre}</p>
                    <p><strong>Zona:</strong> {cotizacionSeleccionada.cliente.zona}</p>
                    <p><strong>Ubicación:</strong> {cotizacionSeleccionada.ubicacion}</p>
                    <p><strong>Fecha de solicitud:</strong> {cotizacionSeleccionada.fecha}</p>
                  </div>
                  
                  <div className="detail-group">
                    <p><strong>Descripción del trabajo:</strong></p>
                    <p className="description-text">{cotizacionSeleccionada.descripcion}</p>
                  </div>

                  {/* Mostrar mi respuesta si ya fue enviada */}
                  {cotizacionSeleccionada.mi_respuesta && (
                    <div className="detail-group">
                      <p><strong>Mi Respuesta:</strong></p>
                      <div className="my-response">
                        <p>💰 <strong>Precio:</strong> ${cotizacionSeleccionada.mi_respuesta.precio.toLocaleString()}</p>
                        <p>⏰ <strong>Tiempo estimado:</strong> {cotizacionSeleccionada.mi_respuesta.tiempo} horas</p>
                        <p>💬 <strong>Comentarios:</strong> {cotizacionSeleccionada.mi_respuesta.comentarios}</p>
                        <p><small>Respondido el: {cotizacionSeleccionada.mi_respuesta.fecha_respuesta}</small></p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Formulario de respuesta para solicitudes pendientes */}
                {tipoSeccion === 'recibidas' && cotizacionSeleccionada.estado === 'PENDIENTE' && (
                  <form className="response-form" onSubmit={handleEnviarRespuesta}>
                    <h4>Enviar Mi Respuesta</h4>
                    
                    <div className="form-group">
                      <label htmlFor="precio">Precio Total ($):</label>
                      <input
                        type="number"
                        id="precio"
                        name="precio"
                        required
                        min="1"
                        placeholder="Ej: 15000"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="tiempo">Tiempo Estimado (horas):</label>
                      <input
                        type="number"
                        id="tiempo"
                        name="tiempo"
                        required
                        min="1"
                        max="100"
                        placeholder="Ej: 2"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="comentarios">Comentarios Adicionales:</label>
                      <textarea
                        id="comentarios"
                        name="comentarios"
                        rows="3"
                        placeholder="Ej: Disponible este fin de semana. Tengo experiencia con..."
                      ></textarea>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn-submit">
                        📤 Enviar Respuesta
                      </button>
                      <button type="button" onClick={handleCloseDetails} className="btn-cancel">
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {/* Botón para trabajos aceptados */}
                {tipoSeccion === 'enviadas' && cotizacionSeleccionada.estado === 'ACEPTADA' && (
                  <div className="accepted-work-actions">
                    <div className="form-actions">
                      <button 
                        onClick={handleFinalizarTrabajo}
                        className="btn-complete"
                      >
                        ✅ Marcar como Completado
                      </button>
                      <button onClick={handleCloseDetails} className="btn-cancel">
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}

                {/* Solo botón cerrar para otros estados */}
                {((tipoSeccion === 'enviadas' && cotizacionSeleccionada.estado !== 'ACEPTADA') || 
                  (tipoSeccion === 'recibidas' && cotizacionSeleccionada.estado !== 'PENDIENTE')) && (
                  <div className="form-actions">
                    <button onClick={handleCloseDetails} className="btn-cancel">
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MisCotizacionesProfesional;