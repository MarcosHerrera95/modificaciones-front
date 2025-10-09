// src/routes/verificationRoutes.js
const express = require('express');
const { submitVerification, reviewVerification } = require('../controllers/verificationController');

const router = express.Router();

router.post('/submit', submitVerification);
router.post('/review', reviewVerification); // Solo admins pueden usar esta ruta

module.exports = router;