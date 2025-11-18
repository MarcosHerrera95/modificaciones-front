-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_servicios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fecha_agendada" DATETIME,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completado_en" DATETIME,
    "es_urgente" BOOLEAN NOT NULL DEFAULT false,
    "servicio_recurrente_id" TEXT,
    CONSTRAINT "servicios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_servicio_recurrente_id_fkey" FOREIGN KEY ("servicio_recurrente_id") REFERENCES "servicios_recurrrentes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_servicios" ("cliente_id", "completado_en", "creado_en", "descripcion", "estado", "fecha_agendada", "id", "profesional_id", "servicio_recurrente_id") SELECT "cliente_id", "completado_en", "creado_en", "descripcion", "estado", "fecha_agendada", "id", "profesional_id", "servicio_recurrente_id" FROM "servicios";
DROP TABLE "servicios";
ALTER TABLE "new_servicios" RENAME TO "servicios";
CREATE INDEX "servicios_cliente_id_idx" ON "servicios"("cliente_id");
CREATE INDEX "servicios_profesional_id_idx" ON "servicios"("profesional_id");
CREATE INDEX "servicios_estado_idx" ON "servicios"("estado");
CREATE INDEX "servicios_creado_en_idx" ON "servicios"("creado_en");
CREATE INDEX "servicios_es_urgente_idx" ON "servicios"("es_urgente");
CREATE INDEX "servicios_cliente_id_estado_idx" ON "servicios"("cliente_id", "estado");
CREATE INDEX "servicios_profesional_id_estado_idx" ON "servicios"("profesional_id", "estado");
CREATE INDEX "servicios_estado_creado_en_idx" ON "servicios"("estado", "creado_en");
CREATE INDEX "servicios_es_urgente_estado_idx" ON "servicios"("es_urgente", "estado");
CREATE INDEX "servicios_fecha_agendada_idx" ON "servicios"("fecha_agendada");
CREATE INDEX "servicios_cliente_id_fecha_agendada_idx" ON "servicios"("cliente_id", "fecha_agendada");
CREATE INDEX "servicios_profesional_id_fecha_agendada_idx" ON "servicios"("profesional_id", "fecha_agendada");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
