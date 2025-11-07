/**
 * @archivo src/config/passport.js - Configuración de Passport.js para OAuth
 * @descripción Configura estrategias de autenticación OAuth con Google (REQ-02)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Social: Autenticación simplificada accesible para usuarios con dificultades técnicas
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

/**
 * @estrategia Google OAuth - Autenticación con Google
 * @descripción Configura estrategia OAuth 2.0 para login con Google (REQ-02)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Social: Inclusión digital mediante autenticación familiar y accesible
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3002/api/auth/google/callback',
      scope: ['profile', 'email'],
      accessType: 'offline',
      prompt: 'consent'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Buscar usuario existente por email de Google
        let user = await prisma.usuarios.findUnique({
          where: { email: profile.emails[0].value }
        });

        if (user) {
          // Usuario existe, actualizar información si es necesario
          if (!user.google_id) {
            user = await prisma.usuarios.update({
              where: { id: user.id },
              data: {
                google_id: profile.id,
                url_foto_perfil: profile.photos[0].value,
                esta_verificado: true, // Los usuarios de Google están verificados
              }
            });
          }
        } else {
          // Crear nuevo usuario con datos de Google
          user = await prisma.usuarios.create({
            data: {
              email: profile.emails[0].value,
              nombre: profile.displayName,
              google_id: profile.id,
              url_foto_perfil: profile.photos[0].value,
              rol: 'cliente', // Por defecto, puede cambiarse después
              esta_verificado: true, // Los usuarios de Google están verificados
            }
          });
          console.log('Google OAuth: Created new user:', user.id);
        }

        console.log('Google OAuth: User authenticated:', user.nombre, '(', user.rol, ')');

        // Generar token JWT
        const token = jwt.sign(
          { userId: user.id, role: user.rol },
          process.env.JWT_SECRET,
          { expiresIn: '24h', algorithm: 'HS256' }
        );

        // Devolver usuario y token
        return done(null, { user, token });
      } catch (error) {
        console.error('Error en estrategia de Google:', error);
        return done(error, null);
      }
    }
  )
);

// Serializar usuario para la sesión
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserializar usuario de la sesión
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;