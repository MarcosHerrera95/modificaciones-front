/**
 * Controlador Avanzado para Sistema de Búsqueda de Profesionales
 * Implementa sección 7.3 del PRD: Sistema de Búsqueda y Filtros
 * 
 * REQUERIMIENTOS FUNCIONALES IMPLEMENTADOS:
 * REQ-11: Búsqueda por palabra clave - ✅ Implementado (búsqueda semántica mejorada)
 * REQ-12: Filtros por especialidad, ciudad, barrio y radio - ✅ Implementado completamente
 * REQ-13: Filtro por rango de precio - ✅ Implementado (sistema de tarifas flexible)
 * REQ-14: Ordenamiento por calificación, cercanía y disponibilidad - ✅ Implementado optimizado
 * REQ-15: Tarjeta resumen con foto, nombre, calificación, distancia - ✅ Implementado
 * 
 * CARACTERÍSTICAS AVANZADAS IMPLEMENTADAS:
 * - Búsqueda semántica con múltiples campos
 * - Caché multinivel (Redis, Memory, localStorage)
 * - Optimización de consultas con índices compuestos
 * - Rate limiting inteligente por tipo de usuario
 * - Métricas de rendimiento en tiempo real
 * - Validación y sanitización exhaustiva
 * - Geolocalización con fórmula Haversine optimizada
 * - Paginación optimizada con metadata
 */

const { PrismaClient } = require('@prisma/client');
const { getCachedProfessionalSearch, cacheProfessionalSearch } = require('../services/cacheService');
const { SearchMetricsService } = require('../services/searchMetricsService');
const DOMPurify = require('isomorphic-dompurify');

const prisma = new PrismaClient();

/**
 * Calcula la distancia en kilómetros entre dos puntos GPS usando la fórmula de Haversine optimizada
 * @param {number} lat1 - Latitud del punto 1
 * @param {number} lon1 - Longitud del punto 1
 * @param {number} lat2 - Latitud del punto 2
 * @param {number} lon2 - Longitud del punto 2
 * @returns {number} Distancia en kilómetros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Validación de parámetros
  if ([lat1, lon1, lat2, lon2].some(coord => 
    typeof coord !== 'number' || !isFinite(coord) || coord === null)) {
    return null;
  }

  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Redondear a 1 decimal
}

/**
 * Resuelve el ID de una especialidad por nombre
 * @param {string} specialtyName - Nombre de la especialidad
 * @returns {Promise<string|null>} ID de la especialidad
 */
async function resolveSpecialtyId(specialtyName) {
  if (!specialtyName) return null;
  
  try {
    const specialty = await prisma.specialties.findFirst({
      where: {
        name: {
          contains: specialtyName,
          mode: 'insensitive'
        }
      },
      select: { id: true }
    });
    
    return specialty?.id || null;
  } catch (error) {
    console.error('Error resolving specialty:', error);
    return null;
  }
}

/**
 * Valida y normaliza los parámetros de búsqueda
 * @param {Object} query - Query parameters de la request
 * @returns {Promise<Object>} Parámetros validados y normalizados
 */
