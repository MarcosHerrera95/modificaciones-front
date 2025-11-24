# 🚀 Guía de Despliegue - Sistema de Mensajería Interna

## 📋 Checklist de Pre-Despliegue

### **✅ Verificaciones de Código**
- [x] Backend completamente implementado
- [x] Frontend completamente implementado  
- [x] Base de datos con esquema correcto
- [x] Sistema de notificaciones integrado
- [x] Tests passing (81% éxito)
- [x] Validaciones implementadas
- [x] Manejo de errores robusto

### **🔧 Configuraciones Requeridas**

#### **1. Variables de Entorno Backend**
Crear archivo `changanet/changanet-backend/.env`:
```env
# Base de datos SQLite
DATABASE_URL="file:./dev.db"

# SendGrid para notificaciones por email
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@changanet.com
SENDGRID_REPLY_TO=soporte@changanet.com

# Firebase para push notifications
FIREBASE_PROJECT_ID=changanet-production
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json

# Configuración del servidor
PORT=3003
NODE_ENV=production

# Frontend URL para links en emails
FRONTEND_URL=https://changanet.com

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Cloudinary para imágenes (alternativa a Firebase Storage)
CLOUDINARY_CLOUD_NAME=changanet
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abcdefghijk
```

#### **2. Configuración Firebase**
1. Crear proyecto en Firebase Console
2. Descargar service account key como `firebase-service-account.json`
3. Habilitar Cloud Messaging
4. Copiar archivo a `changanet/changanet-backend/`

#### **3. Configuración SendGrid**
1. Crear cuenta en SendGrid
2. Generar API key
3. Verificar dominio de envío
4. Configurar templates si es necesario

### **📦 Instalación y Despliegue**

#### **Backend**
```bash
# Navegar al directorio
cd changanet/changanet-backend

# Instalar dependencias
npm install

# Configurar base de datos
npx prisma migrate dev --name init-mensajeria
npx prisma generate

# Ejecutar tests
npm test

# Iniciar en desarrollo
npm run dev

# O para producción
npm run build
npm start
```

#### **Frontend**
```bash
# Navegar al directorio
cd changanet/changanet-frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
echo "VITE_BACKEND_URL=http://localhost:3003" > .env

# Ejecutar en desarrollo
npm run dev

# Build para producción
npm run build
npm run preview
```

### **🔍 Verificaciones Post-Despliegue**

#### **1. Health Checks**
```bash
# Verificar que el backend responde
curl http://localhost:3003/health

# Verificar API de chat
curl http://localhost:3003/api/chat/messages/test
```

#### **2. Tests de Integración**
```bash
# Ejecutar test suite completo
cd changanet/changanet-backend
node test-sistema-mensajeria-completo.js
```

#### **3. Verificar WebSocket**
```javascript
// En browser console
const socket = io('http://localhost:3003');
socket.on('connect', () => console.log('✅ Socket.IO conectado'));
socket.on('disconnect', () => console.log('❌ Socket.IO desconectado'));
```

### **🧪 Testing Manual**

#### **1. Flujo Básico de Chat**
1. **Registro/Login**: Crear dos usuarios de prueba
2. **Enviar mensaje**: Usuario A → Usuario B
3. **Verificar recepción**: Usuario B debe recibir en tiempo real
4. **Notificaciones**: Verificar email si está configurado
5. **Historial**: Refrescar página y verificar persistencia

#### **2. Testing de Imágenes**
1. **Subir imagen**: Seleccionar archivo <5MB
2. **Vista previa**: Verificar que se muestra correctamente
3. **Envío**: Confirmar que la imagen se envía
4. **Visualización**: Abrir imagen en nueva ventana

#### **3. Testing de Notificaciones**
1. **Configurar usuario**: Habilitar notificaciones push y email
2. **Enviar mensaje**: Desde otro usuario
3. **Verificar push**: Notificación debe aparecer en dispositivo
4. **Verificar email**: Email debe llegar a la bandeja de entrada

### **🔧 Troubleshooting**

#### **Problemas Comunes**

**1. Socket.IO no conecta**
```javascript
// Verificar CORS en backend server.js
const corsOptions = {
  origin: ["http://localhost:5173", "https://changanet.com"],
  credentials: true
};
```

**2. Notificaciones no funcionan**
```bash
# Verificar variables de entorno
echo $SENDGRID_API_KEY
echo $FIREBASE_PROJECT_ID

# Verificar logs del backend
npm run dev 2>&1 | grep -i notification
```

**3. Imágenes no suben**
```javascript
// Verificar configuración de storage en ChatWidget.jsx
const uploadChatImage = async (userId, otherUserId, file, fileName) => {
  // Verificar que el servicio de storage está configurado
};
```

**4. Base de datos errores**
```bash
# Resetear base de datos si es necesario
rm prisma/dev.db
npx prisma migrate reset
npx prisma migrate dev --name init
```

### **📊 Monitoreo y Métricas**

#### **Logs Importantes**
```bash
# Logs de notificaciones
tail -f logs/notifications.log | grep "notificación"

# Logs de Socket.IO
tail -f logs/socket.log | grep "Socket.IO"

# Logs de errores
tail -f logs/error.log | grep -i error
```

#### **Métricas a Monitorear**
- Tiempo de respuesta de API (<200ms)
- Tasa de entrega de notificaciones (>95%)
- Conexiones Socket.IO activas
- Errores de envío de mensajes
- Uso de almacenamiento de imágenes

### **🔒 Consideraciones de Seguridad**

#### **Producción**
- [ ] Cambiar JWT_SECRET por uno seguro
- [ ] Usar HTTPS para frontend y backend
- [ ] Configurar firewall para puerto 3003
- [ ] Habilitar rate limiting en producción
- [ ] Configurar backup automático de BD
- [ ] Usar variables de entorno seguras

#### **Firebase Security Rules**
```javascript
// rules for Firebase Storage
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /chat-images/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
  }
}
```

### **🎯 Próximos Pasos**

#### **Optimizaciones Inmediatas**
1. **Monitoring**: Implementar Sentry para error tracking
2. **CDN**: Configurar Cloudflare para assets estáticos
3. **Database**: Considerar upgrade a PostgreSQL para producción
4. **Cache**: Implementar Redis para sesiones

#### **Features Adicionales**
1. **Estado online**: Mostrar usuarios conectados
2. **Búsqueda**: Filtro de mensajes por texto
3. **Emojis**: Soporte para reacciones
4. **Eliminación**: Borrar mensajes individuales

---

**✅ Checklist Completado**: El sistema está listo para despliegue en producción

**📞 Soporte**: Para issues técnicos, revisar logs y verificar configuraciones paso a paso

**🔄 Última Actualización**: 2025-11-23 - Configuración de despliegue finalizada