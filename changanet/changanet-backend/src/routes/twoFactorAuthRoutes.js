/**
 * Rutas de Autenticación de Dos Factores (2FA)
 * Endpoints para gestión completa de TOTP y códigos de respaldo
 * @version 1.0.0
 * @date 2025-11-25
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authenticate');
const TwoFactorAuthService = require('../services/twoFactorAuthService');
const RecaptchaService = require('../services/recaptchaService');
const logger = require('../services/logger');

const router = express.Router();
const twoFactorService = new TwoFactorAuthService();

// Middleware de autenticación requerido para todas las rutas 2FA
router.use(authenticateToken);

/**
 * POST /api/2fa/generate-secret
 * Genera secreto TOTP para configurar 2FA
 */
router.post('/generate-secret', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const recaptchaResult = await RecaptchaService.verifyMiddleware('2fa_setup')(req, res, () => {});

    if (!req.recaptchaVerified) {
      return res.status(429).json({
        error: 'Verificación reCAPTCHA requerida',
        code: 'RECAPTCHA_VERIFICATION_REQUIRED'
      });
    }

    // Generar secreto TOTP
    const secretData = await twoFactorService.generateSecret(userEmail);

    logger.info('2FA secret generated for user', {
      userId: req.user.id,
      email: userEmail,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Secreto de autenticación generado exitosamente',
      data: {
        secret: secretData.secret,
        qrCodeUrl: secretData.qrCodeUrl,
        qrCodeImage: secretData.qrCodeImage,
        serviceName: secretData.serviceName,
        email: secretData.email,
        tempData: secretData.tempData
      }
    });

  } catch (error) {
    logger.error('Error generating 2FA secret', {
      userId: req.user.id,
      email: req.user.email,
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Error al generar secreto de autenticación',
      code: 'SECRET_GENERATION_ERROR'
    });
  }
});

/**
 * POST /api/2fa/activate
 * Activa 2FA con verificación del código
 */
router.post('/activate', async (req, res) => {
  try {
    const { token, tempData } = req.body;
    const userEmail = req.user.email;

    if (!token || !tempData) {
      return res.status(400).json({
        success: false,
        error: 'Token y datos temporales son requeridos',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Verificar reCAPTCHA
    const recaptchaResult = await RecaptchaService.verifyMiddleware('2fa_setup')(req, res, () => {});
    if (!req.recaptchaVerified) {
      return res.status(429).json({
        success: false,
        error: 'Verificación reCAPTCHA requerida',
        code: 'RECAPTCHA_VERIFICATION_REQUIRED'
      });
    }

    // Activar 2FA
    const activationResult = await twoFactorService.activateTwoFactor(userEmail, token, tempData);

    if (!activationResult.success) {
      return res.status(400).json({
        success: false,
        error: activationResult.error,
        code: 'ACTIVATION_FAILED'
      });
    }

    logger.info('2FA activated successfully', {
      userId: req.user.id,
      email: userEmail,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: activationResult.message,
      data: {
        backupCodes: activationResult.backupCodes,
        backupCodesCount: activationResult.backupCodesCount,
        warning: 'Guárdalos en un lugar seguro. Solo se mostrarán una vez.'
      }
    });

  } catch (error) {
    logger.error('Error activating 2FA', {
      userId: req.user.id,
      email: req.user.email,
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Error al activar autenticación de dos factores',
      code: 'ACTIVATION_ERROR'
    });
  }
});

/**
 * POST /api/2fa/verify
 * Verifica código TOTP o de respaldo durante login
 */
router.post('/verify', async (req, res) => {
  try {
    const { token, loginContext } = req.body;
    const userEmail = req.user.email;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token de verificación requerido',
        code: 'MISSING_TOKEN'
      });
    }

    // Preparar contexto del login
    const context = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      ...loginContext
    };

    // Verificar código 2FA
    const verificationResult = await twoFactorService.verifyTwoFactorToken(userEmail, token, context);

    if (!verificationResult.success) {
      // Log del intento fallido
      logger.warn('2FA verification failed', {
        userId: req.user.id,
        email: userEmail,
        error: verificationResult.error,
        attempts: verificationResult.attempts,
        locked: verificationResult.locked,
        ip: req.ip
      });

      const statusCode = verificationResult.locked ? 429 : 400;
      
      return res.status(statusCode).json({
        success: false,
        error: verificationResult.error,
        code: 'VERIFICATION_FAILED',
        data: {
          attempts: verificationResult.attempts,
          maxAttempts: verificationResult.maxAttempts,
          remainingAttempts: verificationResult.remainingAttempts,
          locked: verificationResult.locked,
          remainingTime: verificationResult.remainingTime
        }
      });
    }

    logger.info('2FA verification successful', {
      userId: req.user.id,
      email: userEmail,
      usedBackupCode: verificationResult.usedBackupCode,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: verificationResult.message,
      data: {
        verified: true,
        requires2FA: true,
        usedBackupCode: verificationResult.usedBackupCode || false
      }
    });

  } catch (error) {
    logger.error('Error verifying 2FA token', {
      userId: req.user.id,
      email: req.user.email,
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Error al verificar código de autenticación',
      code: 'VERIFICATION_ERROR'
    });
  }
});

/**
 * POST /api/2fa/disable
 * Desactiva 2FA con verificación de contraseña
 */
