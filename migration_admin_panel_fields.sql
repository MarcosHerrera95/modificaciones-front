-- Migration: Fix inconsistent field names for admin panel
-- Generated for admin panel field consistency
-- Run this migration on production database

-- Rename columns in usuarios table
ALTER TABLE usuarios RENAME COLUMN bloqueado_hasta TO bloqueado_en;

-- Add missing columns to usuarios table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_por TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS motivo_bloqueo TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol_cambiado_en TIMESTAMP WITH TIME ZONE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol_cambiado_por TEXT;

-- Rename columns in verification_requests table
ALTER TABLE verification_requests RENAME COLUMN revisado_en TO fecha_revision;
ALTER TABLE verification_requests RENAME COLUMN comentario_admin TO motivo_rechazo;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado_por ON usuarios(bloqueado_por);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_cambiado_por ON usuarios(rol_cambiado_por);
CREATE INDEX IF NOT EXISTS idx_verification_requests_fecha_revision ON verification_requests(fecha_revision);