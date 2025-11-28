-- CHANGANET - Payments and Commissions Module Schema Creation
-- Direct PostgreSQL SQL script - No Prisma required
-- Compatible with environments without Docker
-- Generated: 2025-11-28

-- ===========================================
-- CREATE CUSTOM ENUMS
-- ===========================================

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

-- ===========================================
-- CREATE TABLES
-- ===========================================

-- Simplified usuarios table (reference)
CREATE TABLE IF NOT EXISTS "usuarios" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "nombre" VARCHAR(255) NOT NULL,
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Simplified servicios table (reference)
CREATE TABLE IF NOT EXISTS "servicios" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "descripcion" TEXT NOT NULL,
  "estado" VARCHAR(50) DEFAULT 'PENDIENTE',
  "cliente_id" VARCHAR(25) NOT NULL,
  "profesional_id" VARCHAR(25) NOT NULL,
  "completado_en" TIMESTAMP,
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced pagos table
CREATE TABLE IF NOT EXISTS "pagos" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "servicio_id" VARCHAR(25) NOT NULL UNIQUE,
  "cliente_id" VARCHAR(25) NOT NULL,
  "profesional_id" VARCHAR(25) NOT NULL,
  "monto_total" REAL NOT NULL,
  "comision_plataforma" REAL DEFAULT 0,
  "monto_profesional" REAL NOT NULL,
  "monto_procesamiento" REAL DEFAULT 0,
  "mercado_pago_id" VARCHAR(255) UNIQUE,
  "mercado_pago_preference_id" VARCHAR(255) UNIQUE,
  "estado" "PaymentStatus" DEFAULT 'PENDIENTE',
  "metodo_pago" VARCHAR(255),
  "fecha_pago" TIMESTAMP,
  "fecha_liberacion" TIMESTAMP,
  "fecha_liberacion_programada" TIMESTAMP,
  "fecha_expiracion_preference" TIMESTAMP,
  "url_comprobante" TEXT,
  "metadata" JSONB,
  "datos_adicionales" JSONB,
  "webhook_procesado" BOOLEAN DEFAULT FALSE,
  "ultimo_webhook_procesado_en" TIMESTAMP,
  "intentos_webhook" INTEGER DEFAULT 0,
  "max_intentos_webhook" INTEGER DEFAULT 5,
  "referencia_externa" VARCHAR(255),
  "notas_admin" TEXT,
  "creado_por" VARCHAR(255),
  "actualizado_por" VARCHAR(255),
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER DEFAULT 1,

  CONSTRAINT "pagos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE CASCADE,
  CONSTRAINT "pagos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE,
  CONSTRAINT "pagos_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios"("id") ON DELETE CASCADE
);

-- Enhanced cuentas_bancarias table
CREATE TABLE IF NOT EXISTS "cuentas_bancarias" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "profesional_id" VARCHAR(25) NOT NULL,
  "cvu" VARCHAR(22) NOT NULL UNIQUE,
  "alias" VARCHAR(255) NOT NULL UNIQUE,
  "banco" VARCHAR(255),
  "titular" VARCHAR(255),
  "tipo_cuenta" VARCHAR(50),
  "es_principal" BOOLEAN DEFAULT FALSE,
  "verificada" BOOLEAN DEFAULT FALSE,
  "fecha_verificacion" TIMESTAMP,
  "verificada_por" VARCHAR(255),
  "datos_adicionales" JSONB,
  "creado_por" VARCHAR(255),
  "actualizado_por" VARCHAR(255),
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cuentas_bancarias_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios"("id") ON DELETE CASCADE
);

-- Enhanced retiros table
CREATE TABLE IF NOT EXISTS "retiros" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "profesional_id" VARCHAR(25) NOT NULL,
  "cuenta_id" VARCHAR(25) NOT NULL,
  "monto" REAL NOT NULL,
  "monto_comision" REAL DEFAULT 0,
  "monto_final" REAL NOT NULL,
  "estado" "WithdrawalStatus" DEFAULT 'PROCESANDO',
  "fecha_solicitud" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "fecha_procesado" TIMESTAMP,
  "fecha_acreditado" TIMESTAMP,
  "referencia_bancaria" VARCHAR(255),
  "notas" TEXT,
  "procesado_por" VARCHAR(255),
  "datos_adicionales" JSONB,
  "creado_por" VARCHAR(255),
  "actualizado_por" VARCHAR(255),
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "retiros_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios"("id") ON DELETE CASCADE,
  CONSTRAINT "retiros_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_bancarias"("id") ON DELETE CASCADE
);

