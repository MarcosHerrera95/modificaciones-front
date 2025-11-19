import React, { useState } from 'react';
import './MisCotizacionesCliente.css';

/**
 * Componente MisCotizacionesCliente
 * Gestiona las cotizaciones del cliente en el panel de "Mi Cuenta"
 * Permite ver cotizaciones recibidas y recientes, aceptar o rechazar ofertas
 */
const MisCotizacionesCliente = () => {
  console.log('MisCotizacionesCliente component rendered');

  // Estados para gestionar las cotizaciones y la interfaz
  const [cotizacionesRecibidas, setCotizacionesRecibidas] = useState([
    {
      id: 1,
      cliente: { nombre: 'Diego Eduardo Euler', zona: 'QUILMES' },
      servicio: 'instalacion red electrica',
      descripcion: 'Necesito cambiar la instalación eléctrica de un baño.',
      imagenes: [],
      ubicacion: 'Buenos Aires',
      fecha: '2025-04-05',
      estado: 'PENDIENTE',
      profesional: {
        nombre: 'Isabella Gómez González',
        oferta: {
          precio: 5631,
          tiempo: 2,
          comentarios: 'Puedo comenzar mañana a las 9am.'
        }
      }
    },
    {
      id: 2,
      cliente: { nombre: 'María López', zona: 'PALERMO' },
      servicio: 'reparacion grifería',
      descripcion: 'La grifería del baño pierde agua constantemente.',
      imagenes: [],
      ubicacion: 'Buenos Aires',
      fecha: '2025-04-03',
      estado: 'PENDIENTE',
      profesional: {
        nombre: 'Carlos Rodríguez',
        oferta: {
          precio: 2895,
          tiempo: 1,
          comentarios: 'Disponible este viernes.'
        }
      }
    }
  ]);

  const [cotizacionesRecientes, setCotizacionesRecientes] = useState([
    {
      id: 3,
      cliente: { nombre: 'Ana García', zona: 'BELGRANO' },
      servicio: 'instalacion aire acondicionado',
      descripcion: 'Necesito instalar aire acondicionado en sala y dormitorio.',
      imagenes: [],
      ubicacion: 'Buenos Aires',
      fecha: '2025-03-28',
      estado: 'ENVIADA',
      profesional: {
        nombre: 'Luis Martínez',
        oferta: {
          precio: 8500,
          tiempo: 3,
          comentarios: 'Incluye materiales y mano de obra.'
        }
      }
    }
  ]);

  // Estados para controlar la interfaz
  const [showPanel, setShowPanel] = useState(false);
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  /**
   * Abre el panel principal de cotizaciones
   */
  const handleOpenCotizaciones = () => {
    console.log('Abriendo panel de cotizaciones');
    console.log('showPanel antes:', showPanel);
    setShowPanel(true);
    console.log('showPanel después de setState:', true);
  };

  /**
   * Cierra el panel principal y resetea estados
   */
  const handleCloseCotizaciones = () => {
    setShowPanel(false);
    setCotizacionSeleccionada(null);
    setShowDetails(false);
  };

  /**
   * Abre el modal de detalles de una cotización específica
   * @param {Object} cotizacion - La cotización seleccionada
   */
  const handleOpenDetails = (cotizacion) => {
    setCotizacionSeleccionada(cotizacion);
    setShowDetails(true);
  };

  /**
   * Cierra el modal de detalles
   */
  const handleCloseDetails = () => {
    setShowDetails(false);
    setCotizacionSeleccionada(null);
  };

  /**
   * Procesa la aceptación de una cotización
   * @param {Event} e - Evento del formulario
   */
  const handleAcceptQuote = (e) => {
    e.preventDefault();
    // Simulación de aceptación (en producción haría llamada a API)
    console.log("Aceptando cotización:", cotizacionSeleccionada);
    alert(`¡Cotización aceptada! Se ha notificado al profesional ${cotizacionSeleccionada.profesional.nombre}`);

    // Actualizar estado localmente
    if (cotizacionSeleccionada.estado === 'PENDIENTE') {
      setCotizacionesRecibidas(prev => prev.map(c =>
        c.id === cotizacionSeleccionada.id ? { ...c, estado: 'ACEPTADA' } : c
      ));
    }

    handleCloseDetails();
  };

  /**
   * Procesa el rechazo de una cotización
   * @param {Event} e - Evento del formulario
   */
  const handleRejectQuote = (e) => {
    e.preventDefault();
    // Simulación de rechazo (en producción haría llamada a API)
    console.log("Rechazando cotización:", cotizacionSeleccionada);
    alert(`Cotización rechazada. Se ha notificado al profesional ${cotizacionSeleccionada.profesional.nombre}`);

    // Actualizar estado localmente
    if (cotizacionSeleccionada.estado === 'PENDIENTE') {
      setCotizacionesRecibidas(prev => prev.map(c =>
        c.id === cotizacionSeleccionada.id ? { ...c, estado: 'RECHAZADA' } : c
      ));
    }

    handleCloseDetails();
  };

  console.log('Renderizando botón Mis Cotizaciones');

  return (
    <>
      {/* Botón principal para abrir el panel de cotizaciones */}
      <button
        onClick={() => {
          console.log('Botón Mis Cotizaciones clickeado');
          alert('Botón clickeado - abriendo modal'); // Debug temporal
          handleOpenCotizaciones();
        }}
        className="btn-mis-cotizaciones"
        aria-label="Abrir panel de Mis Cotizaciones"
        style={{
          backgroundColor: 'red',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        🔍 Mis Cotizaciones
      </button>

      {/* Panel/Modal principal de cotizaciones */}
      {showPanel && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          style={{ zIndex: 9999 }}
        >
          {console.log('Renderizando modal de cotizaciones')}
          <div className="modal-content" style={{ zIndex: 10000 }}>
            <div className="modal-header">
              <h2 id="modal-title">Mis Cotizaciones</h2>
              <p className="modal-subtitle">Gestiona tus solicitudes pendientes y recientes</p>
              <button
                onClick={handleCloseCotizaciones}
                className="btn-close"
                aria-label="Cerrar panel de cotizaciones"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Sección de Cotizaciones Recibidas */}
              <section className="cotizaciones-section" aria-labelledby="recibidas-title">
                <h3 id="recibidas-title">Cotizaciones Recibidas</h3>
                <div className="cotizaciones-list" role="list">
                  {cotizacionesRecibidas.length === 0 ? (
                    <p className="no-cotizaciones">No tienes cotizaciones recibidas pendientes.</p>
                  ) : (
                    cotizacionesRecibidas.map(cotizacion => (
                      <div key={cotizacion.id} className="cotizacion-card" role="listitem">
                        <div className="cotizacion-info">
                          <h4 className="servicio-titulo">{cotizacion.servicio}</h4>
                          <p className="cliente-info">
                            Cliente: {cotizacion.cliente.nombre} • Zona: {cotizacion.cliente.zona}
                          </p>
                        </div>
                        <span
                          className={`estado-badge ${cotizacion.estado.toLowerCase()}`}
                          aria-label={`Estado: ${cotizacion.estado}`}
                        >
                          {cotizacion.estado}
                        </span>
                        <button
                          onClick={() => handleOpenDetails(cotizacion)}
                          className="btn-ver-detalles"
                          aria-label={`Ver detalles de la cotización ${cotizacion.servicio}`}
                        >
                          Ver Detalles
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Sección de Cotizaciones Recientes */}
              <section className="cotizaciones-section" aria-labelledby="recientes-title">
                <h3 id="recientes-title">Cotizaciones Recientes</h3>
                <div className="cotizaciones-list" role="list">
                  {cotizacionesRecientes.length === 0 ? (
                    <p className="no-cotizaciones">No tienes cotizaciones recientes.</p>
                  ) : (
                    cotizacionesRecientes.map(cotizacion => (
                      <div key={cotizacion.id} className="cotizacion-card" role="listitem">
                        <div className="cotizacion-info">
                          <h4 className="servicio-titulo">{cotizacion.servicio}</h4>
                          <p className="cliente-info">
                            Cliente: {cotizacion.cliente.nombre} • Zona: {cotizacion.cliente.zona}
                          </p>
                        </div>
                        <span
                          className={`estado-badge ${cotizacion.estado.toLowerCase()}`}
                          aria-label={`Estado: ${cotizacion.estado}`}
                        >
                          {cotizacion.estado}
                        </span>
                        <button
                          onClick={() => handleOpenDetails(cotizacion)}
                          className="btn-ver-detalles"
                          aria-label={`Ver detalles de la cotización ${cotizacion.servicio}`}
                        >
                          Ver Detalles
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="modal-footer">
              <button
                onClick={handleCloseCotizaciones}
                className="btn-secondary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles de cotización */}
      {showDetails && cotizacionSeleccionada && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="details-title">
          <div className="modal-content modal-details">
            <div className="modal-header">
              <h2 id="details-title">Detalles de la Cotización</h2>
              <button
                onClick={handleCloseDetails}
                className="btn-close"
                aria-label="Cerrar detalles de cotización"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Información del cliente */}
              <section className="detalles-section" aria-labelledby="cliente-title">
                <h3 id="cliente-title">Información del Cliente</h3>
                <div className="info-grid">
                  <p><strong>Nombre:</strong> {cotizacionSeleccionada.cliente.nombre}</p>
                  <p><strong>Zona:</strong> {cotizacionSeleccionada.cliente.zona}</p>
                  <p><strong>Ubicación:</strong> {cotizacionSeleccionada.ubicacion}</p>
                  <p><strong>Fecha de solicitud:</strong> {cotizacionSeleccionada.fecha}</p>
                </div>
              </section>

              {/* Descripción del servicio */}
              <section className="detalles-section" aria-labelledby="servicio-title">
                <h3 id="servicio-title">Descripción del Servicio</h3>
                <p className="descripcion">{cotizacionSeleccionada.descripcion}</p>
              </section>

              {/* Imágenes adjuntas */}
              {cotizacionSeleccionada.imagenes && cotizacionSeleccionada.imagenes.length > 0 && (
                <section className="detalles-section" aria-labelledby="imagenes-title">
                  <h3 id="imagenes-title">Imágenes Adjuntas</h3>
                  <div className="imagenes-grid">
                    {cotizacionSeleccionada.imagenes.map((imagen, index) => (
                      <img
                        key={index}
                        src={imagen}
                        alt={`Imagen ${index + 1} del servicio`}
                        className="imagen-servicio"
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Oferta del profesional */}
              <section className="detalles-section oferta-section" aria-labelledby="oferta-title">
                <h3 id="oferta-title">Oferta del Profesional</h3>
                <div className="oferta-info">
                  <p><strong>Profesional:</strong> {cotizacionSeleccionada.profesional.nombre}</p>
                  <p><strong>Precio Final:</strong> ${cotizacionSeleccionada.profesional.oferta.precio.toLocaleString()}</p>
                  <p><strong>Tiempo Estimado:</strong> {cotizacionSeleccionada.profesional.oferta.tiempo} día(s)</p>
                  <p><strong>Comentarios Adicionales:</strong></p>
                  <p className="comentarios">{cotizacionSeleccionada.profesional.oferta.comentarios}</p>
                </div>
              </section>
            </div>

            <div className="modal-footer">
              {cotizacionSeleccionada.estado === 'PENDIENTE' && (
                <div className="acciones-cotizacion">
                  <button
                    onClick={handleRejectQuote}
                    className="btn-rechazar"
                    aria-label="Rechazar cotización"
                  >
                    ❌ Rechazar Cotización
                  </button>
                  <button
                    onClick={handleAcceptQuote}
                    className="btn-aceptar"
                    aria-label="Aceptar cotización"
                  >
                    ✅ Aceptar Cotización
                  </button>
                </div>
              )}
              <button
                onClick={handleCloseDetails}
                className="btn-secondary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MisCotizacionesCliente;