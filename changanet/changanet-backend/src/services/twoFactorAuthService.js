/**
 * Servicio de Autenticación de Dos Factores (2FA) con TOTP
 * Implementa Time-based One-Time Password compatible con Google Authenticator
 * @version 1.0.0
 * @date 2025-11-25
 */

const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient();

class TwoFactorAuthService {
  constructor() {
    // Configuración TOTP
    this.config = {
      step: 30,        // Tiempo de expiración en segundos (30s por defecto)
      window: 1,       // Ventana de tolerancia (1 paso antes/después)
      digits: 6,       // Número de dígitos del código
      algorithm: 'sha1' // Algoritmo de hashing
    };
  }

  /**
   * Genera un secreto TOTP para un usuario
   * @param {string} email - Email del usuario
   * @param {string} serviceName - Nombre del servicio (ChangÁnet)
   * @returns {Promise<Object>} Objeto con el secreto y configuración QR
   */
  async generateSecret(email, serviceName = 'ChangÁnet') {
    try {
      // Generar secreto TOTP
      const secret = speakeasy.generateSecret({
        name: `${serviceName} (${email})`,
        issuer: 'ChangÁnet',
        length: 32 // 32 bytes = 256 bits
      });

      // Guardar el secreto en la base de datos (encriptado)
      const encryptedSecret = this.encryptSecret(secret.base32);
      
      const twoFactorData = {
        userEmail: email,
        secret: encryptedSecret,
        isEnabled: false,
        backupCodes: [], // Se generarán cuando se active
        createdAt: new Date(),
        lastUsed: null,
        attempts: 0,
        isLocked: false,
        lockExpiresAt: null
      };

      logger.info('2FA secret generated', {
        email: email,
        service: serviceName,
        hasQrCode: !!secret.otpauth_url
      });

      return {
        secret: secret.base32,
        secretHex: secret.hex,
        qrCodeUrl: secret.otpauth_url,
        qrCodeImage: await this.generateQRCodeImage(secret.otpauth_url),
        serviceName: serviceName,
        email: email,
        tempData: twoFactorData // Datos temporales para activar después
      };

    } catch (error) {
      logger.error('Error generating 2FA secret', {
        email: email,
        error: error.message,
        stack: error.stack
      });
      throw new Error('Error al generar secreto de autenticación');
    }
  }

  /**
   * Activa 2FA para un usuario con verificación del código
   * @param {string} email - Email del usuario
   * @param {string} token - Código TOTP del usuario
   * @param {Object} twoFactorData - Datos temporales de 2FA
   * @returns {Promise<Object>} Resultado de la activación
   */
  async activateTwoFactor(email, token, twoFactorData) {
    try {
      // Verificar el código TOTP
      const isValid = speakeasy.totp.verify({
        secret: twoFactorData.secret,
        encoding: 'base32',
        token: token,
        step: this.config.step,
        window: this.config.window,
        algorithm: this.config.algorithm
      });

      if (!isValid) {
        logger.warn('Invalid 2FA token during activation', { email: email });
        return {
          success: false,
          error: 'Código de verificación inválido'
        };
      }

      // Generar códigos de respaldo
      const backupCodes = this.generateBackupCodes();

      // Guardar en base de datos
      const savedTwoFactor = await prisma.autenticacion_dos_factores.create({
        data: {
          usuario_id: await this.getUserIdByEmail(email),
          secret: twoFactorData.secret,
          backup_codes: backupCodes,
          is_enabled: true,
          created_at: new Date(),
          last_used: null,
          attempts: 0,
          is_locked: false
        }
      });

      logger.info('2FA activated successfully', {
        email: email,
        userId: savedTwoFactor.usuario_id,
        backupCodesCount: backupCodes.length
      });

      return {
        success: true,
        message: 'Autenticación de dos factores activada exitosamente',
        backupCodes: backupCodes,
        backupCodesCount: backupCodes.length
      };

    } catch (error) {
      logger.error('Error activating 2FA', {
        email: email,
        error: error.message,
        stack: error.stack
      });
      throw new Error('Error al activar autenticación de dos factores');
    }
  }

