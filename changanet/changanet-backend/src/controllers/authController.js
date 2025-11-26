/**
 * Controlador de autenticación que maneja registro, login y autenticación OAuth de usuarios.
 * Gestiona la creación de cuentas, validación de credenciales y generación de tokens JWT.
 * Incluye logging estructurado para auditoría (REQ-42, RB-04)
 *
 * Implementa los requerimientos funcionales de la sección 7.1 del PRD:
 * - REQ-01: Registro con correo y contraseña
 * - REQ-02: Registro social (Google)
 * - REQ-03: Envío de correo de verificación
 * - REQ-04: Validación de email único
 * - REQ-05: Recuperación de contraseña por correo
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../services/logger');
const { sendEmail } = require('../services/emailService');

/**
 * Función avanzada de validación de fortaleza de contraseña
 * Evalúa múltiples criterios de seguridad y proporciona feedback detallado
 */
function validatePasswordStrength(password) {
  const feedback = {
    isValid: false,
    score: 0,
    suggestions: [],
    warnings: []
  };

  if (!password) {
    feedback.warnings.push('La contraseña es requerida');
    return feedback;
  }

  // Validación básica de longitud
  if (password.length < 10) {
    feedback.warnings.push('La contraseña debe tener al menos 10 caracteres');
    return feedback;
  }

  // Verificar presencia de diferentes tipos de caracteres
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasSpaces = /\s/.test(password);

  // Validaciones específicas
  if (hasSpaces) {
    feedback.warnings.push('La contraseña no debe contener espacios');
  }

  // Detectar contraseñas comunes
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'sunshine', 'flower', 'iloveyou'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    feedback.warnings.push('Esta contraseña es muy común y fácilmente adivinable');
    return feedback;
  }

  // Verificar patrones comunes
  const patterns = [
    /(.)\1{2,}/, // Caracteres repetidos 3+ veces
    /\d{4,}/, // 4+ dígitos consecutivos
    /[a-zA-Z]{4,}/, // 4+ letras consecutivas
    /^[A-Z]/, // Empieza con mayúscula
    /[a-z]$/ // Termina con minúscula
  ];

  patterns.forEach((pattern, index) => {
    if (pattern.test(password)) {
      switch (index) {
        case 0:
          feedback.warnings.push('Evita caracteres repetidos consecutivamente');
          break;
        case 1:
          feedback.warnings.push('Evita secuencias numéricas largas');
          break;
        case 2:
          feedback.warnings.push('Evita secuencias de letras largas');
          break;
      }
    }
  });

  // Calcular puntuación basada en factores de seguridad
  let score = 0;

  // Longitud (máximo 25 puntos)
  if (password.length >= 10) score += 5;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Variedad de caracteres (máximo 30 puntos)
  if (hasLowerCase) score += 5;
  if (hasUpperCase) score += 5;
  if (hasNumbers) score += 5;
  if (hasSpecialChars) score += 15; // Los caracteres especiales valen más

  // Complejidad adicional (máximo 45 puntos)
  if (password.length >= 12 && hasLowerCase && hasUpperCase && hasNumbers && hasSpecialChars) {
    score += 25; // Bonus por contraseña muy fuerte
  }

  feedback.score = Math.min(score, 100);

  // Generar sugerencias basadas en la puntuación
  if (score < 30) {
    feedback.suggestions.push('Usa una combinación de letras, números y símbolos');
    feedback.suggestions.push('Aumenta la longitud de la contraseña a 12+ caracteres');
  } else if (score < 60) {
    feedback.suggestions.push('Considera usar una passphrase más larga');
    if (!hasSpecialChars) {
      feedback.suggestions.push('Agrega símbolos especiales para mayor seguridad');
    }
  } else if (score < 80) {
    feedback.suggestions.push('Tu contraseña es buena, pero podría ser mejor');
  } else {
    feedback.suggestions.push('¡Excelente! Tu contraseña es muy segura');
  }

  feedback.isValid = score >= 30 && !hasSpaces && !feedback.warnings.some(w => w.includes('común'));
  
  return feedback;
}

/**
 * Registro de usuario cliente
 * REQ-01: Permite el registro con correo y contraseña
 * REQ-03: Envía correo de verificación al registrarse
 * REQ-04: Valida que el correo no esté previamente registrado
 * Implementa validaciones de formato de email, longitud de contraseña y rol válido
 */
