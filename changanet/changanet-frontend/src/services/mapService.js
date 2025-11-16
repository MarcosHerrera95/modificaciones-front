/**
 * Servicio de mapas para Changánet - Google Maps API Integration
 * Maneja geocodificación, autocompletado y cálculo de distancias
 * REQ-09, REQ-12, REQ-15
 * Usa la nueva API funcional de @googlemaps/js-api-loader
 */

import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

// Estado del servicio
let isInitialized = false;

/**
 * Inicializa Google Maps API usando la nueva API funcional
 */
const initializeGoogleMaps = async () => {
  if (!isInitialized) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    console.log('Google Maps API Key:', apiKey ? `Present (starts with: ${apiKey.substring(0, 10)}...)` : 'Missing');
    console.log('API Key length:', apiKey ? apiKey.length : 0);
    console.log('API Key format check:', apiKey && apiKey.startsWith('AIza') ? 'Valid format' : 'Invalid format');

    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      console.warn('Google Maps API key not configured, using fallback mode');
      isInitialized = true; // Mark as initialized to prevent retries
      return;
    }

    setOptions({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry', 'routes']
    });
    isInitialized = true;
    console.log('Google Maps API initialized successfully');
  }
};


export const getDistanceMatrix = async (origin, destination) => {
  try {
    console.log('🔍 Attempting to calculate distance matrix...');
    console.log('📍 Origin:', origin);
    console.log('📍 Destination:', destination);

    // Validar que la API key esté configurada y no sea placeholder
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      console.log('⚠️  Google Maps API key not configured, using fallback distance calculation');
      throw new Error('API key not configured');
    }

    await initializeGoogleMaps();

    // Usar la nueva API funcional correcta para Distance Matrix
    const { DistanceMatrixService } = await importLibrary("routes");
    const service = new DistanceMatrixService();

    console.log('✅ DistanceMatrixService initialized, making request...');

    const response = await service.getDistanceMatrix({
      origins: [origin],
      destinations: [destination],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC
    });

    console.log('✅ Distance Matrix API response received successfully');
    console.log('📊 Response status:', response.rows?.[0]?.elements?.[0]?.status);

    if (!response.rows?.[0]?.elements?.[0]) {
      throw new Error('No se recibió respuesta válida de la API de Distance Matrix');
    }

    return response.rows[0].elements[0];
  } catch (error) {
    console.error("❌ Error calculando distancia con Google Maps:", error.message);

    // Para errores de API denegada, usar fallback automáticamente
    if (error.message && error.message.includes('REQUEST_DENIED')) {
      console.warn('🚫 Distance Matrix API denegada, usando cálculo alternativo');
    }

    if (error.message && error.message.includes('API key')) {
      throw new Error('Clave de API de Google Maps inválida o expirada.');
    }

    // Para otros errores, usar fallback automático con distancia simulada
    console.warn('⚠️  Error en Google Maps API, usando cálculo alternativo de distancia');

    // Calcular distancia aproximada usando coordenadas simuladas
    const originCoords = getSimulatedCoordinates(origin);
    const destCoords = getSimulatedCoordinates(destination);
    const distanceKm = calculateHaversineDistance(
      originCoords.lat, originCoords.lng,
      destCoords.lat, destCoords.lng
    );

    // Retornar objeto compatible con Distance Matrix API
    return {
      distance: {
        text: `${Math.round(distanceKm)} km`,
        value: Math.round(distanceKm * 1000) // metros
      },
      duration: {
        text: `${Math.round(distanceKm / 50 * 60)} mins`, // aproximado a 50km/h
        value: Math.round(distanceKm / 50 * 3600) // segundos
      },
      status: 'OK'
    };
  }
};

/**
 * Inicializa autocompletado de lugares en un input usando Autocomplete class
 * @param {HTMLInputElement} inputElement - Elemento input para autocompletado
 * @param {Function} callback - Función a llamar cuando se selecciona un lugar
 * @returns {Object} Instancia de Autocomplete
 */
export const initAutocomplete = async (inputElement, callback) => {
  try {
    await initializeGoogleMaps();
    const { Autocomplete } = await importLibrary('places');
    const autocomplete = new Autocomplete(inputElement, {
      types: ['geocode'],
      componentRestrictions: { country: 'AR' }
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        callback({
          address: place.formatted_address,
          location: place.geometry.location
        });
      }
    });
  } catch (error) {
    console.error('Error al inicializar Places API:', error);
    throw new Error('No se pudo cargar Google Maps Places API');
  }
};

/**
 * Calcula distancia usando fórmula de Haversine (fallback)
 * @param {number} lat1 - Latitud 1
 * @param {number} lon1 - Longitud 1
 * @param {number} lat2 - Latitud 2
 * @param {number} lon2 - Longitud 2
 * @returns {number} Distancia en km
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Obtiene coordenadas simuladas basadas en zona de cobertura
 * @param {string} zonaCobertura - Zona de cobertura del profesional
 * @returns {{lat: number, lng: number}}
 */
export const getSimulatedCoordinates = (zonaCobertura) => {
  const coordsMap = {
    'Palermo': [-34.5889, -58.4306],
    'Recoleta': [-34.5875, -58.3978],
    'Belgrano': [-34.5631, -58.4564],
    'CABA': [-34.6037, -58.3816],
    'La Plata': [-34.9214, -57.9544],
    'Mar del Plata': [-38.0055, -57.5426],
    'Córdoba': [-31.4201, -64.1888],
    'Rosario': [-32.9468, -60.6393],
    'Mendoza': [-32.8895, -68.8458]
  };

  for (const [zone, coords] of Object.entries(coordsMap)) {
    if (zonaCobertura && zonaCobertura.toLowerCase().includes(zone.toLowerCase())) {
      return { lat: coords[0], lng: coords[1] };
    }
  }

  // Default: Buenos Aires
  return { lat: -34.6037, lng: -58.3816 };
};

export default {
  getDistanceMatrix,
  initAutocomplete,
  calculateHaversineDistance,
  getSimulatedCoordinates
};