-- Migraciones SQL para el sistema de autenticación de Changánet
-- Versión: 1.0
-- Fecha: 24 de Noviembre, 2025
-- Descripción: Scripts SQL para crear tablas, índices y optimizaciones de seguridad

-- =============================================================================
-- TABLA: usuarios - Tabla principal de usuarios del sistema
-- =============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hash_contrasena VARCHAR(255),
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    rol VARCHAR(20) NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente', 'profesional', 'admin')),
    esta_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
    bloqueado_hasta TIMESTAMP NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    token_verificacion VARCHAR(255) UNIQUE,
    token_expiracion TIMESTAMP NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NULL,
    google_id VARCHAR(255) UNIQUE,
    facebook_id VARCHAR(255) UNIQUE,
    url_foto_perfil VARCHAR(500),
    fcm_token VARCHAR(500),
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    direccion VARCHAR(255),
    preferencias_servicio TEXT,
    
    -- Campos de auditoría de seguridad
    last_login_at TIMESTAMP NULL,
    last_login_ip INET,
    password_changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Campos adicionales de perfil
    notificaciones_push BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_email BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_sms BOOLEAN NOT NULL DEFAULT FALSE,
    notificaciones_servicios BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_mensajes BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_pagos BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_marketing BOOLEAN NOT NULL DEFAULT FALSE
);

-- =============================================================================
-- TABLA: refresh_tokens - Tokens revocables para sesiones largas
-- =============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP NULL,
    revoked_by_ip INET,
    user_agent TEXT
);

-- =============================================================================
-- TABLA: security_logs - Auditoría de eventos de seguridad
-- =============================================================================

CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_description TEXT,
    ip_address INET,
    user_agent TEXT,
    request_path VARCHAR(500),
    success BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- =============================================================================
-- TABLA: oauth_providers - Manejo de OAuth tokens de terceros
-- =============================================================================

CREATE TABLE IF NOT EXISTS oauth_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'facebook')),
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    scopes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(provider, provider_user_id)
);

-- =============================================================================
-- ÍNDICES para optimización de performance y seguridad
-- =============================================================================

