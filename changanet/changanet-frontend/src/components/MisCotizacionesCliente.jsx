import React, { useState, useEffect } from 'react';

// Estilos CSS integrados para el modal
const styles = `
/* Overlay principal del modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease-out;
}

/* Contenido principal del modal */
.modal-content {
  background-color: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  width: 600px;
  position: relative;
  animation: slideIn 0.3s ease-out;
}

/* Animaciones */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { 
    opacity: 0;
    transform: translateY(-30px) scale(0.95);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Encabezado del modal */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.modal-title {
  color: #2c3e50;
  font-size: 1.8rem;
  margin: 0;
  font-weight: 600;
}

.modal-subtitle {
  color: #7f8c8d;
  font-size: 1rem;
  margin-bottom: 25px;
  margin-top: 5px;
}

/* Botón de cerrar */
.btn-close {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #ecf0f1;
  color: #7f8c8d;
  font-size: 1.5rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
}

.btn-close:hover {
  background-color: #e74c3c;
  color: white;
  transform: rotate(90deg) scale(1.1);
}

/* Contenido del modal */
.modal-body {
  padding: 20px 0;
  text-align: center;
}

.empty-state {
  padding: 40px 20px;
  color: #7f8c8d;
}

.empty-state-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.6;
}

.empty-state-text {
  font-size: 1.1rem;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    padding: 20px;
    margin: 10px;
  }
  
  .modal-title {
    font-size: 1.5rem;
  }
}

/* Accesibilidad */
.btn-close:focus {
  outline: 2px solid #3498db;
  outline-offset: 2px;
}
`;

const MisCotizacionesCliente = ({ onClose }) => {
  // Estado para manejar el modal
  const [isVisible, setIsVisible] = useState(true);

  // Función para cerrar modal con tecla Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Función para cerrar el modal
  const handleClose = () => {
    setIsVisible(false);
    // Pequeño delay para la animación de salida
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 300);
  };

  // Función para manejar click en overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div 
        className="modal-overlay" 
        role="presentation"
        onClick={handleOverlayClick}
      >
        <div 
          className="modal-content" 
          role="dialog" 
          aria-labelledby="modal-title" 
          aria-describedby="modal-subtitle"
        >
          <button 
            onClick={handleClose} 
            className="btn-close" 
            aria-label="Cerrar modal de cotizaciones"
          >
            ×
          </button>
          
          <div className="modal-header">
            <h2 id="modal-title" className="modal-title">
              Mis Cotizaciones
            </h2>
          </div>
          
          <p id="modal-subtitle" className="modal-subtitle">
            Gestiona tus solicitudes pendientes y recientes.
          </p>

          <div className="modal-body">
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p className="empty-state-text">
                No hay cotizaciones para mostrar
              </p>
              <p style={{ fontSize: '0.9rem', marginTop: '10px', opacity: 0.8 }}>
                Las cotizaciones aparecerán aquí cuando los profesionales respondan a tus solicitudes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MisCotizacionesCliente;