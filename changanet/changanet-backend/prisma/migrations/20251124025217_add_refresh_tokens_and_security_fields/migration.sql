-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "hash_contrasena" TEXT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'cliente',
    "esta_verificado" BOOLEAN NOT NULL DEFAULT false,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "bloqueado_hasta" DATETIME,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "token_verificacion" TEXT,
    "token_expiracion" DATETIME,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" DATETIME,
    "google_id" TEXT,
    "facebook_id" TEXT,
    "url_foto_perfil" TEXT,
    "fcm_token" TEXT,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "direccion" TEXT,
    "preferencias_servicio" TEXT,
    "notificaciones_push" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_email" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_sms" BOOLEAN NOT NULL DEFAULT false,
    "notificaciones_servicios" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_mensajes" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_pagos" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_marketing" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_usuarios" ("actualizado_en", "bloqueado", "creado_en", "direccion", "email", "esta_verificado", "fcm_token", "google_id", "hash_contrasena", "id", "nombre", "notificaciones_email", "notificaciones_marketing", "notificaciones_mensajes", "notificaciones_pagos", "notificaciones_push", "notificaciones_servicios", "notificaciones_sms", "preferencias_servicio", "rol", "sms_enabled", "telefono", "token_expiracion", "token_verificacion", "url_foto_perfil") SELECT "actualizado_en", "bloqueado", "creado_en", "direccion", "email", "esta_verificado", "fcm_token", "google_id", "hash_contrasena", "id", "nombre", "notificaciones_email", "notificaciones_marketing", "notificaciones_mensajes", "notificaciones_pagos", "notificaciones_push", "notificaciones_servicios", "notificaciones_sms", "preferencias_servicio", "rol", "sms_enabled", "telefono", "token_expiracion", "token_verificacion", "url_foto_perfil" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_token_verificacion_key" ON "usuarios"("token_verificacion");
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");
CREATE UNIQUE INDEX "usuarios_facebook_id_key" ON "usuarios"("facebook_id");
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");
CREATE INDEX "usuarios_esta_verificado_idx" ON "usuarios"("esta_verificado");
CREATE INDEX "usuarios_telefono_idx" ON "usuarios"("telefono");
CREATE INDEX "usuarios_sms_enabled_idx" ON "usuarios"("sms_enabled");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
