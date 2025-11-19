/**
 * Servidor principal de la aplicación Changánet.
 * Configura Express.js con middleware de seguridad, autenticación, monitoreo y servicios externos.
 * Inicializa Socket.IO para comunicación en tiempo real y define rutas de la API.
 */

// Load appropriate environment file based on NODE_ENV
if (process.env.NODE_ENV === 'test') {
  require('dotenv').config({ path: '.env.test' });
} else {
  require('dotenv').config();
}

/**
 * Inicializa Sentry para monitoreo de errores antes de cualquier otro middleware.
 * Debe ejecutarse al inicio para capturar todos los errores de la aplicación.
 */
const { initializeSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } = require('./services/sentryService');
initializeSentry();

// Inicializar servicios de monitoreo
const queryMonitor = require('./services/queryMonitorService');
const backupService = require('./services/backupService');

/**
 * Inicializa el sistema de métricas de Prometheus para monitoreo de rendimiento.
 */
const { initializeMetrics } = require('./services/metricsService');
initializeMetrics();

/**
 * Inicializa el sistema de caché Redis para optimización de rendimiento.
 */
const { initializeRedis } = require('./services/cacheService');
initializeRedis();

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
 * Inicialización condicional del SDK de Firebase Admin.
 * Solo se inicializa si existe el archivo de credenciales de servicio.
 * Se usa para enviar notificaciones push y gestionar autenticación.
 */
