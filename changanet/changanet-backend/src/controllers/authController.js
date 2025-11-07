/**
 * Controlador de autenticación que maneja registro, login y autenticación OAuth de usuarios.
 * Gestiona la creación de cuentas, validación de credenciales y generación de tokens JWT.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Registro de usuario cliente
 */
exports.register = async (req, res) => {
  const { name, email, password, rol } = req.body;

  try {
    // Validar que el rol sea especificado y válido
    if (!rol) {
      return res.status(400).json({ error: 'El rol es requerido. Use "cliente" o "profesional".' });
    }

    if (!['cliente', 'profesional'].includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido. Use "cliente" o "profesional".' });
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.usuarios.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado.' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.usuarios.create({
      data: {
        nombre: name,
        email,
        hash_contrasena: hashedPassword,
        rol,
        esta_verificado: false
      },
    });

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h', algorithm: 'HS256' }
    );

    res.status(201).json({ message: 'Usuario registrado exitosamente.', token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch (error) {
    console.error('Error en registro:', error);
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
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.hash_contrasena);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h', algorithm: 'HS256' }
    );

    res.status(200).json({ message: 'Login exitoso.', token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch (error) {
    console.error(error);
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

    // Crear usuario
    const user = await prisma.usuarios.create({
      data: {
        nombre,
        email,
        hash_contrasena: hashedPassword,
        telefono,
        rol: 'profesional',
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

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h', algorithm: 'HS256' }
    );

    res.status(201).json({ message: 'Profesional registrado exitosamente.', token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }, profile });
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

module.exports = {
  register: exports.register,
  login: exports.login,
  googleCallback: exports.googleCallback,
  registerProfessional: exports.registerProfessional,
  getCurrentUser: exports.getCurrentUser
};
