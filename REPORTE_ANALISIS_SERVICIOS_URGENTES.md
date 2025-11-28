# 📋 REPORTE DE ANÁLISIS DETALLADO - MÓDULO SERVICIOS URGENTES

## 🎯 OBJETIVO DEL ANÁLISIS

Realizar un análisis completo de la base de datos y modelos Prisma para el módulo Servicios Urgentes, validando los modelos requeridos, índices de base de datos, comparando con requisitos del PRD y detectando inconsistencias.

## 📊 MATRIZ DE ERRORES DETECTADOS

| ID | Severidad | Archivo | Línea | Descripción | Causa | Impacto | FIX |
|----|-----------|---------|-------|-------------|-------|---------|-----|
| ERR-UR-001 | CRÍTICA | schema.prisma | N/A | Modelo `urgent_rejections` no existe | Falta en la implementación actual | No se puede rastrear rechazos de solicitudes urgentes | Agregar modelo `urgent_rejections` con campos: id, urgent_request_id, professional_id, reason, rejected_at |
| ERR-UR-002 | CRÍTICA | schema.prisma | N/A | Modelo `urgent_tracking` no existe | Falta en la implementación actual | No hay historial de cambios de estado para solicitudes urgentes | Agregar modelo `urgent_tracking` con campos: id, urgent_request_id, previous_status, new_status, changed_by, changed_at, notes |
| ERR-UR-003 | ALTA | schema.prisma | 1003 | Campo `location` es String en lugar de coordenadas Float | Diseño inicial no consideró búsquedas por distancia | Imposible realizar búsquedas eficientes por distancia geográfica | Reemplazar `location String` por `latitude Float?`, `longitude Float?` en `urgent_requests` |
| ERR-UR-004 | ALTA | schema.prisma | N/A | Falta índice para búsqueda por distancia (lat/lng) | No se implementaron índices geoespaciales | Consultas de distancia serán lentas con muchos registros | Agregar `@@index([latitude, longitude])` en `urgent_requests` |
| ERR-UR-005 | MEDIA | schema.prisma | 1013-1016 | Índices existentes no cubren `assigned_professional_id` | Los índices están en `urgent_assignments` pero no directamente en `urgent_requests` | Consultas por profesional asignado requieren joins adicionales | Agregar `@@index([assigned_professional_id])` si se agrega el campo, o verificar necesidad |
| ERR-UR-006 | MEDIA | schema.prisma | 1013-1016 | Falta índice compuesto para optimización de consultas | Solo existe `@@index([status, created_at])` | Consultas complejas pueden ser ineficientes | Agregar `@@index([status, assigned_professional_id])` y `@@index([client_id, status])` |
| ERR-UR-007 | BAJA | PRD | Sección 10 | Sección de Servicios Urgentes incompleta en PRD | Documentación insuficiente | Implementación basada en suposiciones | Completar Sección 10 del PRD con especificaciones detalladas de modelos e índices |

## 🔍 ANÁLISIS DETALLADO

### 1. Modelos Requeridos vs Implementados

**Modelos Requeridos:**
- ✅ `urgent_requests` - Implementado
- ❌ `urgent_rejections` - **FALTANTE**
- ❌ `urgent_tracking` - **FALTANTE**

**Modelos Adicionales Encontrados:**
- `urgent_request_candidates` - Gestiona candidatos notificados
- `urgent_assignments` - Gestiona asignaciones aceptadas
- `urgent_pricing_rules` - Reglas de precios dinámicos

### 2. Análisis de Índices

**Índices Actuales en `urgent_requests`:**
```prisma
@@index([status], map: "idx_urgent_status")
@@index([created_at])
@@index([client_id])
@@index([status, created_at])
```

**Índices Requeridos Faltantes:**
- Índice geoespacial: `@@index([latitude, longitude])`
- Índice para profesional asignado: `@@index([assigned_professional_id])`
- Índices compuestos adicionales para optimización

### 3. Comparación con PRD

**PRD - Estado Actual:**
- Sección 10 mencionada pero sin detalles específicos
- No define modelos específicos ni índices requeridos
- Implementación actual excede especificaciones mínimas del PRD

**Inconsistencias Detectadas:**
- PRD no especifica los modelos requeridos en la tarea
- Falta definición de campos geoespaciales
- No hay requerimientos de índices específicos

## 🛠️ PROPUESTA DE SOLUCIÓN

### Modelo Prisma Actualizado

