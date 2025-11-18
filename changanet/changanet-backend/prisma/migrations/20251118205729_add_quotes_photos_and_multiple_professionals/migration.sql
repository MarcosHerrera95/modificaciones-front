/*
  Warnings:

  - You are about to drop the column `aceptado_en` on the `cotizaciones` table. All the data in the column will be lost.
  - You are about to drop the column `comentario` on the `cotizaciones` table. All the data in the column will be lost.
  - You are about to drop the column `estado` on the `cotizaciones` table. All the data in the column will be lost.
  - You are about to drop the column `precio` on the `cotizaciones` table. All the data in the column will be lost.
  - You are about to drop the column `profesional_id` on the `cotizaciones` table. All the data in the column will be lost.
  - You are about to drop the column `rechazado_en` on the `cotizaciones` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "cotizacion_respuestas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotizacion_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "precio" REAL,
    "comentario" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondido_en" DATETIME,
    CONSTRAINT "cotizacion_respuestas_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizacion_respuestas_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cotizaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "zona_cobertura" TEXT,
    "fotos_urls" TEXT,
    "profesionales_solicitados" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cotizaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cotizaciones" ("cliente_id", "creado_en", "descripcion", "id", "zona_cobertura") SELECT "cliente_id", "creado_en", "descripcion", "id", "zona_cobertura" FROM "cotizaciones";
DROP TABLE "cotizaciones";
ALTER TABLE "new_cotizaciones" RENAME TO "cotizaciones";
CREATE INDEX "cotizaciones_cliente_id_idx" ON "cotizaciones"("cliente_id");
CREATE INDEX "cotizaciones_creado_en_idx" ON "cotizaciones"("creado_en");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "cotizacion_respuestas_cotizacion_id_idx" ON "cotizacion_respuestas"("cotizacion_id");

-- CreateIndex
CREATE INDEX "cotizacion_respuestas_profesional_id_idx" ON "cotizacion_respuestas"("profesional_id");

-- CreateIndex
CREATE INDEX "cotizacion_respuestas_estado_idx" ON "cotizacion_respuestas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "cotizacion_respuestas_cotizacion_id_profesional_id_key" ON "cotizacion_respuestas"("cotizacion_id", "profesional_id");
