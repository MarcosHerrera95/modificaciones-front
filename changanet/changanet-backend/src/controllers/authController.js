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

    // Validar longitud mínima de contraseña por seguridad (REQ-01: contraseña segura)
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

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

    // Hashear la contraseña usando bcrypt con factor de costo 10 (seguridad)
    const hashedPassword = await bcrypt.hash(password, 10);

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

    // Generar token JWT para autenticación inmediata (REQ-01: acceso después de registro)
    const token = jwt.sign(
      { userId: user.id, role: user.rol }, // Payload con ID y rol del usuario
      process.env.JWT_SECRET, // Clave secreta desde variables de entorno
      { expiresIn: '7d', algorithm: 'HS256' } // Expira en 7 días, algoritmo HS256
    );

    // Registrar registro exitoso para auditoría
    logger.info('User registered successfully', {
      service: 'auth',
      userId: user.id,
      email: user.email,
      rol: user.rol,
      ip: req.ip
    });

    // Responder con éxito, token JWT y datos del usuario
    res.status(201).json({
      message: 'Usuario registrado exitosamente. Revisa tu email para verificar la cuenta.',
      token, // Token para autenticación inmediata
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
    // Validar que ambos campos estén presentes (seguridad básica)
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    // Buscar usuario en la base de datos por email único
    const user = await prisma.usuarios.findUnique({ where: { email } });
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

    // Comparar contraseña proporcionada con hash almacenado usando bcrypt
    const isValidPassword = await bcrypt.compare(password, user.hash_contrasena);
    if (!isValidPassword) {
      // Contraseña incorrecta - registrar intento fallido para seguridad
      logger.warn('Login failed: invalid password', {
        service: 'auth',
        userId: user.id,
        email,
        ip: req.ip
      });
      // Responder genéricamente para no revelar información
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Credenciales válidas - generar token JWT para sesión
    const token = jwt.sign(
      { userId: user.id, role: user.rol }, // Incluir ID y rol del usuario
      process.env.JWT_SECRET, // Clave secreta desde variables de entorno
      { expiresIn: '7d', algorithm: 'HS256' } // 7 días de validez
    );

    // Registrar login exitoso para auditoría
    logger.info('User login successful', {
      service: 'auth',
      userId: user.id,
      email: user.email,
      rol: user.rol,
      ip: req.ip
    });

    // Responder con token y datos básicos del usuario
    res.status(200).json({
      message: 'Login exitoso.',
      token, // Token JWT para autenticación en futuras requests
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
    const hashedPassword = await bcrypt.hash(password, 10);

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

    // Generar token JWT con expiresIn: '7d' según requisitos
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    res.status(201).json({
      message: 'Profesional registrado exitosamente. Revisa tu email para verificar la cuenta.',
      token,
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
        esta_verificado: user.esta_verificado
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

    // Validar longitud de contraseña
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

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
    const hashedPassword = await bcrypt.hash(newPassword, 10);

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
    const { uid, email, nombre, foto, rol } = req.body;

    console.log('Google OAuth attempt:', { email, uid, nombre, rol });

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

    if (user) {
      // Usuario existe, actualizar información si es necesario
      if (!user.google_id) {
        user = await prisma.usuarios.update({
          where: { id: user.id },
          data: {
            google_id: uid,
            nombre: nombre, // Actualizar nombre si cambió
            url_foto_perfil: foto || user.url_foto_perfil,
            esta_verificado: true, // Los usuarios de Google están verificados
          }
        });
        logger.info('Google OAuth: existing user updated', {
          service: 'auth',
          userId: user.id,
          email: user.email,
          ip: req.ip
        });
        console.log('Google OAuth: existing user updated:', user.email);
      } else {
        logger.info('Google OAuth: existing user login', {
          service: 'auth',
          userId: user.id,
          email: user.email,
          ip: req.ip
        });
        console.log('Google OAuth: existing user login:', user.email);
      }
    } else {
      // Crear nuevo usuario con rol por defecto "cliente" (REQ-02)
      user = await prisma.usuarios.create({
        data: {
          nombre,
          email,
          google_id: uid,
          url_foto_perfil: foto || null,
          rol: rol && ['cliente', 'profesional'].includes(rol) ? rol : 'cliente', // Validar rol
          esta_verificado: true, // Los usuarios de Google están verificados
        }
      });
      logger.info('Google OAuth: new user created', {
        service: 'auth',
        userId: user.id,
        email: user.email,
        rol: user.rol,
        ip: req.ip
      });
      console.log('Google OAuth: new user created:', user.email);
    }

    // Generar token JWT con expiresIn: '7d' según requisitos
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    console.log('Google OAuth: successful login for:', user.email);

    res.status(200).json({
      message: 'Login exitoso con Google',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        esta_verificado: user.esta_verificado
      }
    });
  } catch (error) {
    console.error('Google OAuth login error:', error);
    logger.error('Google OAuth login error', {
      service: 'auth',
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Error procesando autenticación con Google'
    });
  }
};

module.exports = {
  register: exports.register,
  login: exports.login,
  googleCallback: exports.googleCallback,
  googleLogin: exports.googleLogin,
  registerProfessional: exports.registerProfessional,
  getCurrentUser: exports.getCurrentUser,
  verifyEmail: exports.verifyEmail,
  forgotPassword: exports.forgotPassword,
  resetPassword: exports.resetPassword
};
