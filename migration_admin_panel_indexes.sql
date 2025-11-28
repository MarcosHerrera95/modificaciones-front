-- Migration: Add missing indexes for admin panel performance
-- Generated for admin panel optimization
-- Run this migration on production database

-- Indexes for usuarios table (users)
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado ON usuarios(bloqueado);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios USING gin (to_tsvector('spanish', nombre));
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios USING gin (to_tsvector('spanish', email));

-- Indexes for servicios table (services)
CREATE INDEX IF NOT EXISTS idx_servicios_descripcion ON servicios USING gin (to_tsvector('spanish', descripcion));

-- Indexes for specialties table (categories)
CREATE INDEX IF NOT EXISTS idx_specialties_name ON specialties USING gin (to_tsvector('spanish', name));

-- Additional indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_bloqueado ON usuarios(rol, bloqueado);
CREATE INDEX IF NOT EXISTS idx_usuarios_verificado_bloqueado ON usuarios(esta_verificado, bloqueado);
CREATE INDEX IF NOT EXISTS idx_servicios_estado_urgente ON servicios(estado, es_urgente);
CREATE INDEX IF NOT EXISTS idx_pagos_estado_fecha ON pagos(estado, fecha_pago);