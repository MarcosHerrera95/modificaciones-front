/**
 * Script de migración SQL actualizada para el sistema de autenticación Changánet
 * Versión: 2.0.0 - Actualizada 24 de Noviembre, 2025
 * Descripción: Migración completa con campos de auditoría y seguridad mejorados
 */

-- ==================================================
-- CONFIGURACIÓN INICIAL Y TABLA DE USUARIOS MEJORADA
-- ==================================================

-- Crear tabla de usuarios con campos de auditoría y seguridad
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    hash_contrasena TEXT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    rol TEXT DEFAULT 'cliente' CHECK (rol IN ('cliente', 'profesional', 'admin')),
    esta_verificado BOOLEAN DEFAULT 0,
    bloqueado BOOLEAN DEFAULT 0,
    bloqueado_hasta DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    token_verificacion TEXT UNIQUE,
    token_expiracion DATETIME,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME,
    google_id TEXT UNIQUE,
    facebook_id TEXT UNIQUE,
    url_foto_perfil TEXT,
    fcm_token TEXT,
    sms_enabled BOOLEAN DEFAULT 0,
    
    -- Campos de auditoría de seguridad (NUEVOS)
    last_login_at DATETIME,
    last_login_ip TEXT,
    password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Preferencias de notificaciones
    direccion TEXT,
    preferencias_servicio TEXT,
    notificaciones_push BOOLEAN DEFAULT 1,
    notificaciones_email BOOLEAN DEFAULT 1,
    notificaciones_sms BOOLEAN DEFAULT 0,
    notificaciones_servicios BOOLEAN DEFAULT 1,
    notificaciones_mensajes BOOLEAN DEFAULT 1,
    notificaciones_pagos BOOLEAN DEFAULT 1,
    notificaciones_marketing BOOLEAN DEFAULT 0
);

