/**
 * Controlador para gestión de perfiles de usuarios
 * Implementa sección 7.2 del PRD: Gestión de Perfiles Profesionales
 * REQ-06: Subir foto de perfil
 * REQ-07: Seleccionar especialidad
 * REQ-08: Ingresar años de experiencia
 * REQ-09: Definir zona de cobertura geográfica
 * REQ-10: Indicar tarifas (por hora, por servicio)
 */

// src/controllers/profileController.js
const { PrismaClient } = require('@prisma/client');
const { uploadImage, deleteImage } = require('../services/storageService');
const { getCachedProfessionalProfile, cacheProfessionalProfile, invalidateProfessionalProfile } = require('../services/cacheService');
const prisma = new PrismaClient();

/**
 * Obtiene perfil público de un profesional
 * Incluye caché para optimización de rendimiento
 * REQ-07, REQ-09: Muestra especialidad y zona de cobertura
 */
exports.getProfile = async (req, res) => {
  const { professionalId } = req.params;

  try {
    // Intentar obtener perfil del caché
    const cachedProfile = await getCachedProfessionalProfile(professionalId);
    if (cachedProfile) {
      console.log('👤 Perfil obtenido del caché');
      return res.status(200).json(cachedProfile);
    }

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

    // Almacenar en caché
    await cacheProfessionalProfile(professionalId, profile);
    console.log('💾 Perfil almacenado en caché');

    res.status(200).json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el perfil.' });
  }
};

/**
 * Actualiza perfil de usuario (profesional o cliente)
 * REQ-06: Maneja subida de foto de perfil
 * REQ-07-10: Actualiza especialidad, experiencia, zona, tarifas
 * Soporta tanto perfiles profesionales como clientes
 */
exports.updateProfile = async (req, res) => {
  const { userId } = req.user;
  const { nombre, email, telefono, especialidad, anos_experiencia, zona_cobertura, tarifa_hora, descripcion, direccion, preferencias_servicio, latitud, longitud } = req.body;

  try {
    const user = await prisma.usuarios.findUnique({ where: { id: userId } });

    if (user.rol === 'profesional') {
      // Update professional profile
      let profile = await prisma.perfiles_profesionales.findUnique({ where: { usuario_id: userId } });

      let url_foto_perfil = profile ? profile.url_foto_perfil : null;

      // Handle image upload if file exists
      if (req.file) {
        try {
          // Delete previous image if exists
          if (url_foto_perfil) {
            const publicId = url_foto_perfil.split('/').pop().split('.')[0];
            await deleteImage(`changanet/${publicId}`);
          }

          // Upload new image to Cloudinary
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
            anos_experiencia: parseInt(anos_experiencia, 10),
            zona_cobertura,
            latitud: latitud ? parseFloat(latitud) : undefined,
            longitud: longitud ? parseFloat(longitud) : undefined,
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
            anos_experiencia: parseInt(anos_experiencia, 10),
            zona_cobertura,
            latitud: latitud ? parseFloat(latitud) : undefined,
            longitud: longitud ? parseFloat(longitud) : undefined,
            tarifa_hora: parseFloat(tarifa_hora),
            descripcion,
            url_foto_perfil
          },
        });
      }

      // Invalidate profile cache after update
      await invalidateProfessionalProfile(userId);
      console.log('🗑️ Professional profile cache invalidated');

      res.status(200).json(profile);
    } else if (user.rol === 'cliente') {
      // Update client profile (basic user info)
      let url_foto_perfil = user.url_foto_perfil;

      // Handle image upload if file exists
      if (req.file) {
        try {
          // Delete previous image if exists
          if (url_foto_perfil) {
            const publicId = url_foto_perfil.split('/').pop().split('.')[0];
            await deleteImage(`changanet/${publicId}`);
          }

          // Upload new image to Cloudinary
          const result = await uploadImage(req.file.buffer, { folder: 'changanet/profiles' });
          url_foto_perfil = result.secure_url;
        } catch (uploadError) {
          console.error('Error uploading client image:', uploadError);
          return res.status(500).json({ error: 'Error al subir la imagen.' });
        }
      }

      const updatedUser = await prisma.usuarios.update({
        where: { id: userId },
        data: {
          nombre,
          email,
          telefono,
          url_foto_perfil,
          // Note: Currently only nombre, email, telefono are stored in usuarios table
          // direccion and preferencias_servicio will be added in future schema updates
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          rol: true,
          esta_verificado: true,
          url_foto_perfil: true
        }
      });

      console.log('✅ Client profile updated successfully');
      res.status(200).json({ usuario: updatedUser });
    } else {
      return res.status(403).json({ error: 'Rol de usuario no válido.' });
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
};