exports.register = async (req, res) => {
  // Extraer datos del cuerpo de la solicitud HTTP (REQ-01: campos básicos para registro)
  const { name, email, password, rol } = req.body;

  try {
    // Validar que todos los campos requeridos estén presentes (REQ-01: validación de campos obligatorios)
    if (!name || !email || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos: name, email, password, rol.' });
    }

    // Validar formato del email usando expresión regular (REQ-01: formato válido de email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido.' });
    }

    // Validar fortaleza de contraseña usando sistema avanzado de scoring
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      logger.warn('Registration failed: weak password', {
        service: 'auth',
        email,
        passwordScore: passwordValidation.score,
        warnings: passwordValidation.warnings,
        ip: req.ip
      });
      return res.status(400).json({ 
        error: 'La contraseña no cumple con los requisitos de seguridad.',
        details: {
          score: passwordValidation.score,
          warnings: passwordValidation.warnings,
          suggestions: passwordValidation.suggestions
        }
      });
    }

    // Log de contraseña aceptable para auditoría
    logger.info('Password validation passed', {
      service: 'auth',
      email,
      passwordScore: passwordValidation.score,
      ip: req.ip
    });

    // Validar que el rol sea uno de los valores permitidos (cliente o profesional)
    if (!['cliente', 'profesional'].includes(rol)) {
      // Registrar intento de registro con rol inválido para auditoría
      logger.warn('Registration failed: invalid role', {
        service: 'auth',
        email,
        rol,
        ip: req.ip
      });
      return res.status(400).json({ error: 'Rol inválido. Use "cliente" o "profesional".' });
    }

    // Verificar si ya existe un usuario con este email (REQ-04: email único)
    const existingUser = await prisma.usuarios.findUnique({ where: { email } });
    if (existingUser) {
      // Registrar intento de registro duplicado para auditoría
      logger.warn('Registration failed: email already exists', {
        service: 'auth',
        email,
        ip: req.ip
      });
      return res.status(409).json({ error: 'El email ya está registrado.' });
    }

    // Hashear la contraseña usando bcrypt con factor de costo 12 (seguridad >=12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generar token único de verificación usando crypto (REQ-03: token para verificación)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    // Establecer expiración del token en 24 horas
    const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Crear nuevo usuario en la base de datos con todos los campos requeridos
    const user = await prisma.usuarios.create({
      data: {
        nombre: name, // Nombre del usuario
        email, // Email único
        hash_contrasena: hashedPassword, // Contraseña hasheada
        rol: rol, // Rol explícitamente asignado desde el frontend
        esta_verificado: false, // Usuario no verificado inicialmente
        token_verificacion: verificationToken, // Token para verificar email
        token_expiracion: tokenExpiration // Fecha de expiración del token
      },
    });

    // Intentar enviar email de verificación (REQ-03: envío automático de email)
    try {
      const { sendVerificationEmail } = require('../services/emailService');
      await sendVerificationEmail(user.email, verificationToken);
      // Registrar envío exitoso del email
      logger.info('Verification email sent', {
        service: 'auth',
        userId: user.id,
        email: user.email
      });
    } catch (emailError) {
      // Registrar error pero no fallar el registro (email es secundario)
      logger.warn('Failed to send verification email', {
        service: 'auth',
        userId: user.id,
        email: user.email,
        error: emailError.message
      });
      // No fallar el registro por error en email - continúa el proceso
    }

    // Generar tokens JWT para autenticación inmediata (REQ-01: acceso después de registro)
    const token = jwt.sign(
      { userId: user.id, role: user.rol }, // Payload con ID y rol del usuario
      process.env.JWT_SECRET, // Clave secreta desde variables de entorno
      { expiresIn: '15m', algorithm: 'HS256' } // Access token: 15 minutos
    );

    // Generar refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    // Almacenar refresh token hashed en DB
    await prisma.refresh_tokens.create({
      data: {
        id: require('crypto').randomUUID(),
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: refreshExpiresAt
      }
    });

    // Registrar registro exitoso para auditoría
    logger.info('User registered successfully', {
      service: 'auth',
      userId: user.id,
      email: user.email,
      rol: user.rol,
      ip: req.ip
    });

    // Responder con éxito, tokens JWT y datos del usuario
    res.status(201).json({
      message: 'Usuario registrado exitosamente. Revisa tu email para verificar la cuenta.',
      token, // Access token para autenticación inmediata
      refreshToken, // Refresh token
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }, // Datos públicos del usuario
      requiresVerification: true // Indica que necesita verificar email
    });
  } catch (error) {
    // Registrar error de registro para debugging
    logger.error('Registration error', {
      service: 'auth',
      email,
      rol,
      error,
      ip: req.ip
    });
    // Responder con error interno del servidor
    res.status(500).json({ error: 'Error al registrar el usuario.', details: error.message });
  }
};

/**
 * Login de usuario
 * Valida credenciales de email y contraseña, genera token JWT
 */
