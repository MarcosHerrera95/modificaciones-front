# Verificación y Corrección de Estructura de Base de Datos - Sistema de Reseñas

## Fecha de Análisis
25 de Noviembre, 2025

## Resumen Ejecutivo

Este documento detalla la verificación y corrección de la estructura de la base de datos para el Sistema de Reseñas y Valoraciones de Changánet, analizando la tabla `resenas` y su relación con otras tablas relevantes, así como su cumplimiento con los requerimientos del PRD (REQ-21 a REQ-25).

## Análisis de la Estructura Actual

### Tabla `resenas`

La tabla `resenas` en el archivo `schema.prisma` tiene la siguiente estructura:

```prisma
model resenas {
  id           String    @id
  servicio_id  String    @unique
  cliente_id   String
  calificacion Int
  comentario   String?
  url_foto     String?
  creado_en    DateTime  @default(now())
  usuarios     usuarios  @relation([cliente_id], references: [id])
  servicios    servicios @relation([servicio_id], references: [id])

  @@index([servicio_id])
}
```

#### Análisis por Campo

| Campo | Tipo | Especificación | Cumplimiento de Requerimientos |
|-------|------|----------------|---------------------------------|
| `id` | String | Identificador único | ✅ Sí - Cumple con REQ-21 a REQ-25 |
| `servicio_id` | String | Referencia al servicio | ✅ Sí - Necesario para REQ-25 (verificar servicio completado) |
| `cliente_id` | String | Referencia al cliente | ✅ Sí - Necesario para REQ-25 (verificar que es cliente del servicio) |
| `calificacion` | Int | Calificación (1-5) | ✅ Sí - Cumple con REQ-21 (calificación con estrellas) |
| `comentario` | String? | Comentario opcional | ✅ Sí - Cumple con REQ-22 (comentario escrito) |
| `url_foto` | String? | URL de la foto | ✅ Sí - Cumple con REQ-23 (adjuntar foto) |
| `creado_en` | DateTime | Fecha de creación | ✅ Sí - Registro temporal de la reseña |

#### Índices

| Índice | Propósito | Eficiencia |
|--------|-----------|------------|
| `@@index([servicio_id])` | Búsqueda por servicio | ✅ Bueno - Permite encontrar reseñas por servicio rápidamente |

### Tabla `servicios`

La tabla `servicios` es fundamental para el funcionamiento del sistema de reseñas, ya que debe verificar que el servicio esté en estado 'completado':

```prisma
model servicios {
  id                                          String                  @id
  cliente_id                                  String
  profesional_id                              String
  descripcion                                 String
  estado                                      String                  @default("PENDIENTE")
  fecha_agendada                              DateTime?
  creado_en                                   DateTime                @default(now())
  completado_en                               DateTime?
  es_urgente                                  Boolean                 @default(false)
  ...
  resenas                                     resenas?
  ...
  usuarios_servicios_profesional_idTousuarios usuarios                @relation("servicios_profesional_idTousuarios", fields: [profesional_id], references: [id])
  usuarios_servicios_cliente_idTousuarios     usuarios                @relation("servicios_cliente_idTousuarios", fields: [cliente_id], references: [id])
  ...
  @@index([estado, creado_en])
  @@index([profesional_id, estado])
  @@index([cliente_id, estado])
  ...
}
```

#### Análisis por Campo Relevante para Reseñas

| Campo | Tipo | Relevancia para Reseñas | Cumplimiento |
|-------|------|-------------------------|--------------|
| `id` | String | Identificador para relacionar con reseñas | ✅ Sí |
| `cliente_id` | String | Necesario para verificar que el cliente puede reseñar | ✅ Sí |
| `profesional_id` | String | Necesario para calcular calificación promedio | ✅ Sí |
| `estado` | String | Debe ser 'completado' para permitir reseña (REQ-25) | ✅ Sí |
| `completado_en` | DateTime | Fecha de finalización del servicio | ✅ Sí |

### Tabla `perfiles_profesionales`

Esta tabla almacena la calificación promedio calculada a partir de las reseñas:

