/**
 * UserService
 * Servicio de lógica de negocio para gestión de usuarios
 *
 * Implementa operaciones CRUD para usuarios, validaciones de negocio
 * y gestión de perfiles de usuario (cliente/profesional)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { getCachedUser, cacheUser, invalidateUser } = require('./cacheService');

const prisma = new PrismaClient();

class UserService {
  /**
   * Obtiene un usuario por ID con su perfil completo
   */
  async getUserById(userId, includePrivate = false) {
    try {
      // Intentar obtener del caché
      const cachedUser = await getCachedUser(userId);
      if (cachedUser && !includePrivate) {
        console.log('👤 Usuario obtenido del caché');
        return cachedUser;
      }

      const user = await prisma.usuarios.findUnique({
        where: { id: userId },
        include: {
          perfil_profesional: {
            include: {
              coverage_zone: true,
              professional_specialties: {
                include: {
                  specialty: true
                }
              }
            }
          },
          admin_profile: true,
          verification_requests: true
        }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Formatear respuesta
      const formattedUser = {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        telefono: user.telefono,
        rol: user.rol,
        esta_verificado: user.esta_verificado,
        bloqueado: user.bloqueado,
        creado_en: user.creado_en,
        actualizado_en: user.actualizado_en,
        url_foto_perfil: user.url_foto_perfil,
        sms_enabled: user.sms_enabled,
        direccion: user.direccion,
        preferencias_servicio: user.preferencias_servicio,
        notificaciones_push: user.notificaciones_push,
        notificaciones_email: user.notificaciones_email,
        notificaciones_sms: user.notificaciones_sms,
        notificaciones_servicios: user.notificaciones_servicios,
        notificaciones_mensajes: user.notificaciones_mensajes,
        notificaciones_pagos: user.notificaciones_pagos,
        notificaciones_marketing: user.notificaciones_marketing
      };

      // Solo añadir datos privados si se solicita
      if (includePrivate) {
        formattedUser.google_id = user.google_id;
        formattedUser.facebook_id = user.facebook_id;
        formattedUser.fcm_token = user.fcm_token;
        formattedUser.failed_login_attempts = user.failed_login_attempts;
        formattedUser.token_verificacion = user.token_verificacion;
        formattedUser.token_expiracion = user.token_expiracion;
        formattedUser.bloqueado_hasta = user.bloqueado_hasta;
        formattedUser.perfil_profesional = user.perfil_profesional;
        formattedUser.admin_profile = user.admin_profile;
        formattedUser.verification_requests = user.verification_requests;
      }

      // Almacenar en caché (solo datos públicos)
      if (!includePrivate) {
        await cacheUser(userId, formattedUser);
        console.log('💾 Usuario almacenado en caché');
      }

      return formattedUser;
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      throw error;
    }
  }

  /**
   * Actualiza los datos básicos de un usuario
   */
  async updateUser(userId, updateData) {
    try {
      const {
        nombre, email, telefono, direccion,
        preferencias_servicio,
        notificaciones_push, notificaciones_email,
        notificaciones_sms, notificaciones_servicios,
        notificaciones_mensajes, notificaciones_pagos,
        notificaciones_marketing, sms_enabled
      } = updateData;

      const updatedUser = await prisma.usuarios.update({
        where: { id: userId },
        data: {
          ...(nombre && { nombre }),
          ...(email && { email }),
          ...(telefono && { telefono }),
          ...(direccion && { direccion }),
          ...(preferencias_servicio && { preferencias_servicio }),
          ...(notificaciones_push !== undefined && { notificaciones_push: Boolean(notificaciones_push) }),
          ...(notificaciones_email !== undefined && { notificaciones_email: Boolean(notificaciones_email) }),
          ...(notificaciones_sms !== undefined && { notificaciones_sms: Boolean(notificaciones_sms) }),
          ...(notificaciones_servicios !== undefined && { notificaciones_servicios: Boolean(notificaciones_servicios) }),
          ...(notificaciones_mensajes !== undefined && { notificaciones_mensajes: Boolean(notificaciones_mensajes) }),
          ...(notificaciones_pagos !== undefined && { notificaciones_pagos: Boolean(notificaciones_pagos) }),
          ...(notificaciones_marketing !== undefined && { notificaciones_marketing: Boolean(notificaciones_marketing) }),
          ...(sms_enabled !== undefined && { sms_enabled: Boolean(sms_enabled) }),
          actualizado_en: new Date()
        }
      });

      // Invalidar caché
      await invalidateUser(userId);
      console.log('🗑️ User cache invalidated');

      return this.getUserById(userId, true);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Cambia la contraseña de un usuario
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await prisma.usuarios.findUnique({
        where: { id: userId },
        select: { hash_contrasena: true }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar contraseña actual (si existe)
      if (user.hash_contrasena && currentPassword) {
        const isValid = await bcrypt.compare(currentPassword, user.hash_contrasena);
        if (!isValid) {
          throw new Error('Contraseña actual incorrecta');
        }
      }

      // Hash de nueva contraseña
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Actualizar contraseña
      await prisma.usuarios.update({
        where: { id: userId },
        data: {
          hash_contrasena: hashedPassword,
          actualizado_en: new Date()
        }
      });

      // Invalidar caché
      await invalidateUser(userId);

      console.log('✅ Password changed successfully');
      return { success: true, message: 'Contraseña actualizada exitosamente' };
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  /**
   * Actualiza el token FCM para notificaciones push
   */
  async updateFCMToken(userId, fcmToken) {
    try {
      await prisma.usuarios.update({
        where: { id: userId },
        data: {
          fcm_token: fcmToken,
          actualizado_en: new Date()
        }
      });

      // Invalidar caché
      await invalidateUser(userId);

      return { success: true, message: 'Token FCM actualizado' };
    } catch (error) {
      console.error('Error updating FCM token:', error);
      throw error;
    }
  }

  /**
   * Bloquea o desbloquea un usuario
   */
  async toggleUserBlock(userId, blocked, blockedUntil = null, reason = '') {
    try {
      const updateData = {
        bloqueado: blocked,
        actualizado_en: new Date()
      };

      if (blocked && blockedUntil) {
        updateData.bloqueado_hasta = new Date(blockedUntil);
      } else if (!blocked) {
        updateData.bloqueado_hasta = null;
        updateData.failed_login_attempts = 0; // Reset failed attempts
      }

      await prisma.usuarios.update({
        where: { id: userId },
        data: updateData
      });

      // Invalidar caché
      await invalidateUser(userId);

      console.log(`✅ User ${blocked ? 'blocked' : 'unblocked'} successfully`);
      return {
        success: true,
        message: `Usuario ${blocked ? 'bloqueado' : 'desbloqueado'} exitosamente`,
        blocked,
        blockedUntil
      };
    } catch (error) {
      console.error('Error toggling user block:', error);
      throw error;
    }
  }

  /**
   * Registra un intento fallido de login
   */
  async recordFailedLogin(userId) {
    try {
      const user = await prisma.usuarios.findUnique({
        where: { id: userId },
        select: { failed_login_attempts: true, bloqueado: true }
      });

      if (!user || user.bloqueado) {
        return; // No registrar si ya está bloqueado
      }

      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const shouldBlock = newAttempts >= 5; // Bloquear después de 5 intentos

      const updateData = {
        failed_login_attempts: newAttempts,
        actualizado_en: new Date()
      };

      if (shouldBlock) {
        // Bloquear por 30 minutos
        updateData.bloqueado = true;
        updateData.bloqueado_hasta = new Date(Date.now() + 30 * 60 * 1000);
      }

      await prisma.usuarios.update({
        where: { id: userId },
        data: updateData
      });

      // Invalidar caché
      await invalidateUser(userId);

      return {
        attempts: newAttempts,
        blocked: shouldBlock,
        blockedUntil: shouldBlock ? updateData.bloqueado_hasta : null
      };
    } catch (error) {
      console.error('Error recording failed login:', error);
      throw error;
    }
  }

  /**
   * Limpia los intentos fallidos de login
   */
  async clearFailedLoginAttempts(userId) {
    try {
      await prisma.usuarios.update({
        where: { id: userId },
        data: {
          failed_login_attempts: 0,
          actualizado_en: new Date()
        }
      });

      // Invalidar caché
      await invalidateUser(userId);

      return { success: true };
    } catch (error) {
      console.error('Error clearing failed login attempts:', error);
      throw error;
    }
  }

  /**
   * Busca usuarios por criterios
   */
  async searchUsers(criteria) {
    try {
      const {
        query,
        rol,
        esta_verificado,
        bloqueado,
        page = 1,
        limit = 20,
        sortBy = 'creado_en',
        sortOrder = 'desc'
      } = criteria;

      const where = {
        ...(rol && { rol }),
        ...(esta_verificado !== undefined && { esta_verificado: Boolean(esta_verificado) }),
        ...(bloqueado !== undefined && { bloqueado: Boolean(bloqueado) }),
        ...(query && {
          OR: [
            { nombre: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { telefono: { contains: query, mode: 'insensitive' } }
          ]
        })
      };

      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.usuarios.findMany({
          where,
          select: {
            id: true,
            email: true,
            nombre: true,
            telefono: true,
            rol: true,
            esta_verificado: true,
            bloqueado: true,
            creado_en: true,
            actualizado_en: true,
            url_foto_perfil: true
          },
          orderBy,
          skip,
          take: limit
        }),
        prisma.usuarios.count({ where })
      ]);

      return {
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      };
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de usuarios
   */
  async getUserStats() {
    try {
      const [
        totalUsers,
        verifiedUsers,
        blockedUsers,
        professionals,
        clients,
        recentUsers
      ] = await Promise.all([
        prisma.usuarios.count(),
        prisma.usuarios.count({ where: { esta_verificado: true } }),
        prisma.usuarios.count({ where: { bloqueado: true } }),
        prisma.usuarios.count({ where: { rol: 'profesional' } }),
        prisma.usuarios.count({ where: { rol: 'cliente' } }),
        prisma.usuarios.count({
          where: {
            creado_en: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
            }
          }
        })
      ]);

      return {
        total: totalUsers,
        verified: verifiedUsers,
        blocked: blockedUsers,
        professionals,
        clients,
        recent: recentUsers,
        verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(1) : 0
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Elimina un usuario (soft delete - solo para admins)
   */
  async deleteUser(userId, adminId) {
    try {
      // En lugar de eliminar físicamente, podríamos marcar como eliminado
      // Por ahora, solo bloqueamos permanentemente
      await prisma.usuarios.update({
        where: { id: userId },
        data: {
          bloqueado: true,
          bloqueado_hasta: null, // Bloqueo permanente
          actualizado_en: new Date()
        }
      });

      // Invalidar caché
      await invalidateUser(userId);

      // Registrar en audit log
      await prisma.audit_log.create({
        data: {
          user_id: adminId,
          action: 'DELETE_USER',
          resource: 'usuarios',
          resource_id: userId,
          details: JSON.stringify({ deleted_by: adminId })
        }
      });

      console.log('✅ User deleted (soft delete) successfully');
      return { success: true, message: 'Usuario eliminado exitosamente' };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

module.exports = new UserService();