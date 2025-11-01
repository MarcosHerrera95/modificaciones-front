/**
 * @archivo src/server.js - Servidor principal de Changánet
 * @descripción Configuración y inicialización del servidor Express con middleware de seguridad, autenticación y servicios externos (REQ-01, REQ-40, REQ-41)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Económico: Infraestructura segura para transacciones; Ambiental: Optimización de recursos del servidor
 */

// src/server.js (fragmento actualizado) - restarted
require('dotenv').config();

// IMPORTANTE: Inicializar Sentry ANTES de cualquier otro import o middleware (REQ-40)
const { initializeSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } = require('./services/sentryService');
initializeSentry();

// Inicializar métricas de Prometheus
const { initializeMetrics } = require('./services/metricsService');
initializeMetrics();

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

/**
 * @sección FCM Integration - Inicialización de Firebase Admin SDK
 * @descripción Configura Firebase Admin para notificaciones push y autenticación (REQ-19, REQ-20)
 * @sprint Sprint 2 – Notificaciones y Comunicación
 * @tarjeta Tarjeta 4: [Backend] Implementar API de Chat en Tiempo Real
 * @impacto Social: Comunicación accesible para todos los usuarios
 */

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

/**
 * @sección Configuración de Middleware
 * @descripción Middlewares de seguridad, monitoreo y optimización (REQ-40, REQ-41, REQ-42)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Ambiental: Optimización de recursos mediante compresión y monitoreo eficiente
 */

// Middleware de Sentry (DEBE ir ANTES de otros middlewares) - Monitoreo de errores (REQ-40)
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Middleware de métricas HTTP (después de Sentry, antes de otros middlewares) - Métricas de rendimiento (REQ-41)
const { createHttpMetricsMiddleware } = require('./services/metricsService');
app.use(createHttpMetricsMiddleware());

// Middleware de seguridad y optimización - Seguridad y performance (REQ-42)
app.use(helmet()); // Protege cabeceras HTTP
app.use(compression()); // Comprime respuestas para mejorar rendimiento
app.use(morgan('combined')); // Registra todas las solicitudes HTTP

/**
 * @sección Rate Limiting - Limitación de tasa de solicitudes
 * @descripción Protección contra ataques DDoS y abuso de API (REQ-42)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Económico: Protección de recursos del servidor contra ataques
 */

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

/**
 * @sección Middleware CORS y Parsing
 * @descripción Configuración de CORS y parsing de requests (REQ-01, REQ-42)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Social: Acceso seguro desde diferentes orígenes para usuarios diversos
 */

// Middleware estándar
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' })); // Limitar tamaño de payloads
app.use(express.urlencoded({ extended: true })); // Para datos de formularios

/**
 * @sección Configuración de Sesiones y Passport
 * @descripción Middleware de sesiones para autenticación OAuth (REQ-02)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Económico: Sesiones seguras para transacciones OAuth
 */

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

// Ruta de documentación API - Documentación Swagger (REQ-40)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rutas de métricas (antes de otras rutas para evitar interferencias)
const metricsRoutes = require('./routes/metricsRoutes');
app.use('/api', metricsRoutes);

/**
 * @sección Configuración de Rutas API
 * @descripción Definición de endpoints REST de la aplicación (REQ-01, REQ-03, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20)
 * @sprint Sprint 1-6 – Todos los sprints según funcionalidad
 * @tarjeta Tarjetas 1-10: [Backend] Implementación completa de APIs
 * @impacto Social: APIs accesibles para integración de servicios comunitarios
 */

// Rutas de la API
app.use('/api/auth', authRoutes); // Autenticación (REQ-01, REQ-02, REQ-03)
app.use('/api/profile', profileRoutes); // Perfiles de usuario (REQ-05)
app.use('/api/professionals', searchRoutes); // Búsqueda de profesionales (REQ-06)
app.use('/api/messages', authenticateToken, messageRoutes); // Chat en tiempo real (REQ-19)
app.use('/api/reviews', authenticateToken, reviewRoutes); // Sistema de reseñas (REQ-16)
app.use('/api/availability', authenticateToken, availabilityRoutes); // Disponibilidad (REQ-10)
app.use('/api/notifications', authenticateToken, notificationRoutes); // Notificaciones (REQ-19, REQ-20)
app.use('/api/quotes', authenticateToken, quoteRoutes); // Sistema de cotizaciones (REQ-11, REQ-12)
app.use('/api/verification', authenticateToken, verificationRoutes); // Verificación de identidad (REQ-04)
app.use('/api/custody', authenticateToken, custodyRoutes); // Custodia de pagos (REQ-17)
app.use('/api/ranking', rankingRoutes); // Sistema de rankings (REQ-18)
app.use('/api/services', serviceRoutes); // Gestión de servicios (REQ-07, REQ-08, REQ-09)
app.use('/api/gallery', authenticateToken, galleryRoutes); // Galería de trabajos (REQ-15)

// Socket.IO para chat en tiempo real (REQ-19)
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

// Middleware de manejo de errores de Sentry (DEBE ser el ÚLTIMO middleware de error) - Monitoreo de errores (REQ-40)
app.use(sentryErrorHandler());

// Manejo de errores global (después de Sentry) - Manejo de errores no capturados (REQ-40)
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

// Ruta de salud para monitoreo - Health check para load balancers (REQ-41)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Ruta de prueba para verificar CORS - Testing de configuración CORS (REQ-42)
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