exports.login = async (req, res) => {
  // Extraer credenciales del cuerpo de la solicitud (email y contraseña)
  const { email, password } = req.body;

  try {
    // Normalizar email a minúsculas para case-insensitive login
    const normalizedEmail = email.toLowerCase().trim();

    // Validar que ambos campos estén presentes (seguridad básica)
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    // Buscar usuario en la base de datos por email único
    const user = await prisma.usuarios.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Usuario no encontrado - registrar intento fallido para seguridad
      logger.warn('Login failed: user not found', {
        service: 'auth',
        email,
        ip: req.ip
      });
      // Responder genéricamente para no revelar existencia de usuarios
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Debug: Verificar el tipo y contenido de hash_contrasena
    logger.info('Debug: hash_contrasena info', {
      service: 'auth',
      email,
      hash_contrasena_type: typeof user.hash_contrasena,
      hash_contrasena_value: user.hash_contrasena ? '[EXISTS]' : '[NULL]',
      hash_contrasena_length: user.hash_contrasena ? user.hash_contrasena.length : 0
    });

    // Verificar si el usuario tiene contraseña local (no es usuario de Google)
    if (!user.hash_contrasena || user.hash_contrasena === null) {
      // Usuario de Google o sin contraseña local - redirigir a login con Google
      logger.warn('Login failed: Google user or no password', {
        service: 'auth',
        email,
        ip: req.ip
      });
      return res.status(401).json({
        error: 'Credenciales inválidas.',
        isGoogleUser: true
      });
    }

    // Convertir hash_contrasena a string si es Buffer
    let hashString;
    try {
      if (Buffer.isBuffer(user.hash_contrasena)) {
        hashString = user.hash_contrasena.toString('utf8');
      } else if (typeof user.hash_contrasena !== 'string') {
        throw new Error(`Hash type invalid: ${typeof user.hash_contrasena}`);
      } else {
        hashString = user.hash_contrasena;
      }
    } catch (conversionError) {
      logger.error('Login failed: hash conversion error', {
        service: 'auth',
        error: conversionError.message,
        hash_type: typeof user.hash_contrasena,
        userId: user.id,
        email,
        ip: req.ip
      });
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    // Verificar si el usuario está bloqueado por intentos fallidos
    if (user.bloqueado && user.bloqueado_hasta && user.bloqueado_hasta > new Date()) {
      const remainingTime = Math.ceil((user.bloqueado_hasta - new Date()) / 1000);
      logger.warn('Login failed: user blocked', {
        service: 'auth',
        userId: user.id,
        email,
        remainingTime,
        ip: req.ip
      });
      return res.status(429).json({
        error: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos.',
        retryAfter: remainingTime
      });
    } else if (user.bloqueado && (!user.bloqueado_hasta || user.bloqueado_hasta <= new Date())) {
      // El bloqueo ha expirado, resetear
      await prisma.usuarios.update({
        where: { id: user.id },
        data: {
          bloqueado: false,
          bloqueado_hasta: null,
          failed_login_attempts: 0
        }
      });
      user.bloqueado = false; // Actualizar la instancia local
    }

    // Comparar contraseña proporcionada con hash almacenado usando bcrypt
    try {
      const isValidPassword = await bcrypt.compare(password, hashString);
      if (!isValidPassword) {
        // Contraseña incorrecta - implementar lockout después de 5 intentos
        const failedAttempts = (user.failed_login_attempts || 0) + 1;
        const isBlocked = failedAttempts >= 5;

        await prisma.usuarios.update({
          where: { id: user.id },
          data: {
            failed_login_attempts: failedAttempts,
            bloqueado: isBlocked,
            bloqueado_hasta: isBlocked ? new Date(Date.now() + 15 * 60 * 1000) : null // 15 minutos
          }
        });

        logger.warn('Login failed: invalid password', {
          service: 'auth',
          userId: user.id,
          email,
          failedAttempts,
          isBlocked,
          ip: req.ip
        });

        if (isBlocked) {
          return res.status(429).json({
            error: 'Cuenta bloqueada por múltiples intentos fallidos. Inténtalo de nuevo en 15 minutos.',
            retryAfter: 900
          });
        }

        // Responder genéricamente para no revelar información
        return res.status(401).json({ error: 'Credenciales inválidas.' });
      } else {
        // Login exitoso - resetear contador de intentos fallidos
        await prisma.usuarios.update({
          where: { id: user.id },
          data: {
            failed_login_attempts: 0,
            bloqueado: false,
            bloqueado_hasta: null
          }
        });
      }
    } catch (bcryptError) {
      // Error en bcrypt - probablemente hash corrupto
      logger.error('Login failed: bcrypt error', {
        service: 'auth',
        error: bcryptError.message,
        userId: user.id,
        email,
        ip: req.ip
      });
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    // Credenciales válidas - generar tokens JWT para sesión
    const token = jwt.sign(
      { userId: user.id, role: user.rol }, // Incluir ID y rol del usuario
      process.env.JWT_SECRET, // Clave secreta desde variables de entorno
      { expiresIn: '15m', algorithm: 'HS256' } // Access token: 15 minutos
    );

    // Generar refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    // Almacenar refresh token hashed en DB
    await prisma.refresh_tokens.create({
      data: {
        id: require('crypto').randomUUID(),
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: refreshExpiresAt
      }
    });

    // Registrar login exitoso para auditoría
    logger.info('User login successful', {
      service: 'auth',
      userId: user.id,
      email: user.email,
      rol: user.rol,
      ip: req.ip
    });

    // Responder con tokens y datos básicos del usuario
    res.status(200).json({
      message: 'Login exitoso.',
      token, // Access token JWT (corto)
      refreshToken, // Refresh token (largo)
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } // Datos públicos del usuario
    });
  } catch (error) {
    // Registrar error de login para debugging
    logger.error('Login error', {
      service: 'auth',
      email,
      error,
      ip: req.ip
    });
    // Responder con error genérico
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
};

/**
 * Callback de Google OAuth
 */
exports.googleCallback = (req, res) => {
  try {
    // El token ya fue generado en la estrategia de Passport
    const { token, user } = req.user;

    if (!token || !user) {
      console.error('Google callback: Missing token or user data');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=auth_failed`);
    }

    // Codificar datos del usuario para pasar por URL
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      esta_verificado: user.esta_verificado
    }));

    console.log('Google callback: Redirecting to frontend with token and user data');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}&user=${userData}`);
  } catch (error) {
    console.error('Error in Google callback:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=auth_error`);
  }
};

/**
 * Callback de Facebook OAuth
 */
exports.facebookCallback = (req, res) => {
  try {
    // El token ya fue generado en la estrategia de Passport
    const { token, user, refreshToken } = req.user;

    if (!token || !user) {
      console.error('Facebook callback: Missing token or user data');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=auth_failed`);
    }

    // Codificar datos del usuario para pasar por URL
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      esta_verificado: user.esta_verificado
    }));

    console.log('Facebook callback: Redirecting to frontend with token and user data');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}&refreshToken=${refreshToken}&user=${userData}`);
  } catch (error) {
    console.error('Error in Facebook callback:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=auth_error`);
  }
};

/**
 * Registro de profesional
 */
exports.registerProfessional = async (req, res) => {
  const { nombre, email, password, telefono, especialidad, anos_experiencia, zona_cobertura, tarifa_hora, descripcion } = req.body;

  try {
    // Verificar si el usuario ya existe
    const existingUser = await prisma.usuarios.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado.' });
    }

    // RB-01: Un profesional solo puede tener un perfil activo
    // Nota: Esta validación se aplica al crear el perfil, pero el usuario aún no existe

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generar token de verificación de email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Crear usuario
    const user = await prisma.usuarios.create({
      data: {
        nombre,
        email,
        hash_contrasena: hashedPassword,
        telefono,
        rol: 'profesional',
        esta_verificado: false,
        token_verificacion: verificationToken,
        token_expiracion: tokenExpiration
      },
    });

    // Crear perfil profesional
    const profile = await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: user.id,
        especialidad,
        anos_experiencia,
        zona_cobertura,
        tarifa_hora: parseFloat(tarifa_hora),
        descripcion,
      },
    });

    // Enviar email de verificación
    try {
      const { sendVerificationEmail } = require('../services/emailService');
      await sendVerificationEmail(user.email, verificationToken);
      logger.info('Verification email sent to professional', {
        service: 'auth',
        userId: user.id,
        email: user.email
      });
    } catch (emailError) {
      logger.warn('Failed to send verification email to professional', {
        service: 'auth',
        userId: user.id,
        email: user.email,
        error: emailError.message
      });
      // No fallar el registro por error en email
    }

    // Generar tokens JWT con expiresIn según requisitos
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' } // Access token: 15 minutos
    );

    // Generar refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    // Almacenar refresh token hashed en DB
    await prisma.refresh_tokens.create({
      data: {
        id: require('crypto').randomUUID(),
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: refreshExpiresAt
      }
    });

    res.status(201).json({
      message: 'Profesional registrado exitosamente. Revisa tu email para verificar la cuenta.',
      token,
      refreshToken,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      profile,
      requiresVerification: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el profesional.' });
  }
};

/**
 * Obtiene los datos del usuario actualmente autenticado
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // Los datos del usuario ya están disponibles en req.user gracias al middleware authenticateToken
    const user = req.user;

    res.status(200).json({
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        esta_verificado: user.esta_verificado,
        url_foto_perfil: user.url_foto_perfil // Incluir foto de perfil
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuario actual:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Solicitar recuperación de contraseña
 * REQ-05: Permite recuperación de contraseña mediante correo
 * Genera token y envía enlace de recuperación por email
 */
exports.forgotPassword = async (req, res) => {
  // Extraer email del cuerpo de la solicitud (REQ-05: recuperación por correo)
  const { email } = req.body;

  try {
    // Validar que el email esté presente
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }

    // Buscar usuario por email en la base de datos
    const user = await prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      // Usuario no encontrado - responder genéricamente por seguridad
      // No revelar si el email existe para evitar enumeración de usuarios
      return res.status(200).json({ message: 'Si el email existe, se enviará un enlace de recuperación.' });
    }

    // Usuario encontrado - generar token único para recuperación
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Establecer expiración en 1 hora por seguridad
    const tokenExpiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Actualizar usuario con token de recuperación temporal
    await prisma.usuarios.update({
      where: { id: user.id },
      data: {
        token_verificacion: resetToken, // Reutilizar campo de verificación para token de reset
        token_expiracion: tokenExpiration // Fecha de expiración del token
      }
    });

    // Intentar enviar email con enlace de recuperación (REQ-05: envío por correo)
    try {
      const { sendPasswordResetEmail } = require('../services/emailService');
      await sendPasswordResetEmail(user.email, resetToken);
      // Registrar envío exitoso para auditoría
      logger.info('Password reset email sent', {
        service: 'auth',
        userId: user.id,
        email: user.email
      });
    } catch (emailError) {
      // Registrar error pero no fallar la solicitud (email es secundario)
      logger.warn('Failed to send password reset email', {
        service: 'auth',
        userId: user.id,
        email: user.email,
        error: emailError.message
      });
      // Continuar sin fallar - el token está guardado para uso futuro
    }

    // Responder siempre con el mismo mensaje por seguridad
    res.status(200).json({ message: 'Si el email existe, se enviará un enlace de recuperación.' });
  } catch (error) {
    // Registrar error para debugging
    logger.error('Forgot password error', {
      service: 'auth',
      email,
      error: error.message
    });
    // Responder con error genérico
    res.status(500).json({ error: 'Error al procesar la solicitud de recuperación.' });
  }
};