-- Commission history table
CREATE TABLE IF NOT EXISTS "comisiones_historial" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pago_id" VARCHAR(25),
  "retiro_id" VARCHAR(25),
  "servicio_id" VARCHAR(25),
  "tipo" "CommissionType" NOT NULL,
  "evento" "CommissionEventType" NOT NULL,
  "monto" REAL NOT NULL,
  "porcentaje" REAL,
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

-- Enhanced commission_settings table
CREATE TABLE IF NOT EXISTS "commission_settings" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "nombre" VARCHAR(255) NOT NULL UNIQUE,
  "tipo" "CommissionType" NOT NULL,
  "porcentaje" REAL NOT NULL,
  "monto_minimo" REAL DEFAULT 0,
  "monto_maximo" REAL,
  "activo" BOOLEAN DEFAULT TRUE,
  "fecha_inicio" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "fecha_fin" TIMESTAMP,
  "condiciones" JSONB,
  "descripcion" TEXT,
  "creado_por" VARCHAR(255),
  "actualizado_por" VARCHAR(255),
  "aprobado_por" VARCHAR(255),
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment events table
CREATE TABLE IF NOT EXISTS "eventos_pagos" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pago_id" VARCHAR(25) NOT NULL,
  "tipo_evento" VARCHAR(255) NOT NULL,
  "datos" JSONB NOT NULL,
  "procesado" BOOLEAN DEFAULT FALSE,
  "procesado_en" TIMESTAMP,
  "procesado_por" VARCHAR(255),
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "eventos_pagos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE CASCADE
);

-- Payment disputes table
CREATE TABLE IF NOT EXISTS "disputas_pagos" (
  "id" VARCHAR(25) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pago_id" VARCHAR(25) NOT NULL,
  "usuario_id" VARCHAR(25) NOT NULL,
  "tipo" VARCHAR(255) NOT NULL,
  "motivo" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "evidencia_urls" JSONB,
  "estado" VARCHAR(50) DEFAULT 'abierta',
  "fecha_apertura" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "fecha_resolucion" TIMESTAMP,
  "resolucion" TEXT,
  "notas_admin" TEXT,
  "reembolso_monto" REAL,
  "reembolso_procesado" BOOLEAN DEFAULT FALSE,
  "reembolso_procesado_en" TIMESTAMP,
  "resuelto_por" VARCHAR(255),
  "creado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "disputas_pagos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE CASCADE,
  CONSTRAINT "disputas_pagos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE
);

-- ===========================================
-- CREATE INDEXES
-- ===========================================

-- usuarios indexes
CREATE INDEX IF NOT EXISTS "usuarios_email_idx" ON "usuarios"("email");

-- servicios indexes
CREATE INDEX IF NOT EXISTS "servicios_estado_idx" ON "servicios"("estado");
CREATE INDEX IF NOT EXISTS "servicios_cliente_id_idx" ON "servicios"("cliente_id");
CREATE INDEX IF NOT EXISTS "servicios_profesional_id_idx" ON "servicios"("profesional_id");

-- pagos indexes
CREATE INDEX IF NOT EXISTS "pagos_estado_idx" ON "pagos"("estado");
CREATE INDEX IF NOT EXISTS "pagos_profesional_id_idx" ON "pagos"("profesional_id");
CREATE INDEX IF NOT EXISTS "pagos_cliente_id_idx" ON "pagos"("cliente_id");
CREATE INDEX IF NOT EXISTS "pagos_webhook_procesado_idx" ON "pagos"("webhook_procesado");
CREATE INDEX IF NOT EXISTS "pagos_fecha_liberacion_programada_idx" ON "pagos"("fecha_liberacion_programada");
CREATE INDEX IF NOT EXISTS "pagos_mercado_pago_preference_id_idx" ON "pagos"("mercado_pago_preference_id");
CREATE INDEX IF NOT EXISTS "pagos_mercado_pago_id_idx" ON "pagos"("mercado_pago_id");
CREATE INDEX IF NOT EXISTS "pagos_fecha_pago_idx" ON "pagos"("fecha_pago");
CREATE INDEX IF NOT EXISTS "pagos_estado_fecha_liberacion_programada_idx" ON "pagos"("estado", "fecha_liberacion_programada");
CREATE INDEX IF NOT EXISTS "pagos_profesional_id_estado_fecha_pago_idx" ON "pagos"("profesional_id", "estado", "fecha_pago");
CREATE INDEX IF NOT EXISTS "pagos_cliente_id_estado_creado_en_idx" ON "pagos"("cliente_id", "estado", "creado_en");
CREATE INDEX IF NOT EXISTS "pagos_referencia_externa_idx" ON "pagos"("referencia_externa");
CREATE INDEX IF NOT EXISTS "pagos_creado_en_idx" ON "pagos"("creado_en");

