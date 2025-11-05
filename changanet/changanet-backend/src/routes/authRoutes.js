const express = require('express');
const passport = require('../config/passport');
// Importar los controladores que contienen la lógica de negocio para registro y login.
const { register, login, googleCallback, registerProfessional } = require('../controllers/authController');

const router = express.Router();

// Rutas de autenticación
router.post('/register', register);
router.post('/login', login);
router.post('/register-professional', registerProfessional);

// Rutas OAuth de Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  response_type: 'code'
}));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), googleCallback);

module.exports = router;