-- CreateTable
CREATE TABLE "servicios_recurrrentes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "dia_semana" INTEGER,
    "dia_mes" INTEGER,
    "hora_inicio" TEXT NOT NULL,
    "duracion_horas" REAL NOT NULL,
    "tarifa_base" REAL NOT NULL,
    "descuento_recurrencia" REAL NOT NULL DEFAULT 0,
    "fecha_inicio" DATETIME NOT NULL,
    "fecha_fin" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" DATETIME,
    CONSTRAINT "servicios_recurrrentes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_recurrrentes_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "servicio_recurrente_id" TEXT,
    CONSTRAINT "servicios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_servicio_recurrente_id_fkey" FOREIGN KEY ("servicio_recurrente_id") REFERENCES "servicios_recurrrentes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_servicios" ("cliente_id", "completado_en", "creado_en", "descripcion", "estado", "fecha_agendada", "id", "profesional_id") SELECT "cliente_id", "completado_en", "creado_en", "descripcion", "estado", "fecha_agendada", "id", "profesional_id" FROM "servicios";
DROP TABLE "servicios";
ALTER TABLE "new_servicios" RENAME TO "servicios";
CREATE INDEX "servicios_cliente_id_idx" ON "servicios"("cliente_id");
CREATE INDEX "servicios_profesional_id_idx" ON "servicios"("profesional_id");
CREATE INDEX "servicios_estado_idx" ON "servicios"("estado");
CREATE INDEX "servicios_creado_en_idx" ON "servicios"("creado_en");
CREATE INDEX "servicios_cliente_id_estado_idx" ON "servicios"("cliente_id", "estado");
CREATE INDEX "servicios_profesional_id_estado_idx" ON "servicios"("profesional_id", "estado");
CREATE INDEX "servicios_estado_creado_en_idx" ON "servicios"("estado", "creado_en");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_cliente_id_idx" ON "servicios_recurrrentes"("cliente_id");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_profesional_id_idx" ON "servicios_recurrrentes"("profesional_id");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_activo_idx" ON "servicios_recurrrentes"("activo");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_fecha_inicio_idx" ON "servicios_recurrrentes"("fecha_inicio");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_frecuencia_idx" ON "servicios_recurrrentes"("frecuencia");
