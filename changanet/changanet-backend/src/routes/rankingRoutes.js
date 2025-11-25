/**
 * Rutas para el sistema de rankings y reputación
 * REQ-36 a REQ-40: Sistema de verificación de identidad y reputación
 */

const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const reputationController = require('../controllers/reputationController');
const { authenticateToken } = require('../middleware/authenticate');

// Rutas públicas de ranking
router.get('/professionals', rankingController.getProfessionalsRanking);
router.get('/professionals/:professionalId', rankingController.getProfessionalRanking);
router.get('/specialty/:specialty', rankingController.getTopProfessionalsBySpecialty);

// Rutas de reputación
router.get('/reputation/:userId', reputationController.getUserReputation);
router.get('/reputation/ranking', reputationController.getReputationRanking);
router.get('/reputation/:userId/history', reputationController.getReputationHistory);

// Rutas protegidas (admin/interno)
router.post('/reputation/update', authenticateToken, reputationController.updateReputation);
router.post('/reputation/assign-medal', authenticateToken, reputationController.assignMedal);

module.exports = router;