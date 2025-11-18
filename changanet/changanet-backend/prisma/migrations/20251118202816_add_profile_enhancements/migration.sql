-- CreateTable
CREATE TABLE "logros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "criterio" TEXT NOT NULL,
    "puntos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "logros_usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "logro_id" TEXT NOT NULL,
    "obtenido_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logros_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "logros_usuario_logro_id_fkey" FOREIGN KEY ("logro_id") REFERENCES "logros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_perfiles_profesionales" (
    "usuario_id" TEXT NOT NULL PRIMARY KEY,
    "especialidad" TEXT NOT NULL,
    "especialidades" TEXT,
    "anos_experiencia" INTEGER,
    "zona_cobertura" TEXT NOT NULL,
    "latitud" REAL,
    "longitud" REAL,
    "tipo_tarifa" TEXT NOT NULL DEFAULT 'hora',
    "tarifa_hora" REAL,
    "tarifa_servicio" REAL,
    "tarifa_convenio" TEXT,
    "descripcion" TEXT,
    "url_foto_perfil" TEXT,
    "url_foto_portada" TEXT,
    "esta_disponible" BOOLEAN NOT NULL DEFAULT true,
    "calificacion_promedio" REAL,
    "estado_verificacion" TEXT NOT NULL DEFAULT 'pendiente',
    "verificado_en" DATETIME,
    "url_documento_verificacion" TEXT,
    CONSTRAINT "perfiles_profesionales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_perfiles_profesionales" ("anos_experiencia", "calificacion_promedio", "descripcion", "especialidad", "estado_verificacion", "latitud", "longitud", "tarifa_hora", "url_documento_verificacion", "url_foto_perfil", "usuario_id", "verificado_en", "zona_cobertura") SELECT "anos_experiencia", "calificacion_promedio", "descripcion", "especialidad", "estado_verificacion", "latitud", "longitud", "tarifa_hora", "url_documento_verificacion", "url_foto_perfil", "usuario_id", "verificado_en", "zona_cobertura" FROM "perfiles_profesionales";
DROP TABLE "perfiles_profesionales";
ALTER TABLE "new_perfiles_profesionales" RENAME TO "perfiles_profesionales";
CREATE INDEX "perfiles_profesionales_especialidad_idx" ON "perfiles_profesionales"("especialidad");
CREATE INDEX "perfiles_profesionales_zona_cobertura_idx" ON "perfiles_profesionales"("zona_cobertura");
CREATE INDEX "perfiles_profesionales_calificacion_promedio_idx" ON "perfiles_profesionales"("calificacion_promedio");
CREATE INDEX "perfiles_profesionales_latitud_longitud_idx" ON "perfiles_profesionales"("latitud", "longitud");
CREATE INDEX "perfiles_profesionales_especialidad_zona_cobertura_calificacion_promedio_idx" ON "perfiles_profesionales"("especialidad", "zona_cobertura", "calificacion_promedio");
CREATE INDEX "perfiles_profesionales_tipo_tarifa_idx" ON "perfiles_profesionales"("tipo_tarifa");
CREATE INDEX "perfiles_profesionales_esta_disponible_idx" ON "perfiles_profesionales"("esta_disponible");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "logros_categoria_idx" ON "logros"("categoria");

-- CreateIndex
CREATE INDEX "logros_activo_idx" ON "logros"("activo");

-- CreateIndex
CREATE INDEX "logros_usuario_usuario_id_idx" ON "logros_usuario"("usuario_id");

-- CreateIndex
CREATE INDEX "logros_usuario_logro_id_idx" ON "logros_usuario"("logro_id");

-- CreateIndex
CREATE UNIQUE INDEX "logros_usuario_usuario_id_logro_id_key" ON "logros_usuario"("usuario_id", "logro_id");
