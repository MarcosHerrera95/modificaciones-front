// src/controllers/professionalController.js
const { PrismaClient } = require('@prisma/client');
const DOMPurify = require('isomorphic-dompurify');
const prisma = new PrismaClient();

/**
 * Sanitiza parámetros de entrada para prevenir ataques XSS
 * @param {Object} params - Parámetros a sanitizar
 * @returns {Object} Parámetros sanitizados
 */
function sanitizeSearchParams(params) {
  const sanitized = {};

  // Sanitizar strings con DOMPurify
  const stringFields = ['zona_cobertura', 'especialidad'];
  stringFields.forEach(field => {
    if (params[field]) {
      sanitized[field] = DOMPurify.sanitize(params[field], {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      }).trim();
    }
  });

  // Copiar valores numéricos sin modificación
  const numericFields = ['precio_min', 'precio_max', 'page', 'limit'];
  numericFields.forEach(field => {
    if (params[field] !== undefined && params[field] !== null) {
      sanitized[field] = params[field];
    }
  });

  // Manejar campos especiales
  if (params.sort_by) sanitized.sort_by = params.sort_by;

  return sanitized;
}

/**
 * Buscar profesionales con filtros y ordenamiento
 * REQ-11, REQ-12, REQ-13, REQ-14, REQ-15
 */
