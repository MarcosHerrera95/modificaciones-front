// src/routes/adminRoutes.js
// Rutas del panel de administración
// Implementa sección 15 del PRD: Panel de Administración

const express = require('express');
const { authenticateToken } = require('../middleware/authenticate');
const adminController = require('../controllers/adminController');

const router = express.Router();

// POST /api/admin/create-admin-user
// Crear usuario administrador (solo para desarrollo/setup inicial - sin auth requerida)
router.post('/create-admin-user', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        error: 'Se requieren nombre, email y password'
      });
    }

    // Verificar si ya existe un admin con ese email
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const existingAdmin = await prisma.usuarios.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      return res.status(400).json({
        error: 'Ya existe un usuario con ese email'
      });
    }

    // Crear hash de contraseña
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario admin
    const newAdmin = await prisma.usuarios.create({
      data: {
        nombre,
        email,
        hash_contrasena: passwordHash,
        rol: 'admin',
        esta_verificado: true,
        bloqueado: false
      }
    });

    res.status(201).json({
      success: true,
      message: 'Usuario administrador creado exitosamente',
      data: {
        id: newAdmin.id,
        nombre: newAdmin.nombre,
        email: newAdmin.email,
        rol: newAdmin.rol
      }
    });
  } catch (error) {
    console.error('Error creando usuario admin:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

// Middleware para verificar rol de admin
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({
      error: 'Acceso denegado. Se requieren permisos de administrador.'
    });
  }
  next();
};

// Aplicar middleware de admin a todas las rutas siguientes
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/users
// Lista usuarios con filtros
router.get('/users', adminController.getUsers);

// PUT /api/admin/users/:userId/toggle-block
// Bloquea o desbloquea un usuario
router.put('/users/:userId/toggle-block', adminController.toggleUserBlock);

// GET /api/admin/stats
// Estadísticas generales de la plataforma
router.get('/stats', adminController.getPlatformStats);

// GET /api/admin/disputes
// Lista disputas entre usuarios
router.get('/disputes', adminController.getDisputes);

module.exports = router;