```prisma
// ... existing models ...

model urgent_requests {
  id             String                      @id @default(cuid())
  client_id      String
  service_id     String?
  description    String
  latitude       Float?                      // Nuevo: coordenada latitud
  longitude      Float?                      // Nuevo: coordenada longitud
  radius_km      Float                       @default(5.0)
  status         String                      @default("pending")
  price_estimate Float?
  assigned_professional_id String?           // Nuevo: profesional asignado
  created_at     DateTime                    @default(now())
  updated_at     DateTime                    @updatedAt
  assignments    urgent_assignments[]
  candidates     urgent_request_candidates[]
  rejections     urgent_rejections[]         // Nuevo: relación con rechazos
  tracking       urgent_tracking[]           // Nuevo: relación con tracking
  service        servicios?                  @relation(fields: [service_id], references: [id])
  client         usuarios                    @relation("urgent_requests_client_idTousuarios", fields: [client_id], references: [id], onDelete: Cascade)

  // Índices optimizados
  @@index([status], map: "idx_urgent_status")
  @@index([created_at])
  @@index([client_id])
  @@index([latitude, longitude])             // Nuevo: búsqueda geoespacial
  @@index([assigned_professional_id])        // Nuevo: búsqueda por profesional
  @@index([status, created_at])
  @@index([status, assigned_professional_id]) // Nuevo: índice compuesto
  @@index([client_id, status])               // Nuevo: índice compuesto
  @@map("urgent_requests")
}

model urgent_rejections {
  id                String          @id @default(cuid())
  urgent_request_id String
  professional_id   String
  reason            String?         // Razón del rechazo
  rejected_at       DateTime        @default(now())
  professional      usuarios        @relation("urgent_rejections_professional_idTousuarios", fields: [professional_id], references: [id], onDelete: Cascade)
  urgent_request    urgent_requests @relation(fields: [urgent_request_id], references: [id], onDelete: Cascade)

  @@index([urgent_request_id])
  @@index([professional_id])
  @@index([rejected_at])
  @@map("urgent_rejections")
}

model urgent_tracking {
  id                String          @id @default(cuid())
  urgent_request_id String
  previous_status   String?
  new_status        String
  changed_by        String?         // Usuario que realizó el cambio
  changed_at        DateTime        @default(now())
  notes             String?         // Notas adicionales del cambio
  urgent_request    urgent_requests @relation(fields: [urgent_request_id], references: [id], onDelete: Cascade)

  @@index([urgent_request_id])
  @@index([changed_at])
  @@index([new_status])
  @@index([urgent_request_id, changed_at]) // Para historial ordenado
  @@map("urgent_tracking")
}

// ... existing models ...
```

### Migración SQL Propuesta

```sql
-- Migración para añadir campos geoespaciales y modelos faltantes
-- Generada: 2025-11-28

-- Añadir campos a urgent_requests
ALTER TABLE "urgent_requests" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "urgent_requests" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "urgent_requests" ADD COLUMN "assigned_professional_id" TEXT;

-- Crear índices para campos nuevos
CREATE INDEX "urgent_requests_latitude_longitude_idx" ON "urgent_requests"("latitude", "longitude");
CREATE INDEX "urgent_requests_assigned_professional_id_idx" ON "urgent_requests"("assigned_professional_id");
CREATE INDEX "urgent_requests_status_assigned_professional_id_idx" ON "urgent_requests"("status", "assigned_professional_id");
CREATE INDEX "urgent_requests_client_id_status_idx" ON "urgent_requests"("client_id", "status");

-- Crear tabla urgent_rejections
CREATE TABLE "urgent_rejections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urgent_request_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "reason" TEXT,
    "rejected_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "urgent_rejections_urgent_request_id_fkey" FOREIGN KEY ("urgent_request_id") REFERENCES "urgent_requests"("id") ON DELETE CASCADE,
    CONSTRAINT "urgent_rejections_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "usuarios"("id") ON DELETE CASCADE
);

-- Crear tabla urgent_tracking
CREATE TABLE "urgent_tracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urgent_request_id" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "urgent_tracking_urgent_request_id_fkey" FOREIGN KEY ("urgent_request_id") REFERENCES "urgent_requests"("id") ON DELETE CASCADE
);

-- Crear índices para nuevas tablas
CREATE INDEX "urgent_rejections_urgent_request_id_idx" ON "urgent_rejections"("urgent_request_id");
CREATE INDEX "urgent_rejections_professional_id_idx" ON "urgent_rejections"("professional_id");
CREATE INDEX "urgent_rejections_rejected_at_idx" ON "urgent_rejections"("rejected_at");

CREATE INDEX "urgent_tracking_urgent_request_id_idx" ON "urgent_tracking"("urgent_request_id");
CREATE INDEX "urgent_tracking_changed_at_idx" ON "urgent_tracking"("changed_at");
CREATE INDEX "urgent_tracking_new_status_idx" ON "urgent_tracking"("new_status");
CREATE INDEX "urgent_tracking_urgent_request_id_changed_at_idx" ON "urgent_tracking"("urgent_request_id", "changed_at");
```

## 📈 RECOMENDACIONES

### 1. **Implementación Prioritaria**
- Agregar los modelos `urgent_rejections` y `urgent_tracking` para completar la funcionalidad
- Reemplazar campo `location` por coordenadas `latitude`/`longitude`
- Implementar índices geoespaciales para búsquedas por distancia

### 2. **Mejoras de Performance**
- Considerar PostGIS para consultas geoespaciales avanzadas
- Implementar caching para coordenadas frecuentes
- Optimizar consultas con índices compuestos

### 3. **Actualización del PRD**
- Completar Sección 10 con especificaciones detalladas
- Definir requerimientos de índices y modelos específicos
- Incluir casos de uso para rechazos y tracking de estado

### 4. **Próximos Pasos**
1. Aplicar migración SQL en entorno de desarrollo
2. Actualizar código backend para nuevos modelos
3. Implementar lógica de tracking automático de cambios de estado
4. Actualizar documentación y tests

## ✅ CONCLUSIÓN

El análisis revela que mientras la funcionalidad básica de servicios urgentes está implementada, faltan modelos críticos (`urgent_rejections`, `urgent_tracking`) y optimizaciones de índices para búsquedas geoespaciales eficientes. La corrección de estos issues mejorará significativamente la robustez y performance del módulo.

**Severidad General: ALTA** - Se requieren cambios estructurales pero no afectan funcionalidad crítica existente.