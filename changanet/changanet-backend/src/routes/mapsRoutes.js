// src/routes/mapsRoutes.js - Rutas para Google Maps API
const express = require('express');
const { getGeocodeData } = require('../services/mapService');

const router = express.Router();

/**
 * GET /api/maps/geocode
 * Geocodifica una dirección usando Google Maps API
 */
router.get('/geocode', async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({
        error: 'Dirección requerida',
        message: 'Debe proporcionar una dirección para geocodificar'
      });
    }

    const geocodeData = await getGeocodeData(address);

    res.status(200).json({
      success: true,
      data: geocodeData
    });
  } catch (error) {
    console.error('Error en geocodificación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;