  /**
   * Verifica un código TOTP durante el login
   * @param {string} email - Email del usuario
   * @param {string} token - Código TOTP
   * @param {Object} loginContext - Contexto del login (IP, device, etc.)
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async verifyTwoFactorToken(email, token, loginContext = {}) {
    try {
      // Buscar configuración 2FA del usuario
      const twoFactorConfig = await prisma.autenticacion_dos_factores.findUnique({
        where: { usuario_id: await this.getUserIdByEmail(email) },
        include: { usuario: true }
      });

      if (!twoFactorConfig || !twoFactorConfig.is_enabled) {
        return {
          success: false,
          error: 'Autenticación de dos factores no configurada',
          requires2FA: false
        };
      }

      // Verificar si está bloqueado
      if (twoFactorConfig.is_locked) {
        if (twoFactorConfig.lock_expires_at && new Date() < twoFactorConfig.lock_expires_at) {
          const remainingTime = Math.ceil((twoFactorConfig.lock_expires_at - new Date()) / 1000);
          logger.warn('2FA verification attempt while locked', {
            email: email,
            remainingTime: remainingTime,
            ip: loginContext.ip
          });
          
          return {
            success: false,
            error: `Cuenta bloqueada temporalmente. Inténtalo en ${remainingTime} segundos.`,
            locked: true,
            remainingTime: remainingTime
          };
        } else {
          // Desbloquear si ya pasó el tiempo
          await prisma.autenticacion_dos_factores.update({
            where: { usuario_id: twoFactorConfig.usuario_id },
            data: {
              is_locked: false,
              lock_expires_at: null,
              attempts: 0
            }
          });
        }
      }

      // Verificar código TOTP
      const isValidTotp = speakeasy.totp.verify({
        secret: this.decryptSecret(twoFactorConfig.secret),
        encoding: 'base32',
        token: token,
        step: this.config.step,
        window: this.config.window,
        algorithm: this.config.algorithm
      });

      if (isValidTotp) {
        // Éxito - actualizar último uso y resetear intentos
        await prisma.autenticacion_dos_factores.update({
          where: { usuario_id: twoFactorConfig.usuario_id },
          data: {
            last_used: new Date(),
            attempts: 0,
            is_locked: false,
            lock_expires_at: null
          }
        });

        // Registrar actividad de seguridad
        await this.logSecurityActivity(twoFactorConfig.usuario_id, '2fa_success', loginContext);

        logger.info('2FA verification successful', {
          email: email,
          userId: twoFactorConfig.usuario_id,
          ip: loginContext.ip
        });

        return {
          success: true,
          message: 'Verificación de dos factores exitosa',
          requires2FA: true
        };
      }

      // Verificar códigos de respaldo
      const isValidBackup = await this.verifyBackupCode(twoFactorConfig.usuario_id, token, loginContext);

      if (isValidBackup) {
        // Marcar código de backup como usado
        await this.markBackupCodeAsUsed(twoFactorConfig.usuario_id, token);

        logger.info('2FA verification successful (backup code)', {
          email: email,
          userId: twoFactorConfig.usuario_id,
          ip: loginContext.ip
        });

        return {
          success: true,
          message: 'Verificación con código de respaldo exitosa',
          usedBackupCode: true,
          requires2FA: true
        };
      }

      // Código inválido - incrementar contador
      const newAttempts = (twoFactorConfig.attempts || 0) + 1;
      const maxAttempts = 5; // Máximo 5 intentos
      const shouldLock = newAttempts >= maxAttempts;

      await prisma.autenticacion_dos_factores.update({
        where: { usuario_id: twoFactorConfig.usuario_id },
        data: {
          attempts: newAttempts,
          is_locked: shouldLock,
          lock_expires_at: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null // 15 minutos
        }
      });

      // Registrar intento fallido
      await this.logSecurityActivity(twoFactorConfig.usuario_id, '2fa_failed', {
        ...loginContext,
        attempts: newAttempts
      });

      logger.warn('2FA verification failed', {
        email: email,
        userId: twoFactorConfig.usuario_id,
        attempts: newAttempts,
        locked: shouldLock,
        ip: loginContext.ip
      });

      return {
        success: false,
        error: 'Código de verificación inválido',
        attempts: newAttempts,
        maxAttempts: maxAttempts,
        locked: shouldLock,
        remainingAttempts: Math.max(0, maxAttempts - newAttempts)
      };

    } catch (error) {
      logger.error('Error verifying 2FA token', {
        email: email,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: 'Error al verificar código de autenticación'
      };
    }
  }

  /**
   * Desactiva 2FA para un usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña para confirmar
   * @returns {Promise<Object>} Resultado de la desactivación
   */
  async disableTwoFactor(email, password) {
    try {
      // Verificar contraseña
      const user = await this.verifyPassword(email, password);
      if (!user) {
        return {
          success: false,
          error: 'Contraseña incorrecta'
        };
      }

      // Desactivar 2FA
      await prisma.autenticacion_dos_factores.update({
        where: { usuario_id: user.id },
        data: {
          is_enabled: false,
          secret: null,
          backup_codes: [],
          attempts: 0,
          is_locked: false,
          lock_expires_at: null
        }
      });

      logger.info('2FA disabled', {
        email: email,
        userId: user.id
      });

      return {
        success: true,
        message: 'Autenticación de dos factores desactivada'
      };

    } catch (error) {
      logger.error('Error disabling 2FA', {
        email: email,
        error: error.message,
        stack: error.stack
      });
      throw new Error('Error al desactivar autenticación de dos factores');
    }
  }

