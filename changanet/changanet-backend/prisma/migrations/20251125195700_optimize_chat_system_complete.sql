-- Migración para optimizar completamente el sistema de chat
-- Fecha: 25 de Noviembre, 2025
-- Propósito: Crear estructura de datos optimizada para chat según análisis técnico

-- =============================================
-- 1. TABLA DE CONVERSACIONES NORMALIZADA
-- =============================================

-- Crear tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    professional_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    last_message_at TIMESTAMP NULL,
    last_message_preview TEXT NULL,
    message_count INTEGER DEFAULT 0,
    unread_count_client INTEGER DEFAULT 0,
    unread_count_professional INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices y constraints
    FOREIGN KEY (client_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (professional_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Un cliente y un profesional pueden tener solo una conversación activa
    CONSTRAINT unique_active_conversation 
        UNIQUE (client_id, professional_id, status) 
        DEFERRABLE INITIALLY DEFERRED,
    
    -- Índices para optimización
    INDEX idx_conversations_status (status),
    INDEX idx_conversations_client (client_id, status),
    INDEX idx_conversations_professional (professional_id, status),
    INDEX idx_conversations_last_message (last_message_at DESC),
    INDEX idx_conversations_updated (updated_at DESC),
    INDEX idx_conversations_unread_client (client_id, unread_count_client),
    INDEX idx_conversations_unread_professional (professional_id, unread_count_professional)
);

-- =============================================
-- 2. TABLA DE MENSAJES OPTIMIZADA
-- =============================================

-- Actualizar tabla de mensajes existente
ALTER TABLE mensajes 
ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
ADD COLUMN IF NOT EXISTS file_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
ADD COLUMN IF NOT EXISTS reply_to_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metadata TEXT; -- JSON para datos adicionales

-- Agregar foreign key a conversaciones
ALTER TABLE mensajes 
ADD CONSTRAINT IF NOT EXISTS fk_mensajes_conversation 
FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- Índices optimizados para mensajes
CREATE INDEX IF NOT EXISTS idx_mensajes_conversation_created 
ON mensajes(conversation_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_mensajes_conversation_status 
ON mensajes(conversation_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_mensajes_sender_created 
ON mensajes(remitente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensajes_unread 
ON mensajes(conversation_id, destinatario_id, esta_leido) WHERE esta_leido = FALSE;

CREATE INDEX IF NOT EXISTS idx_mensajes_type 
ON mensajes(conversation_id, message_type, created_at);

-- =============================================
-- 3. TABLA DE INDICADORES DE ESCRITURA
-- =============================================

CREATE TABLE IF NOT EXISTS typing_indicators (
    id VARCHAR(255) PRIMARY KEY DEFAULT 'lower(hex(randomblob(16)))',
    conversation_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    is_typing BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    UNIQUE INDEX idx_typing_unique 
    ON typing_indicators(conversation_id, user_id),
    
    INDEX idx_typing_conversation (conversation_id),
    INDEX idx_typing_activity (last_activity),
    INDEX idx_typing_user (user_id)
);

-- =============================================
-- 4. TABLA DE ESTADO DE CONEXIÓN
-- =============================================

CREATE TABLE IF NOT EXISTS chat_connections (
    id VARCHAR(255) PRIMARY KEY DEFAULT 'lower(hex(randomblob(16)))',
    user_id VARCHAR(255) NOT NULL,
    socket_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    connected_at TIMESTAMP NULL,
    disconnected_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    INDEX idx_connections_user (user_id),
    INDEX idx_connections_online (is_online, last_seen),
    INDEX idx_connections_activity (last_seen DESC),
    INDEX idx_connections_socket (socket_id)
);

-- =============================================
-- 5. TABLA DE NOTIFICACIONES DE CHAT
-- =============================================

CREATE TABLE IF NOT EXISTS chat_notifications (
    id VARCHAR(255) PRIMARY KEY DEFAULT 'lower(hex(randomblob(16)))',
    user_id VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255) NOT NULL,
    sender_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'message', 'typing', 'read'
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data TEXT, -- JSON con datos adicionales
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    INDEX idx_notifications_user_unread (user_id, is_read, sent_at DESC),
    INDEX idx_notifications_conversation (conversation_id, sent_at DESC),
    INDEX idx_notifications_type (notification_type, sent_at DESC),
    INDEX idx_notifications_expires (expires_at)
);

-- =============================================
-- 6. TABLA DE CONFIGURACIÓN DE CHAT POR USUARIO
-- =============================================

CREATE TABLE IF NOT EXISTS chat_user_settings (
    id VARCHAR(255) PRIMARY KEY DEFAULT 'lower(hex(randomblob(16)))',
    user_id VARCHAR(255) NOT NULL UNIQUE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    auto_mark_read BOOLEAN DEFAULT TRUE,
    show_online_status BOOLEAN DEFAULT TRUE,
    allow_message_from_strangers BOOLEAN DEFAULT FALSE,
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'es',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    INDEX idx_user_settings_user (user_id),
    INDEX idx_user_settings_notifications (notifications_enabled)
);

-- =============================================
-- 7. TABLA DE MÉTRICAS Y ESTADÍSTICAS
-- =============================================

CREATE TABLE IF NOT EXISTS chat_metrics (
    id VARCHAR(255) PRIMARY KEY DEFAULT 'lower(hex(randomblob(16)))',
    user_id VARCHAR(255),
    conversation_id VARCHAR(255),
    metric_type VARCHAR(50) NOT NULL, -- 'message_sent', 'message_received', 'conversation_started', etc.
    value INTEGER DEFAULT 1,
    metadata TEXT, -- JSON con datos adicionales
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    
    INDEX idx_metrics_user_date (user_id, recorded_at DESC),
    INDEX idx_metrics_conversation_date (conversation_id, recorded_at DESC),
    INDEX idx_metrics_type_date (metric_type, recorded_at DESC)
);

-- =============================================
-- 8. VISTAS PARA OPTIMIZACIÓN
-- =============================================

-- Vista para conversaciones con información de participantes
CREATE VIEW IF NOT EXISTS conversations_view AS
SELECT 
    c.*,
    u1.nombre as client_name,
    u1.rol as client_role,
    u1.url_foto_perfil as client_photo,
    u2.nombre as professional_name,
    u2.rol as professional_role,
    u2.url_foto_perfil as professional_photo,
    -- Información del último mensaje
    m.id as last_message_id,
    m.contenido as last_message_content,
    m.message_type as last_message_type,
    m.creado_en as last_message_time,
    m.remitente_id as last_message_sender_id,
    u3.nombre as last_message_sender_name
FROM conversations c
JOIN usuarios u1 ON c.client_id = u1.id
JOIN usuarios u2 ON c.professional_id = u2.id
LEFT JOIN mensajes m ON c.id = m.conversation_id
LEFT JOIN usuarios u3 ON m.remitente_id = u3.id
WHERE c.status = 'active'
ORDER BY c.last_message_at DESC NULLS LAST;

-- Vista para mensajes con información del remitente
CREATE VIEW IF NOT EXISTS messages_with_sender AS
SELECT 
    m.*,
    u.nombre as sender_name,
    u.rol as sender_role,
    u.url_foto_perfil as sender_photo,
    c.client_id,
    c.professional_id
FROM mensajes m
JOIN usuarios u ON m.remitente_id = u.id
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE m.is_deleted = FALSE;

-- =============================================
-- 9. TRIGGERS PARA AUTOMATIZACIÓN
-- =============================================

-- Función para actualizar contador de mensajes en conversación
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET 
        message_count = message_count + 1,
        last_message_at = NEW.creado_en,
        last_message_preview = CASE 
            WHEN NEW.message_type = 'text' THEN SUBSTR(NEW.contenido, 1, 100)
            WHEN NEW.message_type = 'image' THEN '[Imagen]'
            WHEN NEW.message_type = 'file' THEN '[Archivo]'
            ELSE '[Mensaje]'
        END,
        unread_count_client = CASE 
            WHEN NEW.remitente_id != client_id THEN unread_count_client + 1
            ELSE unread_count_client
        END,
        unread_count_professional = CASE 
            WHEN NEW.remitente_id != professional_id THEN unread_count_professional + 1
            ELSE unread_count_professional
        END
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar contador al insertar mensaje
DROP TRIGGER IF EXISTS trigger_update_message_count ON mensajes;
CREATE TRIGGER trigger_update_message_count
    AFTER INSERT ON mensajes
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_message_count();

-- Función para limpiar indicadores de typing expirados
CREATE OR REPLACE FUNCTION cleanup_typing_indicators()
RETURNS TRIGGER AS $$
BEGIN
    -- Marcar como no typing si ha pasado más de 10 segundos sin actividad
    UPDATE typing_indicators 
    SET is_typing = FALSE, last_activity = CURRENT_TIMESTAMP
    WHERE conversation_id = OLD.conversation_id 
        AND user_id = OLD.user_id 
        AND is_typing = TRUE
        AND last_activity < CURRENT_TIMESTAMP - INTERVAL '10 seconds';
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger para limpieza de typing indicators
DROP TRIGGER IF EXISTS trigger_cleanup_typing ON typing_indicators;
CREATE TRIGGER trigger_cleanup_typing
    AFTER UPDATE ON typing_indicators
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_typing_indicators();

-- =============================================
-- 10. DATOS INICIALES Y CONFIGURACIÓN
-- =============================================

-- Insertar configuración por defecto para usuarios existentes
INSERT INTO chat_user_settings (user_id, notifications_enabled, sound_enabled, auto_mark_read, show_online_status)
SELECT 
    id as user_id,
    COALESCE(notificaciones_mensajes, TRUE) as notifications_enabled,
    TRUE as sound_enabled,
    TRUE as auto_mark_read,
    TRUE as show_online_status
FROM usuarios
WHERE id NOT IN (SELECT user_id FROM chat_user_settings WHERE user_id IS NOT NULL);

-- =============================================
-- 11. PROCEDIMIENTOS ALMACENADOS ÚTILES
-- =============================================

-- Procedimiento para obtener conversaciones de un usuario
CREATE OR REPLACE FUNCTION get_user_conversations(user_id_param VARCHAR(255), limit_param INTEGER DEFAULT 50)
RETURNS TABLE (
    conversation_id VARCHAR(255),
    other_user_id VARCHAR(255),
    other_user_name VARCHAR(255),
    other_user_photo VARCHAR(255),
    other_user_role VARCHAR(255),
    last_message_content TEXT,
    last_message_time TIMESTAMP,
    last_message_type VARCHAR(20),
    last_message_sender_id VARCHAR(255),
    unread_count INTEGER,
    is_online BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN c.client_id = user_id_param THEN c.professional_id ELSE c.client_id END as other_user_id,
        u.nombre as other_user_name,
        u.url_foto_perfil as other_user_photo,
        u.rol as other_user_role,
        COALESCE(m.contenido, '') as last_message_content,
        m.creado_en as last_message_time,
        COALESCE(m.message_type, 'text') as last_message_type,
        m.remitente_id as last_message_sender_id,
        CASE WHEN c.client_id = user_id_param THEN c.unread_count_client ELSE c.unread_count_professional END as unread_count,
        COALESCE(cc.is_online, FALSE) as is_online
    FROM conversations c
    JOIN usuarios u ON (u.id = CASE WHEN c.client_id = user_id_param THEN c.professional_id ELSE c.client_id END)
    LEFT JOIN mensajes m ON c.id = m.conversation_id AND m.creado_en = c.last_message_at
    LEFT JOIN chat_connections cc ON cc.user_id = u.id AND cc.is_online = TRUE
    WHERE c.status = 'active' 
        AND (c.client_id = user_id_param OR c.professional_id = user_id_param)
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 12. ÍNDICES ADICIONALES PARA RENDIMIENTO
-- =============================================

-- Índices compuestos para consultas comunes
CREATE INDEX IF NOT EXISTS idx_conversations_user_status_unread 
ON conversations ((CASE WHEN client_id = professional_id THEN professional_id ELSE client_id END), status, unread_count_client DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_conversation 
ON mensajes(remitente_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_unread 
ON mensajes(conversation_id, destinatario_id, esta_leido, created_at DESC) WHERE esta_leido = FALSE;

-- =============================================
-- 13. OPTIMIZACIÓN DE CONSULTAS
-- =============================================

-- Habilitar extensiones útiles si están disponibles
-- CREATE EXTENSION IF NOT EXISTS pg_trgm; -- Para búsqueda similarity
-- CREATE EXTENSION IF NOT EXISTS btree_gin; -- Para índices GIN

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================

-- Comentarios finales
-- Esta migración optimiza completamente el sistema de chat creando:
-- 1. Tabla de conversaciones normalizada
-- 2. Mensajes mejorados con metadata y tipos
-- 3. Indicadores de escritura
-- 4. Sistema de conexiones en tiempo real
-- 5. Notificaciones optimizadas
-- 6. Configuración por usuario
-- 7. Métricas y estadísticas
-- 8. Vistas optimizadas
-- 9. Triggers para automatización
-- 10. Procedimientos almacenados
-- 11. Índices para máximo rendimiento

-- NOTA: Esta migración mantiene compatibilidad con datos existentes
-- y añade nuevas funcionalidades sin romper el sistema actual.