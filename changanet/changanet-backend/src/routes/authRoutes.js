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

// Ruta para autenticación con Firebase ID Token
router.post('/google/firebase', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Token de Firebase requerido' });
    }

    // Verificar el token de Firebase usando Firebase Admin SDK
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseError) {
      console.error('Error verificando token de Firebase:', firebaseError);
      return res.status(401).json({ error: 'Token de Firebase inválido' });
    }

    // Buscar o crear usuario basado en el email del token
    let user = await prisma.usuarios.findUnique({
      where: { email: decodedToken.email }
    });

    if (!user) {
      user = await prisma.usuarios.create({
        data: {
          email: decodedToken.email,
          nombre: decodedToken.name || decodedToken.email.split('@')[0],
          google_id: decodedToken.uid,
          url_foto_perfil: decodedToken.picture || null,
          rol: 'cliente',
          esta_verificado: decodedToken.email_verified || true,
        }
      });

      // Enviar email de bienvenida (no bloqueante)
      try {
        const { sendWelcomeEmail } = require('../services/emailService');
        await sendWelcomeEmail(user);
      } catch (emailError) {
        console.error('Error enviando email de bienvenida:', emailError);
      }
    } else {
      // Actualizar información si es necesario
      if (!user.google_id || user.google_id !== decodedToken.uid) {
        user = await prisma.usuarios.update({
          where: { id: user.id },
          data: {
            google_id: decodedToken.uid,
            url_foto_perfil: decodedToken.picture || user.url_foto_perfil,
            esta_verificado: decodedToken.email_verified || user.esta_verificado,
          }
        });
      }
    }

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.nombre,
        role: user.rol,
        verified: user.esta_verificado
      },
      token
    });
  } catch (error) {
    console.error('Error en autenticación Firebase:', error);
    res.status(500).json({ error: 'Error en autenticación' });
  }
});

// Ruta temporal de prueba para métricas de Prometheus (solo desarrollo)
router.get('/test', (req, res) => {
  res.status(200).json({ message: 'Ruta de prueba para métricas de Prometheus' });
});

// Exportar el enrutador para que pueda ser usado por el servidor principal (server.js).
module.exports = router;