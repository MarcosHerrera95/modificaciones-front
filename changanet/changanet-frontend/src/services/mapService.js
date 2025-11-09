/**
 * Servicio de mapas para Changánet - Google Maps API Integration
 * Maneja geocodificación, autocompletado y cálculo de distancias
 * REQ-09, REQ-12, REQ-15
 * Usa la nueva API funcional con setOptions e importLibrary
 */

// Estado del servicio
let googleMaps = null;
let placesLibrary = null;
let mapsLibrary = null;

/**
 * Inicializa Google Maps API usando la nueva API funcional
 */
export const initGoogleMaps = async () => {
  try {
    if (!googleMaps) {
      // Configurar la API key globalmente
      google.maps.importLibrary.setOptions({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        version: 'weekly'
      });

      // Cargar las bibliotecas necesarias
      [mapsLibrary, placesLibrary] = await Promise.all([
        google.maps.importLibrary('maps'),
        google.maps.importLibrary('places')
      ]);

      googleMaps = google.maps;
      console.log('✅ Google Maps API inicializada con nueva API funcional');
    }
    return googleMaps;
  } catch (error) {
    console.error('❌ Error inicializando Google Maps:', error);
    throw new Error('No se pudo inicializar Google Maps API');
  }
};

/**
 * Inicializa Places Service usando la nueva API
 */
const initPlacesService = () => {
  if (!placesService && googleMaps && placesLibrary) {
    const mapDiv = document.createElement('div');
    const map = new mapsLibrary.Map(mapDiv, {
      center: { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
      zoom: 12
    });
    placesService = new placesLibrary.PlacesService(map);
  }
  return placesService;
};

/**
 * Geocodifica una dirección a coordenadas
 * @param {string} address - Dirección a geocodificar
 * @returns {Promise<{lat: number, lng: number}>}
 */
export const geocodeAddress = async (address) => {
  try {
    await initGoogleMaps();

    const geocoder = new googleMaps.Geocoder();

    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === googleMaps.GeocoderStatus.OK && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          reject(new Error(`Geocodificación fallida: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('Error en geocodificación:', error);
    throw error;
  }
};

/**
 * Calcula distancia y tiempo entre dos puntos usando Distance Matrix API
 * @param {Object} origin - {lat, lng} o dirección
 * @param {Object} destination - {lat, lng} o dirección
 * @returns {Promise<{distance: string, duration: string, distanceValue: number}>}
 */
export const getDistanceMatrix = async (origin, destination) => {
  try {
    await initGoogleMaps();

    const service = new googleMaps.DistanceMatrixService();

    return new Promise((resolve, reject) => {
      service.getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
        travelMode: googleMaps.TravelMode.DRIVING,
        unitSystem: googleMaps.UnitSystem.METRIC
      }, (response, status) => {
        if (status === googleMaps.DistanceMatrixStatus.OK) {
          const element = response.rows[0].elements[0];

          if (element.status === 'OK') {
            resolve({
              distance: element.distance.text,
              duration: element.duration.text,
              distanceValue: element.distance.value // en metros
            });
          } else {
            reject(new Error(`No se pudo calcular la distancia: ${element.status}`));
          }
        } else {
          reject(new Error(`Error en Distance Matrix: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('Error calculando distancia:', error);
    throw error;
  }
};

/**
 * Inicializa autocompletado de lugares en un input
 * @param {HTMLInputElement} inputElement - Elemento input
 * @param {Function} callback - Función a llamar cuando se selecciona un lugar
 * @returns {google.maps.places.Autocomplete}
 */
export const initAutocomplete = async (inputElement, callback) => {
  try {
    await initGoogleMaps();

    // Restringir a Argentina
    const autocomplete = new placesLibrary.Autocomplete(inputElement, {
      componentRestrictions: { country: 'ar' },
      fields: ['formatted_address', 'geometry', 'place_id'],
      types: ['geocode', 'establishment']
    });

    // Event listener para cuando se selecciona un lugar
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry) {
        console.warn('No se encontraron detalles del lugar seleccionado');
        return;
      }

      const location = {
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeId: place.place_id
      };

      callback(location);
    });

    return autocomplete;
  } catch (error) {
    console.error('Error inicializando autocompletado:', error);
    throw error;
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
  initGoogleMaps,
  geocodeAddress,
  getDistanceMatrix,
  initAutocomplete,
  calculateHaversineDistance,
  getSimulatedCoordinates
};