let admin;
try {
  admin = require('firebase-admin');
  const serviceAccount = require('./config/serviceAccountKey.json');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'changanet-notifications'
    });
    console.log('Firebase Admin inicializado correctamente');
  }
} catch (error) {
  console.warn('Firebase Admin no disponible - notificaciones push deshabilitadas');
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
const paymentRoutes = require('./routes/paymentRoutes');
const custodyRoutes = require('./routes/custodyRoutes');
const rankingRoutes = require('./routes/rankingRoutes');
const serviceRoutes = require('./routes/servicesRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const contactRoutes = require('./routes/contactRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const professionalsRoutes = require('./routes/professionalsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const marketAnalysisRoutes = require('./routes/marketAnalysisRoutes');
const advancedAnalyticsRoutes = require('./routes/advancedAnalyticsRoutes');
const recurringServiceRoutes = require('./routes/recurringServiceRoutes');
const mapsRoutes = require('./routes/mapsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const smsRoutes = require('./routes/smsRoutes');
const favoritesRoutes = require('./routes/favoritesRoutes');
const achievementsRoutes = require('./routes/achievementsRoutes');
const { authenticateToken } = require('./middleware/authenticate');
const { sendNotification } = require('./services/notificationService');
const { sendPushNotification } = require('./services/pushNotificationService');
const { scheduleAutomaticReminders } = require('./services/availabilityReminderService');
const { scheduleRecurringServiceGeneration, scheduleAutomaticFundReleases } = require('./services/recurringServiceScheduler');
const { initializeDefaultAchievements } = require('./controllers/achievementsController');

// Importar documentación Swagger
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const swaggerDocument = yaml.load(fs.readFileSync('./src/docs/swagger.yaml', 'utf8'));

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Inicializar servicio de backup
backupService.initialize().then(success => {
  if (success) {
    console.log('💾 Servicio de backup inicializado');
  } else {
    console.warn('⚠️  Servicio de backup no pudo inicializarse');
  }
});

// Inicializar logros por defecto - REQ-38: Sistema de medallas
initializeDefaultAchievements().then(() => {
  console.log('🏆 Logros por defecto inicializados');
}).catch(error => {
  console.error('❌ Error inicializando logros:', error);
});
const app = express();
const server = http.createServer(app);

// Configurar monitoreo de queries en desarrollo/producción
if (process.env.NODE_ENV !== 'test') {
  console.log('📊 Monitoreo de queries activado');
}
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://127.0.0.1:5176"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

/**
 * Middleware de autenticación para Socket.IO
 * Verifica el token JWT enviado en el handshake de conexión
 */
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const clientIP = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'];
  const isDevelopment = process.env.NODE_ENV !== 'production';

  console.log(`🔐 Socket.IO Auth Attempt - IP: ${clientIP}, UA: ${userAgent?.substring(0, 50)}..., ENV: ${process.env.NODE_ENV}`);

  if (!token) {
    if (isDevelopment) {
      console.warn('⚠️ DEVELOPMENT: Socket.IO connection without token allowed for testing');
      console.warn(`⚠️ Client IP: ${clientIP}, Time: ${new Date().toISOString()}`);
      console.warn('⚠️ Remember to enable authentication in production!');

      // En desarrollo, crear usuario de prueba pero marcar como no autenticado
      socket.user = {
        id: 'dev-test-user',
        nombre: 'Usuario de Prueba',
        email: 'test@changánet.dev',
        rol: 'cliente',
        esta_verificado: false
      };
      socket.isDevMode = true;
      return next();
    } else {
      console.error('🚨 PRODUCTION SECURITY ALERT: Socket.IO connection without token BLOCKED!');
      console.error(`🚨 Client IP: ${clientIP}, Time: ${new Date().toISOString()}`);
      return next(new Error('Authentication required'));
    }
  }

  try {
    // Verificar el token usando jwt.verify
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // Obtener datos del usuario desde la base de datos
    const userData = await prisma.usuarios.findUnique({
      where: { id: decoded.userId || decoded.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        esta_verificado: true
      }
    });

    if (!userData) {
      console.error(`🚨 SECURITY ALERT: Valid JWT but user not found in DB!`);
      console.error(`🚨 Token userId: ${decoded.userId || decoded.id}, IP: ${clientIP}`);
      if (!isDevelopment) {
        return next(new Error('User not found'));
      }
      // En desarrollo, permitir pero loggear
      socket.user = null;
      socket.isUnauthenticated = true;
      return next();
    }

    // Adjuntar datos del usuario al socket
    socket.user = {
      ...decoded,
      ...userData,
      role: userData.rol
    };

    console.log(`✅ Socket.IO: User authenticated: ${socket.user.nombre} (${socket.user.email})`);
    next();
  } catch (error) {
    console.error(`🚨 SECURITY ALERT: JWT verification failed!`);
    console.error(`🚨 Error: ${error.message}, IP: ${clientIP}, Token: ${token?.substring(0, 20)}...`);

    if (!isDevelopment) {
      return next(new Error('Invalid token'));
    }

    // En desarrollo, permitir pero loggear como error de desarrollo
    console.warn('⚠️ DEVELOPMENT: Allowing connection despite invalid token');
    socket.user = null;
    socket.isUnauthenticated = true;
    next();
  }
});

/**
 * Configuración de middleware para seguridad, monitoreo y optimización.
 * Los middlewares se aplican en orden específico para garantizar funcionalidad correcta.
 */

// Middleware de Sentry para captura de errores y tracing de rendimiento
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Middleware personalizado para recopilar métricas HTTP de Prometheus
const { createHttpMetricsMiddleware } = require('./services/metricsService');
app.use(createHttpMetricsMiddleware());

// Middleware de seguridad y optimización de rendimiento
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'", "https://www.gstatic.com", "https://www.googleapis.com"],
      connectSrc: ["'self'", "https://www.googleapis.com", "https://firestore.googleapis.com", "https://identitytoolkit.googleapis.com", "wss:"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://www.google.com"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable COEP for Firebase Auth compatibility
  crossOriginOpenerPolicy: false // Disable COOP for popup compatibility
}));
app.use(compression()); // Comprime respuestas HTTP para reducir ancho de banda
app.use(morgan('combined')); // Logger de solicitudes HTTP con formato combinado

/**
 * Configuración de limitación de tasa de solicitudes para protección contra abuso.
 * Limita a 100 solicitudes por minuto por dirección IP para prevenir ataques DDoS.
 */

// Configura el limitador de tasa usando RateLimiterMemory
const limiter = new rateLimit.RateLimiterMemory({
  points: process.env.NODE_ENV === 'production' ? 30 : 500, // Más restrictivo en producción, más permisivo en desarrollo
  duration: 60, // Ventana de tiempo en segundos (1 minuto)
});

console.log(`🛡️ Rate limiting configured: ${limiter.points} requests per ${limiter.duration} seconds (${process.env.NODE_ENV})`);

/**
 * Middleware que verifica y limita la tasa de solicitudes por IP.
 * Consume un punto por solicitud y rechaza si se excede el límite.
 */
const rateLimiterMiddleware = (req, res, next) => {
  limiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).send('Demasiadas solicitudes desde esta IP, inténtalo de nuevo más tarde.');
    });
};

/**
 * Configuración de middleware para manejo de CORS y parsing de datos.
 * Permite solicitudes desde el frontend y parsea JSON y datos de formularios.
 * CORS debe aplicarse ANTES del rate limiter para que los headers estén en todas las respuestas.
 */

