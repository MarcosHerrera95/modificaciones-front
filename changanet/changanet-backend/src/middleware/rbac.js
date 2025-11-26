/**
 * Middleware de Control de Acceso Basado en Roles (RBAC)
 * Implementación para Panel de Administración según PRD
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Definición de permisos por rol
const PERMISSIONS = {
  superadmin: [
    'users.view', 'users.edit', 'users.block', 'users.delete',
    'verifications.view', 'verifications.approve', 'verifications.reject',
    'moderation.view', 'moderation.manage', 'moderation.delete',
    'disputes.view', 'disputes.resolve', 'disputes.refund',
    'payments.view', 'payments.release', 'payments.refund',
    'commissions.view', 'commissions.edit',
    'settings.view', 'settings.edit',
    'audit.view',
    'reports.view', 'reports.export',
    'system.admin'
  ],
  manager: [
    'users.view', 'users.edit', 'users.block',
    'verifications.view', 'verifications.approve', 'verifications.reject',
    'moderation.view', 'moderation.manage',
    'disputes.view', 'disputes.resolve',
    'payments.view', 'payments.release',
    'commissions.view', // Solo ver, no editar
    'audit.view',
    'reports.view', 'reports.export'
  ],
  support: [
    'users.view',
    'verifications.view', 'verifications.approve', 'verifications.reject',
    'moderation.view', 'moderation.manage',
    'disputes.view',
    'payments.view',
    'audit.view'
  ]
};

/**
 * Middleware para verificar permisos de administrador
 */
exports.requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    // Verificar si el usuario tiene rol de admin o es admin básico
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    // Obtener perfil de admin para roles granulares
    const adminProfile = await prisma.admin_profile.findUnique({
      where: { user_id: req.user.id }
    });

    if (!adminProfile || !adminProfile.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Perfil de administrador no encontrado o inactivo.'
      });
    }

    // Adjuntar información del admin al request
    req.admin = {
      profile: adminProfile,
      permissions: PERMISSIONS[adminProfile.role] || []
    };

    next();
  } catch (error) {
    console.error('Error en requireAdmin middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware para verificar permisos específicos
 */
exports.requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin || !req.admin.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `Permiso requerido: ${permission}`,
        message: 'No tienes permisos suficientes para realizar esta acción.'
      });
    }
    next();
  };
};

/**
 * Middleware para verificar rol específico
 */
exports.requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.admin || req.admin.profile.role !== requiredRole) {
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
 * Servicio para verificar permisos (útil en controladores)
 */
exports.hasPermission = (adminProfile, permission) => {
  const permissions = PERMISSIONS[adminProfile.role] || [];
  return permissions.includes(permission);
};

/**
 * Servicio para obtener todos los permisos de un rol
 */
exports.getRolePermissions = (role) => {
  return PERMISSIONS[role] || [];
};

/**
 * Servicio para validar si un rol existe
 */
exports.isValidRole = (role) => {
  return Object.keys(PERMISSIONS).includes(role);
};