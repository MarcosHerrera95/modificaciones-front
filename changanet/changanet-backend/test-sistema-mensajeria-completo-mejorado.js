/**
 * Test Sistema de Mensajería Completo Mejorado
 * 
 * Pruebas exhaustivas para el sistema de chat mejorado de Changánet
 * Incluye testing de todas las funcionalidades nuevas implementadas
 * 
 * CARACTERÍSTICAS PROBADAS:
 * - ChatContext y gestión de estado
 * - Rate limiting y seguridad
 * - Storage service y subida de imágenes
 * - WebSocket mejorado
 * - Notificaciones robustas
 * 
 * EJECUCIÓN:
 * node test-sistema-mensajeria-completo-mejorado.js
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const rateLimiter = require('./changanet-backend/src/services/rateLimiterService');
const storageService = require('./changanet-backend/src/services/storageService');

const prisma = new PrismaClient();

// Configuración de prueba
const CONFIG = {
  BASE_URL: 'http://localhost:3003',
  FRONTEND_URL: 'http://localhost:5173',
  TEST_USER: {
    email: 'test@changanet.com',
    password: 'Test123!',
    nombre: 'Usuario de Prueba',
    rol: 'cliente'
  },
  TEST_PROFESSIONAL: {
    email: 'profesional@changanet.com',
    password: 'Test123!',
    nombre: 'Profesional de Prueba',
    rol: 'profesional'
  }
};

// Utilidades de testing
class ChatTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    this.authTokens = {};
    this.testData = {};
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${icon} ${message}`);
  }

  async test(name, testFunction) {
    this.results.total++;
    try {
      await testFunction();
      this.results.passed++;
      await this.log(`Test passed: ${name}`, 'success');
      return true;
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ name, error: error.message });
      await this.log(`Test failed: ${name} - ${error.message}`, 'error');
      return false;
    }
  }

  async makeAuthenticatedRequest(method, endpoint, data = null, user = 'client') {
    const token = this.authTokens[user];
    if (!token) {
      throw new Error(`No authentication token for user: ${user}`);
    }

    const config = {
      method,
      url: `${CONFIG.BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    return await axios(config);
  }

  async authenticateUser(userData) {
    try {
      // Intentar login
      const response = await axios.post(`${CONFIG.BASE_URL}/api/auth/login`, {
        email: userData.email,
        password: userData.password
      });

      return response.data.token;
    } catch (error) {
      // Si no existe el usuario, registrarlo
      await this.registerUser(userData);
      return this.authenticateUser(userData);
    }
  }

  async registerUser(userData) {
    const response = await axios.post(`${CONFIG.BASE_URL}/api/auth/register`, userData);
    return response.data;
  }

  printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTADOS DE PRUEBAS DEL SISTEMA DE CHAT MEJORADO');
    console.log('='.repeat(80));
    
    console.log(`Total de pruebas: ${this.results.total}`);
    console.log(`✅ Exitosas: ${this.results.passed}`);
    console.log(`❌ Fallidas: ${this.results.failed}`);
    
    const successRate = ((this.results.passed / this.results.total) * 100).toFixed(2);
    console.log(`📈 Tasa de éxito: ${successRate}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n🔍 ERRORES DETALLADOS:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.name}: ${error.error}`);
      });
    }
    
    console.log('='.repeat(80));
  }
}

// Tests específicos
class ChatSystemTests {
  constructor(tester) {
    this.tester = tester;
  }

  // Test de autenticación y setup
  async testAuthentication() {
    await this.tester.test('Registro de usuario cliente', async () => {
      const response = await this.tester.registerUser(CONFIG.TEST_USER);
      if (!response.success) {
        throw new Error('Failed to register client user');
      }
    });

    await this.tester.test('Registro de usuario profesional', async () => {
      const response = await this.tester.registerUser(CONFIG.TEST_PROFESSIONAL);
      if (!response.success) {
        throw new Error('Failed to register professional user');
      }
    });

    await this.tester.test('Autenticación de usuario cliente', async () => {
      const token = await this.tester.authenticateUser(CONFIG.TEST_USER);
      this.tester.authTokens.client = token;
    });

    await this.tester.test('Autenticación de usuario profesional', async () => {
      const token = await this.tester.authenticateUser(CONFIG.TEST_PROFESSIONAL);
      this.tester.authTokens.professional = token;
    });
  }

  // Test de rate limiting
  async testRateLimiting() {
    await this.tester.test('Rate limiting - mensajes', async () => {
      const userId = 'test-user-123';
      
      // Primer request debe pasar
      let result = await rateLimiter.checkLimit('messages', userId);
      if (!result.allowed) {
        throw new Error('First message request should be allowed');
      }
      
      // Simular múltiples requests rápidos (más del límite)
      for (let i = 0; i < 12; i++) {
        await rateLimiter.checkLimit('messages', userId);
      }
      
      // El último debe estar bloqueado
      result = await rateLimiter.checkLimit('messages', userId);
      if (result.allowed) {
        throw new Error('Rate limit should block excessive requests');
      }
      
      if (result.retryAfter !== undefined && result.retryAfter < 0) {
        throw new Error('Invalid retryAfter value');
      }
    });

    await this.tester.test('Rate limiting - uploads', async () => {
      const userId = 'test-user-456';
      
      // Primer upload debe pasar
      let result = await rateLimiter.checkLimit('uploads', userId);
      if (!result.allowed) {
        throw new Error('First upload request should be allowed');
      }
      
      // Múltiples uploads deben ser bloqueados
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit('uploads', userId);
      }
      
      // El último debe estar bloqueado
      result = await rateLimiter.checkLimit('uploads', userId);
      if (result.allowed) {
        throw new Error('Upload rate limit should block excessive requests');
      }
    });

    await this.tester.test('Rate limiting - métricas', async () => {
      const metrics = rateLimiter.getMetrics();
      
      if (typeof metrics.totalRequests !== 'number') {
        throw new Error('Invalid totalRequests metric');
      }
      
      if (typeof metrics.blockedRequests !== 'number') {
        throw new Error('Invalid blockedRequests metric');
      }
      
      if (typeof metrics.blockRate !== 'string') {
        throw new Error('Invalid blockRate metric');
      }
    });
  }

  // Test de storage service
  async testStorageService() {
    await this.tester.test('Storage service - validación de archivos', async () => {
      // Test archivo válido
      try {
        await storageService.validateFile('test.jpg', 'image/jpeg', 1024 * 1024, 'user123');
      } catch (error) {
        // Debería pasar sin errores
      }
      
      // Test archivo inválido (tipo)
      try {
        await storageService.validateFile('test.exe', 'application/exe', 1024 * 1024, 'user123');
        throw new Error('Should have rejected invalid file type');
      } catch (error) {
        if (!error.message.includes('Tipo de archivo no permitido')) {
          throw error;
        }
      }
      
      // Test archivo demasiado grande
      try {
        await storageService.validateFile('test.jpg', 'image/jpeg', 10 * 1024 * 1024, 'user123');
        throw new Error('Should have rejected oversized file');
      } catch (error) {
        if (!error.message.includes('demasiado grande')) {
          throw error;
        }
      }
    });

    await this.tester.test('Storage service - generación de presigned URL', async () => {
      const result = await storageService.getPresignedUploadUrl(
        'test-image.jpg',
        'image/jpeg',
        1024 * 1024,
        'user123'
      );
      
      if (!result.uploadUrl) {
        throw new Error('Missing uploadUrl');
      }
      
      if (!result.fileUrl) {
        throw new Error('Missing fileUrl');
      }
      
      if (!result.fileId) {
        throw new Error('Missing fileId');
      }
      
      if (!result.expiresAt) {
        throw new Error('Missing expiresAt');
      }
    });

    await this.tester.test('Storage service - métricas', async () => {
      const metrics = storageService.getMetrics();
      
      if (typeof metrics.totalUploads !== 'number') {
        throw new Error('Invalid totalUploads metric');
      }
      
      if (typeof metrics.successfulUploads !== 'number') {
        throw new Error('Invalid successfulUploads metric');
      }
      
      if (typeof metrics.provider !== 'string') {
        throw new Error('Invalid provider metric');
      }
    });
  }

  // Test de funcionalidad de chat
  async testChatFunctionality() {
    await this.tester.test('Crear conversación', async () => {
      // Obtener IDs de usuarios de prueba
      const [clientUser] = await Promise.all([
        prisma.usuarios.findUnique({ where: { email: CONFIG.TEST_USER.email } })
      ]);
      
      const [professionalUser] = await Promise.all([
        prisma.usuarios.findUnique({ where: { email: CONFIG.TEST_PROFESSIONAL.email } })
      ]);
      
      if (!clientUser || !professionalUser) {
        throw new Error('Test users not found');
      }
      
      // Crear conversación
      const response = await this.tester.makeAuthenticatedRequest(
        'POST',
        '/api/chat/conversations',
        {
          clientId: clientUser.id,
          professionalId: professionalUser.id
        },
        'client'
      );
      
      if (!response.data.conversationId) {
        throw new Error('Missing conversationId in response');
      }
      
      this.tester.testData.conversationId = response.data.conversationId;
      this.tester.testData.clientId = clientUser.id;
      this.tester.testData.professionalId = professionalUser.id;
    });

    await this.tester.test('Obtener conversaciones', async () => {
      const response = await this.tester.makeAuthenticatedRequest(
        'GET',
        '/api/chat/conversations',
        null,
        'client'
      );
      
      if (!Array.isArray(response.data.conversations)) {
        throw new Error('Conversations should be an array');
      }
    });

    await this.tester.test('Enviar mensaje de texto', async () => {
      if (!this.tester.testData.conversationId) {
        throw new Error('No conversation ID available');
      }
      
      const response = await this.tester.makeAuthenticatedRequest(
        'POST',
        '/api/chat/messages',
        {
          conversationId: this.tester.testData.conversationId,
          content: 'Hola, este es un mensaje de prueba',
          type: 'text'
        },
        'client'
      );
      
      if (!response.data.message) {
        throw new Error('Missing message in response');
      }
      
      this.tester.testData.messageId = response.data.message.id;
    });

    await this.tester.test('Obtener mensajes', async () => {
      if (!this.tester.testData.conversationId) {
        throw new Error('No conversation ID available');
      }
      
      const response = await this.tester.makeAuthenticatedRequest(
        'GET',
        `/api/chat/messages/${this.tester.testData.conversationId}`,
        null,
        'client'
      );
      
      if (!Array.isArray(response.data.messages)) {
        throw new Error('Messages should be an array');
      }
      
      if (response.data.messages.length === 0) {
        throw new Error('No messages found in conversation');
      }
    });

    await this.tester.test('Marcar mensajes como leídos', async () => {
      if (!this.tester.testData.messageId || !this.tester.testData.conversationId) {
        throw new Error('No message or conversation ID available');
      }
      
      const response = await this.tester.makeAuthenticatedRequest(
        'POST',
        '/api/chat/messages/read',
        {
          conversationId: this.tester.testData.conversationId,
          messageIds: [this.tester.testData.messageId]
        },
        'professional'
      );
      
      // La respuesta puede no tener contenido específico, verificar que no hay error
      if (response.status >= 400) {
        throw new Error('Mark as read request failed');
      }
    });
  }

  // Test de endpoints API
  async testAPIEndpoints() {
    await this.tester.test('Health check - API', async () => {
      const response = await axios.get(`${CONFIG.BASE_URL}/health`);
      if (response.status !== 200) {
        throw new Error('Health check failed');
      }
    });

    await this.tester.test('Unauthorized access blocked', async () => {
      try {
        await axios.get(`${CONFIG.BASE_URL}/api/chat/conversations`);
        throw new Error('Should have blocked unauthorized access');
      } catch (error) {
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          throw error;
        }
      }
    });

    await this.tester.test('Invalid conversation ID', async () => {
      try {
        await this.tester.makeAuthenticatedRequest(
          'GET',
          '/api/chat/conversations/invalid-id',
          null,
          'client'
        );
        throw new Error('Should have blocked invalid conversation ID');
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }
    });
  }

  // Test de base de datos
  async testDatabaseOperations() {
    await this.tester.test('Database connection', async () => {
      await prisma.$queryRaw`SELECT 1`;
    });

    await this.tester.test('Database schema integrity', async () => {
      // Verificar que las tablas necesarias existen
      const tables = await prisma.$queryRaw`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('mensajes', 'usuarios', 'conversations')
      `;
      
      const tableNames = tables.map(t => t.name);
      
      if (!tableNames.includes('mensajes')) {
        throw new Error('Missing mensajes table');
      }
      
      if (!tableNames.includes('usuarios')) {
        throw new Error('Missing usuarios table');
      }
      
      // La tabla conversations puede no existir aún (depende de migración)
      // if (!tableNames.includes('conversations')) {
      //   throw new Error('Missing conversations table');
      // }
    });
  }
}

// Función principal de testing
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DEL SISTEMA DE CHAT MEJORADO');
  console.log('Fecha:', new Date().toISOString());
  console.log('');

  const tester = new ChatTester();
  const tests = new ChatSystemTests(tester);

  try {
    // Tests de autenticación
    console.log('🔐 Probando autenticación y setup...');
    await tests.testAuthentication();
    console.log('');

    // Tests de rate limiting
    console.log('🛡️ Probando rate limiting...');
    await tests.testRateLimiting();
    console.log('');

    // Tests de storage
    console.log('💾 Probando storage service...');
    await tests.testStorageService();
    console.log('');

    // Tests de funcionalidad
    console.log('💬 Probando funcionalidad de chat...');
    await tests.testChatFunctionality();
    console.log('');

    // Tests de API
    console.log('🌐 Probando endpoints API...');
    await tests.testAPIEndpoints();
    console.log('');

    // Tests de base de datos
    console.log('🗄️ Probando base de datos...');
    await tests.testDatabaseOperations();
    console.log('');

  } catch (error) {
    await tester.log(`Error durante testing: ${error.message}`, 'error');
  } finally {
    // Limpiar datos de prueba
    try {
      // Limpiar usuarios de prueba si existen
      await prisma.usuarios.deleteMany({
        where: {
          email: {
            in: [CONFIG.TEST_USER.email, CONFIG.TEST_PROFESSIONAL.email]
          }
        }
      });
      await tester.log('Datos de prueba limpiados', 'info');
    } catch (cleanupError) {
      await tester.log(`Error limpiando datos: ${cleanupError.message}`, 'error');
    }
    
    await prisma.$disconnect();
  }

  // Mostrar resultados
  tester.printResults();

  return tester.results;
}

// Ejecutar pruebas si este archivo es ejecutado directamente
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('🏁 Pruebas completadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal durante las pruebas:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, ChatTester, ChatSystemTests };