// src/middleware/authenticate.js
// FUNCIÓN: Verifica el token JWT en las rutas protegidas para garantizar que solo usuarios autenticados accedan a ciertas funcionalidades.
// RELACIÓN PRD: REQ-03 (Verificación de email y login seguro), RB-01 (Autenticación obligatoria para acceder a funcionalidades de perfil, chat, reseñas y disponibilidad).
// TARJETA BACKEND: Tarjeta 1: [Backend] Implementar API de Registro y Login.
// SPRINT: Sprint 1 (Primera Entrega) - "Implementación del producto de software".

const jwt = require('jsonwebtoken'); // Librería para verificar tokens JWT

// Función middleware que se ejecuta antes de las rutas protegidas
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
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Si el token es inválido, expirado o mal formado, devolver 403 (Prohibido)
    req.user = user; // Añadir el payload del token (userId, role) al objeto 'req' para usarlo en los controladores posteriores
    console.log('req.user set to:', req.user);
    next(); // Pasar al siguiente middleware o controlador, permitiendo el acceso a la ruta solicitada
  });
};