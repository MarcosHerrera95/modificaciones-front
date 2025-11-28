-- Migration: Enhanced Payments and Commissions Module
-- CHANGANET - Adds enums, Json types, audit fields, and optimized indexes
-- Generated: 2025-11-28

-- Create custom enums
CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDIENTE',
  'APROBADO',
  'LIBERADO',
  'CANCELADO',
  'REEMBOLSADO',
  'EXPIRADO',
  'FALLIDO'
);

CREATE TYPE "WithdrawalStatus" AS ENUM (
  'PROCESANDO',
  'PENDIENTE_VERIFICACION',
  'EN_PROCESO',
  'COMPLETADO',
  'RECHAZADO',
  'CANCELADO',
  'FALLIDO'
);

CREATE TYPE "CommissionType" AS ENUM (
  'PLATAFORMA',
  'PROCESAMIENTO',
  'RETIRO',
  'AJUSTE',
  'REEMBOLSO'
);

CREATE TYPE "CommissionEventType" AS ENUM (
  'APLICADA',
  'AJUSTADA',
  'REEMBOLSADA',
  'CANCELADA'
);

-- Add new columns to existing pagos table
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "monto_procesamiento" FLOAT DEFAULT 0;
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "fecha_expiracion_preference" TIMESTAMP;
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "datos_adicionales" JSONB;
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "max_intentos_webhook" INTEGER DEFAULT 5;
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "referencia_externa" VARCHAR(255);
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "notas_admin" TEXT;

-- Audit fields for pagos
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "creado_por" VARCHAR(255);
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "actualizado_por" VARCHAR(255);
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;

-- Change estado column to use enum (requires data migration)
-- First, ensure all existing values are valid enum values
UPDATE "pagos" SET "estado" = 'PENDIENTE' WHERE "estado" NOT IN ('PENDIENTE', 'APROBADO', 'LIBERADO', 'CANCELADO', 'REEMBOLSADO', 'EXPIRADO', 'FALLIDO');
ALTER TABLE "pagos" ALTER COLUMN "estado" TYPE "PaymentStatus" USING "estado"::"PaymentStatus";

-- Add new indexes for pagos
CREATE INDEX IF NOT EXISTS "pagos_estado_fecha_liberacion_programada_idx" ON "pagos"("estado", "fecha_liberacion_programada");
CREATE INDEX IF NOT EXISTS "pagos_profesional_id_estado_fecha_pago_idx" ON "pagos"("profesional_id", "estado", "fecha_pago");
CREATE INDEX IF NOT EXISTS "pagos_cliente_id_estado_creado_en_idx" ON "pagos"("cliente_id", "estado", "creado_en");
CREATE INDEX IF NOT EXISTS "pagos_referencia_externa_idx" ON "pagos"("referencia_externa");
CREATE INDEX IF NOT EXISTS "pagos_fecha_pago_idx" ON "pagos"("fecha_pago");

-- Enhance cuentas_bancarias table
ALTER TABLE "cuentas_bancarias" ADD COLUMN IF NOT EXISTS "tipo_cuenta" VARCHAR(50);
ALTER TABLE "cuentas_bancarias" ADD COLUMN IF NOT EXISTS "fecha_verificacion" TIMESTAMP;
ALTER TABLE "cuentas_bancarias" ADD COLUMN IF NOT EXISTS "verificada_por" VARCHAR(255);
ALTER TABLE "cuentas_bancarias" ADD COLUMN IF NOT EXISTS "datos_adicionales" JSONB;

-- Audit fields for cuentas_bancarias
ALTER TABLE "cuentas_bancarias" ADD COLUMN IF NOT EXISTS "creado_por" VARCHAR(255);
ALTER TABLE "cuentas_bancarias" ADD COLUMN IF NOT EXISTS "actualizado_por" VARCHAR(255);

-- Add indexes for cuentas_bancarias
CREATE INDEX IF NOT EXISTS "cuentas_bancarias_profesional_id_verificada_idx" ON "cuentas_bancarias"("profesional_id", "verificada");
CREATE INDEX IF NOT EXISTS "cuentas_bancarias_es_principal_idx" ON "cuentas_bancarias"("es_principal");

-- Enhance retiros table
ALTER TABLE "retiros" ADD COLUMN IF NOT EXISTS "monto_comision" FLOAT DEFAULT 0;
ALTER TABLE "retiros" ADD COLUMN IF NOT EXISTS "monto_final" FLOAT;
ALTER TABLE "retiros" ADD COLUMN IF NOT EXISTS "procesado_por" VARCHAR(255);
ALTER TABLE "retiros" ADD COLUMN IF NOT EXISTS "datos_adicionales" JSONB;