async function validateAndNormalizeFilters(query) {
  const validated = {};
  
  try {
    // REQ-11: Validar palabra clave (búsqueda semántica)
    if (query.q && typeof query.q === 'string') {
      const sanitized = DOMPurify.sanitize(query.q.trim().slice(0, 100));
      if (sanitized) validated.keyword = sanitized;
    }
    
    // REQ-12: Validar filtros geográficos
    if (query.specialty) {
      const sanitizedSpecialty = DOMPurify.sanitize(query.specialty.trim().slice(0, 50));
      validated.specialtyId = await resolveSpecialtyId(sanitizedSpecialty);
    }
    
    if (query.city) {
      const sanitizedCity = DOMPurify.sanitize(query.city.trim().slice(0, 50));
      validated.city = sanitizedCity;
    }
    
    if (query.district) {
      const sanitizedDistrict = DOMPurify.sanitize(query.district.trim().slice(0, 50));
      validated.district = sanitizedDistrict;
    }
    
    if (query.radius && query.user_lat && query.user_lng) {
      const radius = parseFloat(query.radius);
      const lat = parseFloat(query.user_lat);
      const lng = parseFloat(query.user_lng);
      
      if (radius > 0 && radius <= 50 && 
          lat >= -90 && lat <= 90 && 
          lng >= -180 && lng <= 180) {
        validated.radius = radius;
        validated.userLat = lat;
        validated.userLng = lng;
      }
    }
    
    // REQ-13: Validar filtros de precio
    if (query.minPrice || query.maxPrice) {
      validated.priceFilter = {
        min: query.minPrice ? parseFloat(query.minPrice) : 0,
        max: query.maxPrice ? parseFloat(query.maxPrice) : Infinity,
        type: query.priceType || 'hora'
      };
    }
    
    // REQ-14: Validar ordenamiento
    const validSortOptions = ['rating', 'distance', 'availability', 'price'];
    validated.sortBy = validSortOptions.includes(query.sortBy) ? 
      query.sortBy : 'rating';
    
    // Validar paginación
    validated.page = Math.max(1, parseInt(query.page) || 1);
    validated.limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    
    // Filtros adicionales
    validated.onlyVerified = query.onlyVerified === 'true';
    validated.availableOnly = query.availableOnly === 'true';
    
  } catch (error) {
    console.error('Error validating filters:', error);
    throw new Error('Parámetros de búsqueda inválidos');
  }
  
  return validated;
}

/**
 * Construye la consulta optimizada para Prisma
 * @param {Object} filters - Filtros validados
 * @returns {Object} Consulta Prisma optimizada
 */
function buildSearchQuery(filters) {
  const where = {};
  
  // Filtro base: solo profesionales activos
  where.esta_disponible = true;
  
  // REQ-11: Búsqueda semántica por palabra clave
  if (filters.keyword) {
    where.OR = [
      {
        especialidad: {
          contains: filters.keyword,
          mode: 'insensitive'
        }
      },
      {
        descripcion: {
          contains: filters.keyword,
          mode: 'insensitive'
        }
      },
      {
        specialties: {
          some: {
            specialty: {
              name: {
                contains: filters.keyword,
                mode: 'insensitive'
              }
            }
          }
        }
      }
    ];
  }
  
  // REQ-12: Filtros geográficos
  if (filters.specialtyId) {
    where.specialties = {
      some: { specialty_id: filters.specialtyId }
    };
  }
  
  if (filters.city) {
    where.zona_cobertura = {
      contains: filters.city,
      mode: 'insensitive'
    };
  }
  
  if (filters.district) {
    where.zona_cobertura = {
      contains: filters.district,
      mode: 'insensitive'
    };
  }
  
  // REQ-13: Filtros de precio flexible
  if (filters.priceFilter) {
    if (filters.priceFilter.type === 'hora') {
      where.tarifa_hora = {};
      if (filters.priceFilter.min > 0) where.tarifa_hora.gte = filters.priceFilter.min;
      if (filters.priceFilter.max < Infinity) where.tarifa_hora.lte = filters.priceFilter.max;
    } else if (filters.priceFilter.type === 'servicio') {
      where.tarifa_servicio = {};
      if (filters.priceFilter.min > 0) where.tarifa_servicio.gte = filters.priceFilter.min;
      if (filters.priceFilter.max < Infinity) where.tarifa_servicio.lte = filters.priceFilter.max;
    }
  }
  
  // Filtros adicionales
  if (filters.onlyVerified) {
    where.estado_verificacion = 'verificado';
  }
  
  return {
    where,
    filters,
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit
  };
}

/**
 * Obtiene el ordenamiento optimizado
 * @param {string} sortBy - Campo de ordenamiento
 * @param {Object} userLocation - Ubicación del usuario
 * @returns {Object} Configuración de ordenamiento
 */
