# Checklist de Seguridad y Guía de Despliegue - Módulo de Autenticación

## Checklist de Seguridad

### ✅ Contraseñas
- [x] Contraseñas hasheadas con bcrypt (cost ≥ 12)
- [x] Validación de fortaleza de contraseña (mínimo 10 caracteres)
- [x] Prevención de contraseñas comunes
- [x] Validación de caracteres especiales, números y mayúsculas

### ✅ Tokens JWT
- [x] Access tokens con expiración corta (15 minutos)
- [x] Refresh tokens revocables y almacenados hashed en DB
- [x] Refresh tokens con expiración larga (30 días)
- [x] Endpoint de refresh token seguro
- [x] Logout que revoca todos los refresh tokens del usuario

### ✅ Rate Limiting
- [x] Rate limiting en endpoints sensibles (registro/login/forgot)
- [x] Límites apropiados: 5 login, 3 registro/forgot por IP por tiempo
- [x] Bloqueo temporal por abuso

### ✅ Lockout de Cuenta
- [x] Bloqueo automático tras 5 intentos fallidos de login
- [x] Bloqueo por 15 minutos
- [x] Reset de contador en login exitoso
- [x] Verificación de expiración de bloqueo

### ✅ Validación y Sanitización
- [x] Validación de formato de email (RFC compliant)
- [x] Sanitización de inputs
- [x] Validación de roles permitidos
- [x] Prevención de SQL injection (ORM Prisma)

### ✅ Almacenamiento Seguro
- [x] Tokens sensibles almacenados hashed (no en texto plano)
- [x] Información PII manejada conforme a estándares
- [x] Logs de seguridad estructurados

### ✅ Autenticación OAuth
- [x] Google OAuth implementado con Passport.js
- [x] Facebook OAuth implementado con Passport.js
- [x] Vinculación automática de cuentas sociales
- [x] Usuarios OAuth marcados como verificados automáticamente

### ✅ Verificación de Email
- [x] Envío de emails de verificación con tokens expirantes
- [x] Opción de reenviar email de verificación
- [x] Endpoint seguro para verificación
- [x] Prevención de abuso en reenvío

### ✅ Recuperación de Contraseña
- [x] Endpoint forgot-password con respuesta genérica
- [x] Tokens de reset expirantes (1 hora)
- [x] Validación de fortaleza en nueva contraseña
- [x] Endpoint seguro para reset

### ✅ HTTPS y CORS
- [x] Configuración HTTPS requerida en producción
- [x] CORS restringido a dominios permitidos
- [x] Headers de seguridad apropiados

### ✅ Logs de Seguridad
- [x] Logging de intentos fallidos de login
- [x] Logging de acciones críticas (registro, verificación, reset)
- [x] Logging de accesos OAuth
- [x] Información de IP en logs

## Guía de Despliegue

### Variables de Entorno Requeridas

```bash
# Base de datos
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="tu-jwt-secret-super-seguro"
JWT_REFRESH_SECRET="tu-refresh-secret-diferente"

# OAuth Google
GOOGLE_CLIENT_ID="tu-google-client-id"
GOOGLE_CLIENT_SECRET="tu-google-client-secret"
GOOGLE_CALLBACK_URL="https://tu-dominio.com/api/auth/google/callback"

# OAuth Facebook
FACEBOOK_APP_ID="tu-facebook-app-id"
FACEBOOK_APP_SECRET="tu-facebook-app-secret"
FACEBOOK_CALLBACK_URL="https://tu-dominio.com/api/auth/facebook/callback"

# Email (SendGrid)
SENDGRID_API_KEY="tu-sendgrid-api-key"
FROM_EMAIL="noreply@tu-dominio.com"

# Frontend
FRONTEND_URL="https://tu-dominio.com"
```

### Configuración de Producción

1. **HTTPS Obligatorio**: Configurar SSL/TLS con certificado válido
2. **Variables de Entorno**: Nunca commitear secrets al repositorio
3. **Rate Limiting**: Configurar límites apropiados para tu carga esperada
4. **Logs**: Configurar rotación y monitoreo de logs de seguridad
5. **Backups**: Programar backups regulares de la base de datos
6. **Monitoreo**: Implementar alertas para intentos de login fallidos masivos

### Configuración de OAuth

#### Google OAuth:
1. Crear proyecto en Google Cloud Console
2. Habilitar Google+ API
3. Crear credenciales OAuth 2.0
4. Configurar URLs autorizadas:
   - Redirect URI: `https://tu-dominio.com/api/auth/google/callback`

#### Facebook OAuth:
1. Crear app en Facebook Developers
2. Configurar Facebook Login
3. Agregar dominio a App Domains
4. Configurar Valid OAuth Redirect URIs:
   - Redirect URI: `https://tu-dominio.com/api/auth/facebook/callback`

### Configuración de Email

#### SendGrid:
1. Crear cuenta en SendGrid
2. Verificar dominio o email remitente
3. Generar API Key
4. Configurar templates de email (opcional pero recomendado)

### Pruebas de Seguridad

Antes del despliegue, ejecutar:

```bash
# Tests unitarios
npm test -- --testPathPattern=authController

# Tests de integración
npm run test:integration

# Tests de seguridad manuales
- Intentar login con credenciales inválidas
- Verificar rate limiting
- Probar recuperación de contraseña
- Verificar OAuth flows
- Probar verificación de email
```

### Monitoreo Post-Despliegue

1. **Logs de Seguridad**: Monitorear intentos fallidos de login
2. **Alertas**: Configurar alertas para actividad sospechosa
3. **Auditoría**: Revisar logs regularmente
4. **Updates**: Mantener dependencias actualizadas

## Endpoints Implementados

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login con email/contraseña
- `POST /api/auth/refresh` - Refresh de access token
- `POST /api/auth/logout` - Logout y revocación de tokens
- `GET /api/auth/verify-email` - Verificación de email
- `POST /api/auth/resend-verification` - Reenviar verificación
- `POST /api/auth/forgot-password` - Solicitar reset de contraseña
- `POST /api/auth/reset-password` - Reset de contraseña

### OAuth
- `GET /api/auth/google` - Iniciar OAuth Google
- `GET /api/auth/google/callback` - Callback OAuth Google
- `POST /api/auth/google-login` - Login con Google desde frontend
- `GET /api/auth/facebook` - Iniciar OAuth Facebook
- `GET /api/auth/facebook/callback` - Callback OAuth Facebook
- `POST /api/auth/facebook-login` - Login con Facebook desde frontend

### Usuario
- `GET /api/auth/me` - Obtener datos del usuario actual

## Modelo de Base de Datos

### usuarios
- id: UUID (PK)
- email: String (único)
- hash_contrasena: String (nullable para OAuth)
- nombre: String
- rol: String (cliente/profesional/admin)
- esta_verificado: Boolean
- bloqueado: Boolean
- bloqueado_hasta: DateTime
- failed_login_attempts: Int
- token_verificacion: String (único, nullable)
- token_expiracion: DateTime
- google_id: String (único, nullable)
- facebook_id: String (único, nullable)
- url_foto_perfil: String

### refresh_tokens
- id: UUID (PK)
- user_id: UUID (FK)
- token_hash: String (único)
- issued_at: DateTime
- expires_at: DateTime
- revoked: Boolean

## Próximos Pasos

1. Implementar 2FA (autenticación de dos factores)
2. Agregar bloqueo por IP además de por usuario
3. Implementar detección de anomalías
4. Agregar auditoría completa de accesos
5. Implementar gestión de sesiones activas