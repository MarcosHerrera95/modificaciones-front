-- ==================================================
-- FUNCIONES DE BASE DE DATOS - Sistema de Presupuesto CHANGANET
-- Archivo: 002_budget_functions.sql
-- Fecha: 25 de Noviembre de 2025
-- Descripción: Funciones para el negocio y automatización del módulo
-- ==================================================

BEGIN;

-- ==================================================
-- Función: distribute_budget_request
-- Descripción: Distribuye una solicitud a múltiples profesionales
-- ==================================================
CREATE OR REPLACE FUNCTION distribute_budget_request(
    p_request_id UUID,
    p_professional_ids UUID[]
)
RETURNS JSON AS $$
DECLARE
    professional_id UUID;
    expires_timestamp TIMESTAMP;
    distribution_count INTEGER := 0;
    result JSON;
BEGIN
    expires_timestamp := CURRENT_TIMESTAMP + INTERVAL '48 hours';
    
    -- Insertar distribuciones para cada profesional
    FOREACH professional_id IN ARRAY p_professional_ids
    LOOP
        INSERT INTO budget_request_professionals (
            request_id, 
            professional_id, 
            expires_at
        ) VALUES (
            p_request_id,
            professional_id,
            expires_timestamp
        )
        ON CONFLICT (request_id, professional_id) DO NOTHING;
        
        IF FOUND THEN
            distribution_count := distribution_count + 1;
        END IF;
    END LOOP;
    
    -- Actualizar estado de la solicitud
    UPDATE budget_requests 
    SET status = 'distributed', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_request_id;
    
    -- Crear resultado
    result := json_build_object(
        'success', true,
        'request_id', p_request_id,
        'distributions_created', distribution_count,
        'expires_at', expires_timestamp
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- Función: select_professionals_for_request
-- Descripción: Selecciona profesionales elegibles para una solicitud
-- ==================================================
CREATE OR REPLACE FUNCTION select_professionals_for_request(
    p_category VARCHAR,
    p_location JSONB,
    p_max_distance_km DECIMAL DEFAULT 25,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    professional_id UUID,
    user_id UUID,
    specialty TEXT,
    rating DECIMAL,
    location TEXT,
    distance_km DECIMAL,
    years_experience INTEGER,
    is_verified BOOLEAN
) AS $$
DECLARE
    client_lat DECIMAL;
    client_lng DECIMAL;
BEGIN
    -- Extraer coordenadas del cliente (si están disponibles)
    IF p_location ? 'latitude' AND p_location ? 'longitude' THEN
        client_lat := (p_location->>'latitude')::DECIMAL;
        client_lng := (p_location->>'longitude')::DECIMAL;
    END IF;
    
    RETURN QUERY
    SELECT 
        pp.id as professional_id,
        pp.user_id,
        pp.specialty,
        pp.rating,
        pp.location,
        CASE 
            WHEN client_lat IS NOT NULL AND client_lng IS NOT NULL THEN
                (6371 * acos(
                    cos(radians(client_lat)) * 
                    cos(radians((pp.location->>'latitude')::DECIMAL)) * 
                    cos(radians((pp.location->>'longitude')::DECIMAL) - radians(client_lng)) + 
                    sin(radians(client_lat)) * 
                    sin(radians((pp.location->>'latitude')::DECIMAL))
                ))::DECIMAL
            ELSE 0
        END as distance_km,
        pp.years_experience,
        pp.is_verified
    FROM professional_profiles pp
    WHERE pp.specialty = p_category
    AND pp.is_verified = true
    AND pp.is_active = true
    AND pp.rating >= 4.0
    AND (p_location IS NULL OR 
         (pp.location ? 'latitude' AND pp.location ? 'longitude' AND
          CASE 
              WHEN client_lat IS NOT NULL AND client_lng IS NOT NULL THEN
                  (6371 * acos(
                      cos(radians(client_lat)) * 
                      cos(radians((pp.location->>'latitude')::DECIMAL)) * 
                      cos(radians((pp.location->>'longitude')::DECIMAL) - radians(client_lng)) + 
                      sin(radians(client_lat)) * 
                      sin(radians((pp.location->>'latitude')::DECIMAL))
                  )) <= p_max_distance_km
              ELSE true
          END
         )
    )
    ORDER BY 
        pp.rating DESC,
        distance_km ASC,
        pp.years_experience DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- Función: get_comparable_offers
-- Descripción: Obtiene ofertas comparables con metadatos adicionales
-- ==================================================
CREATE OR REPLACE FUNCTION get_comparable_offers(p_request_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    min_price DECIMAL;
    min_days INTEGER;
    avg_rating DECIMAL;
BEGIN
    -- Obtener estadísticas para comparación
    SELECT MIN(price), MIN(estimated_days), AVG(pp.rating)
    INTO min_price, min_days, avg_rating
    FROM budget_offers bo
    JOIN professional_profiles pp ON bo.professional_id = pp.id
    WHERE bo.request_id = p_request_id;
    
    -- Construir resultado con ofertas comparables
    SELECT jsonb_agg(
        jsonb_build_object(
            'offer_id', bo.id,
            'professional_id', bo.professional_id,
            'user_id', pp.user_id,
            'professional_name', u.first_name || ' ' || u.last_name,
            'professional_photo', pp.photo_url,
            'professional_rating', pp.rating,
            'professional_experience', pp.years_experience,
            'professional_location', pp.location,
            'professional_specialty', pp.specialty,
            'price', bo.price,
            'estimated_days', bo.estimated_days,
            'comments', bo.comments,
            'photos', bo.photos,
            'availability_details', bo.availability_details,
            'offer_status', bo.offer_status,
            'is_selected', bo.is_selected,
            'created_at', bo.created_at,
            'is_best_price', bo.price = COALESCE(min_price, bo.price),
            'is_fastest', bo.estimated_days = COALESCE(min_days, bo.estimated_days),
            'price_vs_average', CASE 
                WHEN avg_rating IS NOT NULL THEN 
                    ROUND(((bo.price - (SELECT AVG(price) FROM budget_offers WHERE request_id = p_request_id)) / 
                           (SELECT AVG(price) FROM budget_offers WHERE request_id = p_request_id)) * 100, 2)
                ELSE 0 
            END,
            'rating_stars', CASE 
                WHEN pp.rating >= 4.5 THEN 5
                WHEN pp.rating >= 4.0 THEN 4
                WHEN pp.rating >= 3.5 THEN 3
                WHEN pp.rating >= 3.0 THEN 2
                ELSE 1
            END
        ) ORDER BY bo.price ASC, bo.created_at ASC
    )
    INTO result
    FROM budget_offers bo
    JOIN professional_profiles pp ON bo.professional_id = pp.id
    JOIN users u ON pp.user_id = u.id
    WHERE bo.request_id = p_request_id;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- Función: expire_old_requests
-- Descripción: Marca como expiradas las solicitudes y distribuciones vencidas
-- ==================================================
CREATE OR REPLACE FUNCTION expire_old_requests()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Marcar como expiradas las distribuciones vencidas
    UPDATE budget_request_professionals 
    SET status = 'expired'
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND status IN ('sent', 'viewed', 'responded');
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Marcar solicitudes como expiradas si todas sus distribuciones expiraron
    UPDATE budget_requests 
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE id IN (
        SELECT DISTINCT brp.request_id
        FROM budget_request_professionals brp
        WHERE brp.request_id = budget_requests.id
        GROUP BY brp.request_id
        HAVING COUNT(*) FILTER (WHERE brp.status != 'expired') = 0
    )
    AND status NOT IN ('closed', 'expired');
    
    GET DIAGNOSTICS updated_count = updated_count + ROW_COUNT;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- Función: mark_offer_as_selected
-- Descripción: Marca una oferta como seleccionada y actualiza estados
-- ==================================================
CREATE OR REPLACE FUNCTION mark_offer_as_selected(
    p_offer_id UUID,
    p_client_id UUID
)
RETURNS JSON AS $$
DECLARE
    request_record RECORD;
    offer_record RECORD;
    result JSON;
BEGIN
    -- Verificar que la oferta pertenece al cliente
    SELECT br.*, bo.* INTO request_record
    FROM budget_requests br
    JOIN budget_offers bo ON br.id = bo.request_id
    WHERE bo.id = p_offer_id
    AND br.client_id = p_client_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oferta no encontrada o no pertenece al cliente';
    END IF;
    
    -- Marcar todas las ofertas de esta solicitud como no seleccionadas
    UPDATE budget_offers 
    SET is_selected = false, updated_at = CURRENT_TIMESTAMP
    WHERE request_id = request_record.request_id;
    
    -- Marcar la oferta seleccionada
    UPDATE budget_offers 
    SET is_selected = true, offer_status = 'accepted', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_offer_id;
    
    -- Actualizar estado de la solicitud
    UPDATE budget_requests 
    SET status = 'closed', selected_offer_id = p_offer_id, updated_at = CURRENT_TIMESTAMP
    WHERE id = request_record.request_id;
    
    -- Marcar otras ofertas como rechazadas
    UPDATE budget_offers 
    SET offer_status = 'rejected', updated_at = CURRENT_TIMESTAMP
    WHERE request_id = request_record.request_id
    AND id != p_offer_id;
    
    -- Crear resultado
    result := json_build_object(
        'success', true,
        'request_id', request_record.request_id,
        'offer_id', p_offer_id,
        'selected_price', request_record.price,
        'status', 'closed'
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- Función: cleanup_old_budget_requests
-- Descripción: Limpia solicitudes antiguas para mantener el rendimiento
-- ==================================================
CREATE OR REPLACE FUNCTION cleanup_old_budget_requests()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Eliminar solicitudes expiradas con más de 6 meses
    DELETE FROM budget_requests 
    WHERE status = 'expired' 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Limpiar ofertas huérfanas
    DELETE FROM budget_offers 
    WHERE request_id NOT IN (SELECT id FROM budget_requests);
    
    -- Limpiar distribuciones huérfanas
    DELETE FROM budget_request_professionals 
    WHERE request_id NOT IN (SELECT id FROM budget_requests);
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- Triggers y automatizaciones adicionales
-- ==================================================

-- Trigger para actualizar contador de ofertas
CREATE OR REPLACE FUNCTION update_offer_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE budget_requests 
        SET total_offers = total_offers + 1 
        WHERE id = NEW.request_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE budget_requests 
        SET total_offers = total_offers - 1 
        WHERE id = OLD.request_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_offer_count
    AFTER INSERT OR DELETE ON budget_offers
    FOR EACH ROW EXECUTE FUNCTION update_offer_count();

-- Trigger para marcar distribución como respondida
CREATE OR REPLACE FUNCTION mark_distribution_responded()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.offer_status = 'pending' AND (OLD.offer_status IS NULL OR OLD.offer_status != 'pending') THEN
        UPDATE budget_request_professionals 
        SET responded = TRUE, 
            responded_at = CURRENT_TIMESTAMP,
            status = 'responded'
        WHERE request_id = NEW.request_id 
        AND professional_id = NEW.professional_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_distribution_responded
    AFTER INSERT OR UPDATE ON budget_offers
    FOR EACH ROW EXECUTE FUNCTION mark_distribution_responded();

-- ==================================================
-- Vistas útiles para consultas frecuentes
-- ==================================================

-- Vista para bandeja de entrada de profesionales
CREATE OR REPLACE VIEW professional_inbox AS
SELECT 
    brp.id as distribution_id,
    brp.request_id,
    br.title,
    br.description,
    br.photos,
    br.category,
    br.budget_range_min,
    br.budget_range_max,
    br.location,
    br.requirements,
    brp.sent_at,
    brp.responded,
    brp.responded_at,
    brp.expires_at,
    brp.status,
    CASE 
        WHEN brp.expires_at < CURRENT_TIMESTAMP THEN 'expired'
        ELSE brp.status 
    END as current_status,
    bo.id as offer_id,
    bo.price,
    bo.estimated_days,
    bo.comments,
    bo.offer_status,
    bo.is_selected,
    EXTRACT(DAYS FROM (brp.expires_at - CURRENT_TIMESTAMP)) as days_remaining
FROM budget_request_professionals brp
JOIN budget_requests br ON brp.request_id = br.id
LEFT JOIN budget_offers bo ON brp.request_id = bo.request_id AND brp.professional_id = bo.professional_id
ORDER BY brp.sent_at DESC;

-- Vista para solicitudes con métricas
CREATE OR REPLACE VIEW budget_requests_metrics AS
SELECT 
    br.id,
    br.client_id,
    u.first_name || ' ' || u.last_name as client_name,
    br.title,
    br.category,
    br.status,
    br.total_offers,
    br.created_at,
    COUNT(bo.id) FILTER (WHERE bo.is_selected = true) as selected_offers,
    MIN(bo.price) as min_price,
    MAX(bo.price) as max_price,
    AVG(bo.price) as avg_price,
    MIN(bo.estimated_days) as fastest_days,
    MAX(bo.estimated_days) as slowest_days
FROM budget_requests br
LEFT JOIN users u ON br.client_id = u.id
LEFT JOIN budget_offers bo ON br.id = bo.request_id
GROUP BY br.id, u.first_name, u.last_name;

COMMIT;