-- SCRIPT DE OPTIMIZACIÓN DE BASE DE DATOS PARA BÚSQUEDA AVANZADA
-- Changánet - Sistema de Búsqueda y Filtros (REQ-11 a REQ-15)
-- Fecha: 24 de noviembre de 2025
-- Versión: 1.0

-- ============================================================================
-- ÍNDICES OPTIMIZADOS PARA BÚSQUEDA RÁPIDA
-- ============================================================================

-- 1. Índice compuesto para búsquedas por especialidad + ubicación
-- Optimiza consultas tipo: WHERE specialty = ? AND location LIKE ?
CREATE INDEX CONCURRENTLY idx_professional_search_specialty_location 
ON perfiles_profesionales(especialidad, zona_cobertura, esta_disponible)
WHERE esta_disponible = true;

-- 2. Índice para búsquedas de precio con diferentes tipos de tarifa
-- Optimiza consultas por rango de precios (REQ-13)
CREATE INDEX CONCURRENTLY idx_professional_search_price_range 
ON perfiles_profesionales(tipo_tarifa, tarifa_hora, tarifa_servicio)
WHERE tipo_tarifa IN ('hora', 'servicio') AND esta_disponible = true;

-- 3. Índice para ordenamiento por calificación (REQ-14)
-- Facilita ordenamiento DESC por calificación promedio
CREATE INDEX CONCURRENTLY idx_professional_search_rating_desc 
ON perfiles_profesionales(calificacion_promedio DESC, esta_disponible)
WHERE calificacion_promedio IS NOT NULL AND esta_disponible = true;

-- 4. Índice para disponibilidad y verificación
-- Optimiza filtros por disponibilidad y estado de verificación
CREATE INDEX CONCURRENTLY idx_professional_search_availability 
ON perfiles_profesionales(estado_verificacion, esta_disponible, calificacion_promedio DESC);

-- 5. Índice para geolocalización
-- Optimiza búsquedas por coordenadas GPS (REQ-12 - radio)
CREATE INDEX CONCURRENTLY idx_professional_search_geolocation 
ON perfiles_profesionales(latitud, longitud, zona_cobertura)
WHERE latitud IS NOT NULL AND longitud IS NOT NULL;

-- 6. Índice compuesto para búsquedas complejas
-- Optimiza consultas con múltiples filtros (especialidad + ubicación + precio)
CREATE INDEX CONCURRENTLY idx_professional_search_complex_query 
ON perfiles_profesionales(
  especialidad, 
  zona_cobertura, 
  tipo_tarifa, 
  tarifa_hora,
  estado_verificacion,
  esta_disponible
) 
WHERE esta_disponible = true;

-- ============================================================================
-- ÍNDICES PARA TABLAS RELACIONADAS
-- ============================================================================

-- 7. Índice para relación profesionales-especialidades (REQ-12 mejorado)
-- Optimiza búsquedas por especialidad específica
CREATE INDEX CONCURRENTLY idx_professional_specialty_lookup 
ON professional_specialties(specialty_id, professional_id)
WHERE is_primary = true;

-- 8. Índice para zonas de cobertura (REQ-12)
-- Optimiza búsquedas geográficas por ciudad/provincia
CREATE INDEX CONCURRENTLY idx_coverage_zones_search 
ON coverage_zones(city, state, latitude, longitude)
WHERE is_active = true;

-- 9. Índice para catálogo de especialidades
-- Optimiza búsqueda de especialidades por nombre y categoría
CREATE INDEX CONCURRENTLY idx_specialties_search 
ON specialties(name, category, is_active)
WHERE is_active = true;

-- ============================================================================
-- ÍNDICES PARA TABLA DE RESEÑAS (REQ-14, REQ-15)
-- ============================================================================

-- 10. Índice para cálculo de calificaciones promedio
-- Optimiza consultas para obtener estadísticas de profesionales
CREATE INDEX CONCURRENTLY idx_reviews_professional_rating 
ON resenas(servicio_id, calificacion)
WHERE calificacion IS NOT NULL;

-- 11. Índice para servicios completados
-- Optimiza conteo de servicios finalizados por profesional
CREATE INDEX CONCURRENTLY idx_services_completed 
ON servicios(profesional_id, estado, completado_en)
WHERE estado = 'COMPLETADO';

-- ============================================================================
-- ESTADÍSTICAS Y MANTENIMIENTO
-- ============================================================================

-- Actualizar estadísticas del planner de consultas
ANALYZE perfiles_profesionales;
ANALYZE professional_specialties;
ANALYZE specialties;
ANALYZE coverage_zones;
ANALYZE resenas;
ANALYZE servicios;

-- ============================================================================
-- VISTAS MATERIALIZADAS PARA CONSULTAS FRECUENTES
-- ============================================================================

