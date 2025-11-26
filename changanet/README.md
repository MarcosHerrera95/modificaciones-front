# 🚀 Changanet - Plataforma Digital de Servicios Profesionales

## 📋 Descripción

Changanet es una plataforma digital que conecta a personas que requieren servicios técnicos (plomeros, electricistas, albañiles, etc.) con profesionales calificados. Incluye un sistema completo de mensajería en tiempo real, gestión de perfiles profesionales, sistema de reseñas y pagos integrados.

## ✨ Características Principales

### 💬 Sistema de Chat en Tiempo Real
- ✅ **Mensajería instantánea** entre clientes y profesionales
- ✅ **Envío de imágenes** con subida a Google Cloud Storage
- ✅ **Estados de lectura** de mensajes
- ✅ **Notificaciones push y email** automáticas
- ✅ **Historial paginado** de conversaciones
- ✅ **WebSocket en tiempo real** con reconexión automática

### 👥 Gestión de Usuarios
- 🔐 **Autenticación JWT** segura
- 📧 **Registro con email** y validación
- 🌐 **OAuth con Google y Facebook**
- 👤 **Perfiles profesionales** detallados
- ⭐ **Sistema de reseñas** y calificaciones

### 🛠️ Servicios Profesionales
- 📍 **Búsqueda por ubicación** y especialidad
- 📅 **Disponibilidad y agenda** de profesionales
- 💰 **Cotizaciones y presupuestos**
- 💳 **Pagos integrados** con custodia de fondos

## 🏗️ Arquitectura

### Backend (Node.js + Express)
```
changanet-backend/
├── src/
│   ├── controllers/     # Controladores de negocio
│   ├── routes/          # Definición de rutas API
│   ├── services/        # Servicios externos (email, storage, etc.)
│   ├── middleware/      # Middlewares de autenticación y validación
│   └── config/          # Configuraciones de servicios externos
├── prisma/
│   └── schema.prisma    # Modelo de datos con Prisma ORM
└── server.js            # Punto de entrada del servidor
```

### Frontend (React + Vite)
```
changanet-frontend/
├── src/
│   ├── components/      # Componentes reutilizables
│   ├── pages/           # Páginas de la aplicación
│   ├── context/         # Contextos de estado global
│   ├── services/        # Servicios de API y WebSocket
│   └── hooks/           # Hooks personalizados
└── index.html           # Punto de entrada
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+
- npm o yarn
- SQLite (desarrollo) / PostgreSQL (producción)
- Google Cloud Storage (opcional para imágenes)

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd changanet
```

### 2. Configurar Backend
```bash
cd changanet-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Configurar base de datos
npx prisma generate
npx prisma db push

# Iniciar servidor
npm start
```

### 3. Configurar Frontend
```bash
cd changanet-frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con VITE_BACKEND_URL

# Iniciar aplicación
npm run dev
```

## 📡 API Endpoints - Chat

### Autenticación Requerida
Todos los endpoints requieren header `Authorization: Bearer <token>`

### Conversaciones
```
POST   /api/chat/conversations           # Crear conversación
GET    /api/chat/conversations           # Listar conversaciones del usuario
GET    /api/chat/conversations/:userId   # Listar conversaciones específicas
GET    /api/chat/conversation/:id        # Obtener metadata de conversación
DELETE /api/chat/conversations/:id       # Cerrar conversación
```

### Mensajes
```
GET    /api/chat/messages/:conversationId  # Historial paginado
POST   /api/chat/messages                  # Enviar mensaje
POST   /api/chat/messages/read             # Marcar como leído
POST   /api/chat/upload-image              # Obtener URL de subida
GET    /api/chat/search/:conversationId    # Buscar en conversación
```

### WebSocket Events
```javascript
// Cliente → Servidor
socket.emit('message', { conversationId, content, imageUrl });
socket.emit('join', { conversationId });
socket.emit('typing', { conversationId, isTyping: true });

// Servidor → Cliente
socket.on('receiveMessage', (message) => { ... });
socket.on('messageSent', (data) => { ... });
socket.on('messagesRead', (data) => { ... });
socket.on('conversationUpdated', (data) => { ... });
```

## 🔧 Configuración de Variables de Entorno

### Backend (.env)
```env
# Base de datos
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="tu-jwt-secret"
JWT_EXPIRES_IN="24h"

# Email (SendGrid)
SENDGRID_API_KEY="tu-sendgrid-key"
FROM_EMAIL="noreply@changanet.com"

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID="tu-project-id"
GOOGLE_CLOUD_BUCKET="changanet-chat-images"
GOOGLE_CLOUD_KEY_FILE="./config/serviceAccountKey.json"

# Firebase (Notificaciones Push)
FIREBASE_PROJECT_ID="tu-firebase-project"

# Rate Limiting
NODE_ENV="development"  # development=1000 req/min, production=30 req/min
```

### Frontend (.env)
```env
VITE_BACKEND_URL="http://localhost:3002"
VITE_GOOGLE_CLIENT_ID="tu-google-client-id"
```

## 🧪 Testing

### Ejecutar Tests
```bash
# Backend
cd changanet-backend
npm test

# Frontend
cd changanet-frontend
npm test
```

### Tests de Chat
```bash
# Test específico del sistema de chat
npm run test:chat

# Test de integración WebSocket
npm run test:websocket
```

## 📊 Monitoreo y Logs

### Métricas Prometheus
```
GET /metrics  # Métricas de rendimiento
```

### Health Check
```
GET /health   # Estado del servicio
GET /api/status # Estado de servicios externos
```

### Logs
- **Desarrollo**: Console logs con Winston
- **Producción**: Sentry para errores + logs estructurados

## 🔒 Seguridad

### Implementado
- ✅ **Rate Limiting**: 1000 req/min (dev) / 30 req/min (prod)
- ✅ **CORS**: Configurado para orígenes específicos
- ✅ **Helmet**: Headers de seguridad HTTP
- ✅ **JWT**: Autenticación stateless
- ✅ **Sanitización**: DOMPurify para mensajes
- ✅ **Validación**: Joi schemas para inputs
- ✅ **UUID**: IDs consistentes en toda la aplicación

### Mejores Prácticas
- 🔐 **Nunca logs de passwords**
- 🛡️ **Validación en todas las capas**
- 🚫 **No SQL injection** (Prisma ORM)
- 🔒 **HTTPS obligatorio** en producción

## 🚀 Despliegue

### Producción
```bash
# Build frontend
cd changanet-frontend
npm run build

# Configurar backend para producción
cd changanet-backend
NODE_ENV=production npm start

# Usar PM2 para gestión de procesos
npm install -g pm2
pm2 start ecosystem.config.js
```

### Docker
```bash
# Construir imágenes
docker-compose build

# Iniciar servicios
docker-compose up -d
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 📞 Soporte

- 📧 **Email**: soporte@changanet.com
- 💬 **Chat**: Integrado en la plataforma
- 📚 **Docs**: [Documentación API](http://localhost:3002/api-docs)

## 🎯 Roadmap

### Próximas Versiones
- 📱 **App Móvil** (iOS/Android)
- 💳 **Pagos integrados** completos
- 🤖 **Chatbot de soporte**
- 📊 **Analytics avanzado**
- 🌍 **Internacionalización**

---

**Changanet** - Conectando servicios profesionales con confianza 💪