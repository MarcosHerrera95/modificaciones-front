// src/routes/availabilityRoutes.js
const express = require('express');
const { createAvailability, getAvailability, updateAvailability, deleteAvailability } = require('../controllers/availabilityController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

router.post('/', createAvailability);
router.get('/:professionalId', getAvailability);
router.put('/:slotId', updateAvailability);
router.delete('/:slotId', deleteAvailability);

module.exports = router;