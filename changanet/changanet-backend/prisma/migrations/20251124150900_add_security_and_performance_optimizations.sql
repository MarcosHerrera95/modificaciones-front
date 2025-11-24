-- Migration: Add Security and Performance Optimizations
-- Created: 2025-11-24T15:09:00Z
-- Description: Adds enhanced security fields, performance indexes, and audit trail improvements

-- Add enhanced security and audit fields to usuarios table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_activity_at DateTime;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_count Int DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS session_timeout_minutes Int DEFAULT 30;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS two_factor_enabled Boolean DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS two_factor_secret String;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS backup_email String;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS security_questions JSON;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS account_lockout_until DateTime;

-- Add performance optimization fields
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS priority_level Int DEFAULT 0; -- 0=normal, 1=high, 2=urgent
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS estimated_duration_hours Float;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS complexity_score Int DEFAULT 1; -- 1-5 complexity scale

-- Add indexing for common queries to improve performance
CREATE INDEX IF NOT EXISTS idx_usuarios_last_activity ON usuarios(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_usuarios_login_count ON usuarios(login_count DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_verified ON usuarios(rol, esta_verificado);
CREATE INDEX IF NOT EXISTS idx_usuarios_email_normalized ON usuarios(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_mensajes_conversation ON mensajes(remitente_id, destinatario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_unread ON mensajes(destinatario_id, esta_leido, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_servicios_estado_fecha ON servicios(estado, fecha_agendada);
CREATE INDEX IF NOT EXISTS idx_servicios_cliente_estado ON servicios(cliente_id, estado);
CREATE INDEX IF NOT EXISTS idx_servicios_profesional_estado ON servicios(profesional_id, estado);
CREATE INDEX IF NOT EXISTS idx_servicios_priority ON servicios(priority_level, estado);

CREATE INDEX IF NOT EXISTS idx_pagos_estado_fecha ON pagos(estado, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON pagos(cliente_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_profesional ON pagos(profesional_id, estado);

CREATE INDEX IF NOT EXISTS idx_disponibilidad_fecha_profesional ON disponibilidad(fecha, profesional_id);
CREATE INDEX IF NOT EXISTS idx_disponibilidad_reservada ON disponibilidad(reservado_por, fecha);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente_fecha ON cotizaciones(cliente_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_cotizacion_respuestas_cotizacion ON cotizacion_respuestas(cotizacion_id, estado);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leido ON notificaciones(usuario_id, esta_leido, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_perfiles_profesionales_rating_disponible ON perfiles_profesionales(calificacion_promedio DESC, esta_disponible);
CREATE INDEX IF NOT EXISTS idx_perfiles_profesionales_especialidad_zona ON perfiles_profesionales(especialidad, zona_cobertura);

-- Add JSON indexes for better performance on JSON queries (SQLite doesn't support JSON indexes natively, but we can use computed columns)
-- Note: SQLite doesn't support generated columns, so we'll rely on application-level JSON handling

-- Create audit trail table for security monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
    id Text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id Text,
    action Text NOT NULL, -- LOGIN, LOGOUT, CREATE_USER, UPDATE_PROFILE, etc.
    resource_type Text, -- USER, SERVICE, PAYMENT, etc.
    resource_id Text,
    old_values JSON,
    new_values JSON,
    ip_address Text,
    user_agent Text,
    timestamp DateTime DEFAULT CURRENT_TIMESTAMP,
    severity Text DEFAULT 'INFO', -- INFO, WARNING, ERROR, CRITICAL
    session_id Text,
    
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity, timestamp DESC);

-- Add rate limiting tracking table
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id Text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    identifier Text NOT NULL, -- IP address, user ID, or API key
    identifier_type Text NOT NULL, -- 'IP', 'USER', 'API_KEY'
    endpoint Text NOT NULL,
    request_count Int DEFAULT 1,
    window_start DateTime DEFAULT CURRENT_TIMESTAMP,
    created_at DateTime DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_tracking(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_tracking(window_start);

-- Add enhanced notification preferences
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS quiet_hours_start Time;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS quiet_hours_end Time;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS timezone String DEFAULT 'America/Argentina/Buenos_Aires';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS language_preference String DEFAULT 'es';

-- Add performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id Text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    endpoint Text NOT NULL,
    method Text NOT NULL,
    response_time_ms Int,
    status_code Int,
    timestamp DateTime DEFAULT CURRENT_TIMESTAMP,
    user_id Text,
    request_size_bytes Int,
    response_size_bytes Int,
    
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user ON performance_metrics(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);

-- Add cache management table for intelligent caching
CREATE TABLE IF NOT EXISTS cache_metadata (
    id Text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    cache_key Text UNIQUE NOT NULL,
    data_type Text NOT NULL, -- 'USER_LIST', 'PROFESSIONAL_SEARCH', etc.
    size_bytes Int,
    access_count Int DEFAULT 0,
    last_accessed DateTime DEFAULT CURRENT_TIMESTAMP,
    expires_at DateTime,
    created_at DateTime DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_cache_metadata_key (cache_key),
    INDEX idx_cache_metadata_expires (expires_at),
    INDEX idx_cache_metadata_access (last_accessed)
);

-- Add security settings table for system-wide security configuration
CREATE TABLE IF NOT EXISTS security_settings (
    id Text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    setting_key Text UNIQUE NOT NULL,
    setting_value Text NOT NULL,
    description Text,
    is_active Boolean DEFAULT true,
    updated_by Text,
    updated_at DateTime DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Insert default security settings
INSERT OR IGNORE INTO security_settings (setting_key, setting_value, description) VALUES
('max_login_attempts', '5', 'Maximum failed login attempts before account lockout'),
('account_lockout_duration', '30', 'Account lockout duration in minutes'),
('password_min_length', '10', 'Minimum password length'),
('password_require_special', 'true', 'Require special characters in passwords'),
('session_timeout_minutes', '30', 'Default session timeout in minutes'),
('refresh_token_expiry_days', '30', 'Refresh token expiry in days'),
('enable_2fa', 'false', 'Enable two-factor authentication by default'),
('enable_rate_limiting', 'true', 'Enable API rate limiting'),
('rate_limit_requests_per_minute', '100', 'Default rate limit requests per minute'),
('enable_audit_logging', 'true', 'Enable comprehensive audit logging');

-- Update version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    id Text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    version Text UNIQUE NOT NULL,
    applied_at DateTime DEFAULT CURRENT_TIMESTAMP,
    description Text
);

INSERT OR IGNORE INTO schema_version (version, description) VALUES
('2025.11.24.1509', 'Security and performance optimizations - Enhanced indexes, audit trails, and monitoring');

-- Analyze tables for SQLite optimization
ANALYZE;

-- Vacuum to optimize database file
VACUUM;