// src/controllers/profileController.js
const { PrismaClient } = require('@prisma/client');
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
  const { especialidad, años_experiencia, zona_cobertura, tarifa_hora, descripción, url_foto_perfil } = req.body;

  try {
    const user = await prisma.usuarios.findUnique({ where: { id: userId } });
    if (user.rol !== 'profesional') {
      return res.status(403).json({ error: 'Solo los profesionales pueden actualizar un perfil.' });
    }

    let profile = await prisma.perfiles_profesionales.findUnique({ where: { usuario_id: userId } });

    if (profile) {
      profile = await prisma.perfiles_profesionales.update({
        where: { usuario_id: userId },
        data: { 
          especialidad, 
          años_experiencia, 
          zona_cobertura, 
          tarifa_hora: parseFloat(tarifa_hora), 
          descripción, 
          url_foto_perfil 
        },
      });
    } else {
      profile = await prisma.perfiles_profesionales.create({
        data: { 
          usuario_id: userId, 
          especialidad, 
          años_experiencia, 
          zona_cobertura, 
          tarifa_hora: parseFloat(tarifa_hora), 
          descripción, 
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