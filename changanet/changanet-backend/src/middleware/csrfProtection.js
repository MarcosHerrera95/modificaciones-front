/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for CSRF protection
 */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Store CSRF tokens temporarily (in production, use Redis or database)
const csrfTokens = new Map();

/**
 * Generate a secure CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to provide CSRF token to clients
 */
exports.csrfToken = (req, res, next) => {
  try {
    const token = generateCSRFToken();
    const sessionId = req.sessionID || req.ip + '-' + Date.now();

    // Store token with expiration (15 minutes)
    csrfTokens.set(sessionId, {
      token,
      expires: Date.now() + (15 * 60 * 1000)
    });

    // Set token in cookie (httpOnly for security)
    res.cookie('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Also send in response for client-side storage
    res.setHeader('X-CSRF-Token', token);

    next();
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware to validate CSRF token on state-changing requests
 */
exports.validateCSRF = (req, res, next) => {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  try {
    const sessionId = req.sessionID || req.ip + '-' + Date.now();
    const cookieToken = req.cookies['csrf-token'];
    const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

    // Check if tokens exist
    if (!cookieToken || !headerToken) {
      return res.status(403).json({
        success: false,
        error: 'Tokens CSRF requeridos',
        message: 'Faltan tokens de protección CSRF'
      });
    }

    // Get stored token
    const storedTokenData = csrfTokens.get(sessionId);

    if (!storedTokenData) {
      return res.status(403).json({
        success: false,
        error: 'Token CSRF expirado',
        message: 'El token CSRF ha expirado. Refresque la página.'
      });
    }

    // Check expiration
    if (Date.now() > storedTokenData.expires) {
      csrfTokens.delete(sessionId);
      return res.status(403).json({
        success: false,
        error: 'Token CSRF expirado',
        message: 'El token CSRF ha expirado. Refresque la página.'
      });
    }

    // Validate tokens match
    if (cookieToken !== storedTokenData.token || headerToken !== storedTokenData.token) {
      return res.status(403).json({
        success: false,
        error: 'Token CSRF inválido',
        message: 'Los tokens CSRF no coinciden'
      });
    }

    // Token is valid, proceed
    next();

  } catch (error) {
    console.error('Error validating CSRF token:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Clean up expired CSRF tokens (should be called periodically)
 */
exports.cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [sessionId, tokenData] of csrfTokens.entries()) {
    if (now > tokenData.expires) {
      csrfTokens.delete(sessionId);
    }
  }
};

/**
 * Middleware for API endpoints that need CSRF protection
 * Combines token provision and validation
 */
exports.csrfProtection = [
  exports.csrfToken,
  exports.validateCSRF
];

/**
 * Optional: Database-backed CSRF token storage for production
 */
class DatabaseCSRFStore {
  async store(sessionId, token, expiresAt) {
    try {
      await prisma.csrf_tokens.upsert({
        where: { session_id: sessionId },
        update: {
          token,
          expires_at: expiresAt
        },
        create: {
          session_id: sessionId,
          token,
          expires_at: expiresAt
        }
      });
    } catch (error) {
      console.error('Error storing CSRF token:', error);
      throw error;
    }
  }

  async get(sessionId) {
    try {
      const tokenData = await prisma.csrf_tokens.findUnique({
        where: { session_id: sessionId }
      });

      if (!tokenData || Date.now() > tokenData.expires_at.getTime()) {
        if (tokenData) {
          await this.delete(sessionId);
        }
        return null;
      }

      return {
        token: tokenData.token,
        expires: tokenData.expires_at.getTime()
      };
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      return null;
    }
  }

  async delete(sessionId) {
    try {
      await prisma.csrf_tokens.delete({
        where: { session_id: sessionId }
      });
    } catch (error) {
      console.error('Error deleting CSRF token:', error);
    }
  }

  async cleanup() {
    try {
      await prisma.csrf_tokens.deleteMany({
        where: {
          expires_at: {
            lt: new Date()
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning up CSRF tokens:', error);
    }
  }
}

// Export database store for production use
exports.DatabaseCSRFStore = DatabaseCSRFStore;

// For production, you can switch to database storage:
// const csrfStore = new DatabaseCSRFStore();

module.exports = exports;