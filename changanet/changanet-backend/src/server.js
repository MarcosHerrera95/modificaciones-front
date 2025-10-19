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
const serviceRoutes = require('./routes/serviceRoutes');
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
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limitar tamaño de payloads

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
app.use('/api/services', authenticateToken, serviceRoutes);
app.use('/api/gallery', authenticateToken, galleryRoutes);

// Socket.IO para chat en tiempo real
io.on('connection', (socket) => {
  console.log('🚀 Usuario conectado:', socket.id);

  socket.on('sendMessage', async (data) => {
    const { remitente_id, destinatario_id, contenido, url_imagen } = data;

    try {
      const message = await prisma.mensajes.create({
        data: {
          remitente_id,
          destinatario_id,
          contenido,
          url_imagen,
          esta_leido: false,
        },
      });

      // INTEGRACIÓN CON SERVICIO DE NOTIFICACIONES
      await sendNotification(destinatario_id, 'nuevo_mensaje', `Nuevo mensaje de ${remitente_id}`);

      // EMITIR MENSAJE EN TIEMPO REAL
      io.to(destinatario_id).emit('receiveMessage', message);
      io.to(remitente_id).emit('messageSent', message);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      socket.emit('error', { message: 'No se pudo enviar el mensaje.' });
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

// Ruta de salud para monitoreo
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
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
