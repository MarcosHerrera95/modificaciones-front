-- Migración para optimizar el rendimiento del chat
-- Agrega índices adicionales para consultas frecuentes del sistema de mensajería

-- Índices optimizados para la tabla mensajes
CREATE INDEX IF NOT EXISTS idx_mensajes_status_sender 
ON mensajes(status, sender_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_image_url 
ON mensajes(image_url);

CREATE INDEX IF NOT EXISTS idx_mensajes_conversation_status 
ON mensajes(conversation_id, status);

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_mensajes_conversation_status_created 
ON mensajes(conversation_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_mensajes_sender_status_created 
ON mensajes(sender_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_mensajes_conversation_sender_status 
ON mensajes(conversation_id, sender_id, status);

-- Índices para la tabla conversations
CREATE INDEX IF NOT EXISTS idx_conversations_last_message 
ON conversations(last_message_at);

CREATE INDEX IF NOT EXISTS idx_conversations_active_updated 
ON conversations(is_active, updated_at);

-- Estadísticas de la migración
-- Esta migración mejora significativamente el rendimiento de:
-- 1. Carga de historial de mensajes con filtros de estado
-- 2. Búsqueda de mensajes por imagen
-- 3. Consultas de conversaciones activas
-- 4. Actualización de estados de mensajes (sent/delivered/read)
-- 5. Optimización de consultas de typing indicators

SELECT 'Índices de optimización del chat creados exitosamente' as resultado;