/**
 * Restablecer contraseña
 * REQ-05: Restablece contraseña usando token enviado por correo
 * Valida token y actualiza contraseña del usuario
 */
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });
    }

    // Validar fortaleza de contraseña usando sistema avanzado de scoring
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      logger.warn('Password reset failed: weak password', {
        service: 'auth',
        passwordScore: passwordValidation.score,
        warnings: passwordValidation.warnings,
        ip: req.ip
      });
      return res.status(400).json({ 
        error: 'La nueva contraseña no cumple con los requisitos de seguridad.',
        details: {
          score: passwordValidation.score,
          warnings: passwordValidation.warnings,
          suggestions: passwordValidation.suggestions
        }
      });
    }

    // Log de contraseña aceptable para auditoría
    logger.info('Password reset validation passed', {
      service: 'auth',
      passwordScore: passwordValidation.score,
      ip: req.ip
    });

    // Buscar usuario con el token
    const user = await prisma.usuarios.findUnique({
      where: { token_verificacion: token }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    // Verificar si el token no ha expirado
    if (user.token_expiracion && user.token_expiracion < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña y limpiar tokens
    await prisma.usuarios.update({
      where: { id: user.id },
      data: {
        hash_contrasena: hashedPassword,
        token_verificacion: null,
        token_expiracion: null
      }
    });

    logger.info('Password reset successfully', {
      service: 'auth',
      userId: user.id,
      email: user.email
    });

    res.status(200).json({ message: 'Contraseña restablecida exitosamente' });
  } catch (error) {
    logger.error('Reset password error', {
      service: 'auth',
      error: error.message
    });
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
};

/**
 * Reenviar email de verificación
 * REQ-03: Permite reenviar email de verificación si el usuario no lo recibió
 */
exports.resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }

    // Buscar usuario por email
    const user = await prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.esta_verificado) {
      return res.status(400).json({ error: 'El email ya está verificado' });
    }

    // Generar nuevo token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Actualizar usuario con nuevo token
    await prisma.usuarios.update({
      where: { id: user.id },
      data: {
        token_verificacion: verificationToken,
        token_expiracion: tokenExpiration
      }
    });

    // Enviar email de verificación
    try {
      const { sendVerificationEmail } = require('../services/emailService');
      await sendVerificationEmail(user.email, verificationToken);
      logger.info('Verification email resent', {
        service: 'auth',
        userId: user.id,
        email: user.email
      });
    } catch (emailError) {
      logger.warn('Failed to resend verification email', {
        service: 'auth',
        userId: user.id,
        email: user.email,
        error: emailError.message
      });
      return res.status(500).json({ error: 'Error al enviar email de verificación' });
    }

    res.status(200).json({ message: 'Email de verificación reenviado exitosamente' });
  } catch (error) {
    logger.error('Resend verification email error', { error: error.message });
    res.status(500).json({ error: 'Error al reenviar email de verificación' });
  }
};

