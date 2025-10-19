// src/routes/galleryRoutes.js
const express = require('express');
const { upload } = require('../services/storageService');
const galleryController = require('../controllers/galleryController');

const router = express.Router();

// Obtener galería de trabajos de un profesional (público)
router.get('/:professionalId', galleryController.getGallery);

// Agregar imagen a la galería (solo profesionales autenticados)
router.post('/', upload.single('imagen'), galleryController.addGalleryImage);

// Eliminar imagen de la galería (solo el propietario)
router.delete('/:imageId', galleryController.deleteGalleryImage);

module.exports = router;