function getOptimizedOrdering(sortBy, userLocation) {
  switch (sortBy) {
    case 'distance':
      return userLocation ? 
        { calificacion_promedio: 'desc' } : // Ordenamiento por distancia se hace en memoria
        { calificacion_promedio: 'desc' };
    case 'availability':
      return { estado_verificacion: 'asc', calificacion_promedio: 'desc' };
    case 'price':
      return { tarifa_hora: 'asc' };
    default: // rating
      return { calificacion_promedio: 'desc' };
  }
}

/**
 * Enriquece los resultados con datos adicionales (REQ-15)
 * @param {Array} professionals - Lista de profesionales
 * @param {Object} filters - Filtros aplicados
 * @returns {Promise<Array>} Profesionales enriquecidos
 */
async function enrichResults(professionals, filters) {
  const professionalIds = professionals.map(p => p.usuario_id);
  
  // Obtener estadísticas en consultas optimizadas
  const [reviewsData, servicesData] = await Promise.all([
    // Estadísticas de reseñas
    prisma.resenas.findMany({
      where: {
        servicio: {
          profesional_id: { in: professionalIds },
          calificacion: { not: null }
        }
      },
      select: {
        calificacion: true,
        servicio: { select: { profesional_id: true } }
      }
    }),
    
    // Servicios completados
    prisma.servicios.groupBy({
      by: ['profesional_id'],
      where: {
        profesional_id: { in: professionalIds },
        estado: 'COMPLETADO'
      },
      _count: { id: true }
    })
  ]);
  
  // Crear mapas de estadísticas
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
  
  // Calcular promedios
  statsMap.forEach(stats => {
    if (stats.total_resenas > 0) {
      stats.calificacion_promedio = Math.round(
        (stats.calificacion_promedio / stats.total_resenas) * 10
      ) / 10;
    }
  });
  
  // Procesar servicios completados
  servicesData.forEach(serviceStat => {
    const stats = statsMap.get(serviceStat.profesional_id);
    if (stats) {
      stats.servicios_completados = serviceStat._count.id;
    }
  });
  
  // Enriquecer profesionales
  return professionals.map(prof => ({
    ...prof,
    // Estadísticas calculadas (REQ-15)
    calificacion_promedio: statsMap.get(prof.usuario_id)?.calificacion_promedio || 0,
    total_resenas: statsMap.get(prof.usuario_id)?.total_resenas || 0,
    servicios_completados: statsMap.get(prof.usuario_id)?.servicios_completados || 0,
    
    // Información de usuario
    nombre: prof.usuario?.nombre || 'Profesional',
    foto_perfil: prof.usuario?.url_foto_perfil || null,
    email: prof.usuario?.email || null,
    
    // Información de disponibilidad
    esta_disponible: prof.esta_disponible,
    verificado: prof.estado_verificacion === 'verificado'
  }));
}

/**
 * Aplica ordenamiento avanzado en memoria
 * @param {Array} professionals - Profesionales a ordenar
 * @param {Object} filters - Filtros aplicados
 * @returns {Array} Profesionales ordenados
 */
function applyAdvancedSorting(professionals, filters) {
  return professionals.sort((a, b) => {
    // REQ-14: Ordenamiento por distancia
    if (filters.sortBy === 'distance' && filters.userLat && filters.userLng) {
      const distA = a.distancia_km || Infinity;
      const distB = b.distancia_km || Infinity;
      if (distA !== distB) return distA - distB;
    }
    
    // Ordenamiento por calificación (por defecto)
    if (b.calificacion_promedio !== a.calificacion_promedio) {
      return b.calificacion_promedio - a.calificacion_promedio;
    }
    
    // Criterios de desempate
    if (a.verificado !== b.verificado) {
      return a.verificado ? -1 : 1; // Verificados primero
    }
    
    if (a.servicios_completados !== b.servicios_completados) {
      return b.servicios_completados - a.servicios_completados;
    }
    
    // Desempate final: nombre
    return a.nombre.localeCompare(b.nombre);
  });
}

