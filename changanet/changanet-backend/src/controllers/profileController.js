/**
 * Controlador para gestión de perfiles de usuarios
 * Implementa sección 7.2 del PRD: Gestión de Perfiles Profesionales
 *
 * REQUERIMIENTOS FUNCIONALES IMPLEMENTADOS:
 * REQ-06: Subir foto de perfil y portada (Cloudinary) - ✅ Implementado completamente
 * REQ-07: Seleccionar especialidades - ✅ Implementado (múltiples especialidades con array JSON)
 * REQ-08: Ingresar años de experiencia - ✅ Implementado
 * REQ-09: Definir zona de cobertura geográfica - ✅ Implementado (con coordenadas GPS)
 * REQ-10: Indicar tarifas flexibles - ✅ Implementado (hora, servicio, convenio)
 *
 * CARACTERÍSTICAS ADICIONALES IMPLEMENTADAS:
 * - Sistema de especialidades múltiples con array JSON
 * - Tipos de tarifa flexibles (hora/servicio/convenio)
 * - Foto de perfil y portada separadas
 * - Campo de disponibilidad general del profesional
 * - Validación de tipos de tarifa
 * - Compatibilidad hacia atrás con especialidad única
 */

// src/controllers/profileController.js
const { PrismaClient } = require('@prisma/client');
const { uploadImage, deleteImage } = require('../services/storageService');
const prisma = new PrismaClient();

/**
 * Obtiene perfil público de un usuario (profesional o cliente)
 * REQ-07, REQ-09: Muestra especialidad y zona de cobertura para profesionales
 */
