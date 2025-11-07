// src/controllers/searchController.js
const { PrismaClient } = require('@prisma/client');
const { getCachedProfessionalSearch, cacheProfessionalSearch } = require('../services/cacheService');
const prisma = new PrismaClient();

exports.searchProfessionals = async (req, res) => {
  const { especialidad, zona_cobertura, precio_min, precio_max, sort_by = 'calificacion_promedio', page = 1, limit = 10 } = req.query;

  try {
    // Crear objeto de filtros para el caché
    const filters = {
      especialidad: especialidad || null,
      zona_cobertura: zona_cobertura || null,
      precio_min: precio_min ? parseFloat(precio_min) : null,
      precio_max: precio_max ? parseFloat(precio_max) : null,
      sort_by: sort_by || 'calificacion_promedio',
      page: parseInt(page),
      limit: parseInt(limit)
    };

    // Intentar obtener resultados del caché
    const cachedResults = await getCachedProfessionalSearch(filters);
    if (cachedResults) {
      console.log('🔍 Resultados obtenidos del caché');
      return res.status(200).json(cachedResults);
    }

    const where = {};

    if (especialidad) {
      where.especialidad = { contains: especialidad, mode: 'insensitive' };
    }

    if (zona_cobertura) {
      where.zona_cobertura = { contains: zona_cobertura, mode: 'insensitive' };
    }

    if (precio_min || precio_max) {
      where.tarifa_hora = {};
      if (precio_min) where.tarifa_hora.gte = parseFloat(precio_min);
      if (precio_max) where.tarifa_hora.lte = parseFloat(precio_max);
    }

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Configurar ordenamiento con índices optimizados
    let orderBy = {};
    switch (sort_by) {
      case 'calificacion_promedio':
        orderBy = [{ calificacion_promedio: 'desc' }, { usuario: { nombre: 'asc' } }];
        break;
      case 'tarifa_hora':
        orderBy = [{ tarifa_hora: 'asc' }, { calificacion_promedio: 'desc' }];
        break;
      case 'distancia':
        // Para distancia necesitaríamos coordenadas, por ahora ordenar por zona_cobertura
        orderBy = [{ zona_cobertura: 'asc' }, { calificacion_promedio: 'desc' }];
        break;
      default:
        orderBy = [{ calificacion_promedio: 'desc' }, { usuario: { nombre: 'asc' } }];
    }

    console.log({ event: 'search_performed', filters, timestamp: new Date().toISOString() });

    const professionals = await prisma.perfiles_profesionales.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        usuario: {
          select: { id: true, nombre: true, email: true },
        },
      },
    });

    const total = await prisma.perfiles_profesionales.count({ where });
    const totalPages = Math.ceil(total / limit);

    const results = {
      professionals,
      total,
      page: parseInt(page),
      totalPages,
    };

    // Almacenar en caché para futuras consultas
    await cacheProfessionalSearch(filters, results);
    console.log('💾 Resultados almacenados en caché');

    res.status(200).json(results);
  } catch (error) {
    console.error('Error searching professionals:', error);
    res.status(500).json({ error: 'Error al buscar profesionales.' });
  }
};