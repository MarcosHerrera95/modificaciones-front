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
      // Verificar que la API key esté disponible
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw new Error('Google Maps API key no configurada. Verifica VITE_GOOGLE_MAPS_API_KEY en .env.local');
      }

      console.log('🔄 Inicializando Google Maps API...');
      console.log('API Key presente:', !!apiKey);

      // Verificar que google esté disponible globalmente
      if (typeof google === 'undefined') {
        console.error('❌ Google no está definido globalmente. Necesitas cargar el script de Google Maps.');
        throw new Error('Google Maps script no cargado. Verifica la configuración de CSP y el script loader.');
      }

      console.log('✅ Google disponible globalmente');

      // No necesitamos configurar opciones adicionales, la API key ya está en el script
      console.log('✅ API key ya configurada en el script global');

      // Cargar las bibliotecas necesarias
      console.log('📚 Cargando bibliotecas maps y places...');
      [mapsLibrary, placesLibrary] = await Promise.all([
        google.maps.importLibrary('maps'),
        google.maps.importLibrary('places')
      ]);
      console.log('✅ Bibliotecas maps y places cargadas');

      googleMaps = google.maps;
      console.log('✅ Google Maps API inicializada correctamente');
    }
    return googleMaps;
  } catch (error) {
    console.error('❌ Error inicializando Google Maps:', error);
    console.error('Detalles del error:', error.message);
    console.error('Stack trace:', error.stack);
    throw new Error(`No se pudo inicializar Google Maps API: ${error.message}`);
  }
};

// Estado del servicio
let placesService = null;

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
    console.log('🔄 Inicializando autocompletado...');
    await initGoogleMaps();
    console.log('✅ Google Maps inicializado, creando autocompletado...');

    // Usar la nueva API recomendada: PlaceAutocompleteElement
    const autocompleteElement = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: 'ar' },
      types: ['geocode', 'establishment']
    });

    // Crear un contenedor para el elemento de autocompletado
    const container = document.createElement('div');
    container.style.position = 'relative';
    inputElement.parentNode.insertBefore(container, inputElement);
    container.appendChild(autocompleteElement);

    // Ocultar el input original y usar el nuevo elemento
    inputElement.style.display = 'none';

    console.log('✅ Autocompletado creado exitosamente con PlaceAutocompleteElement');

    // Event listener para cuando se selecciona un lugar
    autocompleteElement.addEventListener('gmp-placeselect', (event) => {
      const place = event.place;

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

      console.log('📍 Lugar seleccionado:', location);
      callback(location);
    });

    return autocompleteElement;
  } catch (error) {
    console.error('❌ Error inicializando autocompletado:', error);
    console.error('Detalles del error:', error.message);
    console.error('Stack trace:', error.stack);
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