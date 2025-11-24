/**
 * Rutas de autenticación
 * Implementa endpoints para registro, login, verificación y recuperación de contraseña
 * Según sección 7.1 del PRD: Registro y Autenticación de Usuarios
 */

const express = require('express');
const passport = require('../config/passport');
const { authenticateToken } = require('../middleware/authenticate');
const { RateLimiterMemory } = require('rate-limiter-flexible');
// Importar los controladores que contienen la lógica de negocio para registro y login.
const { register, login, googleCallback, googleLogin, facebookCallback, facebookLogin, registerProfessional, getCurrentUser, verifyEmail, resendVerificationEmail, forgotPassword, resetPassword, refreshToken, logout } = require('../controllers/authController');

const router = express.Router();

// Configuración de Rate Limiting
const loginLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 5, // Número de intentos
  duration: 900, // Por 15 minutos (900 segundos)
  blockDuration: 1800, // Bloquear por 30 minutos
});

const registerLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 3, // Número de registros por IP
  duration: 3600, // Por 1 hora
  blockDuration: 3600, // Bloquear por 1 hora
});

const forgotPasswordLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 3, // Número de solicitudes de reset por IP
  duration: 3600, // Por 1 hora
  blockDuration: 3600, // Bloquear por 1 hora
});

// Middleware para rate limiting con manejo de errores
const rateLimitMiddleware = (limiter) => {
  return async (req, res, next) => {
    // Deshabilitar rate limiting en modo test
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    try {
      await limiter.consume(req.ip);
      next();
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Demasiados intentos',
        message: `Demasiados intentos. Inténtalo de nuevo en ${secs} segundos.`,
        retryAfter: secs
      });
    }
  };
};

// Rutas de autenticación con Rate Limiting
// POST /register - REQ-01: Registro de usuario cliente con email y contraseña
router.post('/register', rateLimitMiddleware(registerLimiter), register);
// POST /login - Validación de credenciales para login
router.post('/login', rateLimitMiddleware(loginLimiter), login);
// POST /register-professional - Registro de profesional con perfil completo
router.post('/register-professional', rateLimitMiddleware(registerLimiter), registerProfessional);
// POST /forgot-password - REQ-05: Solicitar recuperación de contraseña
router.post('/forgot-password', rateLimitMiddleware(forgotPasswordLimiter), forgotPassword);
// POST /reset-password - REQ-05: Restablecer contraseña con token
router.post('/reset-password', rateLimitMiddleware(loginLimiter), resetPassword);
// GET /verify-email - REQ-03: Verificar email mediante token
router.get('/verify-email', verifyEmail);
// POST /resend-verification - Reenviar email de verificación
router.post('/resend-verification', resendVerificationEmail);
// GET /me - Obtener datos del usuario autenticado
router.get('/me', authenticateToken, getCurrentUser);
// POST /refresh - Refresh token para obtener nuevo access token
router.post('/refresh', refreshToken);
// POST /logout - Logout que revoca refresh tokens
router.post('/logout', authenticateToken, logout);

// Rutas OAuth de Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  accessType: 'offline',
  prompt: 'consent',
  responseType: 'code'
}));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), googleCallback);

// Nueva ruta para login con Google desde frontend (con rate limiting)
router.post('/google-login', rateLimitMiddleware(loginLimiter), googleLogin);

// Rutas OAuth de Facebook
router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email']
}));
router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), facebookCallback);

// Nueva ruta para login con Facebook desde frontend (con rate limiting)
router.post('/facebook-login', rateLimitMiddleware(loginLimiter), facebookLogin);

module.exports = router;