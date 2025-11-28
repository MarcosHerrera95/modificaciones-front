# CHANGANET - Migración de Base de Datos de Pagos y Comisiones Sin Docker

Esta guía proporciona una solución completa para configurar el módulo de pagos y comisiones de CHANGANET en entornos que no tienen Docker disponible.

## 📋 Requisitos Previos

### Software Necesario
- **PostgreSQL 12+** instalado y ejecutándose
- **Cliente psql** en el PATH del sistema
- **Node.js 16+** (para la aplicación backend)
- **Git** (opcional, para clonar repositorios)

### Verificación de PostgreSQL
```bash
# Verificar que psql esté disponible
psql --version

# Verificar que PostgreSQL esté ejecutándose
# En Windows: Servicios > PostgreSQL > Estado: Ejecutándose
# En Linux/Mac: sudo systemctl status postgresql
```

## 📁 Archivos Proporcionados

1. **`create_payments_commissions_schema.sql`** - Script SQL completo para crear todas las tablas
2. **`.env.example.payments`** - Variables de entorno necesarias
3. **`setup_payments_database.bat`** - Script de configuración automatizado para Windows

## 🚀 Pasos de Instalación

### Paso 1: Preparar el Entorno

1. **Crear directorio del proyecto**
   ```bash
   mkdir changanet-payments
   cd changanet-payments
   ```

2. **Copiar los archivos proporcionados** al directorio del proyecto:
   - `create_payments_commissions_schema.sql`
   - `.env.example.payments`
   - `setup_payments_database.bat`

### Paso 2: Configurar Variables de Entorno

1. **Copiar el archivo de ejemplo**
   ```bash
   copy .env.example.payments .env
   ```

2. **Editar `.env` con sus valores reales**
   ```env
   # Base de datos - IMPORTANTE: Usar PostgreSQL
   DATABASE_URL="postgresql://tu_usuario:tu_password@localhost:5432/changanet_payments"

   # MercadoPago - OBLIGATORIO
   MERCADOPAGO_ACCESS_TOKEN="APP_USR-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
   MERCADO_PAGO_PUBLIC_KEY="APP_USR-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

   # Ajustes de comisión
   PLATFORM_COMMISSION_RATE=0.05  # 5%

   # URLs
   BACKEND_URL="https://tu-dominio.com"
   FRONTEND_URL="https://tu-frontend.com"
   ```

### Paso 3: Configurar la Base de Datos

#### Opción A: Usar el Script Automatizado (Recomendado)

1. **Ejecutar el script de configuración**
   ```bash
   # Hacer doble clic en setup_payments_database.bat
   # O ejecutar desde línea de comandos:
   setup_payments_database.bat
   ```

2. **Seguir las instrucciones en pantalla**
   - El script verificará PostgreSQL
   - Creará la base de datos si no existe
   - Ejecutará el schema SQL
   - Mostrará el resultado

#### Opción B: Configuración Manual

Si el script automatizado falla, puede configurar manualmente:

1. **Crear la base de datos**
   ```bash
   # Conectarse como superusuario de PostgreSQL
   psql -U postgres

   # Crear la base de datos
   CREATE DATABASE changanet_payments;

   # Salir
   \q
   ```

2. **Ejecutar el script SQL manualmente**
   ```bash
   # Ejecutar el schema
   psql -U tu_usuario -d changanet_payments -f create_payments_commissions_schema.sql
   ```

### Paso 4: Verificar la Instalación

1. **Conectarse a la base de datos**
   ```bash
   psql "tu_DATABASE_URL"
   ```

2. **Verificar tablas creadas**
   ```sql
   \dt

   # Deberías ver estas tablas:
   # - usuarios
   # - servicios
   # - pagos
   # - cuentas_bancarias
   # - retiros
   # - comisiones_historial
   # - commission_settings
   # - eventos_pagos
   # - disputas_pagos
   ```

3. **Verificar datos iniciales**
   ```sql
   SELECT * FROM commission_settings;
   -- Deberías ver las configuraciones de comisión por defecto
   ```

## 🔧 Configuración de MercadoPago

