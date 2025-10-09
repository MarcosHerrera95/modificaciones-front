// src/routes/searchRoutes.js
const express = require('express');
const { searchProfessionals } = require('../controllers/searchController');

const router = express.Router();

router.get('/', searchProfessionals);

module.exports = router;