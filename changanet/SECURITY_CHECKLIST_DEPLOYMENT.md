# CHECKLIST DE DESPLIEGUE Y SEGURIDAD - AUTENTICACIÓN CHANGANET

## Variables de Entorno Requeridas

### Base de Datos
- [ ] `DATABASE_URL`: URL completa de PostgreSQL con credenciales
- [ ] `NODE_ENV`: `production` para entorno de producción

### JWT y Autenticación
- [ ] `JWT_SECRET`: Clave secreta para JWT (mínimo 32 caracteres, generado aleatoriamente)
- [ ] `JWT_REFRESH_SECRET`: Clave secreta para refresh tokens (diferente de JWT_SECRET)

### Email Service (SendGrid)
- [ ] `SENDGRID_API_KEY`: API Key de SendGrid para envío de emails
- [ ] `FROM_EMAIL`: Email verificado en SendGrid (ej: noreply@changanet.com.ar)

### OAuth Google
- [ ] `GOOGLE_CLIENT_ID`: Client ID de Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET`: Client Secret de Google OAuth
- [ ] `GOOGLE_CALLBACK_URL`: URL de callback (https://api.changanet.com/auth/google/callback)

### OAuth Facebook
- [ ] `FACEBOOK_APP_ID`: App ID de Facebook
- [ ] `FACEBOOK_APP_SECRET`: App Secret de Facebook
- [ ] `FACEBOOK_CALLBACK_URL`: URL de callback (https://api.changanet.com/auth/facebook/callback)

### Frontend
- [ ] `VITE_BACKEND_URL`: URL del backend (https://api.changanet.com)
- [ ] `VITE_FRONTEND_URL`: URL del frontend (https://changanet.com.ar)

## Configuración de Seguridad

### HTTPS Obligatorio
- [ ] Certificado SSL/TLS válido instalado
- [ ] Redirección automática HTTP → HTTPS
- [ ] Headers de seguridad configurados:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`

### CORS Configurado
- [ ] Solo dominios permitidos: `https://changanet.com.ar`
- [ ] Métodos permitidos: `GET, POST, PUT, DELETE, OPTIONS`
- [ ] Headers permitidos: `Content-Type, Authorization`

### Rate Limiting Verificado
- [ ] Login: 5 intentos/15min, bloqueo 30min
- [ ] Registro: 3 intentos/hora, bloqueo 1hora
- [ ] Forgot Password: 3 intentos/hora, bloqueo 1hora
- [ ] Google/Facebook Login: 5 intentos/15min

### Base de Datos
- [ ] Conexión SSL habilitada
- [ ] Credenciales de solo lectura para queries no autenticadas
- [ ] Backup automático configurado
- [ ] Logs de queries sensibles habilitados

## Checklist de Despliegue

### Pre-Despliegue
- [ ] Tests unitarios pasan: `npm test`
- [ ] Tests de integración pasan: `npm run test:integration`
- [ ] Linter sin errores: `npm run lint`
- [ ] Build de producción exitoso: `npm run build`
- [ ] Variables de entorno configuradas en servidor
- [ ] Base de datos migrada: `npx prisma migrate deploy`

### Despliegue Backend
- [ ] Servidor Node.js configurado (PM2/Ecosystem)
- [ ] Puerto correcto configurado (3004 para desarrollo, 443 para producción)
- [ ] Logs configurados y monitoreados
- [ ] Health checks funcionando: `GET /health`
- [ ] Métricas de aplicación habilitadas

### Despliegue Frontend
- [ ] Build optimizado generado
- [ ] Assets servidos con cache headers apropiados
- [ ] Service Worker registrado (si aplica)
- [ ] PWA manifest configurado

### Post-Despliegue
- [ ] Endpoint `/auth/me` responde correctamente
- [ ] Registro de usuario funciona
- [ ] Login con email funciona
- [ ] Login con Google funciona
- [ ] Verificación de email funciona
- [ ] Recuperación de contraseña funciona
- [ ] Emails se envían correctamente

## Monitoreo y Alertas

### Métricas a Monitorear
- [ ] Tasa de error de autenticación (< 2%)
- [ ] Tiempo de respuesta de login (< 500ms P95)
- [ ] Tasa de conversión de registro (> 60%)
- [ ] Emails enviados vs entregados
- [ ] Uso de OAuth vs registro tradicional

### Alertas Configuradas
- [ ] Error rate > 5% en endpoints de auth
- [ ] Fallos en envío de emails
- [ ] Ataques de fuerza bruta detectados
- [ ] Base de datos sin conexión
- [ ] Certificado SSL próximo a expirar

## Checklist de Seguridad Final

### Autenticación
- [ ] Passwords hasheados con bcrypt (cost ≥ 12)
- [ ] JWT tokens con expiración corta (15min)
- [ ] Refresh tokens revocables y hashed en DB
- [ ] Lockout automático después de 5 intentos fallidos
- [ ] Rate limiting en todos los endpoints sensibles

### Autorización
- [ ] Middleware de autenticación en rutas protegidas
- [ ] Validación de roles de usuario
- [ ] CORS restrictivo configurado
- [ ] Headers de seguridad implementados

### Datos Sensibles
- [ ] PII encriptado en tránsito y reposo
- [ ] Logs no contienen información sensible
- [ ] Backup encriptado
- [ ] Eliminación segura de datos temporales

### Cumplimiento Legal
- [ ] Aviso de privacidad implementado
- [ ] Términos y condiciones disponibles
- [ ] Consentimiento para tratamiento de datos
- [ ] Procedimiento de eliminación de cuenta implementado

---

**Fecha de Creación:** 24 de noviembre de 2025
**Responsable:** Equipo de Desarrollo Changánet
**Próxima Revisión:** Mensual

**Notas:**
- Este checklist debe completarse antes de cada despliegue
- Mantener confidencial las claves secretas
- Revisar logs regularmente por actividades sospechosas