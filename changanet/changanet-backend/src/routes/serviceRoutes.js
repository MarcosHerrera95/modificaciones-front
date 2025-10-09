// src/routes/serviceRoutes.js
const express = require('express');
const { scheduleService, getClientServices, getProfessionalServices, updateServiceStatus } = require('../controllers/serviceController');

const router = express.Router();

// Schedule a new service (client)
router.post('/', scheduleService);

// Get services for client
router.get('/client', getClientServices);

// Get services for professional
router.get('/professional', getProfessionalServices);

// Update service status (professional)
router.put('/:serviceId/status', updateServiceStatus);

module.exports = router;