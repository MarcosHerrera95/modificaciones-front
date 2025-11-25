-- ==================================================
-- MIGRACIÓN: Sistema Avanzado de Disponibilidad y Citas
-- Fecha: 25 de Noviembre de 2025
-- Versión: 1.0
-- ==================================================

-- Crear tabla de disponibilidad avanzada para profesionales
CREATE TABLE IF NOT EXISTS professionals_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    recurrence_type VARCHAR(20) DEFAULT 'single' CHECK (recurrence_type IN ('single', 'daily', 'weekly', 'monthly', 'custom')),
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires',
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT valid_datetime_range CHECK (end_datetime > start_datetime),
    CONSTRAINT valid_timezone CHECK (timezone IS NOT NULL AND LENGTH(timezone) > 0)
);

-- Crear tabla de citas/agendamientos
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    service_id UUID REFERENCES servicios(id) ON DELETE SET NULL,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(20) DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'api', 'google_calendar', 'ical')),
    notes TEXT,
    cancellation_reason TEXT,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Validaciones
    CONSTRAINT valid_appointment_datetime CHECK (end_datetime > start_datetime)
);

-- Crear tabla de slots bloqueados temporales
CREATE TABLE IF NOT EXISTS blocked_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT valid_blocked_datetime CHECK (end_datetime > start_datetime)
);

-- Crear tabla de sincronización de calendarios externos
CREATE TABLE IF NOT EXISTS calendar_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'outlook', 'ical')),
    external_calendar_id VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'disabled')),
    sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Un profesional puede tener solo una sincronización por proveedor
    UNIQUE(professional_id, provider)
);

-- ==================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ==================================================

-- Índices para professionals_availability
CREATE INDEX IF NOT EXISTS idx_professionals_availability_professional_id ON professionals_availability(professional_id);
CREATE INDEX IF NOT EXISTS idx_professionals_availability_datetime_range ON professionals_availability USING GIST (tstzrange(start_datetime, end_datetime));
CREATE INDEX IF NOT EXISTS idx_professionals_availability_recurrence ON professionals_availability(recurrence_type);
CREATE INDEX IF NOT EXISTS idx_professionals_availability_meta ON professionals_availability USING GIN (meta);

