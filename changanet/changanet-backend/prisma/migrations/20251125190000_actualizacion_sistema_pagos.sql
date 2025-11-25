-- Migración para actualizar el sistema de pagos con nuevas funcionalidades
-- Esta migración corrige inconsistencias y agrega nuevas capacidades

-- 1. Agregar campos faltantes a la tabla pagos
ALTER TABLE pagos ADD COLUMN mercado_pago_preference_id TEXT;
ALTER TABLE pagos ADD COLUMN metadata TEXT;
ALTER TABLE pagos ADD COLUMN webhook_procesado BOOLEAN DEFAULT 0;
ALTER TABLE pagos ADD COLUMN ultimo_webhook_procesado_en DATETIME;
ALTER TABLE pagos ADD COLUMN intentos_webhook INTEGER DEFAULT 0;
ALTER TABLE pagos ADD COLUMN fecha_liberacion_programada DATETIME;

-- 2. Crear índice para el nuevo campo preference_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_preference_id ON pagos(mercado_pago_preference_id);

-- 3. Crear tabla para eventos de pagos (audit trail)
CREATE TABLE IF NOT EXISTS eventos_pagos (
  id TEXT PRIMARY KEY,
  pago_id TEXT NOT NULL,
  tipo_evento TEXT NOT NULL,
  datos TEXT NOT NULL,
  procesado BOOLEAN DEFAULT 0,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE
);

-- 4. Crear tabla para disputas de pagos
CREATE TABLE IF NOT EXISTS disputas_pagos (
  id TEXT PRIMARY KEY,
  pago_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  motivo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'abierta',
  fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_resolucion DATETIME,
  resolucion TEXT,
  notas_admin TEXT,
  reembolso_monto REAL,
  FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 5. Crear índices para nuevas tablas
CREATE INDEX IF NOT EXISTS idx_eventos_pagos_pago_tipo ON eventos_pagos(pago_id, tipo_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_pagos_procesado ON eventos_pagos(procesado);
CREATE INDEX IF NOT EXISTS idx_disputas_pagos_pago ON disputas_pagos(pago_id);
CREATE INDEX IF NOT EXISTS idx_disputas_pagos_usuario ON disputas_pagos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_disputas_pagos_estado ON disputas_pagos(estado);

-- 6. Actualizar constraints para estados de pago
-- Permitir nuevos estados: 'en_disputa', 'reembolsado_parcial', 'cancelado'
-- (No necesitamos modificar el constraint, solo documentamos los estados válidos)

-- 7. Crear trigger para actualizar updated_at en la tabla pagos
CREATE TRIGGER IF NOT EXISTS update_pagos_timestamp 
AFTER UPDATE ON pagos
BEGIN
  UPDATE pagos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;