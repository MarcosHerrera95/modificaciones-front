-- CreateTable
CREATE TABLE "favoritos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favoritos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "favoritos_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "favoritos_cliente_id_idx" ON "favoritos"("cliente_id");

-- CreateIndex
CREATE INDEX "favoritos_profesional_id_idx" ON "favoritos"("profesional_id");

-- CreateIndex
CREATE UNIQUE INDEX "favoritos_cliente_id_profesional_id_key" ON "favoritos"("cliente_id", "profesional_id");