  /**
   * Genera nuevos códigos de respaldo
   * @param {string} email - Email del usuario
   * @returns {Promise<Object>} Nuevos códigos de respaldo
   */
  async regenerateBackupCodes(email) {
    try {
      const userId = await this.getUserIdByEmail(email);
      
      // Verificar que 2FA está activo
      const twoFactorConfig = await prisma.autenticacion_dos_factores.findUnique({
        where: { usuario_id: userId }
      });

      if (!twoFactorConfig || !twoFactorConfig.is_enabled) {
        throw new Error('Autenticación de dos factores no está activa');
      }

      // Generar nuevos códigos
      const newBackupCodes = this.generateBackupCodes();

      // Actualizar códigos
      await prisma.autenticacion_dos_factores.update({
        where: { usuario_id: userId },
        data: { backup_codes: newBackupCodes }
      });

      logger.info('2FA backup codes regenerated', {
        email: email,
        userId: userId
      });

      return {
        success: true,
        backupCodes: newBackupCodes,
        backupCodesCount: newBackupCodes.length
      };

    } catch (error) {
      logger.error('Error regenerating backup codes', {
        email: email,
        error: error.message,
        stack: error.stack
      });
      throw new Error('Error al generar nuevos códigos de respaldo');
    }
  }

  /**
   * Genera código QR para mostrar al usuario
   * @param {string} otpauthUrl - URL otpauth
   * @returns {Promise<string>} URL del código QR como imagen
   */
  async generateQRCodeImage(otpauthUrl) {
    try {
      const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return qrCodeDataUrl;
    } catch (error) {
      logger.error('Error generating QR code', {
        error: error.message,
        stack: error.stack
      });
      throw new Error('Error al generar código QR');
    }
  }

