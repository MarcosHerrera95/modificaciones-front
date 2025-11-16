// src/controllers/searchController.js
const { PrismaClient } = require('@prisma/client');
const { getCachedProfessionalSearch, cacheProfessionalSearch } = require('../services/cacheService');
const prisma = new PrismaClient();

/**
 * Calcula la distancia en kilómetros entre dos puntos GPS usando la fórmula de Haversine
 * @param {number} lat1 - Latitud del punto 1
 * @param {number} lon1 - Longitud del punto 1
 * @param {number} lat2 - Latitud del punto 2
 * @param {number} lon2 - Longitud del punto 2
 * @returns {number} Distancia en kilómetros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

exports.searchProfessionals = async (req, res) => {
  const {
    especialidad,
    zona_cobertura,
    precio_min,
    precio_max,
    sort_by = 'calificacion_promedio',
    page = 1,
    limit = 10,
    user_lat,  // Latitud del usuario para cálculo de distancia
    user_lng   // Longitud del usuario para cálculo de distancia
  } = req.query;

  try {
    // Validar parámetros
    const validSortOptions = ['calificacion_promedio', 'tarifa_hora', 'distancia', 'disponibilidad'];
    if (!validSortOptions.includes(sort_by)) {
      return res.status(400).json({ error: 'Parámetro sort_by inválido. Opciones válidas: calificacion_promedio, tarifa_hora, distancia, disponibilidad.' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos.' });
    }
    // Crear objeto de filtros para el caché
    const filters = {
      especialidad: especialidad || null,
      zona_cobertura: zona_cobertura || null,
      precio_min: precio_min ? parseFloat(precio_min) : null,
      precio_max: precio_max ? parseFloat(precio_max) : null,
      sort_by: sort_by || 'calificacion_promedio',
      page: parseInt(page),
      limit: parseInt(limit),
      user_lat: user_lat ? parseFloat(user_lat) : null,
      user_lng: user_lng ? parseFloat(user_lng) : null
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
      where.especialidad = { contains: especialidad };
    }

    // Filtro por zona/barrio (REQ-12)
    if (zona_cobertura) {
      where.zona_cobertura = { contains: zona_cobertura };
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
    let sortInMemory = false;
    switch (sort_by) {
      case 'calificacion_promedio':
        // Calificación promedio se calcula después, ordenar en memoria
        sortInMemory = true;
        orderBy = [{ usuario: { nombre: 'asc' } }];
        break;
      case 'tarifa_hora':
        orderBy = [{ tarifa_hora: 'asc' }];
        break;
      case 'distancia':
        // Para distancia real: ordenar en memoria si hay coordenadas, sino por zona
        if (user_lat && user_lng) {
          sortInMemory = true;
          orderBy = [{ zona_cobertura: 'asc' }]; // Fallback para DB
        } else {
          orderBy = [{ zona_cobertura: 'asc' }];
        }
        break;
      case 'disponibilidad':
        // Para disponibilidad: ordenar por estado de verificación (verificado primero)
        orderBy = [{ estado_verificacion: 'asc' }];
        break;
      default:
        sortInMemory = true;
        orderBy = [{ usuario: { nombre: 'asc' } }];
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

    // Calcular distancias reales si se proporcionaron coordenadas del usuario
    if (user_lat && user_lng) {
      professionals.forEach(prof => {
        if (prof.latitud && prof.longitud) {
          prof.distancia_km = calculateDistance(
            parseFloat(user_lat),
            parseFloat(user_lng),
            prof.latitud,
            prof.longitud
          );
        } else {
          prof.distancia_km = null; // No se puede calcular distancia
        }
      });
    }

    // Optimizar consultas: precargar datos relacionados para evitar N+1
    const professionalIds = professionals.map(p => p.usuario_id);
    const [reviewsData, services] = await Promise.all([
      prisma.resenas.findMany({
        where: {
          servicio: {
            profesional_id: { in: professionalIds }
          }
        },
        select: {
          calificacion: true,
          servicio: {
            select: { profesional_id: true }
          }
        }
      }),
      prisma.servicios.groupBy({
        by: ['profesional_id'],
        where: { profesional_id: { in: professionalIds }, estado: 'COMPLETADO' },
        _count: { id: true }
      })
    ]);

    // Crear mapa de estadísticas para acceso rápido
    const statsMap = new Map();
    professionalIds.forEach(id => {
      statsMap.set(id, {
        calificacion_promedio: 0,
        total_resenas: 0,
        servicios_completados: 0
      });
    });

    // Procesar reseñas
    reviewsData.forEach(review => {
      const profId = review.servicio.profesional_id;
      const stats = statsMap.get(profId);
      if (stats) {
        stats.total_resenas++;
        stats.calificacion_promedio += review.calificacion;
      }
    });

    // Calcular promedio
    statsMap.forEach(stats => {
      if (stats.total_resenas > 0) {
        stats.calificacion_promedio = stats.calificacion_promedio / stats.total_resenas;
      }
    });

    // Procesar servicios completados
    services.forEach(serviceStat => {
      const stats = statsMap.get(serviceStat.profesional_id);
      if (stats) {
        stats.servicios_completados = serviceStat._count.id;
      }
    });

    // Enriquecer resultados con estadísticas calculadas
    const enrichedProfessionals = professionals.map(prof => ({
      ...prof,
      calificacion_promedio: statsMap.get(prof.usuario_id)?.calificacion_promedio || 0,
      total_resenas: statsMap.get(prof.usuario_id)?.total_resenas || 0,
      servicios_completados: statsMap.get(prof.usuario_id)?.servicios_completados || 0
    }));

    // Ordenar en memoria si es necesario
    if (sortInMemory) {
      enrichedProfessionals.sort((a, b) => {
        if (sort_by === 'distancia' && user_lat && user_lng) {
          // Ordenar por distancia ascendente si hay coordenadas
          const distA = a.distancia_km || Infinity;
          const distB = b.distancia_km || Infinity;
          if (distA !== distB) {
            return distA - distB;
          }
        }

        // Ordenar por calificación descendente (default o fallback)
        if (b.calificacion_promedio !== a.calificacion_promedio) {
          return b.calificacion_promedio - a.calificacion_promedio;
        }
        // Luego por nombre ascendente
        return a.usuario.nombre.localeCompare(b.usuario.nombre);
      });
    }

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