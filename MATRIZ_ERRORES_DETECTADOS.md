# MATRIZ COMPLETA DE ERRORES DETECTADOS - CHANGANET

| ID | Severidad | Archivo/Componente | Línea | Descripción | Causa | Impacto | FIX recomendado |
|----|-----------|-------------------|-------|-------------|-------|---------|-----------------|
| 1 | 🔴 Crítico | changanet-backend/prisma/schema.prisma | 147-162 | Esquema de BD inconsistente - tabla `mensajes` no coincide con controlador | Campos faltantes: `conversation_id`, `sender_id`, `status` | 100% sistema chat down | Crear migración para tabla `conversations` |
| 2 | 🔴 Crítico | changanet-backend/src/controllers/unifiedChatController.js | 127,161,334 | Tabla `conversations` no existe en BD | Controlador usa `prisma.conversations` sin definición | 100% operaciones chat fallan | Implementar esquema `conversations` |
| 3 | 🔴 Crítico | changanet-backend/src/services/unifiedWebSocketService.js | 231 | Import inválido `notifyNewMessage` | Servicio `chatService` no existe | 100% WebSocket fallará | Crear `chatService` con notificaciones |
| 4 | 🔴 Crítico | changanet-backend/src/controllers/unifiedChatController.js | 33-58 | Rate limiting deshabilitado | Código comentado, funciones no-op | Sin protección anti-spam | Habilitar rate limiting real |
| 5 | 🟡 Medio | changanet-frontend/src/components/ChatWindow.jsx | 24 | Componente `LoadingSpinner` faltante | Import de componente inexistente | Frontend chat fallará | Crear componente `LoadingSpinner` |
| 6 | 🟡 Medio | Test suite | - | Dependencias faltantes | `axios`, `@prisma/client` no instalados | Desarrollo complicado | Instalar dependencias |
| 7 | 🟢 Menor | changanet-frontend/src/components/ChatWindow.jsx | 362-371 | Upload imágenes simulado | Solo placeholder, no sube realmente | Funcionalidad limitada | Implementar upload real |
| 8 | 🔴 Crítico | changanet-frontend/src/context/AuthProvider.jsx | 48 | Endpoint incorrecto `/api/profile` | URL hardcodeada errónea | Validación sesión fallaba | Corregir endpoint a `/api/auth/me` |
| 9 | 🟡 Medio | changanet-frontend/src/components/GoogleLoginButton.jsx | 52 | Campo foto inconsistente | `foto` vs `photoURL` | Fotos Google no guardaban | Unificar campo a `photoURL` |
| 10 | 🟡 Medio | changanet-backend/src/controllers/authController.js | 659-667 | Variables undefined en logs | Referencia `user` antes de definición | Errores en reset password | Definir variable `user` antes de usar |
| 11 | 🟡 Medio | Controladores múltiples | - | Múltiples instancias PrismaClient | Instanciación en cada archivo | Memory leaks, conexiones excesivas | Implementar patrón singleton para PrismaClient |
| 12 | 🟢 Menor | Consultas agregadas | - | Consultas N+1 no optimizadas | Relaciones eager loading faltante | Performance degradada | Usar `include` en consultas Prisma |
| 13 | 🔴 Crítico | ChatContext.jsx | 29 | WebSocket connection failed | WebSocket is closed before connection established | Conexión chat inestable | Implementar control de ciclo de vida robusto |
| 14 | 🔴 Crítico | Chat.jsx | 68 | Bucle infinito en resolveConversationId | Recursión no controlada entre funciones | Aplicación inutilizable | Eliminar recursión y controlar estados |
| 15 | 🟡 Medio | Chat.jsx | 91 | Error 429 (Too Many Requests) | Solicitudes múltiples simultáneas sin control | Rate limiting bloquea usuario | Implementar debounce y control de concurrencia |
| 16 | 🟡 Medio | MisCotizacionesProfesional.jsx | - | IDs de cliente falsos hardcodeados | Uso de IDs fake (123, 124, 125, 126) | Chat no funciona con usuarios reales | Usar IDs reales de base de datos |
| 17 | 🔴 Crítico | Backend chat | - | Tabla `conversations` no existe | Esquema de BD incompleto | Sistema de chat no funcional | Crear tabla `conversations` en BD |
| 18 | 🟡 Medio | chatController.js | 195-210 | Validación demasiado estricta en GET conversation | Regex validation excesiva | Errores en conversaciones válidas | Simplificar validación de conversationId |
| 19 | 🟡 Medio | Endpoint resolución UUID | - | Búsqueda de mensajes con UUID como remitente | Mensajes usan IDs reales, no UUIDs | Endpoint no encuentra mensajes | Corregir lógica de búsqueda de mensajes |
| 20 | 🔴 Crítico | NotificationController.js | - | Error de contexto `this` perdido | Métodos sin `.bind()` en rutas Express | 100% notificaciones fallan | Aplicar `.bind(this)` a todos los métodos |
| 21 | 🟡 Medio | RankingController.js | 309 | Referencia incorrecta `prof.usuario.nombre` | Debería ser `prof.usuarios.nombre` | Rankings muestran datos incorrectos | Corregir referencia de propiedad |
| 22 | 🟡 Medio | AutoReleaseService.js | - | Import incorrecto `createNotification` | Función no existe en notificationService | Liberación automática de fondos falla | Importar clase NotificationService correctamente |
| 23 | 🔴 Crítico | NotificationRoutes.js | - | Métodos sin `.bind()` | Pérdida de contexto `this` | Todos los endpoints de notificaciones fallan | Aplicar `.bind(notificationController)` |
| 24 | 🔴 Crítico | /api/chat/open-or-create | - | Error 500 Internal Server Error | Token JWT malformado | Usuario no puede abrir chat | Validar y limpiar tokens corruptos automáticamente |
| 25 | 🟡 Medio | JWT Token | - | Token malformado "jwt malformed" | Token corrupto en localStorage | Error 403 en autenticación | Implementar validación de formato JWT |
| 26 | 🟡 Medio | Frontend API | - | URL de API incorrecta puerto 3003 vs 3004 | Configuración inconsistente | Requests fallan | Unificar configuración de backend URL |
| 27 | 🟡 Medio | PayButton.jsx | - | Endpoint incorrecto `/api/payments/create` | URL hardcodeada errónea | Integración Mercado Pago falla | Corregir a `/api/payments/create-preference` |
| 28 | 🔴 Crítico | Prisma schema | - | Type "resenas" is neither a built-in type, nor refers to another model | Esquema desactualizado vs BD real | Backend no inicia | Sincronizar esquema con `npx prisma db pull --force` |

## Resumen Estadístico

- **Total de errores detectados**: 28
- **Errores críticos (🔴)**: 11 (39%)
- **Errores medios (🟡)**: 13 (46%)
- **Errores menores (🟢)**: 4 (14%)

## Categorización por Área

### Backend: 15 errores
- Base de datos: 5
- Controladores: 4
- Servicios: 3
- Autenticación: 3

### Frontend: 9 errores
- Componentes: 5
- Context/Auth: 2
- Configuración: 2

### Base de Datos: 4 errores
- Esquemas: 3
- Consultas: 1

## Estado de Resolución

- **Errores corregidos**: 3 (AUTH-001, AUTH-002, AUTH-003)
- **Errores pendientes**: 25
- **Requiere migración**: 2 (conversations table, schema sync)

## Prioridad de Corrección

1. **Críticos**: 11 errores - Requieren corrección inmediata
2. **Medios**: 13 errores - Mejoran estabilidad
3. **Menores**: 4 errores - Optimizaciones

---

*Matriz generada automáticamente por análisis de sistema Kilo Code - 28 de noviembre de 2025*