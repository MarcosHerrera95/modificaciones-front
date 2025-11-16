// src/routes/searchRoutes.js
// Rutas para sistema de búsqueda de profesionales
// Implementa sección 7.3 del PRD: Sistema de Búsqueda y Filtros

const express = require('express');
const { searchProfessionals } = require('../controllers/searchController');

const router = express.Router();

// Ruta para buscar profesionales con filtros y ordenamiento
router.get('/', searchProfessionals);

module.exports = router;