router.post('/disable', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Contraseña requerida para desactivar 2FA',
        code: 'PASSWORD_REQUIRED'
      });
    }

    // Verificar reCAPTCHA
    const recaptchaResult = await RecaptchaService.verifyMiddleware('2fa_disable')(req, res, () => {});
    if (!req.recaptchaVerified) {
      return res.status(429).json({
        success: false,
        error: 'Verificación reCAPTCHA requerida',
        code: 'RECAPTCHA_VERIFICATION_REQUIRED'
      });
    }

    // Desactivar 2FA
    const disableResult = await twoFactorService.disableTwoFactor(req.user.email, password);

    if (!disableResult.success) {
      return res.status(400).json({
        success: false,
        error: disableResult.error,
        code: 'DISABLE_FAILED'
      });
    }

    logger.info('2FA disabled', {
      userId: req.user.id,
      email: req.user.email,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: disableResult.message
    });

  } catch (error) {
    logger.error('Error disabling 2FA', {
      userId: req.user.id,
      email: req.user.email,
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Error al desactivar autenticación de dos factores',
      code: 'DISABLE_ERROR'
    });
  }
});

/**
 * POST /api/2fa/regenerate-backup-codes
 * Regenera códigos de respaldo
 */
router.post('/regenerate-backup-codes', async (req, res) => {
  try {
    // Verificar reCAPTCHA
    const recaptchaResult = await RecaptchaService.verifyMiddleware('2fa_backup_codes')(req, res, () => {});
    if (!req.recaptchaVerified) {
      return res.status(429).json({
        success: false,
        error: 'Verificación reCAPTCHA requerida',
        code: 'RECAPTCHA_VERIFICATION_REQUIRED'
      });
    }

    // Regenerar códigos
    const result = await twoFactorService.regenerateBackupCodes(req.user.email);

    logger.info('2FA backup codes regenerated', {
      userId: req.user.id,
      email: req.user.email,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Códigos de respaldo regenerados exitosamente',
      data: {
        backupCodes: result.backupCodes,
        backupCodesCount: result.backupCodesCount,
        warning: 'Los códigos anteriores ya no serán válidos. Guárdalos en un lugar seguro.'
      }
    });

  } catch (error) {
    logger.error('Error regenerating backup codes', {
      userId: req.user.id,
      email: req.user.email,
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Error al regenerar códigos de respaldo',
      code: 'REGENERATION_ERROR'
    });
  }
});

/**
 * GET /api/2fa/status
 * Obtiene estado actual de 2FA
 */
router.get('/status', async (req, res) => {
  try {
    const status = await twoFactorService.getTwoFactorStatus(req.user.email);

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error getting 2FA status', {
      userId: req.user.id,
      email: req.user.email,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de autenticación',
      code: 'STATUS_ERROR'
    });
  }
});

/**
 * GET /api/2fa/backup-codes-info
 * Obtiene información sobre códigos de respaldo restantes
 */
router.get('/backup-codes-info', async (req, res) => {
  try {
    const status = await twoFactorService.getTwoFactorStatus(req.user.email);

    if (!status.isEnabled) {
      return res.status(400).json({
        success: false,
        error: 'Autenticación de dos factores no está activada',
        code: '2FA_NOT_ENABLED'
      });
    }

    const warnings = [];
    if (status.backupCodesRemaining === 0) {
      warnings.push('No tienes códigos de respaldo restantes. Regenera nuevos códigos.');
    } else if (status.backupCodesRemaining <= 2) {
      warnings.push('Pocos códigos de respaldo restantes. Considera regenerar nuevos códigos.');
    }

    res.status(200).json({
      success: true,
      data: {
        isEnabled: status.isEnabled,
        backupCodesRemaining: status.backupCodesRemaining,
        lastUsed: status.lastUsed,
        warnings: warnings,
        canRegenerate: true
      }
    });

  } catch (error) {
    logger.error('Error getting backup codes info', {
      userId: req.user.id,
      email: req.user.email,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error al obtener información de códigos de respaldo',
      code: 'BACKUP_CODES_INFO_ERROR'
    });
  }
});

/**
 * POST /api/2fa/test-token
 * Endpoint de prueba para verificar que 2FA está funcionando (solo desarrollo)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test-token', async (req, res) => {
    try {
      const { token } = req.body;
      const userEmail = req.user.email;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token de prueba requerido',
          code: 'TEST_TOKEN_REQUIRED'
        });
      }

      // Verificar código TOTP sin bloquear cuenta
      const secretData = await twoFactorService.generateSecret(userEmail);
      const isValid = require('speakeasy').totp.verify({
        secret: secretData.secret,
        encoding: 'base32',
        token: token,
        step: 30,
        window: 1
      });

      res.status(200).json({
        success: true,
        message: isValid ? 'Token válido' : 'Token inválido',
        data: {
          isValid: isValid,
          note: 'Esta es una verificación de prueba, no se guarda en el historial'
        }
      });

    } catch (error) {
      logger.error('Error testing 2FA token', {
        userId: req.user.id,
        email: req.user.email,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error al probar token 2FA',
        code: 'TEST_ERROR'
      });
    }
  });
}

// Middleware de manejo de errores global
router.use((error, req, res, next) => {
  logger.error('Unhandled 2FA route error', {
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    email: req.user?.email,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: 'Error interno del servidor en autenticación de dos factores',
    code: 'INTERNAL_ERROR'
  });
});

module.exports = router;