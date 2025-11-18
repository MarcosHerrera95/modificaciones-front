import React, { useState } from 'react';
import './MiCuentaCliente.css';

// Componente funcional para el panel de "Mi Cuenta" del cliente en Changánet
const MiCuentaCliente = () => {
  // Estado para almacenar la información del cliente
  const [cliente, setCliente] = useState({
    nombre: 'Diego Eduardo Euler',
    serviciosContratados: 0,
    cotizacionesRecibidas: 0,
    notificaciones: 0
  });

  // Función para manejar la redirección a buscar profesionales
  const handleSearchProfessionals = () => {
    console.log("Redirigiendo a buscar profesionales...");
    alert('Redirigiendo a buscar profesionales...');
  };

  // Función para manejar la redirección a editar perfil
  const handleEditProfile = () => {
    console.log("Redirigiendo a editar perfil...");
    alert('Redirigiendo a editar perfil...');
  };

  // Función para manejar la redirección a gestionar cotizaciones
  const handleManageQuotes = () => {
    console.log("Redirigiendo a gestionar cotizaciones...");
    alert('Redirigiendo a gestionar cotizaciones...');
  };

  return (
    <div className="mi-cuenta-cliente-container">
      <div className="mi-cuenta-card">
        <h2>Mi Cuenta</h2>
        <div className="saludo">
          <h3>¡Hola, {cliente.nombre}!</h3>
          <p>¿Qué necesitas hoy?</p>
        </div>

        <div className="stats-container">
          <div className="stat-card">
            <span>{cliente.serviciosContratados}</span>
            <p>Servicios contratados</p>
          </div>
          <div className="stat-card">
            <span>{cliente.cotizacionesRecibidas}</span>
            <p>Cotizaciones recibidas</p>
          </div>
          <div className="stat-card">
            <span>{cliente.notificaciones}</span>
            <p>Notificaciones</p>
          </div>
        </div>

        <div className="acciones-rapidas">
          <button onClick={handleSearchProfessionals} className="accion-btn buscar-profesionales" aria-label="Buscar profesionales - Encuentra el servicio que necesitas">
            Buscar Profesionales<br/>
            <small>Encuentra el servicio que necesitas</small>
          </button>
          <button onClick={handleEditProfile} className="accion-btn mi-perfil" aria-label="Mi perfil - Gestiona tu información">
            Mi Perfil<br/>
            <small>Gestiona tu información</small>
          </button>
          <button onClick={handleManageQuotes} className="accion-btn mis-cotizaciones" aria-label="Mis cotizaciones - Revisa tus solicitudes">
            Mis Cotizaciones<br/>
            <small>Revisa tus solicitudes</small>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiCuentaCliente;