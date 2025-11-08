// src/routes/rankingRoutes.js
const express = require('express');
const { getRanking, getProfessionalRanking } = require('../controllers/rankingController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

router.get('/', getRanking);
router.get('/professional/:professionalId', getProfessionalRanking);

module.exports = router;