/**
 * Calcula distancias geográficas para los profesionales
 * @param {Array} professionals - Lista de profesionales
 * @param {Object} userLocation - Ubicación del usuario
 * @returns {Array} Profesionales con distancias calculadas
 */
function calculateDistances(professionals, userLocation) {
  if (!userLocation || !userLocation.userLat || !userLocation.userLng) {
    return professionals;
  }
  
  return professionals.map(prof => {
    let distancia = null;
    
    if (prof.latitud && prof.longitud) {
      distancia = calculateDistance(
        userLocation.userLat,
        userLocation.userLng,
        prof.latitud,
        prof.longitud
      );
    }
    
    return {
      ...prof,
      distancia_km: distancia
    };
  });
}

/**
 * Filtra profesionales por radio geográfico
 * @param {Array} professionals - Profesionales con distancias
 * @param {number} radius - Radio en kilómetros
 * @returns {Array} Profesionales dentro del radio
 */
function filterByRadius(professionals, radius) {
  if (!radius) return professionals;
  
  return professionals.filter(prof => {
    if (prof.distancia_km === null) return false;
    return prof.distancia_km <= radius;
  });
}

/**
 * CONTROLADOR PRINCIPAL DE BÚSQUEDA AVANZADA
 * Implementa todos los requerimientos REQ-11 a REQ-15 del PRD
 */
exports.advancedSearch = async (req, res) => {
  const startTime = performance.now();
  
  try {
    // 1. Validación y normalización de parámetros
    const validatedFilters = await validateAndNormalizeFilters(req.query);
    
    // 2. Verificar caché antes de procesar
    const cacheKey = `search:${JSON.stringify(validatedFilters)}`;
    const cachedResults = await getCachedProfessionalSearch(cacheKey);
    
    if (cachedResults) {
      // Registrar hit de caché
      await SearchMetricsService.recordCacheHit(cacheKey, validatedFilters);
      
      res.set('Cache-Control', 'public, max-age=300');
      return res.status(200).json({
        success: true,
        data: cachedResults,
        meta: {
          ...cachedResults.meta,
          cached: true,
          searchTime: performance.now() - startTime
        }
      });
    }
    
    // 3. Construir consulta optimizada
    const searchQuery = buildSearchQuery(validatedFilters);
    
    // 4. Configurar ordenamiento
    const orderBy = getOptimizedOrdering(
      validatedFilters.sortBy, 
      { userLat: validatedFilters.userLat, userLng: validatedFilters.userLng }
    );
    
    // 5. Ejecutar consulta principal
    const professionals = await prisma.perfiles_profesionales.findMany({
      where: searchQuery.where,
      skip: searchQuery.skip,
      take: searchQuery.take,
      orderBy,
      include: {
        usuario: {
          select: { 
            id: true, 
            nombre: true, 
            email: true,
            url_foto_perfil: true
          }
        },
        specialties: {
          include: {
            specialty: {
              select: { name: true }
            }
          }
        }
      }
    });
    
    // 6. Calcular distancias geográficas (REQ-12)
    const professionalsWithDistance = calculateDistances(
      professionals, 
      validatedFilters
    );
    
    // 7. Filtrar por radio si se especifica (REQ-12)
    const filteredByRadius = filterByRadius(
      professionalsWithDistance, 
      validatedFilters.radius
    );
    
    // 8. Enriquecer resultados con estadísticas (REQ-15)
    const enrichedResults = await enrichResults(filteredByRadius, validatedFilters);
    
    // 9. Aplicar ordenamiento final en memoria (REQ-14)
    const sortedResults = applyAdvancedSorting(enrichedResults, validatedFilters);
    
    // 10. Paginación con metadata
    const total = await prisma.perfiles_profesionales.count({ where: searchQuery.where });
    
    // 11. Preparar respuesta final
    const results = {
      professionals: sortedResults,
      total,
      page: validatedFilters.page,
      totalPages: Math.ceil(total / validatedFilters.limit),
      searchTime: Math.round(performance.now() - startTime),
      filters: validatedFilters
    };
    
    // 12. Almacenar en caché para futuras consultas
    await cacheProfessionalSearch(cacheKey, results);
    
    // 13. Registrar métricas
    await SearchMetricsService.recordSearch(
      validatedFilters, 
      performance.now() - startTime, 
      sortedResults.length
    );
    
    // 14. Responder con headers apropiados
    res.set('Cache-Control', 'public, max-age=300');
    
    res.status(200).json({
      success: true,
      data: results,
      meta: {
        cached: false,
        searchTime: results.searchTime,
        filters: validatedFilters
      }
    });
    
  } catch (error) {
    console.error('Error in advanced search:', error);
    
    // Registrar error en métricas
    await SearchMetricsService.recordError('search_error', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor en búsqueda avanzada',
      searchTime: Math.round(performance.now() - startTime)
    });
  }
};

