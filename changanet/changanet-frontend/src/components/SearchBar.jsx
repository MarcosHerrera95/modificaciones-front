import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SearchBar.css'; // Importar los estilos desde el archivo CSS

// Componente funcional para la barra de búsqueda principal de Changánet
const SearchBar = () => {
  // Estados para los valores de los campos de entrada
  const [service, setService] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [barrio, setBarrio] = useState('');
  const navigate = useNavigate();

  // Función que maneja la búsqueda al hacer clic en el botón
  const handleSearch = (e) => {
    e.preventDefault(); // Previene el envío del formulario por defecto

    // Validar que al menos un campo tenga contenido
    if (!service.trim() && !ciudad.trim() && !barrio.trim()) {
      alert('Por favor ingresa un servicio, ciudad o barrio para buscar');
      return;
    }

    // Construir parámetros de búsqueda
    const params = new URLSearchParams();
    if (service.trim()) {
      params.set('especialidad', service.trim());
    }
    if (ciudad.trim()) {
      params.set('ciudad', ciudad.trim());
    }
    if (barrio.trim()) {
      params.set('barrio', barrio.trim());
    }

    // Navegar a la página de profesionales con los parámetros
    navigate(`/profesionales?${params.toString()}`);
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
            <option value="Gasista" />
            <option value="Techista" />
            <option value="Herrero" />
          </datalist>
        </div>

        {/* Campo 2: Ciudad */}
        <div className="input-group location-group">
          <label htmlFor="ciudad" className="label">Ciudad</label>
          <div className="input-wrapper">
            <input
              id="ciudad"
              type="text"
              placeholder="Buenos Aires, Córdoba..."
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              list="ciudades"
              className="search-input"
              aria-label="Campo para ingresar la ciudad"
            />
            <span className="search-icon">🏙️</span>
          </div>
          {/* Lista de sugerencias para autocompletado de ciudades */}
          <datalist id="ciudades">
            <option value="Buenos Aires" />
            <option value="CABA" />
            <option value="La Plata" />
            <option value="Rosario" />
            <option value="Córdoba" />
            <option value="Mendoza" />
            <option value="Mar del Plata" />
            <option value="Salta" />
            <option value="Tucumán" />
            <option value="Santa Fe" />
          </datalist>
        </div>

        {/* Campo 3: Barrio */}
        <div className="input-group location-group">
          <label htmlFor="barrio" className="label">Barrio</label>
          <div className="input-wrapper">
            <input
              id="barrio"
              type="text"
              placeholder="Palermo, Recoleta..."
              value={barrio}
              onChange={(e) => setBarrio(e.target.value)}
              list="barrios"
              className="search-input"
              aria-label="Campo para ingresar el barrio"
            />
            <span className="search-icon">📍</span>
          </div>
          {/* Lista de sugerencias para autocompletado de barrios */}
          <datalist id="barrios">
            <option value="Palermo" />
            <option value="Recoleta" />
            <option value="Belgrano" />
            <option value="Caballito" />
            <option value="Villa Crespo" />
            <option value="Almagro" />
            <option value="San Telmo" />
            <option value="Puerto Madero" />
            <option value="Núñez" />
            <option value="Colegiales" />
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
