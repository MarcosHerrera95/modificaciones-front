// src/routes/professionalRoutes.js
const express = require('express');
const { getProfessionals, getProfessionalById } = require('../controllers/professionalController');

const router = express.Router();

// Obtener todos los profesionales con filtros y ordenamiento
// GET /api/professionals?zona_cobertura=Palermo&especialidad=plomero&precio_min=100&precio_max=500&sort_by=calificacion_promedio&page=1&limit=10
router.get('/', getProfessionals);

// Obtener profesional específico por ID
// GET /api/professionals/123
router.get('/:id', getProfessionalById);

module.exports = router;"Forzar recarga" 
