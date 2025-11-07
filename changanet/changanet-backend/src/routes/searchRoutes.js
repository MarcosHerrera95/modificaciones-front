// src/routes/searchRoutes.js
const express = require('express');
const { searchProfessionals } = require('../controllers/searchController');

const router = express.Router();

// Ruta para buscar profesionales con filtros y ordenamiento
router.get('/', searchProfessionals);

module.exports = router;