// Configuración de CORS para permitir solicitudes desde el frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175', 'http://127.0.0.1:5176'], // URLs del frontend en desarrollo
  credentials: true, // Si necesitas enviar cookies/credenciales
}));

app.use(rateLimiterMiddleware);

// Middleware para parsear JSON con límite de tamaño
app.use(express.json({ limit: '10mb' }));

// Middleware para parsear datos de formularios URL-encoded
app.use(express.urlencoded({ extended: true }));

/**
 * Configuración de sesiones y Passport.js para autenticación OAuth.
 * Las sesiones son necesarias para mantener el estado durante el flujo OAuth.
 */

// Middleware de sesiones usando express-session
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

// Inicializa Passport.js para manejo de autenticación
app.use(passport.initialize());
app.use(passport.session());

/**
 * Ruta raíz que retorna información básica del estado de la API.
 */
app.get('/', (req, res) => {
  console.log(`📍 Route '/' accessed from ${req.ip} at ${new Date().toISOString()}`);
  res.status(200).json({
    message: 'Changánet API funcionando correctamente',
    version: '1.0.0',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

/**
 * Ruta de documentación de la API usando Swagger UI.
 */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rutas de métricas y backup (antes de otras rutas para evitar interferencias)
const metricsRoutes = require('./routes/metricsRoutes');
const backupRoutes = backupService.getBackupRoutes();
const statsRoutes = require('./routes/statsRoutes');
app.use('/api', metricsRoutes);
app.use('/api', backupRoutes);
app.use('/api', statsRoutes);

// Ruta directa de métricas para Prometheus (sin prefijo /api)
app.get('/metrics', async (req, res) => {
  try {
    const { getMetrics } = require('./services/metricsService');
    const metrics = await getMetrics();

    // Configurar headers para formato Prometheus
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Content-Length', Buffer.byteLength(metrics, 'utf8'));

    // Enviar métricas
    res.status(200).send(metrics);
  } catch (error) {
    console.error('Error al obtener métricas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Configuración de rutas de la API REST.
 * Cada ruta está protegida según sea necesario con middleware de autenticación.
 */

// Rutas de autenticación (registro, login, OAuth)
app.use('/api/auth', authRoutes);

// Rutas de perfiles de usuario
app.use('/api/profile', profileRoutes);

// Rutas de profesionales
app.use('/api/professionals', professionalsRoutes);

// Rutas de búsqueda de profesionales (REQ-11 a REQ-15)
app.use('/api/search', searchRoutes);

// Rutas de mensajería con autenticación requerida
app.use('/api/messages', authenticateToken, messageRoutes);

// Rutas de reseñas con autenticación requerida
app.use('/api/reviews', authenticateToken, reviewRoutes);

// Rutas de disponibilidad con autenticación requerida
app.use('/api/availability', authenticateToken, availabilityRoutes);

// Rutas de notificaciones con autenticación requerida
app.use('/api/notifications', authenticateToken, notificationRoutes);

// Rutas de cotizaciones con autenticación requerida
app.use('/api/quotes', authenticateToken, quoteRoutes);

// Rutas de verificación con autenticación requerida
app.use('/api/verification', authenticateToken, verificationRoutes);

// Rutas de custodia de pagos con autenticación requerida
app.use('/api/custody', authenticateToken, custodyRoutes);

// Rutas de rankings (públicas)
app.use('/api/ranking', rankingRoutes);

// Rutas de gestión de servicios
app.use('/api/services', serviceRoutes);

// Rutas de pagos con custodia de fondos con autenticación requerida
app.use('/api/payments', paymentRoutes);
// Rutas de galería con autenticación requerida
app.use('/api/gallery', authenticateToken, galleryRoutes);

// Rutas de contacto (públicas)
app.use('/api/contact', contactRoutes);

// Rutas de newsletter (públicas)
app.use('/api/newsletter', newsletterRoutes);

// Rutas de administración con autenticación requerida
app.use('/api/admin', adminRoutes);

// Rutas de análisis de mercado con autenticación requerida
app.use('/api/market-analysis', marketAnalysisRoutes);

// Rutas de analytics avanzados con autenticación requerida
app.use('/api/advanced-analytics', advancedAnalyticsRoutes);

// Rutas de servicios recurrentes con autenticación requerida
app.use('/api/recurring-services', recurringServiceRoutes);

// Rutas de mapas (públicas)
app.use('/api/maps', mapsRoutes);

// Rutas de subida de archivos con autenticación requerida
app.use('/api/upload', uploadRoutes);

// Rutas de SMS (solo en desarrollo)
app.use('/api/sms', smsRoutes);

// Rutas de favoritos con autenticación requerida
app.use('/api/favorites', favoritesRoutes);

// Rutas de logros y gamificación
app.use('/api/achievements', achievementsRoutes);

/**
 * Configuración de eventos de Socket.IO para chat en tiempo real.
 * Implementa REQ-16: Chat interno en página del perfil
 * Maneja conexiones de usuarios, envío de mensajes y marcación como leídos.
 *
 * EVENTOS IMPLEMENTADOS:
 * - 'join': Unir usuario a su sala personal
 * - 'sendMessage': Enviar mensaje con validaciones completas
 * - 'markAsRead': Marcar mensajes como leídos
 * - 'disconnect': Manejo de desconexiones
 *
 * CARACTERÍSTICAS DE SEGURIDAD:
 * - Autenticación JWT obligatoria
 * - Validación de participantes en chats de servicios
 * - Límites de caracteres y validación de contenido
 * - Notificaciones push y email automáticas
 */
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  /**
   * Evento para unir un usuario a su sala personal de Socket.IO.
   * Permite enviar mensajes dirigidos específicamente a ese usuario.
   */
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`Usuario ${userId} se unió a su sala personal`);
  });

  /**
   * Evento para enviar un mensaje a otro usuario.
   * Guarda el mensaje en la base de datos y lo emite en tiempo real.
   */
  socket.on('sendMessage', async (data) => {
    const { remitente_id, destinatario_id, contenido, url_imagen, servicio_id } = data;
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // 🚨 SECURITY CHECK: Verificar si el socket está autenticado
    if (!socket.user && !isDevelopment) {
      console.error(`🚨 BLOCKED: Unauthenticated user attempted to send message!`);
      console.error(`🚨 Socket ID: ${socket.id}, IP: ${socket.handshake.address}`);
      console.error(`🚨 Message data: ${JSON.stringify(data)}`);
      socket.emit('error', { message: 'Authentication required to send messages.' });
      return;
    }

    if (socket.isDevMode) {
      console.log(`🧪 DEV MODE: Test user sending message - From: ${remitente_id}, To: ${destinatario_id}`);
    } else {
      console.log(`💬 Message attempt - From: ${remitente_id}, To: ${destinatario_id}, User: ${socket.user?.nombre || 'Unknown'}`);
    }

    try {
      // Validar que todos los campos requeridos estén presentes
      if (!remitente_id || !destinatario_id || (!contenido && !url_imagen)) {
        console.warn(`⚠️ Incomplete message data: ${JSON.stringify(data)}`);
        socket.emit('error', { message: 'Se requiere contenido o imagen para enviar mensaje.' });
        return;
      }

      // Validar límite de caracteres para contenido de texto
      if (contenido && contenido.length > 1000) {
        socket.emit('error', { message: 'El mensaje no puede exceder 1000 caracteres.' });
        return;
      }

      // Validar que ambos usuarios pertenezcan al servicio si se especifica servicio_id
      if (servicio_id) {
        const service = await prisma.servicios.findUnique({
          where: { id: servicio_id },
          include: { cliente: true, profesional: true }
        });

        if (!service) {
          socket.emit('error', { message: 'Servicio no encontrado.' });
          return;
        }

        const isParticipant = (service.cliente_id === remitente_id && service.profesional_id === destinatario_id) ||
                              (service.profesional_id === remitente_id && service.cliente_id === destinatario_id);

        if (!isParticipant) {
          socket.emit('error', { message: 'No tienes permiso para enviar mensajes en este chat.' });
          return;
        }
      }

      // En modo desarrollo con usuario de prueba, usar ID de desarrollo
      let actualRemitenteId = remitente_id;
      if (socket.isDevMode && remitente_id === 'dev-test-user') {
        actualRemitenteId = socket.user.id;
      }

      // Crear el mensaje en la base de datos
      const message = await prisma.mensajes.create({
        data: {
          remitente_id: actualRemitenteId,
          destinatario_id,
          contenido,
          url_imagen: url_imagen || null,
          servicio_id: servicio_id || null,
          esta_leido: false,
        },
      });

      // Enviar notificación push al destinatario (FCM)
      try {
        await sendPushNotification(
          destinatario_id,
          'Nuevo mensaje',
          `Tienes un nuevo mensaje en Changánet`,
          {
            type: 'mensaje',
            remitente_id: remitente_id,
            message_id: message.id
          }
        );
      } catch (pushError) {
        console.warn('Error enviando push notification:', pushError.message);
      }

      // Enviar notificación en base de datos (para historial)
      const sender = await prisma.usuarios.findUnique({ where: { id: actualRemitenteId }, select: { nombre: true } });
      await sendNotification(destinatario_id, 'nuevo_mensaje', `Nuevo mensaje de ${sender?.nombre || 'un usuario'}`);

      // Emitir el mensaje en tiempo real usando salas de Socket.IO
      io.to(destinatario_id).emit('receiveMessage', message);
      io.to(remitente_id).emit('messageSent', message);

      console.log(`Mensaje enviado de ${remitente_id} a ${destinatario_id}`);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      socket.emit('error', { message: 'No se pudo enviar el mensaje.' });
    }
  });

  /**
   * Evento para marcar mensajes como leídos.
   * Actualiza el estado de los mensajes en la base de datos.
   */
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

      // Notificar al remitente que sus mensajes fueron marcados como leídos
      io.to(senderId).emit('messagesRead', { by: recipientId });
    } catch (error) {
      console.error('Error al marcar mensajes como leídos:', error);
      socket.emit('error', { message: 'No se pudieron marcar los mensajes como leídos.' });
    }
  });

  /**
   * Evento para manejar el estado de "escribiendo" de los usuarios.
   * Permite mostrar indicadores en tiempo real cuando alguien está escribiendo.
   */
  socket.on('typing', (data) => {
    const { from, to, isTyping } = data;
    console.log(`⌨️ Typing event - From: ${from}, To: ${to}, IsTyping: ${isTyping}`);
    
    // Enviar evento de typing al destinatario
    socket.to(to).emit('userTyping', { from, isTyping });
  });

  /**
   * Evento que se ejecuta cuando un usuario se desconecta.
   */
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

// Middleware de manejo de errores de Sentry (DEBE ser el ÚLTIMO middleware de error) - Monitoreo de errores (REQ-40)
app.use(sentryErrorHandler());

// Manejo de errores global (después de Sentry) - Manejo de errores no capturados (REQ-40)
app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  res.status(500).json({ error: 'Algo salió mal!', details: err.message });
});