/**
 * Verificar email del usuario
 * REQ-03: Verifica email del usuario mediante token de verificación
 * Marca email como verificado y limpia tokens temporales
 */
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    if (!token) {
      return res.status(400).json({ error: 'Token de verificación requerido' });
    }

    // Buscar usuario con el token de verificación
    const user = await prisma.usuarios.findUnique({
      where: { token_verificacion: token }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token de verificación inválido' });
    }

    // Verificar si el token no ha expirado
    if (user.token_expiracion && user.token_expiracion < new Date()) {
      return res.status(400).json({ error: 'Token de verificación expirado' });
    }

    // Marcar email como verificado y limpiar tokens
    await prisma.usuarios.update({
      where: { id: user.id },
      data: {
        esta_verificado: true,
        token_verificacion: null,
        token_expiracion: null
      }
    });

    logger.info('Email verified successfully', {
      service: 'auth',
      userId: user.id,
      email: user.email
    });

    res.status(200).json({
      message: 'Email verificado exitosamente',
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, esta_verificado: true }
    });
  } catch (error) {
    logger.error('Email verification error', {
      service: 'auth',
      error: error.message
    });
    res.status(500).json({ error: 'Error al verificar email' });
  }
};

/**
 * Endpoint para login con Google desde el frontend
 * REQ-02: Permite registro/login social con Google
 * Crea usuario si no existe, actualiza información y genera token JWT
 */
