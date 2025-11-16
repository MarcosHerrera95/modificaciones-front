-- AlterTable
ALTER TABLE "perfiles_profesionales" ADD COLUMN "latitud" REAL;
ALTER TABLE "perfiles_profesionales" ADD COLUMN "longitud" REAL;

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "documento_url" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "comentario_admin" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisado_en" DATETIME,
    "revisado_por" TEXT,
    CONSTRAINT "verification_requests_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cotizaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "precio" REAL NOT NULL,
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
CREATE TABLE "new_servicios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fecha_agendada" DATETIME,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completado_en" DATETIME,
    CONSTRAINT "servicios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "url_foto_perfil" TEXT
);
INSERT INTO "new_usuarios" ("actualizado_en", "creado_en", "email", "esta_verificado", "google_id", "hash_contrasena", "id", "nombre", "rol", "telefono", "url_foto_perfil") SELECT "actualizado_en", "creado_en", "email", "esta_verificado", "google_id", "hash_contrasena", "id", "nombre", "rol", "telefono", "url_foto_perfil" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_token_verificacion_key" ON "usuarios"("token_verificacion");
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");
CREATE INDEX "usuarios_esta_verificado_idx" ON "usuarios"("esta_verificado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests_usuario_id_key" ON "verification_requests"("usuario_id");

-- CreateIndex
CREATE INDEX "mensajes_remitente_id_creado_en_idx" ON "mensajes"("remitente_id", "creado_en");

-- CreateIndex
CREATE INDEX "mensajes_destinatario_id_creado_en_idx" ON "mensajes"("destinatario_id", "creado_en");

-- CreateIndex
CREATE INDEX "mensajes_remitente_id_destinatario_id_creado_en_idx" ON "mensajes"("remitente_id", "destinatario_id", "creado_en");

-- CreateIndex
CREATE INDEX "mensajes_creado_en_idx" ON "mensajes"("creado_en");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_especialidad_idx" ON "perfiles_profesionales"("especialidad");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_zona_cobertura_idx" ON "perfiles_profesionales"("zona_cobertura");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_calificacion_promedio_idx" ON "perfiles_profesionales"("calificacion_promedio");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_latitud_longitud_idx" ON "perfiles_profesionales"("latitud", "longitud");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_especialidad_zona_cobertura_calificacion_promedio_idx" ON "perfiles_profesionales"("especialidad", "zona_cobertura", "calificacion_promedio");

-- CreateIndex
CREATE INDEX "resenas_servicio_id_idx" ON "resenas"("servicio_id");