1. **Crear cuenta en MercadoPago**
   - Ir a https://www.mercadopago.com.ar/developers
   - Crear una aplicación
   - Obtener las credenciales

2. **Configurar credenciales en `.env`**
   ```env
   MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."
   MERCADO_PAGO_PUBLIC_KEY="APP_USR-..."
   ```

3. **Configurar webhooks** (opcional para producción)
   - URL: `https://tu-dominio.com/api/payments/webhook`
   - Eventos: `payment.created`, `payment.updated`

## 🏗️ Estructura de la Base de Datos

### Tablas Principales

- **`pagos`** - Pagos realizados por servicios
- **`cuentas_bancarias`** - Cuentas bancarias de profesionales
- **`retiros`** - Solicitudes de retiro de fondos
- **`comisiones_historial`** - Historial de comisiones aplicadas
- **`commission_settings`** - Configuraciones de comisión
- **`eventos_pagos`** - Eventos de webhook de pagos
- **`disputas_pagos`** - Disputas y reclamos

### Enums Personalizados

- **`PaymentStatus`** - Estados de pago
- **`WithdrawalStatus`** - Estados de retiro
- **`CommissionType`** - Tipos de comisión
- **`CommissionEventType`** - Tipos de evento de comisión

## 🔒 Consideraciones de Seguridad

1. **Permisos de Base de Datos**
   - Crear un usuario específico para la aplicación
   - No usar el superusuario en producción

2. **Variables de Entorno**
   - Nunca commitear el archivo `.env`
   - Usar secrets managers en producción

3. **Backup Regular**
   ```bash
   # Backup de la base de datos
   pg_dump "tu_DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

## 🧪 Pruebas

### Verificar Conexión
```javascript
// Crear un archivo test-db.js
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => console.log('✅ Conexión exitosa'))
  .catch(err => console.error('❌ Error de conexión:', err))
  .finally(() => client.end());
```

### Probar MercadoPago
```javascript
// Verificar credenciales de MercadoPago
const mercadopago = require('mercadopago');
mercadopago.configurations.setAccessToken(process.env.MERCADOPAGO_ACCESS_TOKEN);

mercadopago.payment.get(123456789) // ID de prueba
  .then(response => console.log('✅ MercadoPago OK'))
  .catch(err => console.error('❌ MercadoPago Error:', err));
```

## 🚀 Despliegue en Producción

### Variables de Entorno de Producción
```env
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@host:5432/db"
BACKEND_URL="https://api.tu-dominio.com"
FRONTEND_URL="https://tu-dominio.com"
```

### Monitoreo
- Configurar logs de PostgreSQL
- Monitorear conexiones activas
- Alertas de errores de pago

### Backup Automático
```bash
# Script de backup diario
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump "$DATABASE_URL" > "backup_$DATE.sql"
# Subir a storage seguro
```

## 🆘 Solución de Problemas

### Error: "psql: command not found"
- Instalar PostgreSQL completo
- Agregar psql al PATH

### Error: "FATAL: database does not exist"
- Crear la base de datos manualmente
- Verificar DATABASE_URL

### Error: "permission denied"
- Revisar permisos del usuario de BD
- Usar superusuario para setup inicial

### MercadoPago no funciona
- Verificar credenciales
- Revisar modo sandbox vs producción
- Verificar URLs de webhook

## 📞 Soporte

Para soporte técnico:
1. Verificar logs de PostgreSQL: `tail -f /var/log/postgresql/postgresql-*.log`
2. Revisar configuración de red
3. Verificar firewall y puertos

## ✅ Checklist de Verificación

- [ ] PostgreSQL instalado y ejecutándose
- [ ] Base de datos creada
- [ ] Schema SQL ejecutado exitosamente
- [ ] Variables de entorno configuradas
- [ ] Credenciales de MercadoPago válidas
- [ ] Conexión a BD verificada
- [ ] Aplicación puede conectarse
- [ ] Primer pago de prueba exitoso

---

**Nota**: Esta configuración es compatible con entornos sin Docker y puede ser utilizada en servidores dedicados, VPS, o cualquier hosting que soporte PostgreSQL.