/**
 * Controlador de autenticación que maneja registro, login y autenticación OAuth de usuarios.
 * Gestiona la creación de cuentas, validación de credenciales y generación de tokens JWT.
 * Incluye logging estructurado para auditoría (REQ-42, RB-04)
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
 */
exports.register = async (req, res) => {
  const { name, email, password, rol } = req.body;

  try {
    // Validar que el rol sea especificado y válido
    if (!rol) {
      logger.warn('Registration failed: role not specified', {
        service: 'auth',
        email,
        ip: req.ip
      });
      return res.status(400).json({ error: 'El rol es requerido. Use "cliente" o "profesional".' });
    }

    if (!['cliente', 'profesional'].includes(rol)) {
      logger.warn('Registration failed: invalid role', {
        service: 'auth',
        email,
        rol,
        ip: req.ip
      });
      return res.status(400).json({ error: 'Rol inválido. Use "cliente" o "profesional".' });
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.usuarios.findUnique({ where: { email } });
    if (existingUser) {
      logger.warn('Registration failed: email already exists', {
        service: 'auth',
        email,
        ip: req.ip
      });
      return res.status(400).json({ error: 'El email ya está registrado.' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generar token de verificación de email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Crear usuario con rol explícitamente asignado
    const user = await prisma.usuarios.create({
      data: {
        nombre: name,
        email,
        hash_contrasena: hashedPassword,
        rol: rol, // Rol explícitamente asignado desde el frontend
        esta_verificado: false,
        token_verificacion: verificationToken,
        token_expiracion: tokenExpiration
      },
    });

    // Enviar email de verificación
    try {
      const { sendVerificationEmail } = require('../services/emailService');
      await sendVerificationEmail(user.email, verificationToken);
      logger.info('Verification email sent', {
        service: 'auth',
        userId: user.id,
        email: user.email
      });
    } catch (emailError) {
      logger.warn('Failed to send verification email', {
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

    logger.info('User registered successfully', {
      service: 'auth',
      userId: user.id,
      email: user.email,
      rol: user.rol,
      ip: req.ip
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente. Revisa tu email para verificar la cuenta.',
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      requiresVerification: true
    });
  } catch (error) {
    logger.error('Registration error', {
      service: 'auth',
      email,
      rol,
      error,
      ip: req.ip
    });
    res.status(500).json({ error: 'Error al registrar el usuario.', details: error.message });
  }
};

/**
 * Login de usuario
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Buscar usuario por email
    const user = await prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      logger.warn('Login failed: user not found', {
        service: 'auth',
        email,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.hash_contrasena);
    if (!isValidPassword) {
      logger.warn('Login failed: invalid password', {
        service: 'auth',
        userId: user.id,
        email,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar token JWT con expiresIn: '7d' según requisitos
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    logger.info('User login successful', {
      service: 'auth',
      userId: user.id,
      email: user.email,
      rol: user.rol,
      ip: req.ip
    });

    res.status(200).json({ message: 'Login exitoso.', token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch (error) {
    logger.error('Login error', {
      service: 'auth',
      email,
      error,
      ip: req.ip
    });
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
 * Verificar email del usuario
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
 */
exports.googleLogin = async (req, res) => {
  try {
    const { uid, email, nombre, foto, rol } = req.body;

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
            url_foto_perfil: foto,
            esta_verificado: true, // Los usuarios de Google están verificados
          }
        });
        logger.info('Google OAuth: existing user updated', {
          service: 'auth',
          userId: user.id,
          email: user.email,
          ip: req.ip
        });
      } else {
        logger.info('Google OAuth: existing user login', {
          service: 'auth',
          userId: user.id,
          email: user.email,
          ip: req.ip
        });
      }
    } else {
      // Crear nuevo usuario con rol por defecto "cliente" (REQ-02)
      user = await prisma.usuarios.create({
        data: {
          nombre,
          email,
          google_id: uid,
          url_foto_perfil: foto,
          rol: rol || 'cliente', // Rol por defecto según REQ-02
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
    }

    // Generar token JWT con expiresIn: '7d' según requisitos
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

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
    logger.error('Google OAuth login error', {
      service: 'auth',
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  register: exports.register,
  login: exports.login,
  googleCallback: exports.googleCallback,
  googleLogin: exports.googleLogin,
  registerProfessional: exports.registerProfessional,
  getCurrentUser: exports.getCurrentUser,
  verifyEmail: exports.verifyEmail
};
