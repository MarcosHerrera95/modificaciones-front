const express = require('express');
const passport = require('../config/passport');
const { authenticateToken } = require('../middleware/authenticate');
// Importar los controladores que contienen la lógica de negocio para registro y login.
const { register, login, googleCallback, registerProfessional, getCurrentUser } = require('../controllers/authController');

const router = express.Router();

// Rutas de autenticación
router.post('/register', register);
router.post('/login', login);
router.post('/register-professional', registerProfessional);
router.get('/me', authenticateToken, getCurrentUser);

// Rutas OAuth de Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  accessType: 'offline',
  prompt: 'consent'
}));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), googleCallback);

module.exports = router;