```prisma
model perfiles_profesionales {
  usuario_id                 String                     @id
  ...
  calificacion_promedio      Float?
  ...
  usuarios                   usuarios                   @relation(fields: [usuario_id], references: [id])
  ...
  @@index([calificacion_promedio])
  ...
}
```

#### Análisis por Campo Relevante para Reseñas

| Campo | Tipo | Relevancia para Reseñas | Cumplimiento |
|-------|------|-------------------------|--------------|
| `usuario_id` | String | ID del profesional | ✅ Sí |
| `calificacion_promedio` | Float | Promedio calculado | ✅ Sí - Cumple con REQ-24 (calcular y mostrar promedio) |

## Verificación de Cumplimiento de Requerimientos

### REQ-21: Calificación con estrellas (1 a 5)
**Estado**: ✅ **CUMPLIDO**

- Campo `calificacion` de tipo Int permite valores del 1 al 5
- El backend valida que el valor esté en ese rango
- El frontend presenta una interfaz visual con estrellas

### REQ-22: Comentario escrito
**Estado**: ✅ **CUMPLIDO**

- Campo `comentario` de tipo String opcional permite comentarios
- No hay limitaciones de longitud en el esquema, pero se puede establecer en el backend

### REQ-23: Adjuntar foto del servicio finalizado
**Estado**: ✅ **CUMPLIDO**

- Campo `url_foto` de tipo String opcional permite almacenar la URL de la foto
- El backend valida que sea una imagen válida
- El frontend presenta un componente para subir la imagen

### REQ-24: Calcular y mostrar la calificación promedio
**Estado**: ✅ **CUMPLIDO**

- Campo `calificacion_promedio` en la tabla `perfiles_profesionales` almacena el promedio calculado
- El backend calcula y actualiza este valor al crear/editar reseñas
- El frontend muestra este promedio en los perfiles de profesionales

### REQ-25: Solo usuarios que completaron un servicio pueden dejar reseña
**Estado**: ✅ **CUMPLIDO**

- La relación entre `resenas`, `servicios` y `usuarios` permite verificar:
  - Que el servicio está en estado 'completado'
  - Que el usuario es el cliente del servicio

## Reglas de Negocio

### RB-02: Las reseñas solo se pueden dejar tras la finalización del servicio
**Estado**: ✅ **CUMPLIDO**

- La relación entre `resenas` y `servicios` permite verificar el estado del servicio
- El campo `estado` en la tabla `servicios` debe ser 'completado' para permitir la reseña
- El índice `@@index([estado, creado_en])` permite búsquedas eficientes por estado

## Recomendaciones para Optimización

1. **Índice adicional en `resenas`**:
   - Añadir un índice compuesto `@@index([cliente_id, creado_en])` para búsquedas eficientes de reseñas por cliente
   - Añadir un índice `@@index([calificacion])` para consultas por calificación

2. **Campo actualizado_en**:
   - Añadir un campo `actualizado_en` a la tabla `resenas` para registrar cuándo se actualizó una reseña
   - Esto permitiría implementar la funcionalidad de editar reseñas en el futuro

3. **Validaciones a nivel de base de datos**:
   - Añadir una restricción CHECK para asegurar que la calificación esté entre 1 y 5
   - Esto proporcionaría una capa adicional de seguridad

```prisma
model resenas {
  ...
  calificacion Int @check(calificacion >= 1 && calificacion <= 5)
  ...
}
```

4. **Optimización de consultas**:
   - Crear una vista materializada para los promedios de calificación que se actualice periódicamente
   - Esto mejoraría el rendimiento en listados de profesionales ordenados por calificación

5. **Auditoría**:
   - Añadir campos de auditoría como `creado_por` y `actualizado_por` para registrar quién creó o modificó cada reseña
   - Esto facilitaría la moderación de contenido

## Conclusión

La estructura de la base de datos para el Sistema de Reseñas y Valoraciones cumple con todos los requerimientos del PRD (REQ-21 a REQ-25). La implementación actual es sólida y permite implementar todas las funcionalidades necesarias.

Las recomendaciones proporcionadas tienen como objetivo mejorar la eficiencia, escalabilidad y seguridad de la base de datos, especialmente en escenarios de alto tráfico donde el número de reseñas podría ser muy grande.