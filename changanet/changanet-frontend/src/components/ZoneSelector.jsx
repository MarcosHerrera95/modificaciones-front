import React, { useState, useEffect, useRef } from 'react';
import { professionalProfileAPI } from '../services/professionalProfileAPIService';

/**
 * ZoneSelector
 * Componente para seleccionar zona de cobertura geográfica
 * 
 * Implementa REQ-09: Definir zona de cobertura geográfica
 * 
 * Características:
 * - Búsqueda de zonas por ciudad/provincia
 * - Coordenadas GPS automáticas
 * - Selección de radio de cobertura
 * - Validación geográfica
 * - Map placeholder (para futura integración con Google Maps)
 */

const ZoneSelector = ({
  selectedZone,
  onZoneChange,
  isLoading = false
}) => {
  const [allZones, setAllZones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredZones, setFilteredZones] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const [coverageRadius, setCoverageRadius] = useState(5); // km
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    loadZones();
  }, []);

  useEffect(() => {
    if (selectedZone) {
      setSelectedZoneId(selectedZone.id || '');
      setCoordinates({
        lat: selectedZone.latitude,
        lng: selectedZone.longitude
      });
      setCoverageRadius(selectedZone.radius_km || 5);
    }
  }, [selectedZone]);

  useEffect(() => {
    filterZones();
  }, [searchTerm, allZones]);

  useEffect(() => {
    // Cerrar dropdown al hacer clic fuera
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadZones = async () => {
    try {
      const zones = await professionalProfileAPI.getCoverageZones();
      setAllZones(zones);
    } catch (error) {
      setError('Error cargando zonas de cobertura');
      console.error('Error loading zones:', error);
    }
  };

  const filterZones = () => {
    if (!searchTerm.trim()) {
      setFilteredZones(allZones);
      return;
    }

    const filtered = allZones.filter(zone =>
      zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.state.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredZones(filtered);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada por este navegador');
      return;
    }

    setUseCurrentLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        
        try {
          // Buscar la zona más cercana basada en coordenadas
          const closestZone = findClosestZone(latitude, longitude);
          if (closestZone) {
            setSelectedZoneId(closestZone.id);
            onZoneChange({
              ...closestZone,
              latitude,
              longitude,
              radius_km: coverageRadius
            });
          } else {
            // Si no hay zona exacta, crear una zona personalizada
            const customZone = {
              id: 'custom',
              name: `Coordenadas ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              city: 'Ubicación actual',
              state: 'Personalizada',
              latitude,
              longitude,
              radius_km: coverageRadius
            };
            setSelectedZoneId('custom');
            onZoneChange(customZone);
          }
          
          setUseCurrentLocation(false);
        } catch {
          setError('Error al buscar zona cercana');
          setUseCurrentLocation(false);
        }
      },
      (error) => {
        setError('Error obteniendo ubicación: ' + error.message);
        setUseCurrentLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const findClosestZone = (lat, lng) => {
    if (allZones.length === 0) return null;

    let closestZone = null;
    let minDistance = Infinity;

    allZones.forEach(zone => {
      if (zone.latitude && zone.longitude) {
        const distance = calculateDistance(lat, lng, zone.latitude, zone.longitude);
        if (distance < minDistance) {
          minDistance = distance;
          closestZone = zone;
        }
      }
    });

    return closestZone;
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const selectZone = (zone) => {
    const zoneData = {
      ...zone,
      latitude: zone.latitude || coordinates.lat,
      longitude: zone.longitude || coordinates.lng,
      radius_km: coverageRadius
    };

    setSelectedZoneId(zone.id);
    setSearchTerm(`${zone.city}, ${zone.state}`);
    setIsDropdownOpen(false);
    onZoneChange(zoneData);
    setError('');
  };

  const updateCoverageRadius = (radius) => {
    setCoverageRadius(radius);
    
    if (selectedZone) {
      const updatedZone = {
        ...selectedZone,
        radius_km: radius
      };
      onZoneChange(updatedZone);
    }
  };

  const ZoneCard = ({ zone }) => (
    <button
      type="button"
      onClick={() => selectZone(zone)}
      className="w-full text-left p-4 hover:bg-emerald-50 rounded-xl transition-colors border border-gray-200 hover:border-emerald-300"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-2xl mr-3">📍</span>
          <div>
            <h4 className="font-medium text-gray-800">{zone.name}</h4>
            <p className="text-sm text-gray-600">{zone.city}, {zone.state}</p>
            {zone.radius_km && (
              <p className="text-xs text-emerald-600 mt-1">
                Radio: {zone.radius_km}km
              </p>
            )}
          </div>
        </div>
        {selectedZoneId === zone.id && (
          <span className="text-emerald-500">✓</span>
        )}
      </div>
    </button>
  );

  const DropdownContent = () => {
    const zonesToShow = searchTerm ? filteredZones : allZones;

    if (zonesToShow.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500">
          <p>No se encontraron zonas para "{searchTerm}"</p>
        </div>
      );
    }

    // Agrupar zonas por estado para mejor UX
    const groupedByState = zonesToShow.reduce((acc, zone) => {
      const state = zone.state || 'Otros';
      if (!acc[state]) {
        acc[state] = [];
      }
      acc[state].push(zone);
      return acc;
    }, {});

    return (
      <div className="max-h-80 overflow-y-auto">
        {Object.entries(groupedByState).map(([state, zones]) => (
          <div key={state} className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-3 py-2 bg-gray-50">
              🗺️ {state}
            </h4>
            <div className="py-1">
              {zones.map(zone => (
                <ZoneCard key={zone.id} zone={zone} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">🗺️ Zona de Cobertura</h2>
        <p className="text-gray-600">Define el área donde ofreces tus servicios</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Selector de Zona */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar Ubicación
          </label>
          <div className="relative mb-4" ref={dropdownRef}>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Buscar ciudad, barrio o zona..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              disabled={isLoading}
            />
            
            {isDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-hidden">
                <DropdownContent />
              </div>
            )}
          </div>

          {/* Botón de ubicación actual */}
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={useCurrentLocation}
            className="w-full bg-blue-500 text-white px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {useCurrentLocation ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Obteniendo ubicación...
              </>
            ) : (
              <>
                <span className="mr-2">📍</span>
                Usar mi ubicación actual
              </>
            )}
          </button>
        </div>

        {/* Configuración de Radio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Radio de Cobertura
          </label>
          <div className="bg-gray-50 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Radio de cobertura:</span>
              <span className="font-medium text-emerald-600">{coverageRadius} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={coverageRadius}
              onChange={(e) => updateCoverageRadius(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 km</span>
              <span>25 km</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Zona seleccionada */}
          {selectedZone && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h4 className="font-medium text-emerald-800 mb-2">📍 Zona Seleccionada</h4>
              <p className="text-sm text-emerald-700">{selectedZone.name}</p>
              <p className="text-xs text-emerald-600">{selectedZone.city}, {selectedZone.state}</p>
              {coordinates.lat && coordinates.lng && (
                <p className="text-xs text-emerald-600 mt-1">
                  Coordenadas: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mt-4">
          {error}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Consejos</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Define un radio realista para tu zona de servicio</li>
          <li>• Usa tu ubicación actual para mayor precisión</li>
          <li>• Los clientes verán tu distancia aproximada</li>
        </ul>
      </div>
    </div>
  );
};

export default ZoneSelector;