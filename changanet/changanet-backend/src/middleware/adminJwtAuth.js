/**
 * Middleware de autenticación JWT separado para administradores
 * Implementa un sistema de autenticación independiente para admin_users
 */

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const logger = require('../services/logger');

const prisma = new PrismaClient();

/**
 * Middleware para autenticar tokens JWT de administradores
 * Verifica tokens emitidos específicamente para admin_users
 */
exports.authenticateAdminToken = async (req, res, next) => {
  try {
    // Obtener el token del header 'Authorization'
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token de administrador requerido',
        message: 'Debes iniciar sesión como administrador para acceder a este recurso'
      });
    }

    // Verificar el token usando la clave secreta de admin
    const adminSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    jwt.verify(token, adminSecret, { algorithms: ['HS256'] }, async (err, decoded) => {
      if (err) {
        console.error('Error al verificar token JWT de admin:', err);
        let errorMessage = 'Token inválido o expirado';

        if (err.name === 'TokenExpiredError') {
          errorMessage = 'Tu sesión de administrador ha expirado. Por favor, inicia sesión nuevamente.';
        } else if (err.name === 'JsonWebTokenError') {
          errorMessage = 'Token de administrador inválido.';
        }

        return res.status(403).json({
          success: false,
          error: 'Token inválido',
          message: errorMessage
        });
      }

      try {
        // Verificar que el usuario existe en admin_users
        const adminUser = await prisma.admin_users.findUnique({
          where: { id: decoded.adminId || decoded.id },
          select: {
            id: true,
            email: true,
            nombre: true,
            rol: true,
            esta_activo: true,
            permisos: true,
            ultimo_acceso: true
          }
        });

        if (!adminUser) {
          console.error('Usuario administrador no encontrado:', decoded.adminId);
          return res.status(403).json({
            success: false,
            error: 'Usuario administrador no encontrado'
          });
        }

        // Verificar que el admin esté activo
        if (!adminUser.esta_activo) {
          console.warn('Acceso denegado: administrador inactivo', {
            adminId: adminUser.id,
            email: adminUser.email
          });
          return res.status(403).json({
            success: false,
            error: 'Cuenta de administrador suspendida',
            message: 'Tu cuenta de administrador ha sido suspendida.'
          });
        }

        // Actualizar último acceso
        await prisma.admin_users.update({
          where: { id: adminUser.id },
          data: { ultimo_acceso: new Date() }
        });

        // Adjuntar información del admin al request
        req.adminUser = {
          ...decoded,
          ...adminUser,
          permissions: JSON.parse(adminUser.permisos || '{}')
        };

        console.log('✅ Admin JWT verificado:', adminUser.nombre, `(${adminUser.id})`);
        next();

      } catch (dbError) {
        console.error('Error al obtener datos del administrador:', dbError);
        return res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          message: 'Error al verificar autenticación de administrador.'
        });
      }
    });

  } catch (error) {
    logger.error('Error en middleware de autenticación de admin JWT', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware para verificar permisos específicos de administrador
 */
exports.requireAdminPermission = (permission) => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación de administrador requerida'
      });
    }

    const userPermissions = req.adminUser.permissions || {};

    // Verificar si tiene el permiso específico o es superadmin
    if (req.adminUser.rol === 'superadmin' || userPermissions[permission]) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Permiso requerido: ${permission}`,
      message: 'No tienes permisos suficientes para realizar esta acción.'
    });
  };
};

/**
 * Middleware para verificar rol específico de administrador
 */
exports.requireAdminRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación de administrador requerida'
      });
    }

    if (req.adminUser.rol !== requiredRole && req.adminUser.rol !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: `Rol requerido: ${requiredRole}`,
        message: 'No tienes el rol necesario para realizar esta acción.'
      });
    }

    next();
  };
};

/**
 * Generar token JWT para administrador
 */
exports.generateAdminToken = (adminUser) => {
  const payload = {
    adminId: adminUser.id,
    email: adminUser.email,
    rol: adminUser.rol,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
  };

  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

/**
 * Verificar si el usuario es administrador válido
 */
exports.isValidAdmin = async (adminId) => {
  try {
    const admin = await prisma.admin_users.findUnique({
      where: { id: adminId },
      select: { id: true, esta_activo: true, rol: true }
    });

    return admin && admin.esta_activo;
  } catch (error) {
    logger.error('Error verificando administrador válido', { error, adminId });
    return false;
  }
};

module.exports = exports;