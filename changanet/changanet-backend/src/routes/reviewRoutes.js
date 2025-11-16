// src/routes/reviewRoutes.js
const express = require('express');
const multer = require('multer');
const { createReview, getReviewsByProfessional, checkReviewEligibility } = require('../controllers/reviewController');
const { authenticateToken } = require('../middleware/authenticate');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Make sure this directory exists
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1]);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

router.post('/', upload.single('url_foto'), createReview);
router.get('/professional/:professionalId', getReviewsByProfessional);
router.get('/check/:servicioId', checkReviewEligibility);

// Obtener reseñas escritas por el cliente autenticado
router.get('/client', authenticateToken, async (req, res) => {
  try {
    const { id: clientId } = req.user;

    const reviews = await prisma.resenas.findMany({
      where: { cliente_id: clientId },
      include: {
        servicio: {
          include: {
            profesional: {
              select: {
                id: true,
                nombre: true,
                email: true,
                perfil_profesional: {
                  select: {
                    especialidad: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { creado_en: 'desc' }
    });

    res.json({ reviews });
  } catch (error) {
    console.error('Error al obtener reseñas del cliente:', error);
    res.status(500).json({ error: 'Error al obtener reseñas del cliente' });
  }
});

module.exports = router;