exports.googleLogin = async (req, res) => {
  try {
    console.log('🟡 Google OAuth request received:', req.body);
    const { uid, email, nombre, photo, rol } = req.body;

    console.log('🟡 Google OAuth attempt:', { 
      email, 
      uid, 
      nombre, 
      rol,
      photo: photo || 'NO PHOTO PROVIDED' // 🔍 DEBUG PHOTO
    });

    // Validar campos requeridos
    if (!uid || !email || !nombre) {
      console.error('Google OAuth validation failed: missing required fields', { uid, email, nombre });
      return res.status(400).json({
        error: 'Campos requeridos faltantes: uid, email, nombre son obligatorios'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Google OAuth validation failed: invalid email format', { email });
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    // Buscar usuario existente por email
    let user = await prisma.usuarios.findUnique({
      where: { email }
    });

    console.log('🟡 EXISTING USER CHECK:');
    console.log('🟡 User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('🟡 Current user data BEFORE update:', {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        google_id: user.google_id,
        url_foto_perfil: user.url_foto_perfil,
        rol: user.rol
      });
    }

    if (user) {
      console.log('🟡 EXISTING USER SCENARIO:');
      console.log('🟡 Current google_id:', user.google_id);
      console.log('🟡 Incoming photo from Google:', photo);
      console.log('🟡 Current photo in DB:', user.url_foto_perfil);
      
      // Usuario existe, actualizar información si es necesario
      if (!user.google_id) {
        console.log('🟡 User has no Google ID - FIRST TIME GOOGLE LOGIN');
        console.log('🟡 Will update with Google data');
        
        user = await prisma.usuarios.update({
          where: { id: user.id },
          data: {
            google_id: uid,
            nombre: nombre, // Actualizar nombre si cambió
            url_foto_perfil: photo || user.url_foto_perfil, // 🔍 CRÍTICO: siempre usar photo de Google si está disponible
            esta_verificado: true, // Los usuarios de Google están verificados
          }
        });
        
        console.log('🟡 AFTER FIRST GOOGLE LOGIN - USER DATA:', {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          google_id: user.google_id,
          url_foto_perfil: user.url_foto_perfil,
          photoSource: user.url_foto_perfil?.includes('googleusercontent') ? 'GOOGLE' : 'OTHER'
        });
        
        logger.info('Google OAuth: existing user updated', {
          service: 'auth',
          userId: user.id,
          email: user.email,
          ip: req.ip
        });
        console.log('Google OAuth: existing user updated:', user.email);
      } else {
        console.log('🟡 User already has Google ID - CHECK IF PHOTO NEEDS UPDATE');
        
        // 🔍 NUEVA LÓGICA: Actualizar photo de Google siempre que sea diferente
        const shouldUpdatePhoto = photo && photo !== user.url_foto_perfil;
        
        if (shouldUpdatePhoto) {
          console.log('🟡 PHOTO UPDATE NEEDED - Google photo different from current');
          console.log('🟡 Current DB photo:', user.url_foto_perfil);
          console.log('🟡 New Google photo:', photo);
          
          user = await prisma.usuarios.update({
            where: { id: user.id },
            data: {
              url_foto_perfil: photo, // 🔍 ACTUALIZAR SIEMPRE LA FOTO DE GOOGLE
              nombre: nombre, // Actualizar nombre si cambió
            }
          });
          
          console.log('🟡 AFTER PHOTO UPDATE - USER DATA:', {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            google_id: user.google_id,
            url_foto_perfil: user.url_foto_perfil,
            photoSource: user.url_foto_perfil?.includes('googleusercontent') ? 'GOOGLE' : 'OTHER'
          });
          
        } else {
          console.log('🟡 NO PHOTO UPDATE NEEDED');
          if (!photo) {
            console.log('🟡 No Google photo provided in this login');
          } else {
            console.log('🟡 Google photo same as current DB photo');
          }
          console.log('🟡 Current photo stays as:', user.url_foto_perfil);
        }
        
        logger.info('Google OAuth: existing user login', {
          service: 'auth',
          userId: user.id,
          email: user.email,
          ip: req.ip
        });
        console.log('Google OAuth: existing user login:', user.email);
      }
    } else {
      // Usuario no existe - crear automáticamente (REQ-02: registro social)
      console.log('Google OAuth: creating new user:', email);

      // Determinar rol basado en el parámetro o default a 'cliente'
      const userRole = rol || 'cliente';
      if (!['cliente', 'profesional'].includes(userRole)) {
        return res.status(400).json({ error: 'Rol inválido para registro social.' });
      }

      // Generar UUID para el nuevo usuario
      const userId = require('crypto').randomUUID();
      
      user = await prisma.usuarios.create({
        data: {
          id: userId,
          nombre,
          email,
          google_id: uid,
          url_foto_perfil: photo, // 🔍 GUARDANDO FOTO DE GOOGLE
          rol: userRole,
          esta_verificado: true, // Los usuarios de Google están verificados automáticamente
          hash_contrasena: null, // No tienen contraseña local
        }
      });

      console.log('🟡 Google OAuth: new user created with photo:', {
        email: user.email,
        url_foto_perfil: user.url_foto_perfil,
        photoWasSaved: !!user.url_foto_perfil
      });

      logger.info('Google OAuth: new user registered', {
        service: 'auth',
        userId: user.id,
        email: user.email,
        rol: user.rol,
        ip: req.ip
      });
      console.log('Google OAuth: new user created:', user.email);
    }

    // Generar tokens JWT con expiresIn según requisitos
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' } // Access token: 15 minutos
    );

    // Generar refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    // Almacenar refresh token hashed en DB
    await prisma.refresh_tokens.create({
      data: {
        id: require('crypto').randomUUID(),
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: refreshExpiresAt
      }
    });

    console.log('Google OAuth: successful login for:', user.email);

    res.status(200).json({
      message: 'Login exitoso con Google',
      token,
      refreshToken,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        esta_verificado: user.esta_verificado,
        url_foto_perfil: user.url_foto_perfil // Incluir foto de perfil en la respuesta
      }
    });
  } catch (error) {
    console.error('Google OAuth login error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error cause:', error.cause);
    
    // Log detallado de la petición que causó el error
    console.error('Request that failed:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    logger.error('Google OAuth login error', {
      service: 'auth',
      error: error.message,
      stack: error.stack,
      errorName: error.name,
      errorCause: error.cause,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestBody: req.body,
      url: req.url
    });
    
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Error procesando autenticación con Google',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Endpoint para login con Facebook desde el frontend
 * REQ-02: Permite registro/login social con Facebook
 * Crea usuario si no existe, actualiza información y genera token JWT
 */
