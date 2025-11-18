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
    "token_verificacion" TEXT,
    "token_expiracion" DATETIME,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" DATETIME,
    "google_id" TEXT,
    "url_foto_perfil" TEXT,
    "fcm_token" TEXT,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notificaciones_push" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_email" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_sms" BOOLEAN NOT NULL DEFAULT false,
    "notificaciones_servicios" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_mensajes" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_pagos" BOOLEAN NOT NULL DEFAULT true,
    "notificaciones_marketing" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_usuarios" ("actualizado_en", "bloqueado", "creado_en", "email", "esta_verificado", "fcm_token", "google_id", "hash_contrasena", "id", "nombre", "rol", "sms_enabled", "telefono", "token_expiracion", "token_verificacion", "url_foto_perfil") SELECT "actualizado_en", "bloqueado", "creado_en", "email", "esta_verificado", "fcm_token", "google_id", "hash_contrasena", "id", "nombre", "rol", "sms_enabled", "telefono", "token_expiracion", "token_verificacion", "url_foto_perfil" FROM "usuarios";
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