exports.getProfile = async (req, res) => {
  const { professionalId } = req.params;

  try {
    // Primero intentar obtener perfil de profesional
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

    if (profile) {
      console.log('✅ Perfil profesional obtenido');
      return res.status(200).json(profile);
    }

    // Si no es profesional, buscar usuario básico (cliente)
    console.log(`🔍 Usuario ${professionalId} no es profesional, buscando como cliente...`);
    const user = await prisma.usuarios.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        url_foto_perfil: true,
        esta_verificado: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Devolver en formato compatible con el frontend (usuario envuelto)
    const clientProfile = {
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        url_foto_perfil: user.url_foto_perfil,
        esta_verificado: user.esta_verificado
      }
    };

    console.log('✅ Perfil de cliente obtenido');
    res.status(200).json(clientProfile);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
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
  const {
    nombre, email, telefono,
    especialidad, especialidades, // especialidad para compatibilidad, especialidades para array
    anos_experiencia, zona_cobertura,
    tipo_tarifa, tarifa_hora, tarifa_servicio, tarifa_convenio, // Sistema de tarifas flexible
    descripcion, direccion, preferencias_servicio,
    latitud, longitud, esta_disponible
  } = req.body;

  try {
    const user = await prisma.usuarios.findUnique({ where: { id: userId } });

    if (user.rol === 'profesional') {
      // Update professional profile
      let profile = await prisma.perfiles_profesionales.findUnique({ where: { usuario_id: userId } });

      let url_foto_perfil = profile ? profile.url_foto_perfil : null;
      let url_foto_portada = profile ? profile.url_foto_portada : null;

      // Handle image uploads (profile photo and cover photo)
      if (req.file) {
        try {
          // Determine if it's profile or cover photo based on field name
          const isCoverPhoto = req.body.foto_tipo === 'portada';

          if (isCoverPhoto) {
            // Delete previous cover image if exists
            if (url_foto_portada) {
              const publicId = url_foto_portada.split('/').pop().split('.')[0];
              await deleteImage(`changanet/${publicId}`);
            }
            // Upload new cover image
            const result = await uploadImage(req.file.buffer, { folder: 'changanet/profiles/covers' });
            url_foto_portada = result.secure_url;
          } else {
            // Delete previous profile image if exists
            if (url_foto_perfil) {
              const publicId = url_foto_perfil.split('/').pop().split('.')[0];
              await deleteImage(`changanet/${publicId}`);
            }
            // Upload new profile image
            const result = await uploadImage(req.file.buffer, { folder: 'changanet/profiles' });
            url_foto_perfil = result.secure_url;
          }
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          return res.status(500).json({ error: 'Error al subir la imagen.' });
        }
      }

      // Preparar especialidades (array JSON o especialidad única para compatibilidad)
      let especialidadesArray = null;
      if (especialidades) {
        // Si se envía array de especialidades
        especialidadesArray = JSON.stringify(especialidades);
      } else if (especialidad) {
        // Compatibilidad con especialidad única
        especialidadesArray = JSON.stringify([especialidad]);
      }

      // Validar tipo de tarifa
      const validTiposTarifa = ['hora', 'servicio', 'convenio'];
      const tipoTarifaFinal = tipo_tarifa && validTiposTarifa.includes(tipo_tarifa) ? tipo_tarifa : 'hora';

      if (profile) {
        profile = await prisma.perfiles_profesionales.update({
          where: { usuario_id: userId },
          data: {
            especialidad: especialidad || (especialidades ? especialidades[0] : profile.especialidad), // Mantener compatibilidad
            especialidades: especialidadesArray,
            anos_experiencia: anos_experiencia ? parseInt(anos_experiencia, 10) : undefined,
            zona_cobertura,
            latitud: latitud ? parseFloat(latitud) : undefined,
            longitud: longitud ? parseFloat(longitud) : undefined,
            tipo_tarifa: tipoTarifaFinal,
            tarifa_hora: tarifa_hora ? parseFloat(tarifa_hora) : undefined,
            tarifa_servicio: tarifa_servicio ? parseFloat(tarifa_servicio) : undefined,
            tarifa_convenio: tarifa_convenio,
            descripcion,
            url_foto_perfil,
            url_foto_portada,
            esta_disponible: esta_disponible !== undefined ? Boolean(esta_disponible) : true,
          },
        });
      } else {
        profile = await prisma.perfiles_profesionales.create({
          data: {
            usuario_id: userId,
            especialidad: especialidad || (especialidades ? especialidades[0] : ''),
            especialidades: especialidadesArray,
            anos_experiencia: anos_experiencia ? parseInt(anos_experiencia, 10) : undefined,
            zona_cobertura,
            latitud: latitud ? parseFloat(latitud) : undefined,
            longitud: longitud ? parseFloat(longitud) : undefined,
            tipo_tarifa: tipoTarifaFinal,
            tarifa_hora: tarifa_hora ? parseFloat(tarifa_hora) : undefined,
            tarifa_servicio: tarifa_servicio ? parseFloat(tarifa_servicio) : undefined,
            tarifa_convenio: tarifa_convenio,
            descripcion,
            url_foto_perfil,
            url_foto_portada,
            esta_disponible: esta_disponible !== undefined ? Boolean(esta_disponible) : true,
          },
        });
      }

      // Profile updated successfully
      console.log('✅ Professional profile updated successfully');

      console.log('✅ Professional profile updated successfully');
      res.status(200).json({
        message: 'Perfil profesional actualizado exitosamente',
        perfil: profile,
        usuario: {
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
          esta_verificado: user.esta_verificado
        }
      });
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
          direccion,
          preferencias_servicio
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          rol: true,
          esta_verificado: true,
          url_foto_perfil: true,
          direccion: true,
          preferencias_servicio: true
        }
      });

      console.log('✅ Client profile updated successfully');
      res.status(200).json({
        message: 'Perfil de cliente actualizado exitosamente',
        usuario: updatedUser,
        perfil: {
          nombre: updatedUser.nombre,
          email: updatedUser.email,
          telefono: updatedUser.telefono,
          url_foto_perfil: updatedUser.url_foto_perfil,
          direccion: updatedUser.direccion,
          preferencias_servicio: updatedUser.preferencias_servicio,
          rol: updatedUser.rol,
          esta_verificado: updatedUser.esta_verificado
        }
      });
    } else {
      return res.status(403).json({ error: 'Rol de usuario no válido.' });
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
};