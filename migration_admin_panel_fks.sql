-- Migration: Add missing foreign key constraints for admin panel
-- Generated for admin panel data integrity
-- Run this migration on production database

-- Add FK for verification_requests.revisado_por -> admin_users.id
ALTER TABLE verification_requests
ADD CONSTRAINT fk_verification_requests_revisado_por
FOREIGN KEY (revisado_por) REFERENCES admin_users(id) ON DELETE SET NULL;

-- Add FK for pagos.creado_por -> admin_users.id
ALTER TABLE pagos
ADD CONSTRAINT fk_pagos_creado_por
FOREIGN KEY (creado_por) REFERENCES admin_users(id) ON DELETE SET NULL;

-- Add FK for pagos.actualizado_por -> admin_users.id
ALTER TABLE pagos
ADD CONSTRAINT fk_pagos_actualizado_por
FOREIGN KEY (actualizado_por) REFERENCES admin_users(id) ON DELETE SET NULL;

-- Add FK for cuentas_bancarias.verificada_por -> admin_users.id
ALTER TABLE cuentas_bancarias
ADD CONSTRAINT fk_cuentas_bancarias_verificada_por
FOREIGN KEY (verificada_por) REFERENCES admin_users(id) ON DELETE SET NULL;

-- Add FK for cuentas_bancarias.creado_por -> admin_users.id
ALTER TABLE cuentas_bancarias
ADD CONSTRAINT fk_cuentas_bancarias_creado_por
FOREIGN KEY (creado_por) REFERENCES admin_users(id) ON DELETE SET NULL;

-- Add FK for cuentas_bancarias.actualizado_por -> admin_users.id
ALTER TABLE cuentas_bancarias
ADD CONSTRAINT fk_cuentas_bancarias_actualizado_por
FOREIGN KEY (actualizado_por) REFERENCES admin_users(id) ON DELETE SET NULL;