-- Índices en tabla usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_verificado ON usuarios(esta_verificado);
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado ON usuarios(bloqueado);
CREATE INDEX IF NOT EXISTS idx_usuarios_telefono ON usuarios(telefono);
CREATE INDEX IF NOT EXISTS idx_usuarios_google_id ON usuarios(google_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_facebook_id ON usuarios(facebook_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_creado_en ON usuarios(creado_en);
CREATE INDEX IF NOT EXISTS idx_usuarios_last_login ON usuarios(last_login_at);

-- Índices compuestos para consultas complejas
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_verificado ON usuarios(rol, esta_verificado);
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado_expires ON usuarios(bloqueado, bloqueado_hasta);

-- Índices en tabla refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expires ON refresh_tokens(user_id, expires_at);

-- Índices en tabla security_logs
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_success ON security_logs(success);

-- Índices compuestos para análisis de seguridad
CREATE INDEX IF NOT EXISTS idx_security_logs_user_event ON security_logs(user_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_event ON security_logs(ip_address, event_type, created_at);

-- Índices en tabla oauth_providers
CREATE INDEX IF NOT EXISTS idx_oauth_providers_user_id ON oauth_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider ON oauth_providers(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_expires ON oauth_providers(expires_at);

-- =============================================================================
-- FUNCIONES UTILITARIAS
-- =============================================================================

-- Función para limpiar tokens expirados automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar refresh tokens expirados
    DELETE FROM refresh_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP OR revoked = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Registrar limpieza en logs de seguridad
    INSERT INTO security_logs (event_type, event_description, success)
    VALUES ('TOKEN_CLEANUP', 'Limpieza automática de ' || deleted_count || ' tokens expirados', TRUE);
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar eventos de seguridad
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id UUID,
    p_event_type VARCHAR(50),
    p_event_description TEXT,
    p_ip_address INET,
    p_user_agent TEXT,
    p_request_path VARCHAR(500),
    p_success BOOLEAN DEFAULT TRUE,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO security_logs (
        user_id,
        event_type,
        event_description,
        ip_address,
        user_agent,
        request_path,
        success,
        metadata
    ) VALUES (
        p_user_id,
        p_event_type,
        p_event_description,
        p_ip_address,
        p_user_agent,
        p_request_path,
        p_success,
        p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar si un usuario puede intentar hacer login
CREATE OR REPLACE FUNCTION can_user_attempt_login(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_record usuarios%ROWTYPE;
BEGIN
    SELECT * INTO user_record FROM usuarios WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar si está bloqueado
    IF user_record.bloqueado THEN
        -- Verificar si el bloqueo ha expirado
        IF user_record.bloqueado_hasta IS NOT NULL AND user_record.bloqueado_hasta > CURRENT_TIMESTAMP THEN
            RETURN FALSE;
        ELSE
            -- Desbloquear automáticamente
            UPDATE usuarios 
            SET bloqueado = FALSE, 
                bloqueado_hasta = NULL, 
                failed_login_attempts = 0,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id = p_user_id;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Función para incrementar intentos fallidos de login
CREATE OR REPLACE FUNCTION increment_failed_login_attempts(
    p_user_id UUID,
    p_ip_address INET
)
RETURNS BOOLEAN AS $$
DECLARE
    user_record usuarios%ROWTYPE;
    new_attempt_count INTEGER;
    should_block BOOLEAN := FALSE;
BEGIN
    SELECT * INTO user_record FROM usuarios WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    new_attempt_count := COALESCE(user_record.failed_login_attempts, 0) + 1;
    
    -- Bloquear después de 5 intentos fallidos
    IF new_attempt_count >= 5 THEN
        should_block := TRUE;
    END IF;
    
    UPDATE usuarios 
    SET 
        failed_login_attempts = new_attempt_count,
        bloqueado = should_block,
        bloqueado_hasta = CASE 
            WHEN should_block THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            ELSE NULL
        END,
        last_login_ip = p_ip_address,
        actualizado_en = CURRENT_TIMESTAMP
    WHERE id = p_user_id;
    
    RETURN should_block;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS para automatización
-- =============================================================================

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tabla usuarios
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para OAuth providers
DROP TRIGGER IF EXISTS update_oauth_providers_updated_at ON oauth_providers;
CREATE TRIGGER update_oauth_providers_updated_at
    BEFORE UPDATE ON oauth_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para registrar eventos de seguridad en login
CREATE OR REPLACE FUNCTION log_login_attempt()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar si hay intentos fallidos o bloqueo
    IF NEW.failed_login_attempts > 0 OR NEW.bloqueado = TRUE THEN
        PERFORM log_security_event(
            NEW.id,
            'LOGIN_ATTEMPT',
            'Failed login attempt. Attempts: ' || NEW.failed_login_attempts,
            NEW.last_login_ip,
            NULL,
            '/api/auth/login',
            NEW.failed_login_attempts = 0,
            jsonb_build_object(
                'attempts', NEW.failed_login_attempts,
                'blocked', NEW.bloqueado,
                'blocked_until', NEW.bloqueado_hasta
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_login_attempts ON usuarios;
CREATE TRIGGER log_login_attempts
    AFTER UPDATE ON usuarios
    FOR EACH ROW
    WHEN (OLD.failed_login_attempts != NEW.failed_login_attempts OR OLD.bloqueado != NEW.bloqueado)
    EXECUTE FUNCTION log_login_attempt();

-- =============================================================================
-- DATOS INICIALES (Solo para entorno de desarrollo)
-- =============================================================================

-- Solo ejecutar en desarrollo
DO $$
BEGIN
    IF current_setting('application_name', true) != 'psql' OR current_database() LIKE '%dev%' OR current_database() LIKE '%test%' THEN
        
        -- Crear usuario admin por defecto
        INSERT INTO usuarios (
            id,
            email, 
            hash_contrasena,
            nombre,
            rol,
            esta_verificado,
            bloqueado
        ) VALUES (
            gen_random_uuid(),
            'admin@changanet.com.ar',
            '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj8xLX3x1E1a', -- password: Admin123!
            'Administrador Changánet',
            'admin',
            TRUE,
            FALSE
        ) ON CONFLICT (email) DO NOTHING;
        
        -- Crear usuario de prueba cliente
        INSERT INTO usuarios (
            id,
            email,
            hash_contrasena,
            nombre,
            rol,
            esta_verificado,
            telefono,
            direccion
        ) VALUES (
            gen_random_uuid(),
            'cliente@changanet.com.ar',
            '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj8xLX3x1E1a', -- password: Test123!
            'Cliente de Prueba',
            'cliente',
            TRUE,
            '+5491123456789',
            'Buenos Aires, Argentina'
        ) ON CONFLICT (email) DO NOTHING;
        
        -- Crear usuario de prueba profesional
        INSERT INTO usuarios (
            id,
            email,
            hash_contrasena,
            nombre,
            rol,
            esta_verificado,
            telefono,
            direccion
        ) VALUES (
            gen_random_uuid(),
            'profesional@changanet.com.ar',
            '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj8xLX3x1E1a', -- password: Test123!
            'Profesional de Prueba',
            'profesional',
            TRUE,
            '+5491123456788',
            'Buenos Aires, Argentina'
        ) ON CONFLICT (email) DO NOTHING;
        
        RAISE NOTICE 'Datos de prueba creados exitosamente';
    END IF;
END
$$;

-- =============================================================================
-- LIMPIEZA Y MANTENIMIENTO
-- =============================================================================

-- Crear job para limpieza automática (requiere pg_cron extension)
-- Descomentar en producción
/*
SELECT cron.schedule(
    'cleanup-expired-tokens',
    '0 2 * * *',
    'SELECT cleanup_expired_tokens();'
);

SELECT cron.schedule(
    'cleanup-old-security-logs',
    '0 3 * * 0', -- Domingos a las 3 AM
    'DELETE FROM security_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL ''90 days'';'
);
*/

-- =============================================================================
-- CONSULTAS ÚTILES PARA MONITOREO
-- =============================================================================

-- Crear vistas para reportes comunes
CREATE OR REPLACE VIEW security_summary AS
SELECT 
    DATE(created_at) as date,
    event_type,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE success = true) as successful_events,
    COUNT(*) FILTER (WHERE success = false) as failed_events,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM security_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), event_type
ORDER BY date DESC, event_type;

-- Vista de usuarios bloqueados
CREATE OR REPLACE VIEW blocked_users AS
SELECT 
    id,
    email,
    nombre,
    failed_login_attempts,
    bloqueado_hasta,
    last_login_ip,
    (bloqueado_hasta - CURRENT_TIMESTAMP) as remaining_block_time
FROM usuarios
WHERE bloqueado = TRUE
ORDER BY bloqueado_hasta;

-- Vista de tokens próximos a expirar
CREATE OR REPLACE VIEW expiring_refresh_tokens AS
SELECT 
    rt.id,
    rt.user_id,
    u.email,
    rt.issued_at,
    rt.expires_at,
    (rt.expires_at - CURRENT_TIMESTAMP) as time_until_expiry
FROM refresh_tokens rt
JOIN usuarios u ON rt.user_id = u.id
WHERE rt.revoked = FALSE 
    AND rt.expires_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '7 days'
ORDER BY rt.expires_at;

-- =============================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =============================================================================

COMMENT ON TABLE usuarios IS 'Tabla principal de usuarios con campos de seguridad y auditoría';
COMMENT ON TABLE refresh_tokens IS 'Tokens revocables para sesiones de larga duración';
COMMENT ON TABLE security_logs IS 'Registro de eventos de seguridad para auditoría';
COMMENT ON TABLE oauth_providers IS 'Tokens y datos de proveedores OAuth externos';

COMMENT ON COLUMN usuarios.failed_login_attempts IS 'Contador de intentos de login fallidos para bloqueo automático';
COMMENT ON COLUMN usuarios.bloqueado_hasta IS 'Timestamp hasta el cual el usuario está bloqueado';
COMMENT ON COLUMN usuarios.token_verificacion IS 'Token temporal para verificación de email';
COMMENT ON COLUMN usuarios.google_id IS 'ID único del usuario en Google OAuth';
COMMENT ON COLUMN usuarios.facebook_id IS 'ID único del usuario en Facebook OAuth';

COMMENT ON COLUMN refresh_tokens.token_hash IS 'Hash SHA256 del token para seguridad (nunca almacenar el token real)';
COMMENT ON COLUMN refresh_tokens.revoked_by_ip IS 'IP desde donde se revocó el token';
COMMENT ON COLUMN security_logs.metadata IS 'Datos adicionales en formato JSON para análisis';

-- =============================================================================
-- VERIFICACIÓN DE INTEGRIDAD
-- =============================================================================

-- Verificar que no hay usuarios con emails duplicados
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM (SELECT email, COUNT(*) FROM usuarios GROUP BY email HAVING COUNT(*) > 1) duplicates) > 0 THEN
        RAISE EXCEPTION 'Usuarios con emails duplicados encontrados';
    END IF;
END
$$;

-- Verificar que no hay refresh tokens duplicados
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM (SELECT token_hash, COUNT(*) FROM refresh_tokens GROUP BY token_hash HAVING COUNT(*) > 1) duplicates) > 0 THEN
        RAISE EXCEPTION 'Refresh tokens duplicados encontrados';
    END IF;
END
$$;

-- Verificar integridad de foreign keys
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM refresh_tokens rt LEFT JOIN usuarios u ON rt.user_id = u.id WHERE u.id IS NULL) > 0 THEN
        RAISE EXCEPTION 'Refresh tokens con user_id inválido';
    END IF;
    
    IF (SELECT COUNT(*) FROM security_logs sl LEFT JOIN usuarios u ON sl.user_id = u.id WHERE sl.user_id IS NOT NULL AND u.id IS NULL) > 0 THEN
        RAISE EXCEPTION 'Security logs con user_id inválido';
    END IF;
END
$$;

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================

RAISE NOTICE 'Migración de autenticación completada exitosamente';
RAISE NOTICE 'Tablas creadas: usuarios, refresh_tokens, security_logs, oauth_providers';
RAISE NOTICE 'Índices creados para optimización de performance';
RAISE NOTICE 'Funciones utilitarias y triggers configurados';
RAISE NOTICE 'Vistas de monitoreo disponibles';
RAISE NOTICE 'Script completado sin errores';

-- Verificar versión de PostgreSQL
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL version: %', version();
END
$$;