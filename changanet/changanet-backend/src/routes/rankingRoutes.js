// src/routes/rankingRoutes.js
const express = require('express');
const { getRanking, getProfessionalRanking } = require('../controllers/rankingController');

const router = express.Router();

router.get('/', getRanking);
router.get('/professional/:professionalId', getProfessionalRanking);

module.exports = router;