-- cuentas_bancarias indexes
CREATE INDEX IF NOT EXISTS "cuentas_bancarias_verificada_idx" ON "cuentas_bancarias"("verificada");
CREATE INDEX IF NOT EXISTS "cuentas_bancarias_profesional_id_idx" ON "cuentas_bancarias"("profesional_id");
CREATE INDEX IF NOT EXISTS "cuentas_bancarias_es_principal_idx" ON "cuentas_bancarias"("es_principal");
CREATE INDEX IF NOT EXISTS "cuentas_bancarias_profesional_id_verificada_idx" ON "cuentas_bancarias"("profesional_id", "verificada");
CREATE INDEX IF NOT EXISTS "cuentas_bancarias_creado_en_idx" ON "cuentas_bancarias"("creado_en");

-- retiros indexes
CREATE INDEX IF NOT EXISTS "retiros_fecha_solicitud_idx" ON "retiros"("fecha_solicitud");
CREATE INDEX IF NOT EXISTS "retiros_estado_idx" ON "retiros"("estado");
CREATE INDEX IF NOT EXISTS "retiros_profesional_id_idx" ON "retiros"("profesional_id");
CREATE INDEX IF NOT EXISTS "retiros_estado_fecha_solicitud_idx" ON "retiros"("estado", "fecha_solicitud");
CREATE INDEX IF NOT EXISTS "retiros_profesional_id_estado_fecha_solicitud_idx" ON "retiros"("profesional_id", "estado", "fecha_solicitud");
CREATE INDEX IF NOT EXISTS "retiros_procesado_por_idx" ON "retiros"("procesado_por");
CREATE INDEX IF NOT EXISTS "retiros_referencia_bancaria_idx" ON "retiros"("referencia_bancaria");

-- comisiones_historial indexes
CREATE INDEX IF NOT EXISTS "comisiones_historial_pago_id_idx" ON "comisiones_historial"("pago_id");
CREATE INDEX IF NOT EXISTS "comisiones_historial_retiro_id_idx" ON "comisiones_historial"("retiro_id");
CREATE INDEX IF NOT EXISTS "comisiones_historial_servicio_id_idx" ON "comisiones_historial"("servicio_id");
CREATE INDEX IF NOT EXISTS "comisiones_historial_tipo_idx" ON "comisiones_historial"("tipo");
CREATE INDEX IF NOT EXISTS "comisiones_historial_evento_idx" ON "comisiones_historial"("evento");
CREATE INDEX IF NOT EXISTS "comisiones_historial_creado_en_idx" ON "comisiones_historial"("creado_en");
CREATE INDEX IF NOT EXISTS "comisiones_historial_tipo_evento_creado_en_idx" ON "comisiones_historial"("tipo", "evento", "creado_en");
CREATE INDEX IF NOT EXISTS "comisiones_historial_aplicado_por_idx" ON "comisiones_historial"("aplicado_por");
CREATE INDEX IF NOT EXISTS "comisiones_historial_aprobado_por_idx" ON "comisiones_historial"("aprobado_por");

-- commission_settings indexes
CREATE INDEX IF NOT EXISTS "commission_settings_activo_idx" ON "commission_settings"("activo");
CREATE INDEX IF NOT EXISTS "commission_settings_tipo_idx" ON "commission_settings"("tipo");
CREATE INDEX IF NOT EXISTS "commission_settings_fecha_inicio_idx" ON "commission_settings"("fecha_inicio");
CREATE INDEX IF NOT EXISTS "commission_settings_tipo_activo_fecha_inicio_idx" ON "commission_settings"("tipo", "activo", "fecha_inicio");
CREATE INDEX IF NOT EXISTS "commission_settings_creado_por_idx" ON "commission_settings"("creado_por");
CREATE INDEX IF NOT EXISTS "commission_settings_aprobado_por_idx" ON "commission_settings"("aprobado_por");

-- eventos_pagos indexes
CREATE INDEX IF NOT EXISTS "eventos_pagos_pago_id_tipo_evento_idx" ON "eventos_pagos"("pago_id", "tipo_evento");
CREATE INDEX IF NOT EXISTS "eventos_pagos_procesado_idx" ON "eventos_pagos"("procesado");
CREATE INDEX IF NOT EXISTS "eventos_pagos_creado_en_idx" ON "eventos_pagos"("creado_en");
CREATE INDEX IF NOT EXISTS "eventos_pagos_pago_id_procesado_creado_en_idx" ON "eventos_pagos"("pago_id", "procesado", "creado_en");

