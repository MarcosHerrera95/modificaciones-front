# 📊 Panel de Administración - Changánet

Manual de usuario para administradores de la plataforma Changánet.

## 🚀 Inicio Rápido

### Acceso al Panel
1. Ve a `https://admin.changanet.com` (o tu dominio de administración)
2. Inicia sesión con tus credenciales de administrador
3. Selecciona el módulo que deseas gestionar

### Credenciales por Defecto (Cambiar Inmediatamente)
- **Email**: admin@changanet.com
- **Password**: Admin123!
- ⚠️ **IMPORTANTE**: Cambia esta contraseña en tu primer login

## 📋 Funciones Principales

### 1. Dashboard General
Vista general del estado de la plataforma con métricas clave:
- **Usuarios**: Total registrados, verificados, pendientes
- **Servicios**: Total, completados, tasa de finalización
- **Pagos**: Procesados, ingresos totales
- **Moderación**: Disputas activas, reportes pendientes
- **Administradores**: Total activos

### 2. Gestión de Usuarios
- **Listado de usuarios** con filtros avanzados
- **Bloquear/Desbloquear** cuentas
- **Cambiar roles** (cliente ↔ profesional)
- **Ver detalles completos** de perfiles
- **Exportar** listas de usuarios

### 3. Verificación de Identidad
- **Revisar solicitudes pendientes**
- **Aprobar/Rechazar** verificaciones
- **Ver documentos** de identidad
- **Historial** de verificaciones por usuario

### 4. Moderación de Contenido
- **Reportes de moderación** (reseñas, usuarios, contenido)
- **Asignar reportes** a administradores
- **Resolver disputas** con notas
- **Eliminar contenido** inapropiado
- **Historial** de acciones de moderación

### 5. Gestión de Disputas
- **Ver disputas activas** de pagos
- **Resolver disputas** con diferentes opciones
- **Procesar reembolsos** cuando corresponda
- **Historial completo** de resolución

### 6. Auditoría y Logs
- **Registro completo** de acciones administrativas
- **Filtros por fecha, acción, administrador**
- **Export de logs** para compliance
- **Alertas** de acciones críticas

### 7. Configuración del Sistema
- **Comisiones**: Ajustar porcentajes (5-10%)
- **Límites de plataforma**: Tamaños de archivo, rate limits
- **Notificaciones**: Configurar alertas del sistema
- **Seguridad**: MFA, timeouts de sesión

## 🔐 Roles y Permisos

### Super Admin
- ✅ Todas las funciones del sistema
- ✅ Gestionar otros administradores
- ✅ Cambiar configuraciones críticas
- ✅ Ver todos los logs de auditoría

### Manager
- ✅ Ver métricas y estadísticas
- ✅ Moderar contenidos y resolver disputas
- ✅ Gestionar usuarios (excepto cambiar roles críticos)
- ✅ Ver logs de auditoría
- ❌ Cambiar comisiones
- ❌ Gestionar otros administradores

### Support
- ✅ Ver información básica de usuarios
- ✅ Aprobar/rechazar verificaciones
- ✅ Moderar contenidos básicos
- ✅ Ver logs limitados
- ❌ Gestionar pagos o configuraciones
- ❌ Resolver disputas complejas

## 📊 Reportes y Analytics

### Reportes Disponibles
- **Usuarios**: Registro, actividad, verificación
- **Servicios**: Completados, cancelados, por categoría
- **Financiero**: Ingresos, comisiones, reembolsos
- **Moderación**: Reportes resueltos, tiempos de respuesta

### Export de Datos
- **Formatos**: CSV, JSON
- **Filtros**: Por fecha, tipo, estado
- **Compresión**: Archivos grandes se comprimen automáticamente

## 🚨 Acciones Críticas

### Requerimientos de Doble Confirmación
- Bloquear usuario permanentemente
- Eliminar contenido masivo
- Procesar reembolso > $1000
- Cambiar configuración de comisiones
- Eliminar cuenta de administrador

### Notificaciones Automáticas
- Login de administrador desde IP desconocida
- Acción crítica realizada
- Error en procesamiento de pago
- Sistema de moderación sobrecargado

## 🔒 Seguridad

### Mejores Prácticas
- **Cambia tu contraseña** regularmente
- **Usa MFA** cuando esté disponible
- **Cierra sesión** al terminar tu turno
- **No compartas** credenciales de acceso
- **Verifica URLs** antes de hacer login

### Sesiones
- **Timeout**: 8 horas de inactividad
- **Máximo concurrente**: 1 sesión por administrador
- **Historial**: Todas las sesiones quedan registradas

## 📞 Soporte y Contacto

### Para Problemas Técnicos
- **Email**: soporte@changanet.com
- **Teléfono**: +54 11 1234-5678
- **Horario**: Lunes a Viernes, 9:00 - 18:00

### Para Emergencias
- **Email**: emergencias@changanet.com
- **Teléfono**: +54 11 9876-5432
- **Disponible**: 24/7

## 📚 Glosario

- **Verificación**: Proceso de validar identidad de usuarios
- **Moderación**: Revisión de contenido reportado como inapropiado
- **Disputa**: Conflicto entre cliente y profesional sobre un servicio
- **Comisión**: Porcentaje que cobra la plataforma por cada transacción
- **Auditoría**: Registro de todas las acciones administrativas

## 🎯 KPIs a Monitorear

### Diarios
- Nuevos usuarios registrados
- Servicios completados
- Reportes de moderación resueltos
- Ingresos generados

### Semanales
- Tasa de verificación de usuarios
- Tiempo promedio de resolución de disputas
- Satisfacción de usuarios (reseñas)
- Uso del panel de administración

### Mensuales
- Crecimiento de usuarios activos
- Retención de profesionales
- Ingresos vs objetivos
- Métricas de seguridad (intentos de acceso no autorizado)

---

## 📝 Notas de la Versión

### v1.0.0 - Panel de Administración Completo
- ✅ Dashboard con métricas en tiempo real
- ✅ Sistema de roles y permisos (RBAC)
- ✅ Moderación completa de contenido
- ✅ Gestión de disputas y reembolsos
- ✅ Auditoría completa de acciones
- ✅ Export de reportes y datos
- ✅ Configuración flexible del sistema

**Fecha de lanzamiento**: Noviembre 2025
**Compatibilidad**: Backend v2.1.0+, Frontend v1.3.0+

---

*Este manual se actualiza con cada nueva versión. Para la versión más reciente, consulta la documentación técnica completa.*