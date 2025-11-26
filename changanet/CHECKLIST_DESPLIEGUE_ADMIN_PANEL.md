# Checklist de Despliegue - Panel de Administración Changánet

## 📋 Lista de Verificación Pre-Despliegue

### 1. Base de Datos
- [ ] Ejecutar `setup-admin-panel.js` para crear datos iniciales
- [ ] Verificar que todas las tablas nuevas existen:
  - `admin_profile`
  - `admin_audit_log`
  - `moderation_reports`
  - `settings`
- [ ] Confirmar índices de rendimiento en tablas de auditoría
- [ ] Validar constraints de foreign keys

### 2. Backend
- [ ] Verificar que todas las rutas de admin están protegidas con RBAC
- [ ] Confirmar middleware de auditoría en acciones críticas
- [ ] Validar configuración de rate limiting para endpoints sensibles
- [ ] Verificar logs de auditoría funcionando correctamente
- [ ] Confirmar OpenAPI/Swagger documentation actualizada

### 3. Frontend
- [ ] Verificar componentes de moderación implementados
- [ ] Confirmar dashboard de auditoría funcional
- [ ] Validar filtros y búsquedas en listados
- [ ] Verificar permisos UI (ocultar botones según rol)
- [ ] Confirmar responsive design en todas las vistas

### 4. Seguridad
- [ ] Configurar credenciales de admin por defecto (cambiar en producción)
- [ ] Verificar encriptación de datos sensibles
- [ ] Confirmar validación de inputs en todos los formularios
- [ ] Validar sanitización de datos para prevenir XSS
- [ ] Verificar protección CSRF en formularios críticos

### 5. Configuración
- [ ] Establecer variables de entorno:
  - `JWT_SECRET` (fuerte y único)
  - `SESSION_SECRET` (para Passport)
  - `ADMIN_EMAIL` (email del administrador)
  - `RATE_LIMIT_*` (configuración de rate limiting)
- [ ] Configurar permisos de archivos (logs de auditoría)
- [ ] Establecer retención de logs de auditoría (90 días)

## 🚀 Pasos de Despliegue

### Fase 1: Preparación
```bash
# 1. Backup de base de datos existente
pg_dump changanet_db > backup_pre_admin_panel.sql

# 2. Ejecutar setup del panel de administración
cd changanet-backend
node setup-admin-panel.js

# 3. Verificar configuración
npm run test:admin
```

### Fase 2: Despliegue Backend
```bash
# 1. Build de producción
npm run build

# 2. Ejecutar migraciones si es necesario
npx prisma migrate deploy

# 3. Iniciar servicios
npm run start:prod

# 4. Verificar health check
curl http://localhost:3002/health
```

### Fase 3: Despliegue Frontend
```bash
# 1. Build de producción
npm run build

# 2. Deploy a servidor web
# Configurar nginx/apache para servir archivos estáticos
# Configurar proxy reverso para /api/*

# 3. Verificar carga inicial
curl -I http://localhost/admin
```

### Fase 4: Configuración Post-Despliegue
```bash
# 1. Cambiar contraseña de admin por defecto
# Iniciar sesión como admin@changanet.com / Admin123!
# Cambiar contraseña inmediatamente

# 2. Configurar permisos de administradores
# Asignar roles apropiados a usuarios existentes

# 3. Verificar funcionalidades críticas
- Login de admin
- Verificación de usuarios
- Moderación de contenido
- Logs de auditoría
- Export de reportes
```

## 🔍 Verificaciones Post-Despliegue

### Funcionalidades Críticas
- [ ] Login de administrador funciona
- [ ] Dashboard muestra estadísticas correctas
- [ ] Verificación de usuarios funciona
- [ ] Moderación de reseñas funciona
- [ ] Logs de auditoría se registran
- [ ] Export de datos funciona
- [ ] Rate limiting no bloquea uso normal

### Seguridad
- [ ] Endpoints de admin requieren autenticación
- [ ] RBAC funciona correctamente
- [ ] Auditoría registra todas las acciones críticas
- [ ] No hay datos sensibles en logs
- [ ] Headers de seguridad configurados

### Rendimiento
- [ ] Dashboard carga en < 3 segundos
- [ ] Listados con paginación funcionan
- [ ] Filtros aplican correctamente
- [ ] Export de datos no excede tiempo límite

## 📊 Monitoreo y Mantenimiento

### Métricas a Monitorear
- Uso del panel de administración (logins, acciones)
- Tasa de error en endpoints de admin
- Rendimiento de queries de auditoría
- Almacenamiento de logs de auditoría

### Tareas de Mantenimiento
- [ ] Rotación de logs de auditoría (mensual)
- [ ] Limpieza de datos antiguos (según política de retención)
- [ ] Actualización de permisos según cambios organizacionales
- [ ] Revisión de seguridad trimestral

## 🚨 Plan de Rollback

En caso de problemas críticos:

```bash
# 1. Detener servicios
docker-compose down

# 2. Restaurar backup de BD
psql changanet_db < backup_pre_admin_panel.sql

# 3. Revertir código a versión anterior
git checkout <previous_commit>

# 4. Reiniciar servicios
docker-compose up -d
```

## 📞 Contactos de Emergencia

- **Desarrollador Principal**: [Nombre] - [Email] - [Teléfono]
- **Administrador de Sistema**: [Nombre] - [Email] - [Teléfono]
- **Equipo de Seguridad**: [Nombre] - [Email] - [Teléfono]

## ✅ Criterios de Aceptación

- [ ] Admin con rol manager puede ver métricas y moderar contenidos
- [ ] Todas las acciones críticas quedan registradas en admin_audit_log
- [ ] Filtrado y export funcionan en listados con >100k registros
- [ ] Pruebas unitarias pasan en CI
- [ ] Endpoints claves tienen coverage mínimo del 80%
- [ ] Documentación técnica completa y actualizada
- [ ] Manual de usuario para administradores disponible

---

**Fecha de Despliegue**: _______________
**Versión Desplegada**: _______________
**Responsable del Despliegue**: _______________
**Notas Adicionales**: _______________