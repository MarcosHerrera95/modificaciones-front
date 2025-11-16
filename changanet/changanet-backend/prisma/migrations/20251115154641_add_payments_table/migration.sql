-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "servicio_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "monto_total" REAL NOT NULL,
    "comision_plataforma" REAL NOT NULL,
    "monto_profesional" REAL NOT NULL,
    "mercado_pago_id" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "metodo_pago" TEXT,
    "fecha_pago" DATETIME,
    "fecha_liberacion" DATETIME,
    "url_comprobante" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pagos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pagos_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "pagos_servicio_id_key" ON "pagos"("servicio_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mercado_pago_id_key" ON "pagos"("mercado_pago_id");

-- CreateIndex
CREATE INDEX "pagos_cliente_id_idx" ON "pagos"("cliente_id");

-- CreateIndex
CREATE INDEX "pagos_profesional_id_idx" ON "pagos"("profesional_id");

-- CreateIndex
CREATE INDEX "pagos_estado_idx" ON "pagos"("estado");

-- CreateIndex
CREATE INDEX "pagos_mercado_pago_id_idx" ON "pagos"("mercado_pago_id");
