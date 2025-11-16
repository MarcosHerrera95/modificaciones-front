/**
 * Rutas de autenticación
 * Implementa endpoints para registro, login, verificación y recuperación de contraseña
 * Según sección 7.1 del PRD: Registro y Autenticación de Usuarios
 */

const express = require('express');
const passport = require('../config/passport');
const { authenticateToken } = require('../middleware/authenticate');
// Importar los controladores que contienen la lógica de negocio para registro y login.
const { register, login, googleCallback, googleLogin, registerProfessional, getCurrentUser, verifyEmail, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

// Rutas de autenticación
// POST /register - REQ-01: Registro de usuario cliente con email y contraseña
router.post('/register', register);
// POST /login - Validación de credenciales para login
router.post('/login', login);
// POST /register-professional - Registro de profesional con perfil completo
router.post('/register-professional', registerProfessional);
// POST /forgot-password - REQ-05: Solicitar recuperación de contraseña
router.post('/forgot-password', forgotPassword);
// POST /reset-password - REQ-05: Restablecer contraseña con token
router.post('/reset-password', resetPassword);
// GET /verify-email - REQ-03: Verificar email mediante token
router.get('/verify-email', verifyEmail);
// GET /me - Obtener datos del usuario autenticado
router.get('/me', authenticateToken, getCurrentUser);

// Rutas OAuth de Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  accessType: 'offline',
  prompt: 'consent',
  responseType: 'code'
}));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), googleCallback);

// Nueva ruta para login con Google desde frontend
router.post('/google-login', googleLogin);

module.exports = router;