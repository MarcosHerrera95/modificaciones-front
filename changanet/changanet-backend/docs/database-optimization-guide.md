# Guía de Optimización de Base de Datos - Changánet

## 📌 Índices Estratégicos Implementados

### Índices Agregados
- **`usuarios.rol`**: Para filtrar usuarios por tipo (cliente/profesional)
- **`usuarios.esta_verificado`**: Para consultas de usuarios verificados
- **`perfiles_profesionales.especialidad`**: Para búsquedas por especialidad (REQ-12)
- **`perfiles_profesionales.zona_cobertura`**: Para búsquedas por zona (REQ-12)
- **`perfiles_profesionales.calificacion_promedio`**: Para ordenar por calificación (REQ-14)
- **`servicios.cliente_id`**: Para consultas de servicios por cliente
- **`servicios.profesional_id`**: Para consultas de servicios por profesional
- **`servicios.estado`**: Para filtrar servicios por estado
- **`resenas.servicio_id`**: UNIQUE para RB-02 (una reseña por servicio)

### Beneficios de los Índices
- **Búsquedas rápidas**: Consultas por zona, especialidad y calificación < 2s
- **Escalabilidad**: Soporte para 100k usuarios sin degradación de rendimiento
- **Optimización de JOINs**: Índices en FKs reducen consultas N+1

## 🎯 Consultas Optimizadas con Include

### Evitar Consultas N+1
```javascript
// ✅ Optimizado: Una sola consulta con include
const profesionales = await prisma.perfiles_profesionales.findMany({
  include: {
    usuario: true, // Evita consulta adicional por usuario
    servicios_como_profesional: {
      include: {
        cliente: true, // Evita consulta adicional por cliente
        resena: true  // Evita consulta adicional por reseña
      }
    }
  },
  where: {
    zona_cobertura: zona,
    especialidad: especialidad,
    calificacion_promedio: { gte: minCalificacion }
  },
  orderBy: { calificacion_promedio: 'desc' }
});

// ❌ No optimizado: Múltiples consultas (N+1 problem)
const profesionales = await prisma.perfiles_profesionales.findMany();
for (const prof of profesionales) {
  const usuario = await prisma.usuarios.findUnique({ where: { id: prof.usuario_id } });
  // ... más consultas
}
```

### Consultas de Búsqueda (REQ-12, REQ-14)
```javascript
// Búsqueda por zona y especialidad
const resultados = await prisma.perfiles_profesionales.findMany({
  include: { usuario: true },
  where: {
    zona_cobertura: { contains: zona, mode: 'insensitive' },
    especialidad: { contains: especialidad, mode: 'insensitive' },
    calificacion_promedio: { gte: minCalificacion }
  },
  orderBy: { calificacion_promedio: 'desc' },
  take: 20
});
```

### Consultas de Servicios con Relaciones
```javascript
// Servicios de un cliente con todas las relaciones
const serviciosCliente = await prisma.servicios.findMany({
  where: { cliente_id: clienteId },
  include: {
    profesional: { include: { perfil_profesional: true } },
    resena: true
  },
  orderBy: { creado_en: 'desc' }
});
```

## 🔧 Tipos de Datos Optimizados

### Enums para Estados
- **`EstadoServicio`**: `PENDIENTE | AGENDADO | COMPLETADO | CANCELADO`
- **`EstadoCotizacion`**: `PENDIENTE | ACEPTADO | RECHAZADO`

### Booleanos Eficientes
- **`esta_verificado`**: Boolean (antes String)
- **`esta_leido`**: Boolean (mensajes y notificaciones)

## ✅ Validaciones en Base de Datos

### Validaciones Implementadas
- **Reseñas**: `calificacion` debe estar entre 1 y 5 (validación en aplicación)
- **Cotizaciones**: `precio > 0` (validación en aplicación)

### Validaciones en Código
```javascript
// Validación de reseñas
if (calificacion < 1 || calificacion > 5) {
  throw new Error('Calificación debe estar entre 1 y 5');
}

// Validación de cotizaciones
if (precio <= 0) {
  throw new Error('Precio debe ser mayor a 0');
}
```

## 📊 Rendimiento Esperado

### Métricas de Rendimiento
- **Búsquedas**: < 2 segundos para 100k registros
- **Consultas con JOINs**: Optimizadas con índices en FKs
- **Escalabilidad**: Soporte para crecimiento a 100k usuarios
- **Memoria**: Consultas paginadas (take: 20) para listas

### Monitoreo Recomendado
- Usar `EXPLAIN QUERY PLAN` en SQLite para verificar uso de índices
- Monitorear queries lentas con Prisma Middleware
- Implementar caché para consultas frecuentes

## 🚀 Próximos Pasos

### Para Fase 3 (Pagos)
- Agregar índices en campos de pago
- Considerar particionamiento por fecha
- Implementar índices compuestos si es necesario

Esta optimización asegura que la base de datos cumpla con los requisitos de rendimiento del PRD v1.0 para Sprints 1-6.