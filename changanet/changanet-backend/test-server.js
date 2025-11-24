/**
 * Servidor de Prueba Simple para Verificar Conectividad de Base de Datos
 * Este servidor básico prueba la conexión con Prisma y la base de datos SQLite
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = 3004;

// Middleware básico
app.use(express.json());

// Endpoint de salud básico
app.get('/health', async (req, res) => {
  try {
    // Probar conexión con la base de datos
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'OK',
      message: 'Servidor funcionando correctamente',
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error de base de datos:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error de base de datos',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para verificar tablas
app.get('/tables', async (req, res) => {
  try {
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `;
    
    res.json({
      status: 'OK',
      tables: tables.map(t => t.name),
      total_tables: tables.length
    });
  } catch (error) {
    console.error('Error obteniendo tablas:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error obteniendo tablas',
      error: error.message
    });
  }
});

// Endpoint para verificar usuarios
app.get('/users', async (req, res) => {
  try {
    const users = await prisma.usuarios.findMany({
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        esta_verificado: true,
        creado_en: true
      },
      take: 5 // Solo los primeros 5 usuarios
    });
    
    res.json({
      status: 'OK',
      users: users,
      total_found: users.length
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error obteniendo usuarios',
      error: error.message
    });
  }
});

// Endpoint para probar conversación (si existe la tabla)
app.get('/conversations', async (req, res) => {
  try {
    const conversations = await prisma.conversations.findMany({
      select: {
        id: true,
        client_id: true,
        professional_id: true,
        created_at: true,
        is_active: true
      },
      take: 5 // Solo las primeras 5 conversaciones
    });
    
    res.json({
      status: 'OK',
      conversations: conversations,
      total_found: conversations.length
    });
  } catch (error) {
    console.error('Error obteniendo conversaciones:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error obteniendo conversaciones',
      error: error.message
    });
  }
});

// Endpoint básico para pruebas
app.get('/', (req, res) => {
  res.json({
    message: 'Servidor de Prueba ChangAnet',
    status: 'Running',
    endpoints: [
      'GET /health - Estado del servidor y base de datos',
      'GET /tables - Listar tablas de la base de datos',
      'GET /users - Ver usuarios de prueba',
      'GET /conversations - Ver conversaciones de prueba'
    ]
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor de prueba iniciado en puerto ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Tablas: http://localhost:${PORT}/tables`);
  console.log(`👥 Usuarios: http://localhost:${PORT}/users`);
  console.log(`💬 Conversaciones: http://localhost:${PORT}/conversations`);
});

// Manejo graceful de cierre
process.on('SIGINT', async () => {
  console.log('\n🔄 Cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});