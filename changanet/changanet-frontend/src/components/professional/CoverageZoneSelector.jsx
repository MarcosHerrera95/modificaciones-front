import { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';

const CoverageZoneSelector = ({ zones, selectedZone, zoneText, onChange, errors = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('all');

  // Obtener estados únicos
  const states = useMemo(() => {
    if (!zones) return [];
    const stateSet = new Set();
    Object.keys(zones).forEach(state => stateSet.add(state));
    return Array.from(stateSet).sort();
  }, [zones]);

  // Filtrar zonas
  const filteredZones = useMemo(() => {
    let allZones = [];
    
    // Recopilar todas las zonas
    if (selectedState === 'all') {
      Object.keys(zones).forEach(state => {
        if (Array.isArray(zones[state])) {
          allZones = allZones.concat(
            zones[state].map(zone => ({ ...zone, state }))
          );
        }
      });
    } else {
      if (Array.isArray(zones[selectedState])) {
        allZones = zones[selectedState].map(zone => ({ ...zone, state: selectedState }));
      }
    }

    // Filtrar por término de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      allZones = allZones.filter(zone =>
        zone.name.toLowerCase().includes(term) ||
        zone.city.toLowerCase().includes(term) ||
        zone.state.toLowerCase().includes(term)
      );
    }

    return allZones.sort((a, b) => `${a.state} ${a.city}`.localeCompare(`${b.state} ${b.city}`));
  }, [zones, selectedState, searchTerm]);

  /**
   * Maneja la selección de una zona
   */
  const handleZoneSelect = (zone) => {
    const zoneData = {
      id: zone.id,
      name: zone.name,
      label: `${zone.name}, ${zone.city}, ${zone.state}`,
      city: zone.city,
      state: zone.state,
      latitude: zone.latitude,
      longitude: zone.longitude,
      radius_km: zone.radius_km
    };
    
    onChange(zoneData);
    toast.success(`Zona seleccionada: ${zoneData.label}`);
  };

  /**
   * Maneja el cambio de estado
   */
  const handleStateChange = (state) => {
    setSelectedState(state);
    setSearchTerm('');
  };

  /**
   * Obtiene el ícono del estado
   */
  const getStateIcon = (state) => {
    const icons = {
      'Buenos Aires': '🏙️',
      'Córdoba': '🏛️',
      'Santa Fe': '🌾',
      'Mendoza': '🍇',
      'Tucumán': '🌶️',
      'Entre Ríos': '🌊'
    };
    return icons[state] || '📍';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Zona de Cobertura</h2>
        <p className="text-gray-600">
          Define las áreas donde ofreces tus servicios. Esto ayuda a los clientes a encontrarte por ubicación.
        </p>
      </div>

      {/* Zona seleccionada */}
      {selectedZone && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <h3 className="text-lg font-semibold text-emerald-800 mb-2">Zona Actual</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-emerald-700">{selectedZone.label}</p>
              <p className="text-sm text-emerald-600">
                Radio: {selectedZone.radius_km}km • Coordenadas: {selectedZone.latitude?.toFixed(4)}, {selectedZone.longitude?.toFixed(4)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-emerald-600 hover:text-emerald-800"
              title="Cambiar zona"
            >
              ✏️
            </button>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por ciudad, barrio o zona..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <div className="absolute right-3 top-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filtro por estado */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleStateChange('all')}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${selectedState === 'all' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            Todas las provincias
          </button>
          {states.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => handleStateChange(state)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${selectedState === state 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {getStateIcon(state)} {state}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de zonas */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">
          {selectedState === 'all' ? 'Todas las zonas' : selectedState}
          <span className="text-sm font-normal text-gray-500 ml-2">
            ({filteredZones.length} disponibles)
          </span>
        </h3>
        
        {filteredZones.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p>No se encontraron zonas</p>
            <p className="text-sm">Intenta con otro término de búsqueda</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredZones.map((zone) => (
              <div
                key={zone.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 hover:bg-emerald-25 cursor-pointer transition-all duration-200"
                onClick={() => handleZoneSelect(zone)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <span className="text-lg mr-2">{getStateIcon(zone.state)}</span>
                      <h4 className="font-medium text-gray-900">{zone.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600 ml-7">
                      {zone.city}, {zone.state} • Radio: {zone.radius_km}km
                    </p>
                  </div>
                  <div className="ml-4">
                    <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campo de texto libre */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Zona de Cobertura (Texto)
        </label>
        <input
          type="text"
          value={zoneText || ''}
          onChange={(e) => onChange({
            ...selectedZone,
            label: e.target.value
          })}
          placeholder="Ej: Palermo, Buenos Aires; Zona Norte (Tigre, San Isidro)"
          className={`
            w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
            ${errors.zona_cobertura ? 'border-red-300 bg-red-50' : 'border-gray-200'}
          `}
        />
        {errors.zona_cobertura && (
          <p className="text-red-500 text-sm mt-1">{errors.zona_cobertura}</p>
        )}
        <p className="text-sm text-gray-600 mt-1">
          Puedes especificar varias áreas separadas por punto y coma (;)
        </p>
      </div>

      {/* Información adicional */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">🗺️ Consejos para la zona de cobertura:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Selecciona las áreas donde realmente puedes brindar servicios</li>
          <li>• Considera el tiempo de traslado y costos de transporte</li>
          <li>• Las zonas más específicas te ayudan a destacar en búsquedas locales</li>
          <li>• Puedes servir múltiples áreas si están cerca entre sí</li>
          <li>• Los clientes buscan por proximidad, mantén tu cobertura realista</li>
        </ul>
      </div>
    </div>
  );
};

export default CoverageZoneSelector;