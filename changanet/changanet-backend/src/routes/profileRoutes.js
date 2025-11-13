// src/routes/profileRoutes.js
// FUNCIÓN: Define los endpoints para la visualización y actualización de perfiles de profesionales.
// RELACIÓN PRD: REQ-06 (Foto), REQ-07 (Especialidad), REQ-08 (Experiencia), REQ-09 (Zona), REQ-10 (Tarifas).
// TARJETA BACKEND: Tarjeta 2: [Backend] Implementar API para Gestión de Perfiles Profesionales.
// SPRINT: Sprint 1 (Primera Entrega) - "Implementación del producto de software".

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/authenticate');
const multer = require('multer');
// Importar los controladores que contienen la lógica de negocio para obtener y actualizar perfiles.
const { getProfile, updateProfile } = require('../controllers/profileController');

const prisma = new PrismaClient();

// Configurar multer para subida de imágenes
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
  },
  fileFilter: (req, file, cb) => {
    // Solo permitir imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Crear un enrutador de Express para agrupar las rutas relacionadas con los perfiles.
const router = express.Router();

// Definir la ruta GET para obtener el perfil propio (autenticado).
// Esta ruta está protegida y devuelve el perfil del usuario autenticado.
router.get('/', authenticateToken, async (req, res) => {
  const { userId } = req.user;

  try {
    if (req.user.role === 'profesional') {
      const profile = await prisma.perfiles_profesionales.findUnique({
        where: { usuario_id: userId },
        include: { usuario: { select: { nombre: true, email: true, telefono: true } } }
      });

      if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });
      res.status(200).json(profile);
    } else {
      // Para clientes, devolver info básica del usuario
      const user = await prisma.usuarios.findUnique({
        where: { id: userId },
        select: { id: true, nombre: true, email: true, telefono: true, rol: true }
      });
      res.status(200).json({ usuario: user });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el perfil.' });
  }
});

// Definir la ruta GET para obtener el perfil público de un profesional.
// REQ-07, REQ-09: El cliente enviará una solicitud GET a /api/profile/123, donde "123" es el ID del profesional.
// Esta ruta es pública y no requiere autenticación.
router.get('/:professionalId', getProfile);

// Note: The authenticated route for own profile is defined above without :professionalId

// Definir la ruta PUT para actualizar perfil (profesional o cliente).
// REQ-08, REQ-10: Los usuarios enviarán una solicitud PUT a /api/profile con los datos actualizados en el cuerpo.
// Esta ruta está protegida por el middleware de autenticación.
// Incluye multer para manejo de subida de imágenes de perfil.
router.put('/', authenticateToken, upload.single('foto_perfil'), updateProfile);

// Exportar el enrutador para que pueda ser usado por el servidor principal (server.js).
module.exports = router;