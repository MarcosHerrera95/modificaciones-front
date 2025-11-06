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
  const { nombre, email, password, telefono } = req.body;

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
        password: hashedPassword,
        telefono,
        rol: 'cliente',
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
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el usuario.' });
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
    const isValidPassword = await bcrypt.compare(password, user.password);
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
  // El token ya fue generado en la estrategia de Passport
  const { token, user } = req.user;
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}`);
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
        password: hashedPassword,
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
