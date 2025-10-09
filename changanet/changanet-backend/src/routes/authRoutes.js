// src/routes/authRoutes.js
// FUNCIÓN: Define los endpoints (URLs) públicos para el registro y login de usuarios.
// RELACIÓN PRD: REQ-01 (Registro), REQ-02 (Login).
// TARJETA BACKEND: Tarjeta 1: [Backend] Implementar API de Registro y Login.
// SPRINT: Sprint 1 (Primera Entrega) - "Implementación del producto de software".

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


// Exportar el enrutador para que pueda ser usado por el servidor principal (server.js).
module.exports = router;