-- Índices para appointments
CREATE INDEX IF NOT EXISTS idx_appointments_professional_id ON appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_datetime_range ON appointments USING GIST (tstzrange(start_datetime, end_datetime));
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_professional_datetime ON appointments(professional_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_client_datetime ON appointments(client_id, start_datetime);

-- Índices para blocked_slots
CREATE INDEX IF NOT EXISTS idx_blocked_slots_professional_id ON blocked_slots(professional_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_datetime_range ON blocked_slots USING GIST (tstzrange(start_datetime, end_datetime));

-- Índices para calendar_sync
CREATE INDEX IF NOT EXISTS idx_calendar_sync_professional_id ON calendar_sync(professional_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_provider ON calendar_sync(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_enabled ON calendar_sync(sync_enabled);

-- ==================================================
-- FUNCIONES DE UTILIDAD
-- ==================================================

-- Función para verificar conflictos de horarios
CREATE OR REPLACE FUNCTION check_availability_conflicts(
    p_professional_id UUID,
    p_start_datetime TIMESTAMP WITH TIME ZONE,
    p_end_datetime TIMESTAMP WITH TIME ZONE,
    p_exclude_appointment_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    -- Verificar conflictos con citas existentes
    SELECT COUNT(*) INTO conflict_count
    FROM appointments
    WHERE professional_id = p_professional_id
      AND status IN ('pending', 'confirmed')
      AND tstzrange(start_datetime, end_datetime) && tstzrange(p_start_datetime, p_end_datetime)
      AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id);

    IF conflict_count > 0 THEN
        RETURN FALSE;
    END IF;

    -- Verificar conflictos con slots bloqueados
    SELECT COUNT(*) INTO conflict_count
    FROM blocked_slots
    WHERE professional_id = p_professional_id
      AND tstzrange(start_datetime, end_datetime) && tstzrange(p_start_datetime, p_end_datetime);

    IF conflict_count > 0 THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Función para generar slots recurrentes
CREATE OR REPLACE FUNCTION generate_recurring_slots(
    p_professional_id UUID,
    p_recurrence_type VARCHAR,
    p_start_datetime TIMESTAMP WITH TIME ZONE,
    p_end_datetime TIMESTAMP WITH TIME ZONE,
    p_meta JSONB
) RETURNS TABLE (
    slot_start TIMESTAMP WITH TIME ZONE,
    slot_end TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    current_date DATE := p_start_datetime::DATE;
    end_date DATE;
    days_of_week INTEGER[];
    slot_duration INTERVAL;
    buffer_minutes INTEGER;
BEGIN
    -- Determinar fecha de fin basada en el tipo de recurrencia
    CASE p_recurrence_type
        WHEN 'daily' THEN
            end_date := current_date + INTERVAL '30 days'; -- 30 días por defecto
        WHEN 'weekly' THEN
            end_date := current_date + INTERVAL '12 weeks'; -- 12 semanas por defecto
        WHEN 'monthly' THEN
            end_date := current_date + INTERVAL '12 months'; -- 12 meses por defecto
        ELSE
            -- Para 'single' o 'custom', solo generar un slot
            RETURN QUERY SELECT p_start_datetime, p_end_datetime;
            RETURN;
    END CASE;

    -- Extraer configuración del meta
    days_of_week := COALESCE((p_meta->>'days')::INTEGER[], ARRAY[]::INTEGER[]);
    slot_duration := COALESCE((p_meta->>'slot_duration')::INTEGER, 60) * INTERVAL '1 minute';
    buffer_minutes := COALESCE((p_meta->>'buffer_minutes')::INTEGER, 0);

    -- Generar slots según el tipo de recurrencia
    WHILE current_date <= end_date LOOP
        CASE p_recurrence_type
            WHEN 'daily' THEN
                -- Generar slots para cada día
                RETURN QUERY SELECT
                    (current_date + (p_start_datetime::TIME))::TIMESTAMP WITH TIME ZONE,
                    (current_date + (p_end_datetime::TIME))::TIMESTAMP WITH TIME ZONE;
                current_date := current_date + 1;

            WHEN 'weekly' THEN
                -- Generar slots solo para los días de la semana especificados
                IF array_length(days_of_week, 1) = 0 OR EXTRACT(DOW FROM current_date) = ANY(days_of_week) THEN
                    RETURN QUERY SELECT
                        (current_date + (p_start_datetime::TIME))::TIMESTAMP WITH TIME ZONE,
                        (current_date + (p_end_datetime::TIME))::TIMESTAMP WITH TIME ZONE;
                END IF;
                current_date := current_date + 1;

            WHEN 'monthly' THEN
                -- Generar slots para el mismo día de cada mes
                RETURN QUERY SELECT
                    (current_date + (p_start_datetime::TIME))::TIMESTAMP WITH TIME ZONE,
                    (current_date + (p_end_datetime::TIME))::TIMESTAMP WITH TIME ZONE;
                current_date := current_date + INTERVAL '1 month';
        END CASE;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener disponibilidad agregada
CREATE OR REPLACE FUNCTION get_aggregated_availability(
    p_professional_id UUID,
    p_from_date DATE DEFAULT CURRENT_DATE,
    p_to_date DATE DEFAULT CURRENT_DATE + INTERVAL '7 days'
) RETURNS TABLE (
    date DATE,
    available_slots JSONB
) AS $$
DECLARE
    current_date DATE := p_from_date;
BEGIN
    WHILE current_date <= p_to_date LOOP
        -- Obtener slots disponibles para esta fecha
        RETURN QUERY
        SELECT
            current_date,
            jsonb_agg(
                jsonb_build_object(
                    'id', pa.id,
                    'start_datetime', pa.start_datetime,
                    'end_datetime', pa.end_datetime,
                    'timezone', pa.timezone,
                    'meta', pa.meta,
                    'is_available', check_availability_conflicts(
                        p_professional_id,
                        pa.start_datetime,
                        pa.end_datetime
                    )
                )
            ) FILTER (WHERE pa.id IS NOT NULL) as available_slots
        FROM professionals_availability pa
        WHERE pa.professional_id = p_professional_id
          AND pa.start_datetime::DATE = current_date
          AND pa.recurrence_type = 'single' -- Por ahora solo slots únicos
        GROUP BY current_date;

        current_date := current_date + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- ==================================================

-- Trigger para actualizar updated_at en professionals_availability
CREATE OR REPLACE FUNCTION update_professionals_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_professionals_availability_updated_at
    BEFORE UPDATE ON professionals_availability
    FOR EACH ROW
    EXECUTE FUNCTION update_professionals_availability_updated_at();

-- Trigger para actualizar updated_at en appointments
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointments_updated_at();

-- Trigger para actualizar updated_at en blocked_slots
CREATE OR REPLACE FUNCTION update_blocked_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blocked_slots_updated_at
    BEFORE UPDATE ON blocked_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_blocked_slots_updated_at();

-- Trigger para actualizar updated_at en calendar_sync
CREATE OR REPLACE FUNCTION update_calendar_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calendar_sync_updated_at
    BEFORE UPDATE ON calendar_sync
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_sync_updated_at();

-- ==================================================
-- DATOS INICIALES DE EJEMPLO
-- ==================================================

-- Insertar algunos slots de disponibilidad de ejemplo (opcional)
-- Estos son solo para testing y deberían ser removidos en producción

-- INSERT INTO professionals_availability (professional_id, recurrence_type, start_datetime, end_datetime, meta)
-- SELECT
--     u.id,
--     'single',
--     CURRENT_DATE + INTERVAL '9 hours',
--     CURRENT_DATE + INTERVAL '17 hours',
--     '{"slot_duration": 60, "buffer_minutes": 15}'::jsonb
-- FROM usuarios u
-- WHERE u.rol = 'profesional'
-- LIMIT 1;

-- ==================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ==================================================

-- Habilitar RLS en las tablas
ALTER TABLE professionals_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync ENABLE ROW LEVEL SECURITY;

-- Políticas para professionals_availability
CREATE POLICY "professionals_availability_select" ON professionals_availability
    FOR SELECT USING (
        professional_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_role')::TEXT = 'admin'
    );

CREATE POLICY "professionals_availability_insert" ON professionals_availability
    FOR INSERT WITH CHECK (
        professional_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_role')::TEXT = 'admin'
    );

CREATE POLICY "professionals_availability_update" ON professionals_availability
    FOR UPDATE USING (
        professional_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_role')::TEXT = 'admin'
    );

CREATE POLICY "professionals_availability_delete" ON professionals_availability
    FOR DELETE USING (
        professional_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_role')::TEXT = 'admin'
    );

-- Políticas para appointments (clientes pueden ver sus propias citas, profesionales las suyas)
CREATE POLICY "appointments_select" ON appointments
    FOR SELECT USING (
        client_id = current_setting('app.current_user_id')::UUID OR
        professional_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_role')::TEXT = 'admin'
    );

CREATE POLICY "appointments_insert" ON appointments
    FOR INSERT WITH CHECK (
        client_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_role')::TEXT = 'admin'
    );

CREATE POLICY "appointments_update" ON appointments
    FOR UPDATE USING (
        client_id = current_setting('app.current_user_id')::UUID OR
        professional_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_role')::TEXT = 'admin'
    );

-- Políticas similares para blocked_slots y calendar_sync...

-- ==================================================
-- COMENTARIOS FINALES
-- ==================================================

COMMENT ON TABLE professionals_availability IS 'Disponibilidad avanzada de profesionales con soporte para recurrencia';
COMMENT ON TABLE appointments IS 'Citas y agendamientos con estados y seguimiento completo';
COMMENT ON TABLE blocked_slots IS 'Slots bloqueados temporalmente por el profesional';
COMMENT ON TABLE calendar_sync IS 'Configuración de sincronización con calendarios externos';

COMMENT ON FUNCTION check_availability_conflicts IS 'Verifica si hay conflictos de horario con citas existentes o slots bloqueados';
COMMENT ON FUNCTION generate_recurring_slots IS 'Genera slots recurrentes basados en configuración';
COMMENT ON FUNCTION get_aggregated_availability IS 'Obtiene disponibilidad agregada para un rango de fechas';

-- ==================================================
-- FIN DE LA MIGRACIÓN
-- ==================================================