-- Update existing monto_final values
UPDATE "retiros" SET "monto_final" = "monto" - "monto_comision" WHERE "monto_final" IS NULL;

-- Make monto_final NOT NULL after populating
ALTER TABLE "retiros" ALTER COLUMN "monto_final" SET NOT NULL;

-- Change estado column to use enum
UPDATE "retiros" SET "estado" = 'PROCESANDO' WHERE "estado" NOT IN ('PROCESANDO', 'PENDIENTE_VERIFICACION', 'EN_PROCESO', 'COMPLETADO', 'RECHAZADO', 'CANCELADO', 'FALLIDO');
ALTER TABLE "retiros" ALTER COLUMN "estado" TYPE "WithdrawalStatus" USING "estado"::"WithdrawalStatus";

-- Audit fields for retiros
ALTER TABLE "retiros" ADD COLUMN IF NOT EXISTS "creado_por" VARCHAR(255);
ALTER TABLE "retiros" ADD COLUMN IF NOT EXISTS "actualizado_por" VARCHAR(255);

-- Add indexes for retiros
CREATE INDEX IF NOT EXISTS "retiros_estado_fecha_solicitud_idx" ON "retiros"("estado", "fecha_solicitud");
CREATE INDEX IF NOT EXISTS "retiros_profesional_id_estado_fecha_solicitud_idx" ON "retiros"("profesional_id", "estado", "fecha_solicitud");
CREATE INDEX IF NOT EXISTS "retiros_procesado_por_idx" ON "retiros"("procesado_por");
CREATE INDEX IF NOT EXISTS "retiros_referencia_bancaria_idx" ON "retiros"("referencia_bancaria");

-- Create commission_history table
CREATE TABLE IF NOT EXISTS "comisiones_historial" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pago_id" VARCHAR(25),
  "retiro_id" VARCHAR(25),
  "servicio_id" VARCHAR(25),
  "tipo" "CommissionType" NOT NULL,
  "evento" "CommissionEventType" NOT NULL,
  "monto" FLOAT NOT NULL,
  "porcentaje" FLOAT,
  "descripcion" TEXT NOT NULL,
  "referencia" VARCHAR(255),
  "datos_adicionales" JSONB,
  "aplicado_por" VARCHAR(255),
  "aprobado_por" VARCHAR(255),
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "comisiones_historial_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE SET NULL,
  CONSTRAINT "comisiones_historial_retiro_id_fkey" FOREIGN KEY ("retiro_id") REFERENCES "retiros"("id") ON DELETE SET NULL,
  CONSTRAINT "comisiones_historial_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE SET NULL
);

-- Indexes for comisiones_historial
CREATE INDEX IF NOT EXISTS "comisiones_historial_pago_id_idx" ON "comisiones_historial"("pago_id");
CREATE INDEX IF NOT EXISTS "comisiones_historial_retiro_id_idx" ON "comisiones_historial"("retiro_id");
CREATE INDEX IF NOT EXISTS "comisiones_historial_servicio_id_idx" ON "comisiones_historial"("servicio_id");
CREATE INDEX IF NOT EXISTS "comisiones_historial_tipo_idx" ON "comisiones_historial"("tipo");
CREATE INDEX IF NOT EXISTS "comisiones_historial_evento_idx" ON "comisiones_historial"("evento");
CREATE INDEX IF NOT EXISTS "comisiones_historial_creado_en_idx" ON "comisiones_historial"("creado_en");
CREATE INDEX IF NOT EXISTS "comisiones_historial_tipo_evento_creado_en_idx" ON "comisiones_historial"("tipo", "evento", "creado_en");
CREATE INDEX IF NOT EXISTS "comisiones_historial_aplicado_por_idx" ON "comisiones_historial"("aplicado_por");
CREATE INDEX IF NOT EXISTS "comisiones_historial_aprobado_por_idx" ON "comisiones_historial"("aprobado_por");

-- Enhance commission_settings table
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "nombre" VARCHAR(255) UNIQUE;
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "tipo" "CommissionType";
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "monto_maximo" FLOAT;
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "fecha_inicio" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "fecha_fin" TIMESTAMP;
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "condiciones" JSONB;
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "descripcion" TEXT;

-- Update existing records to have tipo
UPDATE "commission_settings" SET "tipo" = 'PLATAFORMA' WHERE "tipo" IS NULL;
ALTER TABLE "commission_settings" ALTER COLUMN "tipo" SET NOT NULL;

