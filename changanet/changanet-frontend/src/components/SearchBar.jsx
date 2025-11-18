import React, { useState } from 'react';
import './SearchBar.css'; // Importar los estilos desde el archivo CSS

// Componente funcional para la barra de búsqueda principal de Changánet
const SearchBar = () => {
  // Estados para los valores de los campos de entrada
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');

  // Función que maneja la búsqueda al hacer clic en el botón
  const handleSearch = (e) => {
    e.preventDefault(); // Previene el envío del formulario por defecto
    // Para demostración, muestra un alert con los valores
    alert(`Buscando: ${service} en ${location}`);
  };

  return (
    <div className="search-bar-wrapper">
      {/* Contenedor de la barra de búsqueda directamente sobre el fondo verde */}
      <div className="search-bar-container">
        {/* Campo 1: Servicio que necesitas */}
        <div className="input-group">
          <label htmlFor="service" className="label">Servicio que necesitas</label>
          <div className="input-wrapper">
            <input
              id="service"
              type="text"
              placeholder="Plomero, Electricista..."
              value={service}
              onChange={(e) => setService(e.target.value)}
              list="services"
              className="search-input"
              aria-label="Campo para ingresar el servicio que necesitas"
            />
            <span className="search-icon">🔍</span>
          </div>
          {/* Lista de sugerencias para autocompletado del servicio */}
          <datalist id="services">
            <option value="Plomero" />
            <option value="Electricista" />
            <option value="Albañil" />
            <option value="Pintor" />
            <option value="Carpintero" />
            <option value="Jardinero" />
            <option value="Cerrajero" />
          </datalist>
        </div>

        {/* Campo 2: Ubicación con superposición ligera */}
        <div className="input-group location-group">
          <label htmlFor="location" className="label">Ubicación</label>
          <div className="input-wrapper">
            <input
              id="location"
              type="text"
              placeholder="Buenos Aires, CABA..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              list="locations"
              className="search-input"
              aria-label="Campo para ingresar la ubicación"
            />
            <span className="search-icon">🔍</span>
          </div>
          {/* Lista de sugerencias para autocompletado de la ubicación */}
          <datalist id="locations">
            <option value="Buenos Aires" />
            <option value="La Plata" />
            <option value="Rosario" />
            <option value="Córdoba" />
            <option value="Mendoza" />
            <option value="Mar del Plata" />
            <option value="Salta" />
          </datalist>
        </div>

        {/* Botón de búsqueda con color rojo institucional */}
        <button onClick={handleSearch} className="search-button" aria-label="Buscar servicios">
          Buscar
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