// REMOVED: Duplicate route definition removed for cleaner code
// The first route definition (line 261) handles the root endpoint

// Ruta adicional para compatibilidad con pruebas de CORS
app.options('*', cors());

/**
 * Endpoint de health check para monitoreo y load balancers.
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * Ruta de prueba para verificar la configuración de CORS.
 */
app.get('/test-cors', (req, res) => {
  res.json({
    message: 'CORS funcionando correctamente',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    schema_updated: true
  });
});

// Ruta para verificar configuración de servicios externos
app.get('/api/status', (req, res) => {
  res.json({
    status: 'OK',
    services: {
      firebase: admin ? 'configured' : 'not configured',
      sendgrid: process.env.SENDGRID_API_KEY ? 'configured' : 'not configured',
      twilio: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not configured',
      sentry: process.env.SENTRY_DSN ? 'configured' : 'not configured'
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = parseInt(process.env.PORT) || 3002;

/**
 * Función para encontrar un puerto disponible automáticamente
 * Intenta usar el puerto especificado, y si está ocupado, busca el siguiente disponible
 */
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Si el puerto está ocupado, intentar con el siguiente
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
};

// Programar recordatorios automáticos de disponibilidad
if (process.env.NODE_ENV !== 'test') {
  scheduleAutomaticReminders();
  console.log('⏰ Recordatorios automáticos de disponibilidad programados');

  // Programar liberación automática de fondos (RB-04)
  scheduleAutomaticFundReleases();
  console.log('💰 Liberación automática de fondos programada');

  findAvailablePort(PORT).then(availablePort => {
    server.listen(availablePort, () => {
      console.log(`🚀 Backend y Socket.IO corriendo en http://localhost:${availablePort}`);
      console.log(`📚 Documentación API disponible en http://localhost:${availablePort}/api-docs`);
      console.log(`🔍 Puerto automático: ${availablePort !== PORT ? `Puerto ${PORT} ocupado, usando ${availablePort}` : `Usando puerto configurado ${PORT}`}`);
    });
  }).catch(error => {
    console.error('❌ Error al encontrar puerto disponible:', error);
    process.exit(1);
  });
}

// Exportar app para pruebas
module.exports = app; 
