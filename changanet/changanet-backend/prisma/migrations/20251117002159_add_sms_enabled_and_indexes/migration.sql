-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cotizaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "precio" REAL,
    "comentario" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceptado_en" DATETIME,
    "rechazado_en" DATETIME,
    CONSTRAINT "cotizaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizaciones_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cotizaciones" ("aceptado_en", "cliente_id", "comentario", "creado_en", "descripcion", "estado", "id", "precio", "profesional_id", "rechazado_en") SELECT "aceptado_en", "cliente_id", "comentario", "creado_en", "descripcion", "estado", "id", "precio", "profesional_id", "rechazado_en" FROM "cotizaciones";
DROP TABLE "cotizaciones";
ALTER TABLE "new_cotizaciones" RENAME TO "cotizaciones";
CREATE INDEX "cotizaciones_cliente_id_estado_idx" ON "cotizaciones"("cliente_id", "estado");
CREATE INDEX "cotizaciones_profesional_id_estado_idx" ON "cotizaciones"("profesional_id", "estado");
CREATE INDEX "cotizaciones_estado_creado_en_idx" ON "cotizaciones"("estado", "creado_en");
CREATE TABLE "new_usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "hash_contrasena" TEXT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'cliente',
    "esta_verificado" BOOLEAN NOT NULL DEFAULT false,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "token_verificacion" TEXT,
    "token_expiracion" DATETIME,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" DATETIME,
    "google_id" TEXT,
    "url_foto_perfil" TEXT,
    "fcm_token" TEXT,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_usuarios" ("actualizado_en", "bloqueado", "creado_en", "email", "esta_verificado", "google_id", "hash_contrasena", "id", "nombre", "rol", "telefono", "token_expiracion", "token_verificacion", "url_foto_perfil") SELECT "actualizado_en", "bloqueado", "creado_en", "email", "esta_verificado", "google_id", "hash_contrasena", "id", "nombre", "rol", "telefono", "token_expiracion", "token_verificacion", "url_foto_perfil" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_token_verificacion_key" ON "usuarios"("token_verificacion");
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");
CREATE INDEX "usuarios_esta_verificado_idx" ON "usuarios"("esta_verificado");
CREATE INDEX "usuarios_telefono_idx" ON "usuarios"("telefono");
CREATE INDEX "usuarios_sms_enabled_idx" ON "usuarios"("sms_enabled");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "servicios_fecha_agendada_idx" ON "servicios"("fecha_agendada");

-- CreateIndex
CREATE INDEX "servicios_cliente_id_fecha_agendada_idx" ON "servicios"("cliente_id", "fecha_agendada");

-- CreateIndex
CREATE INDEX "servicios_profesional_id_fecha_agendada_idx" ON "servicios"("profesional_id", "fecha_agendada");
