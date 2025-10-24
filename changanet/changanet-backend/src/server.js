// src/server.js (fragmento actualizado) - restarted
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const helmet = require('helmet'); // Seguridad HTTP
const morgan = require('morgan'); // Logging
const compression = require('compression'); // Compresión de respuestas
const rateLimit = require('rate-limiter-flexible'); // Limitación de tasa
const passport = require('./config/passport'); // Configuración de Passport
const session = require('express-session'); // Sesiones para Passport

// FCM Integration - Solo inicializar si existe el archivo de credenciales
let admin;
try {
  admin = require('firebase-admin');
  const serviceAccount = require('./config/serviceAccountKey.json');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'changanet-notifications'
    });
    console.log('✅ Firebase Admin inicializado correctamente');
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin no disponible - notificaciones push deshabilitadas');
  admin = null;
}

// Importar rutas y middlewares
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const searchRoutes = require('./routes/searchRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const custodyRoutes = require('./routes/custodyRoutes');
const rankingRoutes = require('./routes/rankingRoutes');
const serviceRoutes = require('./routes/servicesRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const { authenticateToken } = require('./middleware/authenticate');
const { sendNotification } = require('./services/notificationService');

// Importar documentación Swagger
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const swaggerDocument = yaml.load(fs.readFileSync('./src/docs/swagger.yaml', 'utf8'));

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware de seguridad y optimización
app.use(helmet()); // Protege cabeceras HTTP
app.use(compression()); // Comprime respuestas para mejorar rendimiento
app.use(morgan('combined')); // Registra todas las solicitudes HTTP

// Configurar limitación de tasa (Rate Limiting) - Protección contra ataques DDoS
const limiter = new rateLimit.RateLimiterMemory({
  points: 100, // 100 solicitudes
  duration: 60, // por minuto
});

const rateLimiterMiddleware = (req, res, next) => {
  limiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).send('Demasiadas solicitudes desde esta IP, inténtalo de nuevo más tarde.');
    });
};

app.use(rateLimiterMiddleware);

// Middleware estándar
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' })); // Limitar tamaño de payloads
app.use(express.urlencoded({ extended: true })); // Para datos de formularios

// Middleware de sesión para Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'changanet-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// Ruta raíz para compatibilidad con pruebas - ANTES de las rutas de API
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Changánet API funcionando correctamente',
    version: '1.0.0',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Ruta de documentación API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes); // Note: profileRoutes has both authenticated and public routes
app.use('/api/professionals', searchRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);
app.use('/api/reviews', authenticateToken, reviewRoutes);
app.use('/api/availability', authenticateToken, availabilityRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/quotes', authenticateToken, quoteRoutes);
app.use('/api/verification', authenticateToken, verificationRoutes);
app.use('/api/custody', authenticateToken, custodyRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/gallery', authenticateToken, galleryRoutes);

// Socket.IO para chat en tiempo real
io.on('connection', (socket) => {
  console.log('🚀 Usuario conectado:', socket.id);

  // Unir usuario a su sala personal para recibir mensajes
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`Usuario ${userId} se unió a su sala personal`);
  });

  socket.on('sendMessage', async (data) => {
    const { remitente_id, destinatario_id, contenido, url_imagen } = data;

    try {
      // Validar datos requeridos
      if (!remitente_id || !destinatario_id || !contenido) {
        socket.emit('error', { message: 'Datos incompletos para enviar mensaje.' });
        return;
      }

      // Crear mensaje en la base de datos
      const message = await prisma.mensajes.create({
        data: {
          remitente_id,
          destinatario_id,
          contenido,
          url_imagen: url_imagen || null,
          esta_leido: false,
        },
      });

      // INTEGRACIÓN CON SERVICIO DE NOTIFICACIONES
      await sendNotification(destinatario_id, 'nuevo_mensaje', `Nuevo mensaje de ${remitente_id}`);

      // EMITIR MENSAJE EN TIEMPO REAL usando salas
      io.to(destinatario_id).emit('receiveMessage', message);
      io.to(remitente_id).emit('messageSent', message);

      console.log(`📨 Mensaje enviado de ${remitente_id} a ${destinatario_id}`);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      socket.emit('error', { message: 'No se pudo enviar el mensaje.' });
    }
  });

  // Marcar mensajes como leídos
  socket.on('markAsRead', async (data) => {
    const { senderId, recipientId } = data;

    try {
      await prisma.mensajes.updateMany({
        where: {
          remitente_id: senderId,
          destinatario_id: recipientId,
          esta_leido: false,
        },
        data: { esta_leido: true },
      });

      // Notificar al remitente que sus mensajes fueron leídos
      io.to(senderId).emit('messagesRead', { by: recipientId });
    } catch (error) {
      console.error('Error al marcar mensajes como leídos:', error);
      socket.emit('error', { message: 'No se pudieron marcar los mensajes como leídos.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('👋 Usuario desconectado:', socket.id);
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal!' });
});

// Ruta raíz para compatibilidad con pruebas - ANTES de las rutas de API
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Changánet API funcionando correctamente',
    version: '1.0.0',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Ruta de salud para monitoreo
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Ruta de prueba para verificar CORS
app.get('/test-cors', (req, res) => {
  res.json({
    message: 'CORS funcionando correctamente',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3002;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Backend y Socket.IO corriendo en http://localhost:${PORT}`);
    console.log(`📚 Documentación API disponible en http://localhost:${PORT}/api-docs`);
  });
}

// Exportar app para pruebas
module.exports = app; 