-- Vista materializada para profesionales con estadísticas precalculadas
-- Optimiza consultas que requieren datos de reseñas y servicios
DROP MATERIALIZED VIEW IF EXISTS mv_professional_stats CASCADE;

CREATE MATERIALIZED VIEW mv_professional_stats AS
SELECT 
  pp.usuario_id,
  pp.especialidad,
  pp.zona_cobertura,
  pp.tarifa_hora,
  pp.tarifa_servicio,
  pp.tipo_tarifa,
  pp.calificacion_promedio,
  pp.esta_disponible,
  pp.estado_verificacion,
  pp.latitud,
  pp.longitud,
  COUNT(DISTINCT r.id) as total_resenas,
  AVG(r.calificacion) as nueva_calificacion_promedio,
  COUNT(DISTINCT s.id) as servicios_completados,
  u.nombre,
  u.email,
  u.url_foto_perfil,
  u.telefono,
  CASE 
    WHEN pp.estado_verificacion = 'verificado' THEN 1 
    ELSE 0 
  END as verificado_score
FROM perfiles_profesionales pp
LEFT JOIN usuarios u ON pp.usuario_id = u.id
LEFT JOIN servicios s ON u.id = s.profesional_id AND s.estado = 'COMPLETADO'
LEFT JOIN resenas r ON s.id = r.servicio_id
WHERE u.bloqueado = false
GROUP BY 
  pp.usuario_id, pp.especialidad, pp.zona_cobertura, pp.tarifa_hora,
  pp.tarifa_servicio, pp.tipo_tarifa, pp.calificacion_promedio,
  pp.esta_disponible, pp.estado_verificacion, pp.latitud, pp.longitud,
  u.nombre, u.email, u.url_foto_perfil, u.telefono;

-- Índices para la vista materializada
CREATE INDEX CONCURRENTLY idx_mv_professional_stats_search 
ON mv_professional_stats(verificado_score DESC, nueva_calificacion_promedio DESC, servicios_completados DESC);

CREATE INDEX CONCURRENTLY idx_mv_professional_stats_specialty 
ON mv_professional_stats(especialidad, zona_cobertura, verificado_score);

CREATE INDEX CONCURRENTLY idx_mv_professional_stats_location 
ON mv_professional_stats(zona_cobertura, latitud, longitud);

-- ============================================================================
-- FUNCIONES AUXILIARES PARA BÚSQUEDA
-- ============================================================================

