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

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "zona_cobertura" TEXT,
    "fotos_urls" TEXT,
    "profesionales_solicitados" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cotizaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "coverage_zones" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'lower(hex(randomblob(16)))',
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "radius_km" REAL DEFAULT 5.0,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
CREATE TABLE "disponibilidad" (
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

-- CreateTable
CREATE TABLE "favoritos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favoritos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "favoritos_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conversations_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "message" TEXT,
    "image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mensajes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mensajes_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mensajes_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "canal" TEXT NOT NULL DEFAULT 'inapp',
    "estado" TEXT NOT NULL DEFAULT 'unread',
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leido_en" DATETIME,
    CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "mercado_pago_preference_id" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "metodo_pago" TEXT,
    "fecha_pago" DATETIME,
    "fecha_liberacion" DATETIME,
    "fecha_liberacion_programada" DATETIME,
    "url_comprobante" TEXT,
    "metadata" TEXT,
    "webhook_procesado" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_webhook_procesado_en" DATETIME,
    "intentos_webhook" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pagos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pagos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pagos_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "perfiles_profesionales" (
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
    "coverage_zone_id" TEXT,
    "matricula" TEXT,
    "profile_completion_score" INTEGER DEFAULT 0,
    "profile_views_count" INTEGER DEFAULT 0,
    "last_profile_update" DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "perfiles_profesionales_coverage_zone_id_fkey" FOREIGN KEY ("coverage_zone_id") REFERENCES "coverage_zones" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "perfiles_profesionales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "professional_specialties" (
    "professional_id" TEXT NOT NULL,
    "specialty_id" TEXT NOT NULL,
    "is_primary" BOOLEAN DEFAULT false,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("professional_id", "specialty_id"),
    CONSTRAINT "professional_specialties_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "professional_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

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

-- CreateTable
CREATE TABLE "resenas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "servicio_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "calificacion" INTEGER NOT NULL,
    "comentario" TEXT,
    "url_foto" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "resenas_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "resenas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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

-- CreateTable
CREATE TABLE "servicios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fecha_agendada" DATETIME,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completado_en" DATETIME,
    "es_urgente" BOOLEAN NOT NULL DEFAULT false,
    "servicio_recurrente_id" TEXT,
    CONSTRAINT "servicios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_servicio_recurrente_id_fkey" FOREIGN KEY ("servicio_recurrente_id") REFERENCES "servicios_recurrrentes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "servicios_recurrrentes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "dia_semana" INTEGER,
    "dia_mes" INTEGER,
    "hora_inicio" TEXT NOT NULL,
    "duracion_horas" REAL NOT NULL,
    "tarifa_base" REAL NOT NULL,
    "descuento_recurrencia" REAL NOT NULL DEFAULT 0,
    "fecha_inicio" DATETIME NOT NULL,
    "fecha_fin" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" DATETIME,
    CONSTRAINT "servicios_recurrrentes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "servicios_recurrrentes_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'lower(hex(randomblob(16)))',
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "hash_contrasena" TEXT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "dni" TEXT,
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

-- CreateTable
CREATE TABLE "identity_verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_front_url" TEXT NOT NULL,
    "document_back_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_review_notes" TEXT,
    "reviewed_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "identity_verification_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "identity_verification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "professional_reputation" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "average_rating" REAL NOT NULL DEFAULT 0,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "on_time_percentage" REAL NOT NULL DEFAULT 0,
    "medals" TEXT NOT NULL DEFAULT '[]',
    "ranking_score" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "professional_reputation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reputation_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reputation_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "professionals_availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "recurrence_type" TEXT NOT NULL DEFAULT 'single',
    "start_datetime" DATETIME NOT NULL,
    "end_datetime" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "professionals_availability_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "service_id" TEXT,
    "start_datetime" DATETIME NOT NULL,
    "end_datetime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "confirmed_at" DATETIME,
    "cancelled_at" DATETIME,
    "completed_at" DATETIME,
    CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "servicios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "blocked_slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "start_datetime" DATETIME NOT NULL,
    "end_datetime" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "blocked_slots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "blocked_slots_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calendar_sync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_calendar_id" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" DATETIME,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" DATETIME,
    "sync_status" TEXT NOT NULL DEFAULT 'idle',
    "sync_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "calendar_sync_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "eventos_pagos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pago_id" TEXT NOT NULL,
    "tipo_evento" TEXT NOT NULL,
    "datos" TEXT NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_pagos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "disputas_pagos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pago_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'abierta',
    "fecha_apertura" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" DATETIME,
    "resolucion" TEXT,
    "notas_admin" TEXT,
    "reembolso_monto" REAL,
    CONSTRAINT "disputas_pagos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "disputas_pagos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "budgetRangeMin" REAL,
    "budgetRangeMax" REAL,
    "preferredDate" DATETIME,
    "location" TEXT,
    "requirements" TEXT NOT NULL DEFAULT '{}',
    "totalOffers" INTEGER NOT NULL DEFAULT 0,
    "selectedOfferId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetRequest_selectedOfferId_fkey" FOREIGN KEY ("selectedOfferId") REFERENCES "BudgetOffer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetRequestProfessional" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetRequestProfessional_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetRequestProfessional_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BudgetRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "estimatedDays" INTEGER,
    "comments" TEXT,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "availabilityDetails" TEXT,
    "offerStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetOffer_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BudgetRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "commission_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commission_percentage" REAL NOT NULL,
    "minimum_fee" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" DATETIME NOT NULL,
    "updated_by" TEXT
);

-- CreateTable
CREATE TABLE "urgent_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "service_id" TEXT,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "radius_km" REAL NOT NULL DEFAULT 5.0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "price_estimate" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "urgent_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "servicios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "urgent_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "urgent_request_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urgent_request_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "distance_km" REAL NOT NULL,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "urgent_request_candidates_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "urgent_request_candidates_urgent_request_id_fkey" FOREIGN KEY ("urgent_request_id") REFERENCES "urgent_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "urgent_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urgent_request_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "assigned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "urgent_assignments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "urgent_assignments_urgent_request_id_fkey" FOREIGN KEY ("urgent_request_id") REFERENCES "urgent_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "urgent_pricing_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service_category" TEXT NOT NULL,
    "base_multiplier" REAL NOT NULL DEFAULT 1.5,
    "min_price" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "inapp" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "actualizado_en" DATETIME NOT NULL,
    CONSTRAINT "notification_preferences_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificacion_id" TEXT NOT NULL,
    "intentos_reintento" INTEGER NOT NULL DEFAULT 0,
    "programado_en" DATETIME NOT NULL,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_queue_notificacion_id_fkey" FOREIGN KEY ("notificacion_id") REFERENCES "notificaciones" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'support',
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "admin_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "moderation_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporter_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assigned_to" TEXT,
    "assigned_at" DATETIME,
    "resolved_at" DATETIME,
    "resolution_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "moderation_reports_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "moderation_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuing_organization" TEXT NOT NULL,
    "issue_date" DATETIME,
    "expiry_date" DATETIME,
    "credential_id" TEXT,
    "credential_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "certifications_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "description" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "experiences_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portfolio_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "photo_url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "category" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "portfolio_photos_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "cotizacion_respuestas_estado_idx" ON "cotizacion_respuestas"("estado");

-- CreateIndex
CREATE INDEX "cotizacion_respuestas_profesional_id_idx" ON "cotizacion_respuestas"("profesional_id");

-- CreateIndex
CREATE INDEX "cotizacion_respuestas_cotizacion_id_idx" ON "cotizacion_respuestas"("cotizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "cotizacion_respuestas_cotizacion_id_profesional_id_key" ON "cotizacion_respuestas"("cotizacion_id", "profesional_id");

-- CreateIndex
CREATE INDEX "cotizaciones_creado_en_idx" ON "cotizaciones"("creado_en");

-- CreateIndex
CREATE INDEX "cotizaciones_cliente_id_idx" ON "cotizaciones"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_coverage_zones_active" ON "coverage_zones"("is_active");

-- CreateIndex
CREATE INDEX "idx_coverage_zones_city" ON "coverage_zones"("city", "state");

-- CreateIndex
CREATE INDEX "cuentas_bancarias_verificada_idx" ON "cuentas_bancarias"("verificada");

-- CreateIndex
CREATE INDEX "cuentas_bancarias_profesional_id_idx" ON "cuentas_bancarias"("profesional_id");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidad_servicio_id_key" ON "disponibilidad"("servicio_id");

-- CreateIndex
CREATE INDEX "disponibilidad_esta_disponible_fecha_idx" ON "disponibilidad"("esta_disponible", "fecha");

-- CreateIndex
CREATE INDEX "disponibilidad_servicio_id_idx" ON "disponibilidad"("servicio_id");

-- CreateIndex
CREATE INDEX "disponibilidad_reservado_por_idx" ON "disponibilidad"("reservado_por");

-- CreateIndex
CREATE INDEX "disponibilidad_profesional_id_fecha_idx" ON "disponibilidad"("profesional_id", "fecha");

-- CreateIndex
CREATE INDEX "favoritos_profesional_id_idx" ON "favoritos"("profesional_id");

-- CreateIndex
CREATE INDEX "favoritos_cliente_id_idx" ON "favoritos"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "favoritos_cliente_id_profesional_id_key" ON "favoritos"("cliente_id", "profesional_id");

-- CreateIndex
CREATE INDEX "logros_activo_idx" ON "logros"("activo");

-- CreateIndex
CREATE INDEX "logros_categoria_idx" ON "logros"("categoria");

-- CreateIndex
CREATE INDEX "logros_usuario_logro_id_idx" ON "logros_usuario"("logro_id");

-- CreateIndex
CREATE INDEX "logros_usuario_usuario_id_idx" ON "logros_usuario"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "logros_usuario_usuario_id_logro_id_key" ON "logros_usuario"("usuario_id", "logro_id");

-- CreateIndex
CREATE INDEX "conversations_client_id_idx" ON "conversations"("client_id");

-- CreateIndex
CREATE INDEX "conversations_professional_id_idx" ON "conversations"("professional_id");

-- CreateIndex
CREATE INDEX "conversations_is_active_idx" ON "conversations"("is_active");

-- CreateIndex
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at");

-- CreateIndex
CREATE INDEX "conversations_client_id_is_active_idx" ON "conversations"("client_id", "is_active");

-- CreateIndex
CREATE INDEX "conversations_professional_id_is_active_idx" ON "conversations"("professional_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_client_id_professional_id_key" ON "conversations"("client_id", "professional_id");

-- CreateIndex
CREATE INDEX "mensajes_created_at_idx" ON "mensajes"("created_at");

-- CreateIndex
CREATE INDEX "mensajes_conversation_id_idx" ON "mensajes"("conversation_id");

-- CreateIndex
CREATE INDEX "mensajes_sender_id_recipient_id_created_at_idx" ON "mensajes"("sender_id", "recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "mensajes_recipient_id_created_at_idx" ON "mensajes"("recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "mensajes_sender_id_created_at_idx" ON "mensajes"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "mensajes_status_idx" ON "mensajes"("status");

-- CreateIndex
CREATE INDEX "idx_notif_user" ON "notificaciones"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_notif_status" ON "notificaciones"("estado");

-- CreateIndex
CREATE INDEX "idx_notif_type" ON "notificaciones"("tipo");

-- CreateIndex
CREATE INDEX "notificaciones_creado_en_idx" ON "notificaciones"("creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_servicio_id_key" ON "pagos"("servicio_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mercado_pago_id_key" ON "pagos"("mercado_pago_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mercado_pago_preference_id_key" ON "pagos"("mercado_pago_preference_id");

-- CreateIndex
CREATE INDEX "pagos_mercado_pago_preference_id_idx" ON "pagos"("mercado_pago_preference_id");

-- CreateIndex
CREATE INDEX "pagos_mercado_pago_id_idx" ON "pagos"("mercado_pago_id");

-- CreateIndex
CREATE INDEX "pagos_estado_idx" ON "pagos"("estado");

-- CreateIndex
CREATE INDEX "pagos_profesional_id_idx" ON "pagos"("profesional_id");

-- CreateIndex
CREATE INDEX "pagos_cliente_id_idx" ON "pagos"("cliente_id");

-- CreateIndex
CREATE INDEX "pagos_webhook_procesado_idx" ON "pagos"("webhook_procesado");

-- CreateIndex
CREATE INDEX "pagos_fecha_liberacion_programada_idx" ON "pagos"("fecha_liberacion_programada");

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_profesionales_matricula_key" ON "perfiles_profesionales"("matricula");

-- CreateIndex
CREATE INDEX "idx_professionals_last_update" ON "perfiles_profesionales"("last_profile_update");

-- CreateIndex
CREATE INDEX "idx_professionals_completion_score" ON "perfiles_profesionales"("profile_completion_score");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_esta_disponible_idx" ON "perfiles_profesionales"("esta_disponible");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_tipo_tarifa_idx" ON "perfiles_profesionales"("tipo_tarifa");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_especialidad_zona_cobertura_calificacion_promedio_idx" ON "perfiles_profesionales"("especialidad", "zona_cobertura", "calificacion_promedio");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_latitud_longitud_idx" ON "perfiles_profesionales"("latitud", "longitud");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_calificacion_promedio_idx" ON "perfiles_profesionales"("calificacion_promedio");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_zona_cobertura_idx" ON "perfiles_profesionales"("zona_cobertura");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_especialidad_idx" ON "perfiles_profesionales"("especialidad");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_matricula_idx" ON "perfiles_profesionales"("matricula");

-- CreateIndex
CREATE INDEX "perfiles_profesionales_matricula_zona_cobertura_idx" ON "perfiles_profesionales"("matricula", "zona_cobertura");

-- CreateIndex
CREATE INDEX "idx_professional_specialties_specialty" ON "professional_specialties"("specialty_id");

-- CreateIndex
CREATE INDEX "idx_professional_specialties_professional" ON "professional_specialties"("professional_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "resenas_servicio_id_key" ON "resenas"("servicio_id");

-- CreateIndex
CREATE INDEX "resenas_servicio_id_idx" ON "resenas"("servicio_id");

-- CreateIndex
CREATE INDEX "retiros_fecha_solicitud_idx" ON "retiros"("fecha_solicitud");

-- CreateIndex
CREATE INDEX "retiros_estado_idx" ON "retiros"("estado");

-- CreateIndex
CREATE INDEX "retiros_profesional_id_idx" ON "retiros"("profesional_id");

-- CreateIndex
CREATE INDEX "servicios_profesional_id_fecha_agendada_idx" ON "servicios"("profesional_id", "fecha_agendada");

-- CreateIndex
CREATE INDEX "servicios_cliente_id_fecha_agendada_idx" ON "servicios"("cliente_id", "fecha_agendada");

-- CreateIndex
CREATE INDEX "servicios_fecha_agendada_idx" ON "servicios"("fecha_agendada");

-- CreateIndex
CREATE INDEX "servicios_es_urgente_estado_idx" ON "servicios"("es_urgente", "estado");

-- CreateIndex
CREATE INDEX "servicios_estado_creado_en_idx" ON "servicios"("estado", "creado_en");

-- CreateIndex
CREATE INDEX "servicios_profesional_id_estado_idx" ON "servicios"("profesional_id", "estado");

-- CreateIndex
CREATE INDEX "servicios_cliente_id_estado_idx" ON "servicios"("cliente_id", "estado");

-- CreateIndex
CREATE INDEX "servicios_es_urgente_idx" ON "servicios"("es_urgente");

-- CreateIndex
CREATE INDEX "servicios_creado_en_idx" ON "servicios"("creado_en");

-- CreateIndex
CREATE INDEX "servicios_estado_idx" ON "servicios"("estado");

-- CreateIndex
CREATE INDEX "servicios_profesional_id_idx" ON "servicios"("profesional_id");

-- CreateIndex
CREATE INDEX "servicios_cliente_id_idx" ON "servicios"("cliente_id");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_frecuencia_idx" ON "servicios_recurrrentes"("frecuencia");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_fecha_inicio_idx" ON "servicios_recurrrentes"("fecha_inicio");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_activo_idx" ON "servicios_recurrrentes"("activo");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_profesional_id_idx" ON "servicios_recurrrentes"("profesional_id");

-- CreateIndex
CREATE INDEX "servicios_recurrrentes_cliente_id_idx" ON "servicios_recurrrentes"("cliente_id");

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_specialties_2" ON "specialties"("name");
Pragma writable_schema=0;

-- CreateIndex
CREATE INDEX "idx_specialties_active" ON "specialties"("is_active");

-- CreateIndex
CREATE INDEX "idx_specialties_category" ON "specialties"("category");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_dni_key" ON "usuarios"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_token_verificacion_key" ON "usuarios"("token_verificacion");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_facebook_id_key" ON "usuarios"("facebook_id");

-- CreateIndex
CREATE INDEX "usuarios_sms_enabled_idx" ON "usuarios"("sms_enabled");

-- CreateIndex
CREATE INDEX "usuarios_telefono_idx" ON "usuarios"("telefono");

-- CreateIndex
CREATE INDEX "usuarios_esta_verificado_idx" ON "usuarios"("esta_verificado");

-- CreateIndex
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");

-- CreateIndex
CREATE INDEX "usuarios_dni_idx" ON "usuarios"("dni");

-- CreateIndex
CREATE INDEX "usuarios_dni_rol_idx" ON "usuarios"("dni", "rol");

-- CreateIndex
CREATE INDEX "usuarios_dni_esta_verificado_idx" ON "usuarios"("dni", "esta_verificado");

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests_usuario_id_key" ON "verification_requests"("usuario_id");

-- CreateIndex
CREATE INDEX "identity_verification_user_id_idx" ON "identity_verification"("user_id");

-- CreateIndex
CREATE INDEX "identity_verification_status_idx" ON "identity_verification"("status");

-- CreateIndex
CREATE INDEX "identity_verification_created_at_idx" ON "identity_verification"("created_at");

-- CreateIndex
CREATE INDEX "professional_reputation_ranking_score_idx" ON "professional_reputation"("ranking_score");

-- CreateIndex
CREATE INDEX "professional_reputation_updated_at_idx" ON "professional_reputation"("updated_at");

-- CreateIndex
CREATE INDEX "reputation_history_user_id_idx" ON "reputation_history"("user_id");

-- CreateIndex
CREATE INDEX "reputation_history_event_type_idx" ON "reputation_history"("event_type");

-- CreateIndex
CREATE INDEX "reputation_history_created_at_idx" ON "reputation_history"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_resource_idx" ON "audit_log"("resource");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_resource_resource_id_idx" ON "audit_log"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "professionals_availability_professional_id_idx" ON "professionals_availability"("professional_id");

-- CreateIndex
CREATE INDEX "professionals_availability_start_datetime_idx" ON "professionals_availability"("start_datetime");

-- CreateIndex
CREATE INDEX "professionals_availability_end_datetime_idx" ON "professionals_availability"("end_datetime");

-- CreateIndex
CREATE INDEX "professionals_availability_recurrence_type_idx" ON "professionals_availability"("recurrence_type");

-- CreateIndex
CREATE INDEX "appointments_professional_id_idx" ON "appointments"("professional_id");

-- CreateIndex
CREATE INDEX "appointments_client_id_idx" ON "appointments"("client_id");

-- CreateIndex
CREATE INDEX "appointments_service_id_idx" ON "appointments"("service_id");

-- CreateIndex
CREATE INDEX "appointments_start_datetime_idx" ON "appointments"("start_datetime");

-- CreateIndex
CREATE INDEX "appointments_end_datetime_idx" ON "appointments"("end_datetime");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_created_at_idx" ON "appointments"("created_at");

-- CreateIndex
CREATE INDEX "blocked_slots_professional_id_idx" ON "blocked_slots"("professional_id");

-- CreateIndex
CREATE INDEX "blocked_slots_start_datetime_idx" ON "blocked_slots"("start_datetime");

-- CreateIndex
CREATE INDEX "blocked_slots_end_datetime_idx" ON "blocked_slots"("end_datetime");

-- CreateIndex
CREATE INDEX "calendar_sync_professional_id_idx" ON "calendar_sync"("professional_id");

-- CreateIndex
CREATE INDEX "calendar_sync_provider_idx" ON "calendar_sync"("provider");

-- CreateIndex
CREATE INDEX "calendar_sync_sync_enabled_idx" ON "calendar_sync"("sync_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_sync_professional_id_provider_key" ON "calendar_sync"("professional_id", "provider");

-- CreateIndex
CREATE INDEX "eventos_pagos_pago_id_tipo_evento_idx" ON "eventos_pagos"("pago_id", "tipo_evento");

-- CreateIndex
CREATE INDEX "eventos_pagos_procesado_idx" ON "eventos_pagos"("procesado");

-- CreateIndex
CREATE INDEX "disputas_pagos_pago_id_idx" ON "disputas_pagos"("pago_id");

-- CreateIndex
CREATE INDEX "disputas_pagos_usuario_id_idx" ON "disputas_pagos"("usuario_id");

-- CreateIndex
CREATE INDEX "disputas_pagos_estado_idx" ON "disputas_pagos"("estado");

-- CreateIndex
CREATE INDEX "disputas_pagos_fecha_apertura_idx" ON "disputas_pagos"("fecha_apertura");

-- CreateIndex
CREATE INDEX "BudgetRequest_clientId_idx" ON "BudgetRequest"("clientId");

-- CreateIndex
CREATE INDEX "BudgetRequest_status_idx" ON "BudgetRequest"("status");

-- CreateIndex
CREATE INDEX "BudgetRequest_category_idx" ON "BudgetRequest"("category");

-- CreateIndex
CREATE INDEX "BudgetRequest_createdAt_idx" ON "BudgetRequest"("createdAt");

-- CreateIndex
CREATE INDEX "BudgetRequestProfessional_requestId_idx" ON "BudgetRequestProfessional"("requestId");

-- CreateIndex
CREATE INDEX "BudgetRequestProfessional_professionalId_idx" ON "BudgetRequestProfessional"("professionalId");

-- CreateIndex
CREATE INDEX "BudgetRequestProfessional_status_idx" ON "BudgetRequestProfessional"("status");

-- CreateIndex
CREATE INDEX "BudgetRequestProfessional_expiresAt_idx" ON "BudgetRequestProfessional"("expiresAt");

-- CreateIndex
CREATE INDEX "BudgetRequestProfessional_responded_idx" ON "BudgetRequestProfessional"("responded");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetRequestProfessional_requestId_professionalId_key" ON "BudgetRequestProfessional"("requestId", "professionalId");

-- CreateIndex
CREATE INDEX "BudgetOffer_requestId_idx" ON "BudgetOffer"("requestId");

-- CreateIndex
CREATE INDEX "BudgetOffer_professionalId_idx" ON "BudgetOffer"("professionalId");

-- CreateIndex
CREATE INDEX "BudgetOffer_price_idx" ON "BudgetOffer"("price");

-- CreateIndex
CREATE INDEX "BudgetOffer_createdAt_idx" ON "BudgetOffer"("createdAt");

-- CreateIndex
CREATE INDEX "BudgetOffer_offerStatus_idx" ON "BudgetOffer"("offerStatus");

-- CreateIndex
CREATE INDEX "BudgetOffer_isSelected_idx" ON "BudgetOffer"("isSelected");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetOffer_requestId_professionalId_key" ON "BudgetOffer"("requestId", "professionalId");

-- CreateIndex
CREATE INDEX "commission_settings_active_idx" ON "commission_settings"("active");

-- CreateIndex
CREATE INDEX "commission_settings_updated_at_idx" ON "commission_settings"("updated_at");

-- CreateIndex
CREATE INDEX "idx_urgent_status" ON "urgent_requests"("status");

-- CreateIndex
CREATE INDEX "urgent_requests_created_at_idx" ON "urgent_requests"("created_at");

-- CreateIndex
CREATE INDEX "urgent_requests_client_id_idx" ON "urgent_requests"("client_id");

-- CreateIndex
CREATE INDEX "urgent_requests_status_created_at_idx" ON "urgent_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "urgent_request_candidates_urgent_request_id_idx" ON "urgent_request_candidates"("urgent_request_id");

-- CreateIndex
CREATE INDEX "urgent_request_candidates_professional_id_idx" ON "urgent_request_candidates"("professional_id");

-- CreateIndex
CREATE INDEX "idx_urgent_candidate_distance" ON "urgent_request_candidates"("distance_km");

-- CreateIndex
CREATE INDEX "urgent_request_candidates_responded_idx" ON "urgent_request_candidates"("responded");

-- CreateIndex
CREATE INDEX "urgent_request_candidates_accepted_idx" ON "urgent_request_candidates"("accepted");

-- CreateIndex
CREATE INDEX "urgent_assignments_urgent_request_id_idx" ON "urgent_assignments"("urgent_request_id");

-- CreateIndex
CREATE INDEX "urgent_assignments_professional_id_idx" ON "urgent_assignments"("professional_id");

-- CreateIndex
CREATE INDEX "urgent_assignments_status_idx" ON "urgent_assignments"("status");

-- CreateIndex
CREATE INDEX "urgent_assignments_assigned_at_idx" ON "urgent_assignments"("assigned_at");

-- CreateIndex
CREATE INDEX "urgent_pricing_rules_service_category_idx" ON "urgent_pricing_rules"("service_category");

-- CreateIndex
CREATE INDEX "urgent_pricing_rules_updated_at_idx" ON "urgent_pricing_rules"("updated_at");

-- CreateIndex
CREATE INDEX "idx_preference_user" ON "notification_preferences"("usuario_id");

-- CreateIndex
CREATE INDEX "notification_preferences_tipo_idx" ON "notification_preferences"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_usuario_id_tipo_key" ON "notification_preferences"("usuario_id", "tipo");

-- CreateIndex
CREATE INDEX "notification_queue_notificacion_id_idx" ON "notification_queue"("notificacion_id");

-- CreateIndex
CREATE INDEX "notification_queue_programado_en_idx" ON "notification_queue"("programado_en");

-- CreateIndex
CREATE INDEX "notification_queue_creado_en_idx" ON "notification_queue"("creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profile_user_id_key" ON "admin_profile"("user_id");

-- CreateIndex
CREATE INDEX "admin_profile_role_idx" ON "admin_profile"("role");

-- CreateIndex
CREATE INDEX "admin_profile_is_active_idx" ON "admin_profile"("is_active");

-- CreateIndex
CREATE INDEX "admin_audit_log_admin_id_idx" ON "admin_audit_log"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_log_action_idx" ON "admin_audit_log"("action");

-- CreateIndex
CREATE INDEX "admin_audit_log_target_type_idx" ON "admin_audit_log"("target_type");

-- CreateIndex
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "moderation_reports_status_idx" ON "moderation_reports"("status");

-- CreateIndex
CREATE INDEX "moderation_reports_priority_idx" ON "moderation_reports"("priority");

-- CreateIndex
CREATE INDEX "moderation_reports_target_type_idx" ON "moderation_reports"("target_type");

-- CreateIndex
CREATE INDEX "moderation_reports_assigned_to_idx" ON "moderation_reports"("assigned_to");

-- CreateIndex
CREATE INDEX "moderation_reports_created_at_idx" ON "moderation_reports"("created_at");

-- CreateIndex
CREATE INDEX "certifications_professional_id_idx" ON "certifications"("professional_id");

-- CreateIndex
CREATE INDEX "experiences_professional_id_idx" ON "experiences"("professional_id");

-- CreateIndex
CREATE INDEX "experiences_start_date_idx" ON "experiences"("start_date");

-- CreateIndex
CREATE INDEX "portfolio_photos_professional_id_idx" ON "portfolio_photos"("professional_id");

-- CreateIndex
CREATE INDEX "portfolio_photos_is_featured_idx" ON "portfolio_photos"("is_featured");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- CreateIndex
CREATE INDEX "settings_is_public_idx" ON "settings"("is_public");

