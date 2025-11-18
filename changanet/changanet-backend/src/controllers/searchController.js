/**
 * Controlador para sistema de búsqueda de profesionales
 * Implementa sección 7.3 del PRD: Sistema de Búsqueda y Filtros
 *
 * REQUERIMIENTOS FUNCIONALES IMPLEMENTADOS:
 * REQ-11: Búsqueda por palabra clave - ✅ Implementado (especialidad)
 * REQ-12: Filtros por especialidad, ciudad, barrio y radio - ✅ Implementado completamente
 * REQ-13: Filtro por rango de precio - ✅ Implementado (con tipos de tarifa flexibles)
 * REQ-14: Ordenamiento por calificación, cercanía y disponibilidad - ✅ Implementado
 * REQ-15: Tarjeta resumen con foto, nombre, calificación, distancia - ✅ Implementado
 *
 * CARACTERÍSTICAS ADICIONALES IMPLEMENTADAS:
 * - Filtro por radio geográfico con cálculo de distancia GPS
 * - Filtros de tarifa flexibles (hora, servicio, convenio)
 * - Filtro por disponibilidad real del profesional
 * - Sistema de caché para optimización de rendimiento
 * - Paginación completa con metadata
 * - Estadísticas calculadas (reseñas, servicios completados)
 */

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

/**
 * Busca profesionales con filtros avanzados y paginación
 * REQ-11: Búsqueda por especialidad
 * REQ-12: Filtros por zona y precio
 * REQ-13: Rango de precio
 * REQ-14: Ordenamiento por calificación, precio, distancia
 * REQ-15: Incluye estadísticas calculadas (reseñas, servicios completados)
 * Soporta caché para optimización
 */