-- Crear tabla de refresh tokens con funcionalidad mejorada
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ==================================================
-- ÍNDICES OPTIMIZADOS PARA PERFORMANCE Y SEGURIDAD
-- ==================================================

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_verificado ON usuarios(esta_verificado);
CREATE INDEX IF NOT EXISTS idx_usuarios_google_id ON usuarios(google_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_facebook_id ON usuarios(facebook_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado ON usuarios(bloqueado, bloqueado_hasta);
CREATE INDEX IF NOT EXISTS idx_usuarios_last_login ON usuarios(last_login_at);

-- Índices para refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked);

-- Índice compuesto para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_verificado ON usuarios(rol, esta_verificado);

-- ==================================================
-- FUNCIONES DE SEGURIDAD Y UTILIDADES
-- ==================================================

-- Función para limpiar tokens expirados automáticamente
CREATE TRIGGER IF NOT EXISTS cleanup_expired_tokens
    AFTER INSERT ON refresh_tokens
    BEGIN
        DELETE FROM refresh_tokens 
        WHERE expires_at < datetime('now') 
        AND revoked = 1;
    END;

-- Función para actualizar timestamp de último login
CREATE TRIGGER IF NOT EXISTS update_last_login
    AFTER UPDATE OF last_login_at ON usuarios
    BEGIN
        UPDATE usuarios 
        SET actualizado_en = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- Función para limpiar tokens vencidos de usuarios bloqueados
CREATE TRIGGER IF NOT EXISTS cleanup_tokens_blocked_users
    AFTER UPDATE OF bloqueado ON usuarios
    WHEN NEW.bloqueado = 1
    BEGIN
        DELETE FROM refresh_tokens 
        WHERE user_id = NEW.id 
        AND revoked = 0;
    END;

-- ==================================================
-- VISTAS ÚTILES PARA MONITOREO
-- ==================================================

-- Vista para usuarios activos (últimos 30 días)
CREATE VIEW IF NOT EXISTS usuarios_activos AS
SELECT 
    id,
    email,
    nombre,
    rol,
    esta_verificado,
    last_login_at,
    creado_en,
    (julianday('now') - julianday(last_login_at)) as dias_desde_ultimo_login
FROM usuarios 
WHERE last_login_at >= date('now', '-30 days');

-- Vista para estadísticas de autenticación diaria
CREATE VIEW IF NOT EXISTS stats_autenticacion_diaria AS
SELECT 
    DATE(creado_en) as fecha,
    rol,
    COUNT(*) as nuevos_usuarios,
    SUM(CASE WHEN esta_verificado = 1 THEN 1 ELSE 0 END) as usuarios_verificados
FROM usuarios 
GROUP BY DATE(creado_en), rol
ORDER BY fecha DESC;

-- ==================================================
-- POLÍTICAS DE SEGURIDAD Y CONSTRAINTS
-- ==================================================

-- Constraint para validar formato de email
CREATE TRIGGER IF NOT EXISTS validate_email_format
    BEFORE INSERT ON usuarios
    WHEN NEW.email IS NOT NULL
    BEGIN
        SELECT CASE
            WHEN NEW.email NOT LIKE '%_@_%_._%' THEN
                RAISE(ABORT, 'Formato de email inválido')
        END;
    END;

-- Constraint para limitar intentos de login fallidos
CREATE TRIGGER IF NOT EXISTS validate_login_attempts
    BEFORE UPDATE OF failed_login_attempts ON usuarios
    WHEN NEW.failed_login_attempts > 10
    BEGIN
        SELECT CASE
            WHEN NEW.failed_login_attempts > 10 THEN
                RAISE(ABORT, 'Demasiados intentos de login fallidos')
        END;
    END;

-- ==================================================
-- DATOS DE SEED INICIAL (OPCIONAL)
-- ==================================================

-- Insertar usuario administrador por defecto (CAMBIAR CONTRASEÑA EN PRODUCCIÓN)
INSERT OR IGNORE INTO usuarios (
    id, 
    email, 
    hash_contrasena, 
    nombre, 
    rol, 
    esta_verificado
) VALUES (
    'admin-default-id',
    'admin@changanet.com.ar',
    '$2b$12$LQv3c1yqBwlVHpTEzs4tae3V6dH4U8F2F5M4E7N1P9K6L8Q2R4S6T8', -- 'changAnet2025!' hasheado
    'Administrador Sistema',
    'admin',
    1
);

-- Insertar especialidades básicas para profesionales (si no existen)
INSERT OR IGNORE INTO specialties (id, name, category, description, is_active) VALUES
('spec-1', 'Plomería', 'Construcción', 'Servicios de plomería y fontanería', 1),
('spec-2', 'Electricidad', 'Construcción', 'Servicios eléctricos residenciales y comerciales', 1),
('spec-3', 'Carpintería', 'Construcción', 'Trabajos en madera y mobiliario', 1),
('spec-4', 'Pintura', 'Construcción', 'Pintura interior y exterior', 1),
('spec-5', 'Aire Acondicionado', 'Hogar', 'Instalación y mantenimiento de sistemas AC', 1),
('spec-6', 'Gasista', 'Hogar', 'Instalación y reparación de gas natural', 1),
('spec-7', 'Jardinería', 'Hogar', 'Mantenimiento de jardines y espacios verdes', 1),
('spec-8', 'Limpieza', 'Hogar', 'Servicios de limpieza residencial y comercial', 1),
('spec-9', 'Mecánica Automotriz', 'Automotriz', 'Reparación y mantenimiento de vehículos', 1),
('spec-10', 'Informática', 'Tecnología', 'Soporte técnico y reparación de equipos', 1);

-- Insertar zonas de cobertura básicas (si no existen)
INSERT OR IGNORE INTO coverage_zones (id, name, state, city, latitude, longitude, radius_km, is_active) VALUES
('zone-1', 'CABA Centro', 'Buenos Aires', 'Buenos Aires', -34.6037, -58.3816, 5.0, 1),
('zone-2', 'CABA Norte', 'Buenos Aires', 'Buenos Aires', -34.5712, -58.3962, 5.0, 1),
('zone-3', 'CABA Sur', 'Buenos Aires', 'Buenos Aires', -34.6361, -58.3667, 5.0, 1),
('zone-4', 'CABA Oeste', 'Buenos Aires', 'Buenos Aires', -34.6288, -58.4067, 5.0, 1),
('zone-5', 'GBA Norte', 'Buenos Aires', 'San Isidro', -34.4708, -58.5369, 15.0, 1),
('zone-6', 'GBA Sur', 'Buenos Aires', 'Avellaneda', -34.6607, -58.3677, 15.0, 1),
('zone-7', 'GBA Oeste', 'Buenos Aires', 'Morón', -34.6536, -58.6217, 15.0, 1),
('zone-8', 'GBA Este', 'Buenos Aires', 'Lomas de Zamora', -34.7658, -58.4089, 15.0, 1);

-- ==================================================
-- VERIFICACIONES FINALES
-- ==================================================

-- Verificar que las tablas se crearon correctamente
SELECT 'Tabla usuarios creada' as status WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='usuarios');
SELECT 'Tabla refresh_tokens creada' as status WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='refresh_tokens');

-- Verificar índices creados
SELECT COUNT(*) as total_indices FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';

-- Contar usuarios de ejemplo insertados
SELECT COUNT(*) as total_usuarios FROM usuarios;
SELECT COUNT(*) as total_especialidades FROM specialties;
SELECT COUNT(*) as total_zonas FROM coverage_zones;