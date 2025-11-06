// src/components/SearchBar.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar = () => {
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(`/profesionales?especialidad=${encodeURIComponent(service)}&zona_cobertura=${encodeURIComponent(location)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar flex flex-col md:flex-row gap-4">
      <div className="flex-1 relative group">
        <div className="absolute left-5 top-1/2 transform -translate-y-1/2 text-emerald-500 z-10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="¿Qué necesitas? (ej: plomero, electricista, pintor)"
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="w-full pl-14 pr-4 py-5 rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-300 text-gray-700 placeholder-gray-500 shadow-lg hover:shadow-xl text-lg min-h-[44px]"
          required
          aria-label="Buscar servicio profesional"
          aria-describedby="service-help"
          list="services-list"
        />
        <div id="service-help" className="sr-only">Ingresa el tipo de servicio que necesitas, por ejemplo: plomero, electricista, pintor</div>
        <datalist id="services-list">
          <option value="Plomero" />
          <option value="Electricista" />
          <option value="Pintor" />
          <option value="Jardinero" />
          <option value="Carpintero" />
          <option value="Mecánico" />
          <option value="Técnico en aire acondicionado" />
          <option value="Cerrajero" />
          <option value="Limpieza del hogar" />
          <option value="Mudanzas" />
        </datalist>
      </div>

      <div className="flex-1 relative group">
        <div className="absolute left-5 top-1/2 transform -translate-y-1/2 text-emerald-500 z-10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="¿Dónde? (ej: Palermo, CABA, La Plata)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full pl-14 pr-4 py-5 rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-300 text-gray-700 placeholder-gray-500 shadow-lg hover:shadow-xl text-lg min-h-[44px]"
          required
          aria-label="Buscar ubicación geográfica"
          aria-describedby="location-help"
          list="locations-list"
        />
        <div id="location-help" className="sr-only">Ingresa tu ubicación o zona donde necesitas el servicio</div>
        <datalist id="locations-list">
          <option value="Buenos Aires" />
          <option value="CABA" />
          <option value="Palermo" />
          <option value="Recoleta" />
          <option value="Belgrano" />
          <option value="La Plata" />
          <option value="Mar del Plata" />
          <option value="Córdoba" />
          <option value="Rosario" />
          <option value="Mendoza" />
        </datalist>
      </div>

      <button
        type="submit"
        className="bg-emerald-500 text-black px-10 py-5 rounded-2xl hover:bg-emerald-600 transition-all duration-300 font-bold shadow-xl hover:shadow-glow transform hover:scale-105 flex items-center justify-center space-x-3 text-lg shimmer min-h-[44px] touch-manipulation"
        aria-label="Buscar profesionales"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Buscar</span>
      </button>
    </form>
  );
};

export default SearchBar;