exports.getProfessionals = async (req, res) => {
   try {
     // Sanitizar parámetros de entrada
     const sanitizedParams = sanitizeSearchParams(req.query);

     const {
       zona_cobertura,
       precio_min,
       precio_max,
       especialidad,
       sort_by = 'calificacion_promedio',
       page = 1,
       limit = 10
     } = sanitizedParams;

     console.log('🔍 Buscando profesionales con filtros:', sanitizedParams);

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
      perfiles_profesionales: {
        isNot: null // Solo usuarios con perfil profesional
      }
    };

    // Crear filtros para perfiles_profesionales usando 'is'
    const perfilWhere = {};

    // Filtro por zona/barrio (REQ-12)
    if (zona_cobertura) {
      perfilWhere.zona_cobertura = {
        contains: zona_cobertura
      };
    }

    // Filtro por especialidad (REQ-11) - mejorado para ser más flexible
    if (especialidad) {
      // Búsqueda flexible que incluya variaciones comunes
      const especialidadLower = especialidad.toLowerCase().trim();
      
      // Mapeo de especialidades flexibles
      
      if (especialidadLower.includes('cerraj')) {
        // Buscar tanto 'Cerrajería' (con í) como 'Cerrajero'
        perfilWhere.especialidad = {
          in: ['Cerrajería', 'cerrajería', 'Cerrajero', 'cerrajero', 'CERRAJERÍA', 'CERRAJERO']
        };
      } else if (especialidadLower.includes('plom')) {
        perfilWhere.especialidad = {
          in: ['Plomero', 'plomero', 'PLOMERO', 'Plomería', 'plomería', 'PLOMERÍA']
        };
      } else if (especialidadLower.includes('electr')) {
        perfilWhere.especialidad = {
          in: ['Electricista', 'electricista', 'ELECTRICISTA', 'Electricidad', 'electricidad', 'ELECTRICIDAD']
        };
      } else if (especialidadLower.includes('pint')) {
        perfilWhere.especialidad = {
          in: ['Pintor', 'pintor', 'PINTOR', 'Pintura', 'pintura', 'PINTURA']
        };
      } else if (especialidadLower.includes('albañil')) {
        perfilWhere.especialidad = {
          in: ['Albañil', 'albañil', 'ALBAÑIL', 'Albañilería', 'albañilería', 'ALBAÑILERÍA']
        };
      } else if (especialidadLower.includes('gas')) {
        perfilWhere.especialidad = {
          in: ['Gasista', 'gasista', 'GASISTA', 'Gasfiter', 'gasfiter', 'GASFITER']
        };
      } else if (especialidadLower.includes('carpint')) {
        perfilWhere.especialidad = {
          in: ['Carpintero', 'carpintero', 'CARPINTERO', 'Carpintería', 'carpintería', 'CARPINTERÍA']
        };
      } else if (especialidadLower.includes('herr')) {
        perfilWhere.especialidad = {
          in: ['Herrero', 'herrero', 'HERRERO', 'Herrería', 'herrería', 'HERRERÍA']
        };
      } else if (especialidadLower.includes('mecan')) {
        perfilWhere.especialidad = {
          in: ['Mecánico', 'mecánico', 'MECÁNICO', 'Mecánica', 'mecánica', 'MECÁNICA']
        };
      } else if (especialidadLower.includes('jardin')) {
        perfilWhere.especialidad = {
          in: ['Jardín', 'jardín', 'JARDÍN', 'Jardinería', 'jardinería', 'JARDINERÍA']
        };
      } else {
        // Búsqueda genérica - buscar coincidencias parciales
        perfilWhere.especialidad = {
          contains: especialidadLower
        };
      }
      
      console.log('🔍 DEBUGGING - Especialidad buscada:', especialidadLower);
      console.log('🔍 DEBUGGING - Filtro aplicado:', perfilWhere.especialidad);
    }

    // Filtro por rango de precio (REQ-13)
    if (precio_min || precio_max) {
      perfilWhere.tarifa_hora = {};
      if (precio_min) perfilWhere.tarifa_hora.gte = parseFloat(precio_min);
      if (precio_max) perfilWhere.tarifa_hora.lte = parseFloat(precio_max);
    }

    // Aplicar filtros de perfiles_profesionales si existen
    if (Object.keys(perfilWhere).length > 0) {
      where.perfiles_profesionales = {
        ...where.perfiles_profesionales,
        is: perfilWhere
      };
    }

    // Configurar ordenamiento (REQ-14)
    // Para ordenar por campos relacionados, necesitamos usar la estructura correcta de Prisma
    let orderBy = {};
    switch (sort_by) {
      case 'calificacion_promedio':
        orderBy = { perfiles_profesionales: { calificacion_promedio: 'desc' } };
        break;
      case 'tarifa_hora':
        orderBy = { perfiles_profesionales: { tarifa_hora: 'asc' } };
        break;
      case 'distancia':
        // Para distancia necesitaríamos coordenadas del usuario
        orderBy = { perfiles_profesionales: { zona_cobertura: 'asc' } };
        break;
      case 'disponibilidad':
        // Para disponibilidad: ordenar por estado de verificación
        orderBy = { perfiles_profesionales: { estado_verificacion: 'desc' } };
        break;
      default:
        orderBy = { perfiles_profesionales: { calificacion_promedio: 'desc' } };
    }

    const skip = (pageNum - 1) * limitNum;

    // Solo obtener especialidades disponibles para logging cuando se busca especialidad
    let allSpecialties = [];
    if (especialidad) {
      allSpecialties = await prisma.perfiles_profesionales.findMany({
        select: {
          especialidad: true
        },
        distinct: ['especialidad']
      });
      console.log('📋 Especialidades disponibles:', allSpecialties.map(s => s.especialidad).join(', '));
    }

    // Buscar profesionales usando Prisma con include (REQ-15)
    // Nota: Ordenamos después de obtener los resultados debido a la estructura de Prisma
    console.log('🔍 DEBUGGING - Prisma where clause:', JSON.stringify(where, null, 2));
    console.log('🔍 DEBUGGING - Skip:', skip, 'Take:', limitNum);

    const professionals = await prisma.usuarios.findMany({
      where,
      include: {
        perfiles_profesionales: {
          select: {
            especialidad: true,
            zona_cobertura: true,
            tarifa_hora: true,
            calificacion_promedio: true,
            estado_verificacion: true,
            descripcion: true,
            latitud: true,
            longitud: true
          }
        }
      },
      skip,
      take: limitNum
    });

    console.log('🔍 DEBUGGING - Raw professionals from DB:', professionals.length);
    console.log('🔍 DEBUGGING - First professional sample:', professionals[0] ? {
      id: professionals[0].id,
      nombre: professionals[0].nombre,
      rol: professionals[0].rol,
      perfil: professionals[0].perfiles_profesionales
    } : 'No professionals found');

    // Ordenar los resultados en JavaScript según el criterio solicitado
    const sortedProfessionals = professionals.sort((a, b) => {
      const profA = a.perfiles_profesionales;
      const profB = b.perfiles_profesionales;

      if (!profA || !profB) return 0;

      switch (sort_by) {
        case 'calificacion_promedio':
          return (profB.calificacion_promedio || 0) - (profA.calificacion_promedio || 0);
        case 'tarifa_hora':
          return (profA.tarifa_hora || 0) - (profB.tarifa_hora || 0);
        case 'distancia':
          return (profA.zona_cobertura || '').localeCompare(profB.zona_cobertura || '');
        case 'disponibilidad': {
          const estadoA = profA.estado_verificacion === 'verificado' ? 1 : 0;
          const estadoB = profB.estado_verificacion === 'verificado' ? 1 : 0;
          return estadoB - estadoA;
        }
        default:
          return (profB.calificacion_promedio || 0) - (profA.calificacion_promedio || 0);
      }
    });

    // Transformar datos para el frontend
    const transformedProfessionals = sortedProfessionals.map(prof => ({
      usuario_id: prof.id,
      usuario: {
        nombre: prof.nombre,
        email: prof.email,
        url_foto_perfil: prof.url_foto_perfil
      },
      especialidad: prof.perfiles_profesionales?.especialidad,
      zona_cobertura: prof.perfiles_profesionales?.zona_cobertura,
      tarifa_hora: prof.perfiles_profesionales?.tarifa_hora,
      calificacion_promedio: prof.perfiles_profesionales?.calificacion_promedio,
      estado_verificacion: prof.perfiles_profesionales?.estado_verificacion,
      descripcion: prof.perfiles_profesionales?.descripcion,
      latitud: prof.perfiles_profesionales?.latitud,
      longitud: prof.perfiles_profesionales?.longitud
    }));

    const totalQuery = where;
    console.log('🔍 DEBUGGING - Total count query:', JSON.stringify(totalQuery, null, 2));

    const total = await prisma.usuarios.count({
      where: totalQuery
    });

    console.log('🔍 DEBUGGING - Total count result:', total);

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
        perfiles_profesionales: {
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
      especialidad: professional.perfiles_profesionales?.especialidad,
      zona_cobertura: professional.perfiles_profesionales?.zona_cobertura,
      tarifa_hora: professional.perfiles_profesionales?.tarifa_hora,
      calificacion_promedio: professional.perfiles_profesionales?.calificacion_promedio,
      estado_verificacion: professional.perfiles_profesionales?.estado_verificacion,
      descripcion: professional.perfiles_profesionales?.descripcion
    };

    res.json(transformedProfessional);
  } catch (error) {
    console.error('Error al obtener profesional:', error);
    res.status(500).json({ error: 'Error al obtener profesional' });
  }
};