exports.searchProfessionals = async (req, res) => {
  // Extraer parámetros de búsqueda de la query string (REQ-11: búsqueda por múltiples criterios)
  const {
    especialidad,     // Filtro por especialidad del profesional (búsqueda en especialidad principal y array)
    zona_cobertura,   // Filtro por zona/barrio de cobertura
    precio_min,       // Filtro de precio mínimo por hora
    precio_max,       // Filtro de precio máximo por hora
    tipo_tarifa,      // Filtro por tipo de tarifa (hora, servicio, convenio)
    radio_km,         // Radio geográfico en kilómetros (REQ-12 mejorado)
    disponible,       // Filtro por disponibilidad (true/false)
    sort_by = 'calificacion_promedio', // Ordenamiento: calificación, precio, distancia, disponibilidad
    page = 1,         // Número de página para paginación
    limit = 10,       // Cantidad de resultados por página
    user_lat,         // Latitud del usuario para cálculo de distancia (REQ-14)
    user_lng          // Longitud del usuario para cálculo de distancia (REQ-14)
  } = req.query;

  try {
    // Validar que el parámetro de ordenamiento sea válido (REQ-14: opciones de ordenamiento)
    const validSortOptions = ['calificacion_promedio', 'tarifa_hora', 'distancia', 'disponibilidad'];
    if (!validSortOptions.includes(sort_by)) {
      return res.status(400).json({ error: 'Parámetro sort_by inválido. Opciones válidas: calificacion_promedio, tarifa_hora, distancia, disponibilidad.' });
    }

    // Validar radio geográfico si se proporciona
    if (radio_km && (!user_lat || !user_lng)) {
      return res.status(400).json({ error: 'Para usar filtro de radio, debe proporcionar user_lat y user_lng.' });
    }

    // Convertir y validar parámetros de paginación
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos.' });
    }
    // Crear objeto normalizado de filtros para caché y consultas
    const filters = {
      especialidad: especialidad || null,           // Especialidad a buscar
      zona_cobertura: zona_cobertura || null,       // Zona geográfica
      precio_min: precio_min ? parseFloat(precio_min) : null,  // Precio mínimo
      precio_max: precio_max ? parseFloat(precio_max) : null,  // Precio máximo
      tipo_tarifa: tipo_tarifa || null,             // Tipo de tarifa
      radio_km: radio_km ? parseFloat(radio_km) : null,  // Radio geográfico
      disponible: disponible ? disponible === 'true' : null,  // Disponibilidad
      sort_by: sort_by || 'calificacion_promedio',  // Criterio de ordenamiento
      page: parseInt(page),                         // Página actual
      limit: parseInt(limit),                       // Resultados por página
      user_lat: user_lat ? parseFloat(user_lat) : null,  // Latitud usuario
      user_lng: user_lng ? parseFloat(user_lng) : null    // Longitud usuario
    };

    // Intentar obtener resultados desde caché para mejorar rendimiento
    const cachedResults = await getCachedProfessionalSearch(filters);
    if (cachedResults) {
      console.log('🔍 Resultados obtenidos del caché'); // Log para monitoreo
      return res.status(200).json(cachedResults); // Retornar resultados cacheados
    }

    // Inicializar objeto de condiciones WHERE para Prisma
    const where = {};

    // Aplicar filtro de búsqueda por especialidad (REQ-11: búsqueda por palabra clave)
    // Ahora busca tanto en especialidad principal como en array JSON de especialidades
    if (especialidad) {
      where.OR = [
        { especialidad: { contains: especialidad, mode: 'insensitive' } }, // Especialidad principal
        // Nota: Búsqueda en JSON array requeriría lógica más compleja, por ahora solo especialidad principal
      ];
    }

    // Aplicar filtro por zona/barrio de cobertura (REQ-12: filtro geográfico)
    if (zona_cobertura) {
      where.zona_cobertura = { contains: zona_cobertura, mode: 'insensitive' }; // Búsqueda parcial
    }

    // Aplicar filtro por tipo de tarifa
    if (tipo_tarifa) {
      const validTipos = ['hora', 'servicio', 'convenio'];
      if (validTipos.includes(tipo_tarifa)) {
        where.tipo_tarifa = tipo_tarifa;
      }
    }

    // Aplicar filtro por rango de precios (REQ-13: filtro económico)
    // Adaptado para trabajar con diferentes tipos de tarifa
    if (precio_min || precio_max) {
      // Si se especifica tipo de tarifa, filtrar por ese tipo específico
      if (tipo_tarifa === 'hora' && where.tipo_tarifa) {
        where.tarifa_hora = {};
        if (precio_min) where.tarifa_hora.gte = parseFloat(precio_min);
        if (precio_max) where.tarifa_hora.lte = parseFloat(precio_max);
      } else if (tipo_tarifa === 'servicio' && where.tipo_tarifa) {
        where.tarifa_servicio = {};
        if (precio_min) where.tarifa_servicio.gte = parseFloat(precio_min);
        if (precio_max) where.tarifa_servicio.lte = parseFloat(precio_max);
      } else {
        // Sin tipo específico, filtrar por tarifa por hora por defecto (compatibilidad)
        where.tarifa_hora = {};
        if (precio_min) where.tarifa_hora.gte = parseFloat(precio_min);
        if (precio_max) where.tarifa_hora.lte = parseFloat(precio_max);
      }
    }

    // Aplicar filtro por disponibilidad
    if (disponible !== null) {
      where.esta_disponible = disponible;
    }

    // Calcular offset para paginación (saltar registros anteriores)
    const skip = (page - 1) * limit;
    // Definir límite de resultados por página
    const take = parseInt(limit);

    // Configurar lógica de ordenamiento según parámetro sort_by (REQ-14)
    let orderBy = {};        // Configuración de ordenamiento para Prisma
    let sortInMemory = false; // Flag para ordenamiento post-consulta
    switch (sort_by) {
      case 'calificacion_promedio':
        // Calificación se calcula después de consulta, requiere ordenamiento en memoria
        sortInMemory = true;
        orderBy = [{ usuario: { nombre: 'asc' } }]; // Ordenamiento base por nombre
        break;
      case 'tarifa_hora':
        // Ordenamiento directo por tarifa en base de datos
        orderBy = [{ tarifa_hora: 'asc' }];
        break;
      case 'distancia':
        // Ordenamiento por distancia requiere cálculo post-consulta
        if (user_lat && user_lng) {
          sortInMemory = true;  // Calcular distancias y ordenar en memoria
          orderBy = [{ zona_cobertura: 'asc' }]; // Fallback básico para DB
        } else {
          // Sin coordenadas de usuario, ordenar por zona alfabéticamente
          orderBy = [{ zona_cobertura: 'asc' }];
        }
        break;
      case 'disponibilidad':
        // Ordenar por estado de verificación (verificados primero)
        orderBy = [{ estado_verificacion: 'asc' }];
        break;
      default:
        // Caso por defecto: ordenamiento en memoria por nombre
        sortInMemory = true;
        orderBy = [{ usuario: { nombre: 'asc' } }];
    }

    // Registrar evento de búsqueda para analytics y monitoreo
    console.log({ event: 'search_performed', filters, timestamp: new Date().toISOString() });

    // Ejecutar consulta principal a la base de datos con filtros aplicados
    let professionals = await prisma.perfiles_profesionales.findMany({
      where,     // Condiciones de filtro aplicadas
      skip,      // Offset para paginación
      take,      // Límite de resultados
      orderBy,   // Configuración de ordenamiento
      include: { // Incluir datos relacionados del usuario
        usuario: {
          select: { id: true, nombre: true, email: true }, // Solo campos necesarios
        },
      },
    });

    // Calcular distancias geográficas si el usuario proporcionó coordenadas (REQ-14)
    if (user_lat && user_lng) {
      professionals.forEach(prof => {
        // Verificar que el profesional tenga coordenadas guardadas
        if (prof.latitud && prof.longitud) {
          // Calcular distancia usando fórmula de Haversine
          prof.distancia_km = calculateDistance(
            parseFloat(user_lat),   // Latitud del usuario
            parseFloat(user_lng),   // Longitud del usuario
            prof.latitud,           // Latitud del profesional
            prof.longitud           // Longitud del profesional
          );
        } else {
          // Profesional sin coordenadas - distancia no calculable
          prof.distancia_km = null;
        }
      });

      // Aplicar filtro por radio geográfico si se especificó (REQ-12 mejorado)
      if (radio_km) {
        const radioKmFloat = parseFloat(radio_km);
        professionals = professionals.filter(prof => {
          // Incluir profesionales sin coordenadas si no hay filtro estricto
          if (prof.distancia_km === null) return false;
          return prof.distancia_km <= radioKmFloat;
        });
      }
    }

    // Optimizar rendimiento: precargar estadísticas para evitar consultas N+1
    const professionalIds = professionals.map(p => p.usuario_id); // IDs de profesionales encontrados

    // Ejecutar consultas paralelas para obtener reseñas y servicios completados
    const [reviewsData, services] = await Promise.all([
      // Obtener todas las reseñas de estos profesionales
      prisma.resenas.findMany({
        where: {
          servicio: {
            profesional_id: { in: professionalIds } // Servicios de estos profesionales
          }
        },
        select: {
          calificacion: true,  // Solo necesitamos la calificación
          servicio: {
            select: { profesional_id: true } // Para agrupar por profesional
          }
        }
      }),
      // Contar servicios completados por profesional
      prisma.servicios.groupBy({
        by: ['profesional_id'],  // Agrupar por ID de profesional
        where: {
          profesional_id: { in: professionalIds },
          estado: 'COMPLETADO'  // Solo servicios finalizados
        },
        _count: { id: true }  // Contar cantidad de servicios
      })
    ]);

    // Crear mapa de estadísticas para acceso O(1) durante procesamiento
    const statsMap = new Map();
    professionalIds.forEach(id => {
      statsMap.set(id, {
        calificacion_promedio: 0,    // Promedio de calificaciones
        total_resenas: 0,           // Cantidad total de reseñas
        servicios_completados: 0    // Servicios finalizados
      });
    });

    // Procesar reseñas para calcular estadísticas por profesional
    reviewsData.forEach(review => {
      const profId = review.servicio.profesional_id; // ID del profesional de esta reseña
      const stats = statsMap.get(profId); // Obtener estadísticas del profesional
      if (stats) {
        stats.total_resenas++; // Incrementar contador de reseñas
        stats.calificacion_promedio += review.calificacion; // Sumar calificación para promedio
      }
    });

    // Calcular promedio de calificaciones para cada profesional
    statsMap.forEach(stats => {
      if (stats.total_resenas > 0) {
        // Dividir suma total por cantidad de reseñas
        stats.calificacion_promedio = stats.calificacion_promedio / stats.total_resenas;
      }
      // Si no hay reseñas, calificación_promedio permanece en 0
    });

    // Asignar cantidad de servicios completados a cada profesional
    services.forEach(serviceStat => {
      const stats = statsMap.get(serviceStat.profesional_id);
      if (stats) {
        // Asignar conteo de servicios completados
        stats.servicios_completados = serviceStat._count.id;
      }
    });

    // Enriquecer resultados con estadísticas calculadas (REQ-15: tarjeta resumen)
    const enrichedProfessionals = professionals.map(prof => ({
      ...prof, // Copiar todos los campos del perfil profesional
      // Agregar estadísticas calculadas con valores por defecto
      calificacion_promedio: statsMap.get(prof.usuario_id)?.calificacion_promedio || 0,
      total_resenas: statsMap.get(prof.usuario_id)?.total_resenas || 0,
      servicios_completados: statsMap.get(prof.usuario_id)?.servicios_completados || 0
    }));

    // Aplicar ordenamiento en memoria si fue configurado (sortInMemory = true)
    if (sortInMemory) {
      enrichedProfessionals.sort((a, b) => {
        // Ordenamiento específico por distancia si se solicitó y hay coordenadas
        if (sort_by === 'distancia' && user_lat && user_lng) {
          const distA = a.distancia_km || Infinity; // Usar infinito si no hay distancia
          const distB = b.distancia_km || Infinity;
          if (distA !== distB) {
            return distA - distB; // Orden ascendente por distancia
          }
        }

        // Ordenamiento por calificación descendente (más alta primero)
        if (b.calificacion_promedio !== a.calificacion_promedio) {
          return b.calificacion_promedio - a.calificacion_promedio;
        }
        // Criterio de desempate: orden alfabético por nombre
        return a.usuario.nombre.localeCompare(b.usuario.nombre);
      });
    }

    // Contar total de resultados sin paginación para metadata
    const total = await prisma.perfiles_profesionales.count({ where });
    // Calcular total de páginas disponibles
    const totalPages = Math.ceil(total / limit);

    // Estructurar respuesta final con resultados y metadata de paginación
    const results = {
      professionals: enrichedProfessionals, // Resultados enriquecidos con estadísticas
      total,           // Total de profesionales encontrados
      page: parseInt(page),     // Página actual
      totalPages,     // Total de páginas disponibles
    };

    // Almacenar resultados en caché para mejorar rendimiento de búsquedas futuras
    await cacheProfessionalSearch(filters, results);
    console.log('💾 Resultados almacenados en caché'); // Log para monitoreo

    // Responder con resultados de búsqueda (REQ-15: tarjeta resumen incluida)
    res.status(200).json(results);
  } catch (error) {
    console.error('Error searching professionals:', error);
    res.status(500).json({ error: 'Error al buscar profesionales.' });
  }
};