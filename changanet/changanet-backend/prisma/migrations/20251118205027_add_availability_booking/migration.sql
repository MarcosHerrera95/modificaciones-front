-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_disponibilidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profesional_id" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "hora_inicio" DATETIME NOT NULL,
    "hora_fin" DATETIME NOT NULL,
    "esta_disponible" BOOLEAN NOT NULL DEFAULT true,
    "reservado_por" TEXT,
    "reservado_en" DATETIME,
    "servicio_id" TEXT,
    CONSTRAINT "disponibilidad_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "disponibilidad_reservado_por_fkey" FOREIGN KEY ("reservado_por") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "disponibilidad_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_disponibilidad" ("esta_disponible", "fecha", "hora_fin", "hora_inicio", "id", "profesional_id") SELECT "esta_disponible", "fecha", "hora_fin", "hora_inicio", "id", "profesional_id" FROM "disponibilidad";
DROP TABLE "disponibilidad";
ALTER TABLE "new_disponibilidad" RENAME TO "disponibilidad";
CREATE UNIQUE INDEX "disponibilidad_servicio_id_key" ON "disponibilidad"("servicio_id");
CREATE INDEX "disponibilidad_profesional_id_fecha_idx" ON "disponibilidad"("profesional_id", "fecha");
CREATE INDEX "disponibilidad_reservado_por_idx" ON "disponibilidad"("reservado_por");
CREATE INDEX "disponibilidad_servicio_id_idx" ON "disponibilidad"("servicio_id");
CREATE INDEX "disponibilidad_esta_disponible_fecha_idx" ON "disponibilidad"("esta_disponible", "fecha");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