-- Función para calcular distancia usando fórmula de Haversine
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision AS $$
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN 6371 * ACOS(
    LEAST(1, GREATEN(-1,
      COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * COS(RADIANS(lon2) - RADIANS(lon1)) +
      SIN(RADIANS(lat1)) * SIN(RADIANS(lat2))
    ))
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para búsquedas de texto completo mejoradas
CREATE OR REPLACE FUNCTION search_professionals_text(
  search_term text,
  specialty_filter text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  max_results integer DEFAULT 50
)
RETURNS TABLE (
  usuario_id uuid,
  nombre text,
  especialidad text,
  zona_cobertura text,
  tarifa_hora numeric,
  calificacion_promedio numeric,
  distancia_km double precision,
  match_score real
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.usuario_id,
    u.nombre,
    p.especialidad,
    p.zona_cobertura,
    p.tarifa_hora,
    p.calificacion_promedio,
    NULL::double precision as distancia_km,
    CASE 
      WHEN LOWER(p.especialidad) LIKE LOWER('%' || search_term || '%') THEN 1.0
      WHEN LOWER(p.descripcion) LIKE LOWER('%' || search_term || '%') THEN 0.8
      WHEN LOWER(p.zona_cobertura) LIKE LOWER('%' || search_term || '%') THEN 0.6
      ELSE 0.3
    END as match_score
  FROM perfiles_profesionales p
  JOIN usuarios u ON p.usuario_id = u.id
  WHERE 
    p.esta_disponible = true
    AND u.bloqueado = false
    AND (
      LOWER(p.especialidad) LIKE LOWER('%' || search_term || '%') OR
      LOWER(p.descripcion) LIKE LOWER('%' || search_term || '%') OR
      LOWER(p.zona_cobertura) LIKE LOWER('%' || search_term || '%') OR
      LOWER(u.nombre) LIKE LOWER('%' || search_term || '%')
    )
    AND (specialty_filter IS NULL OR LOWER(p.especialidad) LIKE LOWER('%' || specialty_filter || '%'))
    AND (city_filter IS NULL OR LOWER(p.zona_cobertura) LIKE LOWER('%' || city_filter || '%'))
  ORDER BY match_score DESC, p.calificacion_promedio DESC NULLS LAST
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS PARA MANTENIMIENTO AUTOMÁTICO
-- ============================================================================

-- Función para actualizar estadísticas cuando cambien las reseñas
CREATE OR REPLACE FUNCTION update_professional_stats()
RETURNS TRIGGER AS $$
DECLARE
  new_avg numeric;
  total_reviews integer;
BEGIN
  -- Calcular nuevo promedio de calificaciones
  SELECT AVG(calificacion), COUNT(*)
  INTO new_avg, total_reviews
  FROM resenas
  WHERE servicio_id = NEW.servicio_id;
  
  -- Actualizar el perfil profesional
  UPDATE perfiles_profesionales
  SET 
    calificacion_promedio = COALESCE(new_avg, 0),
    total_resenas = COALESCE(total_reviews, 0),
    last_profile_update = NOW()
  WHERE usuario_id = (
    SELECT profesional_id FROM servicios WHERE id = NEW.servicio_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar estadísticas cuando se agregue una reseña
DROP TRIGGER IF EXISTS trigger_update_stats_on_review ON resenas;
CREATE TRIGGER trigger_update_stats_on_review
  AFTER INSERT OR UPDATE OR DELETE ON resenas
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_stats();

-- ============================================================================
-- CONFIGURACIÓN DE PERFORMANCE
-- ============================================================================

-- Configurar parámetros de PostgreSQL para búsquedas optimizadas
-- Nota: Estos comandos requieren permisos de superusuario

-- Configurar work_mem para consultas grandes
-- ALTER SYSTEM SET work_mem = '256MB';

-- Configurar shared_buffers para mejor caché
-- ALTER SYSTEM SET shared_buffers = '1GB';

-- Configurar effective_cache_size
-- ALTER SYSTEM SET effective_cache_size = '3GB';

-- Configurar random_page_cost para SSD
-- ALTER SYSTEM SET random_page_cost = 1.1;

-- Reload configuration (requiere restart)
-- SELECT pg_reload_conf();

-- ============================================================================
-- SCRIPT DE LIMPIEZA Y MANTENIMIENTO
-- ============================================================================

-- Función para limpiar índices no utilizados
CREATE OR REPLACE FUNCTION cleanup_unused_indexes()
RETURNS TABLE(index_name text, table_name text, size_bytes bigint) AS $$
DECLARE
  rec record;
BEGIN
  -- Esta función requiere pg_stat_user_indexes y análisis previo
  -- Por ahora, retornamos información de índices grandes
  
  RETURN QUERY
  SELECT 
    idx.indexrelname::text,
    idx.relname::text,
    pg_relation_size(idx.indexrelid)::bigint as size_bytes
  FROM pg_stat_user_indexes idx
  WHERE idx.idx_scan = 0 
    AND pg_relation_size(idx.indexrelid) > 100000000 -- > 100MB
  ORDER BY pg_relation_size(idx.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MONITORING Y ESTADÍSTICAS
-- ============================================================================

-- Vista para monitorear el rendimiento de índices
CREATE OR REPLACE VIEW v_index_performance AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan > 0
ORDER BY idx_scan DESC;

-- Vista para estadísticas de búsquedas
CREATE OR REPLACE VIEW v_search_statistics AS
SELECT 
  DATE_TRUNC('hour', timestamp) as search_hour,
  COUNT(*) as total_searches,
  AVG(response_time_ms) as avg_response_time,
  COUNT(CASE WHEN result_count = 0 THEN 1 END) as no_result_searches,
  COUNT(CASE WHEN cache_hit = true THEN 1 END) as cache_hits,
  ROUND(COUNT(CASE WHEN cache_hit = true THEN 1 END) * 100.0 / COUNT(*), 2) as cache_hit_rate
FROM performance_metrics
WHERE timestamp >= NOW() - INTERVAL '24 hours'
  AND endpoint = 'search'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY search_hour DESC;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- Comentarios finales:
-- 1. Los índices CONCURRENTLY evitan bloqueos durante la creación
-- 2. Los índices condicionales (WHERE) mejoran el rendimiento específico
-- 3. La vista materializada precalcula estadísticas costosas
-- 4. Las funciones optimizadas facilitan búsquedas complejas
-- 5. Los triggers mantienen las estadísticas actualizadas
-- 6. Las vistas de monitoreo permiten seguimiento continuo

-- Para aplicar estos cambios en producción:
-- 1. Ejecutar durante mantenimiento programado
-- 2. Monitorear performance durante la creación de índices
-- 3. Actualizar el plan de consultas con VACUUM ANALYZE
-- 4. Verificar mejoras con EXPLAIN ANALYZE

-- Tiempo estimado de ejecución: 5-15 minutos dependiendo del tamaño de la BD
-- Requiere: PostgreSQL 12+, permisos de superusuario para algunos comandos