exports.facebookLogin = async (req, res) => {
  try {
    console.log('🟡 Facebook OAuth request received:', req.body);
    const { uid, email, nombre, photo, rol } = req.body;

    console.log('🟡 Facebook OAuth attempt:', {
      email,
      uid,
      nombre,
      rol,
      photo: photo || 'NO PHOTO PROVIDED'
    });

    // Validar campos requeridos
    if (!uid || !email || !nombre) {
      console.error('Facebook OAuth validation failed: missing required fields', { uid, email, nombre });
      return res.status(400).json({
        error: 'Campos requeridos faltantes: uid, email, nombre son obligatorios'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Facebook OAuth validation failed: invalid email format', { email });
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    // Buscar usuario existente por email
    let user = await prisma.usuarios.findUnique({
      where: { email }
    });

    console.log('🟡 EXISTING USER CHECK:');
    console.log('🟡 User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('🟡 Current user data BEFORE update:', {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        facebook_id: user.facebook_id,
        url_foto_perfil: user.url_foto_perfil,
        rol: user.rol
      });
    }

    if (user) {
      console.log('🟡 EXISTING USER SCENARIO:');
      console.log('🟡 Current facebook_id:', user.facebook_id);
      console.log('🟡 Incoming photo from Facebook:', photo);
      console.log('🟡 Current photo in DB:', user.url_foto_perfil);

      // Usuario existe, actualizar información si es necesario
      if (!user.facebook_id) {
        console.log('🟡 User has no Facebook ID - FIRST TIME FACEBOOK LOGIN');
        console.log('🟡 Will update with Facebook data');

        user = await prisma.usuarios.update({
          where: { id: user.id },
          data: {
            facebook_id: uid,
            nombre: nombre, // Actualizar nombre si cambió
            url_foto_perfil: photo || user.url_foto_perfil, // Usar photo de Facebook si está disponible
            esta_verificado: true, // Los usuarios de Facebook están verificados
          }
        });

        console.log('🟡 AFTER FIRST FACEBOOK LOGIN - USER DATA:', {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          facebook_id: user.facebook_id,
          url_foto_perfil: user.url_foto_perfil,
          photoSource: user.url_foto_perfil?.includes('facebook') ? 'FACEBOOK' : 'OTHER'
        });

        logger.info('Facebook OAuth: existing user updated', {
          service: 'auth',
          userId: user.id,
          email: user.email,
          ip: req.ip
        });
        console.log('Facebook OAuth: existing user updated:', user.email);
      } else {
        console.log('🟡 User already has Facebook ID - CHECK IF PHOTO NEEDS UPDATE');

        // Actualizar photo de Facebook siempre que sea diferente
        const shouldUpdatePhoto = photo && photo !== user.url_foto_perfil;

        if (shouldUpdatePhoto) {
          console.log('🟡 PHOTO UPDATE NEEDED - Facebook photo different from current');
          console.log('🟡 Current DB photo:', user.url_foto_perfil);
          console.log('🟡 New Facebook photo:', photo);

          user = await prisma.usuarios.update({
            where: { id: user.id },
            data: {
              url_foto_perfil: photo, // Actualizar photo de Facebook
              nombre: nombre, // Actualizar nombre si cambió
            }
          });

          console.log('🟡 AFTER PHOTO UPDATE - USER DATA:', {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            facebook_id: user.facebook_id,
            url_foto_perfil: user.url_foto_perfil,
            photoSource: user.url_foto_perfil?.includes('facebook') ? 'FACEBOOK' : 'OTHER'
          });

        } else {
          console.log('🟡 NO PHOTO UPDATE NEEDED');
          if (!photo) {
            console.log('🟡 No Facebook photo provided in this login');
          } else {
            console.log('🟡 Facebook photo same as current DB photo');
          }
          console.log('🟡 Current photo stays as:', user.url_foto_perfil);
        }

        logger.info('Facebook OAuth: existing user login', {
          service: 'auth',
          userId: user.id,
          email: user.email,
          ip: req.ip
        });
        console.log('Facebook OAuth: existing user login:', user.email);
      }
    } else {
      // Usuario no existe - crear automáticamente (REQ-02: registro social)
      console.log('Facebook OAuth: creating new user:', email);

      // Determinar rol basado en el parámetro o default a 'cliente'
      const userRole = rol || 'cliente';
      if (!['cliente', 'profesional'].includes(userRole)) {
        return res.status(400).json({ error: 'Rol inválido para registro social.' });
      }

      user = await prisma.usuarios.create({
        data: {
          nombre,
          email,
          facebook_id: uid,
          url_foto_perfil: photo, // Guardando photo de Facebook
          rol: userRole,
          esta_verificado: true, // Los usuarios de Facebook están verificados automáticamente
          hash_contrasena: null, // No tienen contraseña local
        }
      });

      console.log('🟡 Facebook OAuth: new user created with photo:', {
        email: user.email,
        url_foto_perfil: user.url_foto_perfil,
        photoWasSaved: !!user.url_foto_perfil
      });

      logger.info('Facebook OAuth: new user registered', {
        service: 'auth',
        userId: user.id,
        email: user.email,
        rol: user.rol,
        ip: req.ip
      });
      console.log('Facebook OAuth: new user created:', user.email);
    }

    // Generar tokens JWT con expiresIn según requisitos
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' } // Access token: 15 minutos
    );

    // Generar refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    // Almacenar refresh token hashed en DB
    await prisma.refresh_tokens.create({
      data: {
        id: require('crypto').randomUUID(),
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: refreshExpiresAt
      }
    });

    console.log('Facebook OAuth: successful login for:', user.email);

    res.status(200).json({
      message: 'Login exitoso con Facebook',
      token,
      refreshToken,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        esta_verificado: user.esta_verificado,
        url_foto_perfil: user.url_foto_perfil // Incluir foto de perfil en la respuesta
      }
    });
  } catch (error) {
    console.error('Facebook OAuth login error:', error);
    logger.error('Facebook OAuth login error', {
      service: 'auth',
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Error procesando autenticación con Facebook'
    });
  }
};