-- disputas_pagos indexes
CREATE INDEX IF NOT EXISTS "disputas_pagos_pago_id_idx" ON "disputas_pagos"("pago_id");
CREATE INDEX IF NOT EXISTS "disputas_pagos_usuario_id_idx" ON "disputas_pagos"("usuario_id");
CREATE INDEX IF NOT EXISTS "disputas_pagos_estado_idx" ON "disputas_pagos"("estado");
CREATE INDEX IF NOT EXISTS "disputas_pagos_fecha_apertura_idx" ON "disputas_pagos"("fecha_apertura");
CREATE INDEX IF NOT EXISTS "disputas_pagos_tipo_idx" ON "disputas_pagos"("tipo");
CREATE INDEX IF NOT EXISTS "disputas_pagos_estado_fecha_apertura_idx" ON "disputas_pagos"("estado", "fecha_apertura");
CREATE INDEX IF NOT EXISTS "disputas_pagos_resuelto_por_idx" ON "disputas_pagos"("resuelto_por");

-- ===========================================
-- CREATE TRIGGERS FOR UPDATED_AT
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."actualizado_en" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON "usuarios" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_servicios_updated_at BEFORE UPDATE ON "servicios" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON "pagos" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cuentas_bancarias_updated_at BEFORE UPDATE ON "cuentas_bancarias" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_retiros_updated_at BEFORE UPDATE ON "retiros" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_settings_updated_at BEFORE UPDATE ON "commission_settings" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_disputas_pagos_updated_at BEFORE UPDATE ON "disputas_pagos" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comisiones_historial_updated_at BEFORE UPDATE ON "comisiones_historial" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ADD CHECK CONSTRAINTS
-- ===========================================

ALTER TABLE "pagos" ADD CONSTRAINT "pagos_comision_plataforma_check" CHECK ("comision_plataforma" >= 0);
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_monto_total_check" CHECK ("monto_total" >= 0);
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_monto_profesional_check" CHECK ("monto_profesional" >= 0);

ALTER TABLE "retiros" ADD CONSTRAINT "retiros_monto_check" CHECK ("monto" >= 0);
ALTER TABLE "retiros" ADD CONSTRAINT "retiros_monto_comision_check" CHECK ("monto_comision" >= 0);

ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_porcentaje_check" CHECK ("porcentaje" >= 0 AND "porcentaje" <= 1);
ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_monto_minimo_check" CHECK ("monto_minimo" >= 0);

-- ===========================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ===========================================

COMMENT ON TABLE "comisiones_historial" IS 'Historial completo de comisiones aplicadas, ajustes y reembolsos';
COMMENT ON COLUMN "pagos"."datos_adicionales" IS 'Campos personalizados para tipos específicos de pago';
COMMENT ON COLUMN "pagos"."referencia_externa" IS 'Referencia externa para conciliación bancaria';
COMMENT ON COLUMN "cuentas_bancarias"."cvu" IS 'Código único de cuenta virtual - exactamente 22 dígitos';
COMMENT ON COLUMN "commission_settings"."condiciones" IS 'Condiciones JSON para aplicar esta comisión específica';

-- ===========================================
-- INSERT DEFAULT COMMISSION SETTINGS
-- ===========================================

INSERT INTO "commission_settings" ("id", "nombre", "tipo", "porcentaje", "monto_minimo", "descripcion") VALUES
(gen_random_uuid()::text, 'Comisión Plataforma Estándar', 'PLATAFORMA', 0.05, 0, 'Comisión estándar de plataforma del 5%'),
(gen_random_uuid()::text, 'Comisión Procesamiento MercadoPago', 'PROCESAMIENTO', 0.0399, 0, 'Comisión de procesamiento de MercadoPago'),
(gen_random_uuid()::text, 'Comisión Retiro Bancario', 'RETIRO', 0.01, 0, 'Comisión por retiro bancario del 1%')
ON CONFLICT ("nombre") DO NOTHING;

-- ===========================================
-- SUCCESS MESSAGE
-- ===========================================

DO $$
BEGIN
    RAISE NOTICE 'CHANGANET Payments and Commissions schema created successfully!';
    RAISE NOTICE 'Tables created: usuarios, servicios, pagos, cuentas_bancarias, retiros, comisiones_historial, commission_settings, eventos_pagos, disputas_pagos';
    RAISE NOTICE 'Default commission settings inserted.';
END $$;