// src/controllers/professionalController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Buscar profesionales con filtros y ordenamiento
 * REQ-11, REQ-12, REQ-13, REQ-14, REQ-15
 */
exports.getProfessionals = async (req, res) => {
  try {
    const {
      zona_cobertura,
      precio_min,
      precio_max,
      especialidad,
      sort_by = 'calificacion_promedio',
      page = 1,
      limit = 10
    } = req.query;

    console.log('🔍 Buscando profesionales con filtros:', req.query);

    // Validar parámetros
    const validSortOptions = ['calificacion_promedio', 'tarifa_hora', 'distancia', 'disponibilidad'];
    if (!validSortOptions.includes(sort_by)) {
      return res.status(400).json({
        error: 'Parámetro sort_by inválido. Opciones válidas: calificacion_promedio, tarifa_hora, distancia, disponibilidad.'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos.' });
    }

    // Construir filtros usando Prisma con include
    const where = {
      rol: 'profesional',
      perfil_profesional: {
        isNot: null // Solo usuarios con perfil profesional
      }
    };

    // Crear filtros para perfil_profesional usando 'is'
    const perfilWhere = {};

    // Filtro por zona/barrio (REQ-12)
    if (zona_cobertura) {
      perfilWhere.zona_cobertura = {
        contains: zona_cobertura
      };
    }

    // Filtro por especialidad (REQ-11)
    if (especialidad) {
      perfilWhere.especialidad = {
        contains: especialidad
      };
    }

    // Filtro por rango de precio (REQ-13)
    if (precio_min || precio_max) {
      perfilWhere.tarifa_hora = {};
      if (precio_min) perfilWhere.tarifa_hora.gte = parseFloat(precio_min);
      if (precio_max) perfilWhere.tarifa_hora.lte = parseFloat(precio_max);
    }

    // Aplicar filtros de perfil_profesional si existen
    if (Object.keys(perfilWhere).length > 0) {
      where.perfil_profesional.is = perfilWhere;
    }

    // Configurar ordenamiento (REQ-14)
    let orderBy = {};
    switch (sort_by) {
      case 'calificacion_promedio':
        orderBy = { perfil_profesional: { calificacion_promedio: 'desc' } };
        break;
      case 'tarifa_hora':
        orderBy = { perfil_profesional: { tarifa_hora: 'asc' } };
        break;
      case 'distancia':
        // Para distancia necesitaríamos coordenadas del usuario
        orderBy = { perfil_profesional: { zona_cobertura: 'asc' } };
        break;
      case 'disponibilidad':
        // Para disponibilidad: ordenar por estado de verificación
        orderBy = { perfil_profesional: { estado_verificacion: 'desc' } };
        break;
      default:
        orderBy = { perfil_profesional: { calificacion_promedio: 'desc' } };
    }

    const skip = (pageNum - 1) * limitNum;

    // Buscar profesionales usando Prisma con include (REQ-15)
    const professionals = await prisma.usuarios.findMany({
      where,
      include: {
        perfil_profesional: {
          select: {
            especialidad: true,
            zona_cobertura: true,
            tarifa_hora: true,
            calificacion_promedio: true,
            estado_verificacion: true,
            descripcion: true
          }
        }
      },
      orderBy,
      skip,
      take: limitNum
    });

    // Transformar datos para el frontend
    const transformedProfessionals = professionals.map(prof => ({
      usuario_id: prof.id,
      usuario: {
        nombre: prof.nombre,
        email: prof.email,
        url_foto_perfil: prof.url_foto_perfil
      },
      especialidad: prof.perfil_profesional?.especialidad,
      zona_cobertura: prof.perfil_profesional?.zona_cobertura,
      tarifa_hora: prof.perfil_profesional?.tarifa_hora,
      calificacion_promedio: prof.perfil_profesional?.calificacion_promedio,
      estado_verificacion: prof.perfil_profesional?.estado_verificacion,
      descripcion: prof.perfil_profesional?.descripcion
    }));

    const total = await prisma.usuarios.count({
      where: {
        rol: 'profesional',
        perfil_profesional: { isNot: null }
      }
    });

    const totalPages = Math.ceil(total / limitNum);

    console.log(`✅ Encontrados ${transformedProfessionals.length} profesionales de ${total} total`);

    res.json({
      professionals: transformedProfessionals,
      total,
      page: pageNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    });

  } catch (error) {
    console.error('❌ Error al buscar profesionales:', error);
    res.status(500).json({ error: 'Error interno del servidor al buscar profesionales' });
  }
};

/**
 * Obtener profesional por ID
 */
exports.getProfessionalById = async (req, res) => {
  try {
    const { id } = req.params;

    const professional = await prisma.usuarios.findUnique({
      where: {
        id: parseInt(id),
        rol: 'profesional'
      },
      include: {
        perfil_profesional: {
          select: {
            especialidad: true,
            zona_cobertura: true,
            tarifa_hora: true,
            calificacion_promedio: true,
            estado_verificacion: true,
            descripcion: true,
            created_at: true
          }
        }
      }
    });

    if (!professional) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    // Transformar datos
    const transformedProfessional = {
      usuario_id: professional.id,
      usuario: {
        nombre: professional.nombre,
        email: professional.email,
        url_foto_perfil: professional.url_foto_perfil
      },
      especialidad: professional.perfil_profesional?.especialidad,
      zona_cobertura: professional.perfil_profesional?.zona_cobertura,
      tarifa_hora: professional.perfil_profesional?.tarifa_hora,
      calificacion_promedio: professional.perfil_profesional?.calificacion_promedio,
      estado_verificacion: professional.perfil_profesional?.estado_verificacion,
      descripcion: professional.perfil_profesional?.descripcion
    };

    res.json(transformedProfessional);
  } catch (error) {
    console.error('Error al obtener profesional:', error);
    res.status(500).json({ error: 'Error al obtener profesional' });
  }
};