/**
 * Refresh token endpoint
 * Genera nuevo access token usando refresh token válido
 */
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requerido' });
    }

    // Verificar y decodificar el refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch (error) {
      logger.warn('Invalid refresh token', { error: error.message, ip: req.ip });
      return res.status(401).json({ error: 'Refresh token inválido' });
    }

    // Buscar el refresh token en la base de datos (hashed)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await prisma.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true }
    });

    if (!storedToken || storedToken.revoked || storedToken.expires_at < new Date()) {
      logger.warn('Refresh token not found, revoked or expired', {
        tokenHash: tokenHash.substring(0, 8) + '...',
        ip: req.ip
      });
      return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      { userId: storedToken.user.id, role: storedToken.user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' } // Access token: 15 minutos
    );

    // Opcional: Generar nuevo refresh token y revocar el anterior
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newRefreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    // Crear nuevo refresh token
    await prisma.refresh_tokens.create({
      data: {
        user_id: storedToken.user.id,
        token_hash: newRefreshTokenHash,
        expires_at: newRefreshExpiresAt
      }
    });

    // Revocar el refresh token anterior
    await prisma.refresh_tokens.update({
      where: { id: storedToken.id },
      data: { revoked: true }
    });

    logger.info('Token refreshed successfully', {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Token refrescado exitosamente',
      token: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Refresh token error', { error: error.message, ip: req.ip });
    res.status(500).json({ error: 'Error al refrescar token' });
  }
};

/**
 * Logout endpoint
 * Revoca todos los refresh tokens del usuario
 */
exports.logout = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Revocar todos los refresh tokens del usuario
    await prisma.refresh_tokens.updateMany({
      where: {
        user_id: userId,
        revoked: false
      },
      data: { revoked: true }
    });

    logger.info('User logged out, tokens revoked', {
      userId,
      ip: req.ip
    });

    res.status(200).json({ message: 'Logout exitoso' });
  } catch (error) {
    logger.error('Logout error', { error: error.message, ip: req.ip });
    res.status(500).json({ error: 'Error en logout' });
  }
};

module.exports = {
  register: exports.register,
  login: exports.login,
  googleCallback: exports.googleCallback,
  googleLogin: exports.googleLogin,
  facebookCallback: exports.facebookCallback,
  facebookLogin: exports.facebookLogin,
  registerProfessional: exports.registerProfessional,
  getCurrentUser: exports.getCurrentUser,
  verifyEmail: exports.verifyEmail,
  resendVerificationEmail: exports.resendVerificationEmail,
  forgotPassword: exports.forgotPassword,
  resetPassword: exports.resetPassword,
  refreshToken: exports.refreshToken,
  logout: exports.logout
};
