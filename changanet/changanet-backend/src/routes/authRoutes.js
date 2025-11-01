/**
 * @archivo src/routes/authRoutes.js - Rutas de autenticación
 * @descripción Define endpoints REST para registro, login y OAuth (REQ-01, REQ-02, REQ-03)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Social: Acceso seguro y accesible a la plataforma para todos los usuarios
 */

const express = require('express');
const passport = require('../config/passport');
// Importar los controladores que contienen la lógica de negocio para registro y login.
const { register, login, googleCallback } = require('../controllers/authController');

// Crear un enrutador de Express para agrupar las rutas relacionadas con la autenticación.
const router = express.Router();

// Definir la ruta POST para el registro de un nuevo usuario.
// REQ-01: El cliente enviará una solicitud POST a /api/auth/register con los datos del formulario.
router.post('/register', register);

// Definir la ruta POST para el inicio de sesión de un usuario existente.
// REQ-02: El cliente enviará una solicitud POST a /api/auth/login con email y contraseña.
router.post('/login', login);

// Rutas para autenticación con Google OAuth
// Ruta para iniciar el flujo de autenticación con Google
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

// Ruta de callback para Google OAuth
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  googleCallback
);

// Ruta para manejar el código de autorización desde el frontend (para popup flow)
router.post('/google/callback', googleCallback);

// Ruta temporal de prueba para métricas de Prometheus (solo desarrollo)
router.get('/test', (req, res) => {
  res.status(200).json({ message: 'Ruta de prueba para métricas de Prometheus' });
});

// Exportar el enrutador para que pueda ser usado por el servidor principal (server.js).
module.exports = router;