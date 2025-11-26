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
              {/* Solicitudes Pendientes */}
              <div className="quote-item pending">
                <div className="quote-info">
                  <h5>Instalación de Aire Acondicionado</h5>
                  <p className="client-info">
                    <strong>Cliente:</strong> Diego Eduardo Euler<br/>
                    <strong>Zona:</strong> QUILMES<br/>
                    <strong>Ubicación:</strong> Buenos Aires<br/>
                    <strong>Fecha:</strong> 2025-01-19
                  </p>
                  <p className="quote-description">
                    <strong>Descripción:</strong> Necesito instalar un aire acondicionado split de 3000 frigorias en mi living. El equipo ya está adquirido, solo necesito la instalación.
                  </p>
                </div>
                <div className="quote-actions">
                  <span className="status-badge pending">PENDIENTE</span>
                  <div className="action-buttons-group">
                    <button 
                      onClick={() => handleOpenDetails({
                        id: 1,
                        titulo: 'Instalación de Aire Acondicionado',
                        cliente: { nombre: 'Diego Eduardo Euler', zona: 'QUILMES' },
                        descripcion: 'Necesito instalar un aire acondicionado split de 3000 frigorias en mi living. El equipo ya está adquirido, solo necesito la instalación.',
                        ubicacion: 'Buenos Aires',
                        fecha: '2025-01-19',
                        estado: 'PENDIENTE'
                      }, 'recibidas')}
                      className="btn-details"
                    >
                      Ver Detalles y Responder
                    </button>
                    <button 
                      onClick={() => handleOpenChat({
                        id: '7f0d57a9-cf83-4d06-8d41-a244752c46ff',
                        nombre: 'Diego Eduardo Euler',
                        rol: 'cliente'
                      }, 'Diego Eduardo Euler')}
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
                  </div>
                </div>
              </div>

              {/* Solicitudes Enviadas */}
              <div className="quote-item sent">
                <div className="quote-info">
                  <h5>Reparación de Calefón</h5>
                  <p className="client-info">
                    <strong>Cliente:</strong> María González<br/>
                    <strong>Zona:</strong> PALERMO<br/>
                    <strong>Fecha:</strong> 2025-01-18
                  </p>
                  <div className="response-info">
                    <p><strong>Mi Respuesta:</strong></p>
                    <p>💰 <strong>Precio:</strong> $15.000</p>
                    <p>⏰ <strong>Tiempo:</strong> 2 horas</p>
                    <p>💬 <strong>Comentarios:</strong> Disponible este fin de semana. Tengo experiencia con marcas Rheem.</p>
                  </div>
                </div>
                <div className="quote-actions">
                  <span className="status-badge sent">ENVIADA</span>
                  <div className="action-buttons-group">
                    <button 
                      onClick={() => handleOpenDetails({
                        id: 2,
                        titulo: 'Reparación de Calefón',
                        cliente: { nombre: 'María González', zona: 'PALERMO' },
                        descripcion: 'El calefón no enciende. Probablemente sea el piloto.',
                        ubicacion: 'Buenos Aires',
                        fecha: '2025-01-18',
                        estado: 'ENVIADA',
                        mi_respuesta: {
                          precio: 15000,
                          tiempo: 2,
                          comentarios: 'Disponible este fin de semana. Tengo experiencia con marcas Rheem.',
                          fecha_respuesta: '2025-01-18'
                        }
                      }, 'enviadas')}
                      className="btn-details"
                    >
                      Ver Mi Respuesta
                    </button>
                    <button 
                      onClick={() => handleOpenChat({
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        nombre: 'María González',
                        rol: 'cliente'
                      }, 'María González')}
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
                  </div>
                </div>
              </div>

              {/* Trabajos Aceptados */}
              <div className="quote-item accepted">
                <div className="quote-info">
                  <h5>Instalación Eléctrica</h5>
                  <p className="client-info">
                    <strong>Cliente:</strong> Carlos Mendoza<br/>
                    <strong>Zona:</strong> RECOLETA<br/>
                    <strong>Fecha:</strong> 2025-01-17
                  </p>
                  <div className="response-info">
                    <p><strong>Mi Respuesta:</strong></p>
                    <p>💰 <strong>Precio:</strong> $25.000</p>
                    <p>⏰ <strong>Tiempo:</strong> 6 horas</p>
                    <p>💬 <strong>Comentarios:</strong> Aceptado. Comenzamos mañana a las 8:00 AM.</p>
                  </div>
                </div>
                <div className="quote-actions">
                  <span className="status-badge accepted">ACEPTADA</span>
                  <div className="action-buttons-group">
                    <button 
                      onClick={() => handleOpenDetails({
                        id: 3,
                        titulo: 'Instalación Eléctrica',
                        cliente: { nombre: 'Carlos Mendoza', zona: 'RECOLETA' },
                        descripcion: 'Necesito instalar el sistema eléctrico completo para una ampliación.',
                        ubicacion: 'Buenos Aires',
                        fecha: '2025-01-17',
                        estado: 'ACEPTADA',
                        mi_respuesta: {
                          precio: 25000,
                          tiempo: 6,
                          comentarios: 'Aceptado. Comenzamos mañana a las 8:00 AM.',
                          fecha_respuesta: '2025-01-17'
                        }
                      }, 'enviadas')}
                      className="btn-details"
                    >
                      Ver Detalles
                    </button>
                    <button 
                      onClick={() => handleOpenChat({
                        id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
                        nombre: 'Carlos Mendoza',
                        rol: 'cliente'
                      }, 'Carlos Mendoza')}
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
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sección de Cotizaciones Recientes */}
          <div className="quote-section">
            <h4>Mis Respuestas Recientes</h4>
            <p className="section-description">Las últimas respuestas que has enviado a solicitudes de clientes</p>
            <div className="quotes-list">
              <div className="quote-item recent">
                <div className="quote-info">
                  <h5>Mantenimiento de Pileta</h5>
                  <p className="client-info">
                    <strong>Cliente:</strong> Ana Torres<br/>
                    <strong>Zona:</strong> BELGRANO<br/>
                    <strong>Fecha solicitud:</strong> 2025-01-19
                  </p>
                  <div className="response-info">
                    <p><strong>Mi Respuesta (Hoy):</strong></p>
                    <p>💰 <strong>Precio:</strong> $8.000</p>
                    <p>⏰ <strong>Tiempo:</strong> 3 horas</p>
                    <p>💬 <strong>Comentarios:</strong> Incluyo productos químicos. Trabajo los sábados.</p>
                  </div>
                </div>
                <div className="quote-actions">
                  <span className="status-badge recent">RECIENTE</span>
                  <div className="action-buttons-group">
                    <button 
                      onClick={() => handleOpenDetails({
                        id: 4,
                        titulo: 'Mantenimiento de Pileta',
                        cliente: { nombre: 'Ana Torres', zona: 'BELGRANO' },
                        descripcion: 'Necesito limpieza y mantenimiento de pileta para temporada de verano.',
                        ubicacion: 'Buenos Aires',
                        fecha: '2025-01-19',
                        estado: 'RECIENTE',
                        mi_respuesta: {
                          precio: 8000,
                          tiempo: 3,
                          comentarios: 'Incluyo productos químicos. Trabajo los sábados.',
                          fecha_respuesta: '2025-01-19'
                        }
                      }, 'enviadas')}
                      className="btn-details"
                    >
                      Ver Mi Respuesta
                    </button>
                    <button 
                      onClick={() => handleOpenChat({
                        id: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
                        nombre: 'Ana Torres',
                        rol: 'cliente'
                      }, 'Ana Torres')}
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
                  </div>
                </div>
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