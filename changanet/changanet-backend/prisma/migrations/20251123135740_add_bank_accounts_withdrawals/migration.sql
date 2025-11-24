-- CreateTable
CREATE TABLE "cuentas_bancarias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profesional_id" TEXT NOT NULL,
    "cvu" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "banco" TEXT,
    "titular" TEXT,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "verificada" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" DATETIME,
    CONSTRAINT "cuentas_bancarias_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "retiros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profesional_id" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'procesando',
    "fecha_solicitud" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_procesado" DATETIME,
    "fecha_acreditado" DATETIME,
    "referencia" TEXT,
    "notas" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retiros_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "retiros_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_bancarias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "cuentas_bancarias_profesional_id_idx" ON "cuentas_bancarias"("profesional_id");

-- CreateIndex
CREATE INDEX "cuentas_bancarias_verificada_idx" ON "cuentas_bancarias"("verificada");

-- CreateIndex
CREATE INDEX "retiros_profesional_id_idx" ON "retiros"("profesional_id");

-- CreateIndex
CREATE INDEX "retiros_estado_idx" ON "retiros"("estado");

-- CreateIndex
CREATE INDEX "retiros_fecha_solicitud_idx" ON "retiros"("fecha_solicitud");