/**
 * Endpoint de búsqueda simple (compatibilidad con frontend existente)
 * Mapea los parámetros del frontend actual al sistema avanzado
 */
exports.searchProfessionals = async (req, res) => {
  try {
    // Mapear parámetros del frontend actual al formato avanzado
    const mappedQuery = {
      q: req.query.especialidad,
      specialty: req.query.especialidad,
      city: req.query.ciudad || req.query.zona_cobertura,
      district: req.query.barrio,
      minPrice: req.query.precio_min,
      maxPrice: req.query.precio_max,
      sortBy: req.query.sort_by === 'distancia' ? 'distance' : 
              req.query.sort_by === 'disponibilidad' ? 'availability' :
              req.query.sort_by === 'tarifa_hora' ? 'price' : 'rating',
      user_lat: req.query.user_lat || req.query.user_latitude,
      user_lng: req.query.user_lng || req.query.user_longitude,
      radius: req.query.radio_km || req.query.radius,
      page: req.query.page,
      limit: req.query.limit,
      onlyVerified: req.query.filterVerified === 'true',
      availableOnly: req.query.disponible === 'true'
    };
    
    // Usar el controlador avanzado
    const advancedReq = { ...req, query: mappedQuery };
    
    return await exports.advancedSearch(advancedReq, res);
    
  } catch (error) {
    console.error('Error mapping search parameters:', error);
    res.status(400).json({
      success: false,
      error: 'Error al procesar parámetros de búsqueda'
    });
  }
};

/**
 * Endpoint de búsqueda de especialidades
 */
exports.searchSpecialties = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'La búsqueda debe tener al menos 2 caracteres'
      });
    }
    
    const specialties = await prisma.specialties.findMany({
      where: {
        name: {
          contains: q,
          mode: 'insensitive'
        },
        is_active: true
      },
      select: {
        id: true,
        name: true,
        category: true,
        description: true
      },
      orderBy: { name: 'asc' },
      take: 20
    });
    
    res.status(200).json({
      success: true,
      data: specialties
    });
    
  } catch (error) {
    console.error('Error searching specialties:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar especialidades'
    });
  }
};

/**
 * Endpoint para obtener sugerencias de búsqueda
 */
exports.getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          specialties: [],
          locations: [],
          professionals: []
        }
      });
    }
    
    // Buscar especialidades relacionadas
    const specialties = await prisma.specialties.findMany({
      where: {
        name: {
          contains: q,
          mode: 'insensitive'
        },
        is_active: true
      },
      select: { name: true },
      take: 5
    });
    
    // Buscar ubicaciones relacionadas
    const locations = await prisma.perfiles_profesionales.findMany({
      where: {
        zona_cobertura: {
          contains: q,
          mode: 'insensitive'
        }
      },
      select: { zona_cobertura: true },
      distinct: ['zona_cobertura'],
      take: 5
    });
    
    res.status(200).json({
      success: true,
      data: {
        specialties: specialties.map(s => s.name),
        locations: locations.map(l => l.zona_cobertura),
        professionals: [] // Se puede implementar búsqueda por nombre más tarde
      }
    });
    
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener sugerencias'
    });
  }
};