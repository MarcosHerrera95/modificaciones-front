-- Crear tabla mensajes faltante para el sistema de chat
CREATE TABLE IF NOT EXISTS mensajes (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  message TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'sent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_mensajes_conversation_id ON mensajes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_sender_id ON mensajes(sender_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_status ON mensajes(status);
CREATE INDEX IF NOT EXISTS idx_mensajes_created_at ON mensajes(created_at);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversation_created ON mensajes(conversation_id, created_at);