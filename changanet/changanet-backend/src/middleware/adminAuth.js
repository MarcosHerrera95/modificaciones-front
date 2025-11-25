/**
 * Middleware de autenticación para administradores
 */

/**
 * Verifica que el usuario autenticado sea administrador
 */
function requireAdmin(req, res, next) {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado'
      });
    }

    // Verificar que sea administrador
    if (req.user.rol !== 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado. Se requieren permisos de administrador'
      });
    }

    // Usuario autorizado
    next();
  } catch (error) {
    console.error('Error en middleware de admin:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Verifica que el usuario sea administrador o el propietario del recurso
 */
function requireAdminOrOwner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado'
      });
    }

    const isAdmin = req.user.rol === 'admin' || req.user.role === 'admin';
    const isOwner = req.user.id === req.params.userId || req.user.id === req.body.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        error: 'Acceso denegado. No tienes permisos para esta operación'
      });
    }

    next();
  } catch (error) {
    console.error('Error en middleware adminOrOwner:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
}

module.exports = {
  requireAdmin,
  requireAdminOrOwner
};