// src/controllers/profileController.js
const { PrismaClient } = require('@prisma/client');
const { uploadImage, deleteImage } = require('../services/storageService');
const prisma = new PrismaClient();

exports.getProfile = async (req, res) => {
  const { professionalId } = req.params;

  try {
    const profile = await prisma.perfiles_profesionales.findUnique({
      where: { usuario_id: professionalId },
      include: { 
        usuario: { 
          select: { 
            nombre: true, 
            email: true 
          } 
        } 
      },
    });

    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });
    res.status(200).json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el perfil.' });
  }
};

exports.updateProfile = async (req, res) => {
  const { userId } = req.user;
  const { especialidad, anos_experiencia, zona_cobertura, tarifa_hora, descripcion } = req.body;

  try {
    const user = await prisma.usuarios.findUnique({ where: { id: userId } });
    if (user.rol !== 'profesional') {
      return res.status(403).json({ error: 'Solo los profesionales pueden actualizar un perfil.' });
    }

    let profile = await prisma.perfiles_profesionales.findUnique({ where: { usuario_id: userId } });

    let url_foto_perfil = profile ? profile.url_foto_perfil : null;

    // Manejar subida de imagen si hay archivo
    if (req.file) {
      try {
        // Eliminar imagen anterior si existe
        if (url_foto_perfil) {
          const publicId = url_foto_perfil.split('/').pop().split('.')[0];
          await deleteImage(`changanet/${publicId}`);
        }

        // Subir nueva imagen a Cloudinary
        const result = await uploadImage(req.file.buffer, { folder: 'changanet/profiles' });
        url_foto_perfil = result.secure_url;
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        return res.status(500).json({ error: 'Error al subir la imagen.' });
      }
    }

    if (profile) {
      profile = await prisma.perfiles_profesionales.update({
        where: { usuario_id: userId },
        data: {
          especialidad,
          anos_experiencia,
          zona_cobertura,
          tarifa_hora: parseFloat(tarifa_hora),
          descripcion,
          url_foto_perfil
        },
      });
    } else {
      profile = await prisma.perfiles_profesionales.create({
        data: {
          usuario_id: userId,
          especialidad,
          anos_experiencia,
          zona_cobertura,
          tarifa_hora: parseFloat(tarifa_hora),
          descripcion,
          url_foto_perfil
        },
      });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
};