  /**
   * Genera códigos de respaldo aleatorios
   * @returns {Array<string>} Array de códigos de respaldo
   */
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 8; i++) {
      // Generar código de 8 dígitos
      const code = crypto.randomInt(10000000, 99999999).toString();
      // Hash del código para almacenamiento seguro
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      codes.push(hashedCode);
    }
    return codes;
  }

  /**
   * Verifica si un código de respaldo es válido
   * @param {number} userId - ID del usuario
   * @param {string} code - Código a verificar
   * @param {Object} context - Contexto del login
   * @returns {Promise<boolean>} true si es válido
   */
  async verifyBackupCode(userId, code, context) {
    try {
      const twoFactorConfig = await prisma.autenticacion_dos_factores.findUnique({
        where: { usuario_id: userId }
      });

      if (!twoFactorConfig || !twoFactorConfig.backup_codes) {
        return false;
      }

      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      
      return twoFactorConfig.backup_codes.some(backupCode => 
        backupCode.code === hashedCode && !backupCode.used
      );

    } catch (error) {
      logger.error('Error verifying backup code', {
        userId: userId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Marca un código de respaldo como usado
   * @param {number} userId - ID del usuario
   * @param {string} code - Código usado
   */
  async markBackupCodeAsUsed(userId, code) {
    try {
      const twoFactorConfig = await prisma.autenticacion_dos_factores.findUnique({
        where: { usuario_id: userId }
      });

      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      const updatedCodes = twoFactorConfig.backup_codes.map(backupCode => {
        if (backupCode.code === hashedCode) {
          return {
            ...backupCode,
            used: true,
            usedAt: new Date()
          };
        }
        return backupCode;
      });

      await prisma.autenticacion_dos_factores.update({
        where: { usuario_id: userId },
        data: { backup_codes: updatedCodes }
      });

    } catch (error) {
      logger.error('Error marking backup code as used', {
        userId: userId,
        error: error.message
      });
    }
  }

  /**
   * Obtiene estado de 2FA para un usuario
   * @param {string} email - Email del usuario
   * @returns {Promise<Object>} Estado de 2FA
   */
  async getTwoFactorStatus(email) {
    try {
      const userId = await this.getUserIdByEmail(email);
      
      const twoFactorConfig = await prisma.autenticacion_dos_factores.findUnique({
        where: { usuario_id: userId }
      });

      return {
        isEnabled: twoFactorConfig?.is_enabled || false,
        hasBackupCodes: !!(twoFactorConfig?.backup_codes?.length),
        backupCodesRemaining: twoFactorConfig?.backup_codes?.filter(code => !code.used)?.length || 0,
        lastUsed: twoFactorConfig?.last_used,
        isLocked: twoFactorConfig?.is_locked || false,
        attempts: twoFactorConfig?.attempts || 0
      };

    } catch (error) {
      logger.error('Error getting 2FA status', {
        email: email,
        error: error.message
      });
      return {
        isEnabled: false,
        hasBackupCodes: false,
        backupCodesRemaining: 0,
        isLocked: false,
        attempts: 0
      };
    }
  }

  // Métodos auxiliares

  /**
   * Encripta el secreto TOTP para almacenamiento seguro
   */
  encryptSecret(secret) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Desencripta el secreto TOTP
   */
  decryptSecret(encryptedSecret) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
    const textParts = encryptedSecret.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Verifica contraseña del usuario (para desactivar 2FA)
   */
  async verifyPassword(email, password) {
    // Esta función debería usar el mismo sistema que el login
    const bcrypt = require('bcryptjs');
    
    const user = await prisma.usuarios.findUnique({
      where: { email }
    });

    if (!user || !user.hash_contrasena) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.hash_contrasena);
    return isValid ? user : null;
  }

  /**
   * Obtiene ID del usuario por email
   */
  async getUserIdByEmail(email) {
    const user = await prisma.usuarios.findUnique({
      where: { email },
      select: { id: true }
    });
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    return user.id;
  }

  /**
   * Registra actividad de seguridad
   */
  async logSecurityActivity(userId, activityType, context = {}) {
    try {
      await prisma.actividad_seguridad.create({
        data: {
          usuario_id: userId,
          tipo_actividad: activityType,
          timestamp: new Date(),
          detalles: context,
          ip_address: context.ip || null,
          user_agent: context.userAgent || null
        }
      });
    } catch (error) {
      logger.error('Error logging security activity', {
        userId: userId,
        activityType: activityType,
        error: error.message
      });
    }
  }
}

module.exports = TwoFactorAuthService;