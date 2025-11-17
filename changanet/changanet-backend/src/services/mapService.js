/**
 * @archivo src/services/mapService.js - Servicio de Google Maps API
 * @descripción Gestiona operaciones de geocodificación y mapas usando Google Maps API (REQ-15, REQ-16)
 * @sprint Sprint 1 – Infraestructura y Base de Datos
 * @tarjeta Tarjeta 2: [Backend] Implementar API de Geolocalización
 * @impacto Social: Accesibilidad geográfica para usuarios con dificultades de movilidad
 */

const axios = require('axios');

// Configuración de Google Maps API
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Valida si la API key de Google Maps está configurada
 */
function isGoogleMapsConfigured() {
  return !!GOOGLE_MAPS_API_KEY;
}

/**
 * Obtiene datos de geocodificación para una dirección
 * @param {string} address - Dirección a geocodificar
 * @returns {Promise<Object>} Datos de geocodificación
 */
async function getGeocodeData(address) {
  try {
    if (!isGoogleMapsConfigured()) {
      throw new Error('Google Maps API key no configurada');
    }

    const response = await axios.get(GEOCODING_API_URL, {
      params: {
        address: address,
        key: GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Error en geocodificación: ${response.data.status}`);
    }

    // Extraer información relevante del primer resultado
    const result = response.data.results[0];
    if (!result) {
      throw new Error('No se encontraron resultados para la dirección');
    }

    const location = result.geometry.location;
    const formattedAddress = result.formatted_address;

    return {
      address: formattedAddress,
      latitude: location.lat,
      longitude: location.lng,
      placeId: result.place_id,
      types: result.types
    };

  } catch (error) {
    console.error('Error en geocodificación:', error.message);
    throw new Error(`Error al geocodificar dirección: ${error.message}`);
  }
}

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine
 * @param {number} lat1 - Latitud del punto 1
 * @param {number} lon1 - Longitud del punto 1
 * @param {number} lat2 - Latitud del punto 2
 * @param {number} lon2 - Longitud del punto 2
 * @returns {number} Distancia en kilómetros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

module.exports = {
  getGeocodeData,
  calculateDistance,
  isGoogleMapsConfigured
};