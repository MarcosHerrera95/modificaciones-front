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

    // Búsqueda por especialidad con ILIKE (REQ-11)
    if (especialidad) {
      where.especialidad = { contains: especialidad, mode: 'insensitive' };
    }

    // Filtro por zona/barrio (REQ-12)
    if (zona_cobertura) {
      where.zona_cobertura = { contains: zona_cobertura, mode: 'insensitive' };
    }

    // Filtro por rango de precio (REQ-13)
    if (precio_min || precio_max) {
      where.tarifa_hora = {};
      if (precio_min) where.tarifa_hora.gte = parseFloat(precio_min);
      if (precio_max) where.tarifa_hora.lte = parseFloat(precio_max);
    }

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Configurar ordenamiento (REQ-14)
    let orderBy = {};
    switch (sort_by) {
      case 'calificacion_promedio':
        orderBy = [{ calificacion_promedio: 'desc' }, { usuario: { nombre: 'asc' } }];
        break;
      case 'tarifa_hora':
        orderBy = [{ tarifa_hora: 'asc' }, { calificacion_promedio: 'desc' }];
        break;
      case 'distancia':
        // Para distancia: ordenar por zona_cobertura alfabéticamente (aproximación)
        orderBy = [{ zona_cobertura: 'asc' }, { calificacion_promedio: 'desc' }];
        break;
      case 'disponibilidad':
        // Para disponibilidad: ordenar por estado de verificación (verificado primero)
        orderBy = [{ estado_verificacion: 'asc' }, { calificacion_promedio: 'desc' }];
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

    // Optimizar consultas: precargar datos relacionados para evitar N+1
    const professionalIds = professionals.map(p => p.usuario_id);
    const [reviews, services] = await Promise.all([
      prisma.resenas.groupBy({
        by: ['profesional_id'],
        where: { profesional_id: { in: professionalIds } },
        _count: { calificacion: true },
        _avg: { calificacion: true }
      }),
      prisma.servicios.groupBy({
        by: ['profesional_id'],
        where: { profesional_id: { in: professionalIds }, estado: 'completado' },
        _count: { id: true }
      })
    ]);

    // Crear mapa de estadísticas para acceso rápido
    const statsMap = new Map();
    professionalIds.forEach(id => {
      const reviewStats = reviews.find(r => r.profesional_id === id);
      const serviceStats = services.find(s => s.profesional_id === id);

      statsMap.set(id, {
        calificacion_promedio: reviewStats?._avg.calificacion || 0,
        total_resenas: reviewStats?._count.calificacion || 0,
        servicios_completados: serviceStats?._count.id || 0
      });
    });

    // Enriquecer resultados con estadísticas calculadas
    const enrichedProfessionals = professionals.map(prof => ({
      ...prof,
      calificacion_promedio: statsMap.get(prof.usuario_id)?.calificacion_promedio || 0,
      total_resenas: statsMap.get(prof.usuario_id)?.total_resenas || 0,
      servicios_completados: statsMap.get(prof.usuario_id)?.servicios_completados || 0
    }));

    const total = await prisma.perfiles_profesionales.count({ where });
    const totalPages = Math.ceil(total / limit);

    const results = {
      professionals: enrichedProfessionals,
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