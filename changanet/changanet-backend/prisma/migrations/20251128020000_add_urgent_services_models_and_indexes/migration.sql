-- Migration: Add urgent services models and indexes
-- CHANGANET - Adds urgent_rejections, urgent_tracking models and geo indexes
-- Generated: 2025-11-28

-- Add new columns to urgent_requests table
ALTER TABLE "urgent_requests" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "urgent_requests" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "urgent_requests" ADD COLUMN IF NOT EXISTS "assigned_professional_id" TEXT;

-- Create indexes for new columns in urgent_requests
CREATE INDEX IF NOT EXISTS "urgent_requests_latitude_longitude_idx" ON "urgent_requests"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "urgent_requests_assigned_professional_id_idx" ON "urgent_requests"("assigned_professional_id");
CREATE INDEX IF NOT EXISTS "urgent_requests_status_assigned_professional_id_idx" ON "urgent_requests"("status", "assigned_professional_id");
CREATE INDEX IF NOT EXISTS "urgent_requests_client_id_status_idx" ON "urgent_requests"("client_id", "status");

-- Create urgent_rejections table
CREATE TABLE IF NOT EXISTS "urgent_rejections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urgent_request_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "reason" TEXT,
    "rejected_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "urgent_rejections_urgent_request_id_fkey" FOREIGN KEY ("urgent_request_id") REFERENCES "urgent_requests"("id") ON DELETE CASCADE,
    CONSTRAINT "urgent_rejections_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios"("id") ON DELETE CASCADE
);

-- Create indexes for urgent_rejections
CREATE INDEX IF NOT EXISTS "urgent_rejections_urgent_request_id_idx" ON "urgent_rejections"("urgent_request_id");
CREATE INDEX IF NOT EXISTS "urgent_rejections_professional_id_idx" ON "urgent_rejections"("professional_id");
CREATE INDEX IF NOT EXISTS "urgent_rejections_rejected_at_idx" ON "urgent_rejections"("rejected_at");

-- Create urgent_tracking table
CREATE TABLE IF NOT EXISTS "urgent_tracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urgent_request_id" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "urgent_tracking_urgent_request_id_fkey" FOREIGN KEY ("urgent_request_id") REFERENCES "urgent_requests"("id") ON DELETE CASCADE
);

-- Create indexes for urgent_tracking
CREATE INDEX IF NOT EXISTS "urgent_tracking_urgent_request_id_idx" ON "urgent_tracking"("urgent_request_id");
CREATE INDEX IF NOT EXISTS "urgent_tracking_changed_at_idx" ON "urgent_tracking"("changed_at");
CREATE INDEX IF NOT EXISTS "urgent_tracking_new_status_idx" ON "urgent_tracking"("new_status");
CREATE INDEX IF NOT EXISTS "urgent_tracking_urgent_request_id_changed_at_idx" ON "urgent_tracking"("urgent_request_id", "changed_at");

-- Add comments for documentation
COMMENT ON TABLE "urgent_rejections" IS 'Historial de rechazos de solicitudes urgentes por profesionales';
COMMENT ON TABLE "urgent_tracking" IS 'Historial de cambios de estado para solicitudes urgentes';
COMMENT ON COLUMN "urgent_requests"."latitude" IS 'Coordenada latitud para búsquedas geoespaciales';
COMMENT ON COLUMN "urgent_requests"."longitude" IS 'Coordenada longitud para búsquedas geoespaciales';
COMMENT ON COLUMN "urgent_requests"."assigned_professional_id" IS 'ID del profesional actualmente asignado a la solicitud urgente';