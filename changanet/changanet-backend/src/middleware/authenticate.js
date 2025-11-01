/**
 * @archivo src/middleware/authenticate.js - Middleware de autenticación JWT
 * @descripción Verifica tokens JWT en rutas protegidas y carga datos del usuario (REQ-03)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Económico: Seguridad robusta para todas las transacciones de la plataforma
 */

const jwt = require('jsonwebtoken'); // Librería para verificar tokens JWT
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Función middleware que se ejecuta antes de las rutas protegidas
/**
 * @función authenticateToken - Middleware de autenticación JWT
 * @descripción Verifica token JWT y carga datos completos del usuario desde BD (REQ-03)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Social: Protección de datos personales y privacidad de usuarios
 * @param {Object} req - Request con header Authorization
 * @param {Object} res - Response
 * @param {Function} next - Función para continuar al siguiente middleware
 */
exports.authenticateToken = (req, res, next) => {
  // Obtener el token del header 'Authorization' (formato: "Bearer TOKEN")
  // El header se espera en el formato estándar "Bearer <token>".
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extraer el token, ignorando la palabra "Bearer"

  // Si no hay token, devolver error 401 (No autorizado)
  // Esto protege las rutas contra accesos no autenticados.
  if (!token) return res.sendStatus(401);

  // Verificar el token usando la clave secreta (JWT_SECRET del .env)
  // La clave secreta debe coincidir con la usada al generar el token en el login.
  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      console.error('Error al verificar token JWT:', err);
      return res.sendStatus(403); // Si el token es inválido, expirado o mal formado, devolver 403 (Prohibido)
    }

    console.log('Token verificado, user:', user);

    // FCM Integration: Obtener información adicional del usuario desde la base de datos
    try {
      const userData = await prisma.usuarios.findUnique({
        where: { id: user.userId || user.id },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          esta_verificado: true
        }
      });

      if (!userData) {
        console.error('Usuario no encontrado en la base de datos:', user.userId);
        return res.sendStatus(403); // Usuario no encontrado
      }

      req.user = {
        ...user,
        ...userData,
        role: userData.rol // Mantener compatibilidad con código existente
      };

      console.log('req.user set to:', req.user);
      next(); // Pasar al siguiente middleware o controlador, permitiendo el acceso a la ruta solicitada
    } catch (dbError) {
      console.error('Error al obtener datos del usuario:', dbError);
      return res.sendStatus(500); // Error interno del servidor
    }
  });
};