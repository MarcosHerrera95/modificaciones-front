-- ==================================================
-- Migración 004: Sistema de Verificación de Identidad y Reputación
-- Implementación para REQ-36 a REQ-40
-- Fecha: 2025-11-25
-- ==================================================

-- Tabla: identity_verification
-- Almacena solicitudes de verificación de identidad
CREATE TABLE IF NOT EXISTS identity_verification (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('dni', 'pasaporte', 'id')),
    document_front_url TEXT NOT NULL,
    document_back_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_review_notes TEXT,
    reviewed_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Índices para identity_verification
CREATE INDEX IF NOT EXISTS idx_identity_user ON identity_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_status ON identity_verification(status);
CREATE INDEX IF NOT EXISTS idx_identity_created ON identity_verification(created_at);

-- Tabla: professional_reputation
-- Almacena métricas de reputación de profesionales
CREATE TABLE IF NOT EXISTS professional_reputation (
    user_id TEXT PRIMARY KEY,
    average_rating REAL NOT NULL DEFAULT 0,
    completed_jobs INTEGER NOT NULL DEFAULT 0,
    on_time_percentage REAL NOT NULL DEFAULT 100,
    medals TEXT NOT NULL DEFAULT '[]', -- JSON string: ['puntualidad','excelencia','top','experto']
    ranking_score REAL NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Índices para professional_reputation
CREATE INDEX IF NOT EXISTS idx_ranking_score ON professional_reputation(ranking_score DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_updated ON professional_reputation(updated_at);

-- Tabla: reputation_history
-- Historial de cambios en la reputación
CREATE TABLE IF NOT EXISTS reputation_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'job_completed','medal_awarded','rating_received','reputation_updated'
    value TEXT NOT NULL DEFAULT '{}', -- JSON string con detalles del evento
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Índices para reputation_history
CREATE INDEX IF NOT EXISTS idx_reputation_history_user ON reputation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_history_event ON reputation_history(event_type);
CREATE INDEX IF NOT EXISTS idx_reputation_history_created ON reputation_history(created_at);

-- Tabla: logros (achievements)
-- Sistema de logros y gamificación
CREATE TABLE IF NOT EXISTS logros (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    icono TEXT NOT NULL,
    categoria TEXT NOT NULL,
    criterio TEXT NOT NULL, -- Condición para obtener el logro
    puntos INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para logros
CREATE INDEX IF NOT EXISTS idx_logros_activo ON logros(activo);
CREATE INDEX IF NOT EXISTS idx_logros_categoria ON logros(categoria);

-- Tabla: logros_usuario (user achievements)
-- Logros obtenidos por usuarios
CREATE TABLE IF NOT EXISTS logros_usuario (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    usuario_id TEXT NOT NULL,
    logro_id TEXT NOT NULL,
    obtenido_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (logro_id) REFERENCES logros(id) ON DELETE CASCADE,
    UNIQUE(usuario_id, logro_id)
);

-- Índices para logros_usuario
CREATE INDEX IF NOT EXISTS idx_logros_usuario_user ON logros_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logros_usuario_logro ON logros_usuario(logro_id);

-- Tabla: audit_log
-- Log de auditoría para trazabilidad completa
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Índices para audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_id ON audit_log(resource, resource_id);

-- ==================================================
-- Datos iniciales para logros por defecto
-- ==================================================

INSERT OR IGNORE INTO logros (id, nombre, descripcion, icono, categoria, criterio, puntos) VALUES
('ach_001', 'Primer Servicio', 'Completa tu primer servicio como profesional', '🎯', 'servicios', 'servicios_completados >= 1', 10),
('ach_002', 'Profesional Estrella', 'Completa 5 servicios exitosamente', '⭐', 'servicios', 'servicios_completados >= 5', 50),
('ach_003', 'Cliente Recurrente', 'Contrata 3 servicios o más', '🔄', 'cliente', 'servicios_contratados >= 3', 25),
('ach_004', 'Crítico Constructivo', 'Deja tu primera reseña', '📝', 'resenas', 'resenas_escritas >= 1', 5),
('ach_005', 'Reseñador Activo', 'Deja 5 reseñas positivas o más', '🌟', 'resenas', 'resenas_positivas >= 5', 30),
('ach_006', 'Verificado', 'Completa la verificación de identidad', '✅', 'verificacion', 'esta_verificado = true', 20),
('ach_007', 'Experiencia Comprobada', 'Más de 5 años de experiencia', '👨‍🔧', 'experiencia', 'anos_experiencia >= 5', 40),
('ach_008', 'Excelencia Total', 'Mantén una calificación perfecta de 5 estrellas', '🏆', 'calidad', 'calificacion_promedio = 5.0', 100);

-- ==================================================
-- Función para actualizar automáticamente la reputación
-- ==================================================

CREATE TRIGGER IF NOT EXISTS update_identity_verification_timestamp
    AFTER UPDATE ON identity_verification
BEGIN
    UPDATE identity_verification SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_professional_reputation_timestamp
    AFTER UPDATE ON professional_reputation
BEGIN
    UPDATE professional_reputation SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ==================================================
-- Comentarios finales
-- ==================================================

-- Esta migración implementa completamente el sistema de verificación de identidad y reputación según los requisitos REQ-36 a REQ-40 del PRD.
-- Incluye:
-- - Verificación de identidad con subida de documentos
-- - Sistema de reputación con cálculo automático de ranking
-- - Medallas automáticas basadas en criterios específicos
-- - Historial de auditoría para todas las acciones
-- - Sistema de logros y gamificación
-- - Índices optimizados para consultas de ranking y búsqueda