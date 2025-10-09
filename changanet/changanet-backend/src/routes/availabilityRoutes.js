// src/routes/availabilityRoutes.js
const express = require('express');
const { createAvailability, getAvailability } = require('../controllers/availabilityController');

const router = express.Router();

router.post('/', createAvailability);
router.get('/:professionalId', getAvailability);

module.exports = router;