-- Update nombre for existing records
UPDATE "commission_settings" SET "nombre" = 'Comisión Plataforma Estándar' WHERE "nombre" IS NULL AND "id" = (SELECT MIN("id") FROM "commission_settings");

-- Audit fields for commission_settings
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "creado_por" VARCHAR(255);
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "actualizado_por" VARCHAR(255);
ALTER TABLE "commission_settings" ADD COLUMN IF NOT EXISTS "aprobado_por" VARCHAR(255);

-- Add indexes for commission_settings
CREATE INDEX IF NOT EXISTS "commission_settings_tipo_activo_fecha_inicio_idx" ON "commission_settings"("tipo", "activo", "fecha_inicio");

-- Enhance eventos_pagos table
ALTER TABLE "eventos_pagos" ADD COLUMN IF NOT EXISTS "procesado_en" TIMESTAMP;
ALTER TABLE "eventos_pagos" ADD COLUMN IF NOT EXISTS "procesado_por" VARCHAR(255);

-- Add indexes for eventos_pagos
CREATE INDEX IF NOT EXISTS "eventos_pagos_pago_id_procesado_creado_en_idx" ON "eventos_pagos"("pago_id", "procesado", "creado_en");

-- Enhance disputas_pagos table
ALTER TABLE "disputas_pagos" ADD COLUMN IF NOT EXISTS "evidencia_urls" JSONB;
ALTER TABLE "disputas_pagos" ADD COLUMN IF NOT EXISTS "reembolso_procesado" BOOLEAN DEFAULT FALSE;
ALTER TABLE "disputas_pagos" ADD COLUMN IF NOT EXISTS "reembolso_procesado_en" TIMESTAMP;

-- Audit fields for disputas_pagos
ALTER TABLE "disputas_pagos" ADD COLUMN IF NOT EXISTS "resuelto_por" VARCHAR(255);

-- Add indexes for disputas_pagos
CREATE INDEX IF NOT EXISTS "disputas_pagos_tipo_idx" ON "disputas_pagos"("tipo");
CREATE INDEX IF NOT EXISTS "disputas_pagos_estado_fecha_apertura_idx" ON "disputas_pagos"("estado", "fecha_apertura");
CREATE INDEX IF NOT EXISTS "disputas_pagos_resuelto_por_idx" ON "disputas_pagos"("resuelto_por");

-- Create trigger for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."actualizado_en" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_pagos_updated_at ON "pagos";
CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON "pagos" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cuentas_bancarias_updated_at ON "cuentas_bancarias";
CREATE TRIGGER update_cuentas_bancarias_updated_at BEFORE UPDATE ON "cuentas_bancarias" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retiros_updated_at ON "retiros";
CREATE TRIGGER update_retiros_updated_at BEFORE UPDATE ON "retiros" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_settings_updated_at ON "commission_settings";
CREATE TRIGGER update_commission_settings_updated_at BEFORE UPDATE ON "commission_settings" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_disputas_pagos_updated_at ON "disputas_pagos";
CREATE TRIGGER update_disputas_pagos_updated_at BEFORE UPDATE ON "disputas_pagos" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comisiones_historial_updated_at ON "comisiones_historial";
CREATE TRIGGER update_comisiones_historial_updated_at BEFORE UPDATE ON "comisiones_historial" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add check constraints for data validation
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_comision_plataforma_check" CHECK ("comision_plataforma" >= 0);
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_monto_total_check" CHECK ("monto_total" >= 0);
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_monto_profesional_check" CHECK ("monto_profesional" >= 0);

ALTER TABLE "retiros" ADD CONSTRAINT "retiros_monto_check" CHECK ("monto" >= 0);
ALTER TABLE "retiros" ADD CONSTRAINT "retiros_monto_comision_check" CHECK ("monto_comision" >= 0);

ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_porcentaje_check" CHECK ("porcentaje" >= 0 AND "porcentaje" <= 1);
ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_monto_minimo_check" CHECK ("monto_minimo" >= 0);

-- Comments for documentation
COMMENT ON TABLE "comisiones_historial" IS 'Historial completo de comisiones aplicadas, ajustes y reembolsos';
COMMENT ON COLUMN "pagos"."datos_adicionales" IS 'Campos personalizados para tipos específicos de pago';
COMMENT ON COLUMN "pagos"."referencia_externa" IS 'Referencia externa para conciliación bancaria';
COMMENT ON COLUMN "cuentas_bancarias"."cvu" IS 'Código único de cuenta virtual - exactamente 22 dígitos';
COMMENT ON COLUMN "commission_settings"."condiciones" IS 'Condiciones JSON para aplicar esta comisión específica';