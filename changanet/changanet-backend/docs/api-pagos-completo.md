# API de Pagos - ChangAnet

## Documentación Completa del Sistema de Pagos

Este documento describe todos los endpoints del sistema de pagos integrado de ChangAnet, incluyendo las nuevas funcionalidades de disputas, reembolsos y gestión avanzada.

## Tabla de Contenidos

1. [Configuración y Autenticación](#configuración-y-autenticación)
2. [Endpoints Básicos](#endpoints-básicos)
3. [Gestión de Fondos](#gestión-de-fondos)
4. [Sistema de Disputas](#sistema-de-disputas)
5. [Sistema de Reembolsos](#sistema-de-reembolsos)
6. [Eventos y Auditoría](#eventos-y-auditoría)
7. [Comprobantes](#comprobantes)
8. [Estados de Pago](#estados-de-pago)
9. [Códigos de Error](#códigos-de-error)

---

## Configuración y Autenticación

### Autenticación Requerida
Todos los endpoints (excepto webhooks) requieren autenticación JWT.

```javascript
headers: {
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

### Variables de Entorno Requeridas
```bash
MERCADO_PAGO_ACCESS_TOKEN=tu_token_mercado_pago
PLATFORM_COMMISSION_RATE=0.05  # 5% comisión
MIN_PAYMENT_AMOUNT=500         # $500 mínimo
MAX_PAYMENT_AMOUNT=500000      # $500,000 máximo
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3002
```

---

## Endpoints Básicos

### 1. Crear Preferencia de Pago

**Endpoint:** `POST /api/payments/create-preference`

**Descripción:** Crea una preferencia de pago con custodia de fondos para un servicio.

**Autenticación:** Requerida

**Body:**
```json
{
  "serviceId": "srv_1234567890",
  "amount": 1500.00,
  "description": "Servicio de plomería - Reparación de cañería"
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "data": {
    "preferenceId": "pref_1234567890",
    "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890",
    "sandboxInitPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890",
    "paymentId": "pay_0987654321"
  }
}
```

**Códigos de Error:**
- `400`: Campos requeridos faltantes
- `403`: Sin permiso para este servicio
- `404`: Servicio no encontrado
- `500`: Error interno del servidor

### 2. Obtener Estado de Pago

**Endpoint:** `GET /api/payments/status/{paymentId}`

**Descripción:** Obtiene el estado actual de un pago.

**Autenticación:** Requerida

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": "1234567890",
    "status": "approved",
    "status_detail": "accredited",
    "transaction_amount": 1500.00,
    "date_approved": "2024-01-15T10:30:00Z"
  }
}
```

---

## Gestión de Fondos

### 3. Liberar Fondos

**Endpoint:** `POST /api/payments/release-funds`

**Descripción:** Libera los fondos de un pago completado (para clientes).

**Autenticación:** Requerida

**Body:**
```json
{
  "paymentId": "pay_0987654321",
  "serviceId": "srv_1234567890"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_0987654321",
    "serviceId": "srv_1234567890",
    "totalAmount": 1500.00,
    "commission": 75.00,
    "professionalAmount": 1425.00,
    "releasedAt": "2024-01-16T14:20:00Z"
  }
}
```

### 4. Retirar Fondos (Profesionales)

**Endpoint:** `POST /api/payments/withdraw`

**Descripción:** Permite a profesionales retirar fondos a su cuenta bancaria.

**Autenticación:** Requerida (solo profesionales)

**Body:**
```json
{
  "amount": 1000.00,
  "bankDetails": {
    "cvu": "1234567890123456789012",
    "alias": "mi.alias.bancario",
    "banco": "Banco Nación"
  }
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "withdrawalId": "wd_1705400400000",
    "amount": 1000.00,
    "processedAt": "2024-01-16T15:30:00Z",
    "estimatedArrival": "2024-01-18T15:30:00Z",
    "bankDetails": {
      "alias": "mi.alias.bancario",
      "cvuMasked": "***9012"
    }
  }
}
```

### 5. Liberación Automática

**Endpoint:** `POST /api/payments/auto-release`

**Descripción:** Liberación automática de fondos (para cron jobs).

**Autenticación:** No requerida

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "processed": 5,
  "results": [
    {
      "serviceId": "srv_1234567890",
      "status": "released",
      "totalAmount": 1500.00,
      "commission": 75.00,
      "professionalAmount": 1425.00,
      "releasedAt": "2024-01-16T16:00:00Z"
    }
  ]
}
```

---

## Sistema de Disputas

### 6. Crear Disputa

**Endpoint:** `POST /api/payments/{paymentId}/dispute`

**Descripción:** Crea una disputa para un pago.

**Autenticación:** Requerida

**Body:**
```json
{
  "motivo": "servicio_no_completado",
  "descripcion": "El profesional no se presentó en la fecha acordada y no completó el servicio."
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "data": {
    "disputeId": "disp_1705400500000",
    "paymentId": "pay_0987654321",
    "estado": "abierta",
    "createdAt": "2024-01-16T17:30:00Z"
  }
}
```

**Motivos Válidos:**
- `servicio_no_completado`: Servicio no completado según acuerdo
- `calidad_deficiente`: Calidad del servicio insatisfactoria
- `retraso_excesivo`: Retrasos no justificados
- `comportamiento_inapropiado`: Comportamiento profesional inadecuado
- `facturacion_incorrecta`: Discrepancia en facturación
- `otro`: Otro motivo

### 7. Obtener Disputas del Usuario

**Endpoint:** `GET /api/payments/disputes`

**Descripción:** Obtiene las disputas del usuario autenticado.

**Autenticación:** Requerida

**Query Parameters:**
- `status` (opcional): Filtrar por estado (`abierta`, `en_revision`, `resuelta`)

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "disp_1705400500000",
      "pago_id": "pay_0987654321",
      "motivo": "servicio_no_completado",
      "descripcion": "El profesional no se presentó...",
      "estado": "abierta",
      "fecha_apertura": "2024-01-16T17:30:00Z",
      "pago": {
        "id": "pay_0987654321",
        "monto_total": 1500.00,
        "estado": "en_disputa",
        "servicio": {
          "descripcion": "Servicio de plomería",
          "cliente": { "nombre": "Juan Pérez" },
          "profesional": { "nombre": "Carlos Plomero" }
        }
      }
    }
  ]
}
```

---

## Sistema de Reembolsos

### 8. Procesar Reembolso

**Endpoint:** `POST /api/payments/{paymentId}/refund`

**Descripción:** Procesa un reembolso para un pago.

**Autenticación:** Requerida (solo cliente)

**Body:**
```json
{
  "amount": 1500.00,
  "reason": "servicio_no_completado"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "refundId": "ref_1705400600000",
    "paymentId": "pay_0987654321",
    "amount": 1500.00,
    "reason": "servicio_no_completado",
    "newStatus": "reembolsado",
    "processedAt": "2024-01-16T18:00:00Z",
    "estimatedArrival": "2024-01-19T18:00:00Z"
  }
}
```

**Razones Válidas:**
- `servicio_no_completado`: Servicio no completado
- `calidad_deficiente`: Calidad insatisfactoria
- `error_facturacion`: Error en facturación
- `cancelacion_cliente`: Cancelación por parte del cliente
- `disputa_resuelta`: Resultado de disputa a favor del cliente

---

## Eventos y Auditoría

### 9. Obtener Eventos de Pago

**Endpoint:** `GET /api/payments/{paymentId}/events`

**Descripción:** Obtiene el historial completo de eventos de un pago.

**Autenticación:** Requerida

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "evt_1705400300000_abc123def",
      "tipo_evento": "payment_created",
      "datos": {
        "amount": 1500.00,
        "clientId": "user_123",
        "serviceId": "srv_1234567890"
      },
      "procesado": true,
      "creado_en": "2024-01-16T14:00:00Z"
    },
    {
      "id": "evt_1705400350000_def456ghi",
      "tipo_evento": "payment_approved",
      "datos": {
        "mercadoPagoId": "1234567890",
        "approvalDate": "2024-01-16T14:15:00Z"
      },
      "procesado": true,
      "creado_en": "2024-01-16T14:15:00Z"
    }
  ]
}
```

**Tipos de Eventos:**
- `payment_created`: Preferencia de pago creada
- `payment_approved`: Pago aprobado por Mercado Pago
- `funds_released`: Fondos liberados al profesional
- `dispute_created`: Disputa creada
- `refund_processed`: Reembolso procesado
- `withdrawal_requested`: Retiro solicitado
- `auto_release_triggered`: Liberación automática ejecutada

---

## Comprobantes

### 10. Generar Comprobante

**Endpoint:** `GET /api/payments/receipt/{paymentId}`

**Descripción:** Genera un comprobante de pago.

**Autenticación:** Requerida

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "receiptUrl": "https://app.changanet.com/receipts/pay_0987654321",
    "paymentId": "pay_0987654321",
    "generatedAt": "2024-01-16T19:00:00Z"
  }
}
```

### 11. Descargar Comprobante

**Endpoint:** `GET /api/payments/receipts/{fileName}`

**Descripción:** Descarga un comprobante de pago.

**Autenticación:** Requerida

**Respuesta:** Archivo PDF

---

## Webhooks

### 12. Webhook de Mercado Pago

**Endpoint:** `POST /api/payments/webhook`

**Descripción:** Recibe notificaciones de Mercado Pago.

**Autenticación:** No requerida

**Body (Mercado Pago):**
```json
{
  "type": "payment",
  "data": {
    "id": "1234567890"
  }
}
```

**Respuesta:** `200 OK`

---

## Estados de Pago

### Estados Válidos

| Estado | Descripción | Transferible a |
|--------|-------------|----------------|
| `pendiente` | Preferencia creada, pendiente de pago | `aprobado`, `cancelado` |
| `aprobado` | Pago aprobado por Mercado Pago | `liberado`, `en_disputa`, `reembolsado` |
| `en_disputa` | Pago en disputa | `reembolsado`, `reembolsado_parcial`, `liberado` |
| `liberado` | Fondos liberados al profesional | - |
| `reembolsado` | Reembolso completo procesado | - |
| `reembolsado_parcial` | Reembolso parcial procesado | `liberado` |
| `cancelado` | Pago cancelado | - |

---

## Validaciones y Límites

### Límites de Montos
- **Pago mínimo:** $500 ARS (configurable)
- **Pago máximo:** $500,000 ARS (configurable)
- **Retiro mínimo:** $100 ARS (configurable)
- **Retiro máximo:** $50,000 ARS (configurable)

### Comisiones
- **Comisión de plataforma:** 5-10% (configurable, default 5%)
- **Se aplica solo al liberar fondos**

### Validaciones de Seguridad
- Autenticación JWT requerida para endpoints privados
- Validación de propiedad del recurso
- Rate limiting aplicado
- Logging de todas las operaciones
- Validación de estados válidos para cada operación

---

## Códigos de Error

### Códigos de Estado HTTP
- `200`: Operación exitosa
- `201`: Recurso creado exitosamente
- `400`: Error de validación
- `401`: No autorizado
- `403`: Prohibido (sin permisos)
- `404`: Recurso no encontrado
- `500`: Error interno del servidor

### Mensajes de Error Comunes
```json
{
  "error": "Faltan campos requeridos: serviceId"
}
```

```json
{
  "error": "No tienes permiso para realizar esta operación"
}
```

```json
{
  "error": "El pago no está en un estado válido para esta operación"
}
```

---

## Ejemplos de Uso

### Flujo Completo de Pago

1. **Cliente crea preferencia de pago:**
   ```bash
   POST /api/payments/create-preference
   ```

2. **Cliente realiza pago en Mercado Pago**

3. **Webhook procesa aprobación:**
   ```bash
   POST /api/payments/webhook
   ```

4. **Cliente libera fondos (después del servicio):**
   ```bash
   POST /api/payments/release-funds
   ```

5. **Profesional retira fondos:**
   ```bash
   POST /api/payments/withdraw
   ```

### Flujo con Disputa

1. **Profesional completa servicio**
2. **Cliente no está satisfecho y crea disputa:**
   ```bash
   POST /api/payments/{paymentId}/dispute
   ```
3. **Admin revisa disputa**
4. **Si es a favor del cliente, se procesa reembolso:**
   ```bash
   POST /api/payments/{paymentId}/refund
   ```

---

## Notas de Implementación

### Custodia de Fondos
- Los fondos se mantienen en custodia hasta que el cliente apruebe la liberación
- Liberación automática después de 24 horas de inactividad (RB-04)

### Notificaciones
- Se envían notificaciones push y email para eventos importantes
- Estados: `pago_aprobado`, `fondos_liberados`, `nueva_disputa`, `reembolso_procesado`

### Auditoría
- Todos los eventos se registran en `eventos_pagos`
- Trazabilidad completa de operaciones
- Logging detallado para debugging

### Configuración de Mercado Pago
- Modo sandbox para desarrollo
- Modo producción para deploy
- Webhooks configurados para notificaciones automáticas

---

*Documentación actualizada: Enero 2024*
*Versión del API: 2.0*
*ChangAnet - Sistema de Pagos Integrado*