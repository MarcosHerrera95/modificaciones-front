/**
 * PRUEBAS END-TO-END DEL SISTEMA DE CHAT - POST CORRECCIONES
 * Verifica que todas las correcciones implementadas funcionen correctamente
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuración de la API
const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3003';

// Variables para almacenar datos de prueba
let testUser1 = null;
let testUser2 = null;
let authToken1 = null;
let authToken2 = null;
let conversationId = null;
let messageId = null;

// Colores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, success, details = '') {
  const status = success ? '✅ PASS' : '❌ FAIL';
  const color = success ? 'green' : 'red';
  log(`${status} ${testName}`, color);
  if (details) log(`   ${details}`, success ? 'green' : 'red');
}

/**
 * Función auxiliar para esperar a que el servidor esté listo
 */
async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK') {
          return true;
        }
      }
    } catch (error) {
      // Ignorar errores de conexión
    }
    log(`Esperando servidor... intento ${i + 1}/${maxAttempts}`, 'yellow');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
  }
  return false;
}

/**
 * PRUEBA 1: Verificar que el servidor esté corriendo
 */
async function testServerHealth() {
  try {
    log('\n🔍 PRUEBA 1: Verificando estado del servidor...', 'blue');

    // Esperar a que el servidor esté listo
    const serverReady = await waitForServer();
    if (!serverReady) {
      logTest('Server Health Check', false, 'Servidor no respondió después de esperar');
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();

    const success = response.ok && data.status === 'OK';
    logTest('Server Health Check', success, `Status: ${response.status}, Response: ${JSON.stringify(data)}`);
    return success;
  } catch (error) {
    logTest('Server Health Check', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 2: Verificar endpoints de chat disponibles
 */
async function testChatEndpoints() {
  try {
    log('\n🔍 PRUEBA 2: Verificando endpoints de chat disponibles...', 'blue');
    const response = await fetch(`${API_BASE_URL}/api/chat/ping`);
    const data = await response.json();

    const success = response.ok && data.endpoints_available && data.endpoints_available.includes('POST /messages/read');
    logTest('Chat Endpoints Check', success, `Endpoints: ${data.endpoints_available?.join(', ')}`);
    return success;
  } catch (error) {
    logTest('Chat Endpoints Check', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 3: Crear usuarios de prueba
 */
async function createTestUsers() {
  try {
    log('\n🔍 PRUEBA 3: Creando usuarios de prueba...', 'blue');

    // Usuario 1 - Cliente
    const user1Response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Client',
        email: `test-client-${Date.now()}@example.com`,
        password: 'testpass123',
        rol: 'cliente'
      })
    });

    const user1Data = await user1Response.json();
    testUser1 = user1Data.user;
    authToken1 = user1Data.token;

    // Usuario 2 - Profesional
    const user2Response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Professional',
        email: `test-pro-${Date.now()}@example.com`,
        password: 'testpass123',
        rol: 'profesional'
      })
    });

    const user2Data = await user2Response.json();
    testUser2 = user2Data.user;
    authToken2 = user2Data.token;

    const success = user1Response.ok && user2Response.ok && testUser1 && testUser2;
    logTest('Create Test Users', success, `User1: ${testUser1?.email}, User2: ${testUser2?.email}`);
    return success;
  } catch (error) {
    logTest('Create Test Users', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 4: Crear conversación entre usuarios
 */
async function createConversation() {
  try {
    log('\n🔍 PRUEBA 4: Creando conversación entre usuarios...', 'blue');

    const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken1}`
      },
      body: JSON.stringify({
        clientId: testUser1.id,
        professionalId: testUser2.id
      })
    });

    const data = await response.json();
    conversationId = data.conversation?.id;

    const success = response.ok && conversationId;
    logTest('Create Conversation', success, `Conversation ID: ${conversationId}`);
    return success;
  } catch (error) {
    logTest('Create Conversation', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 5: Enviar mensaje en la conversación
 */
async function sendMessage() {
  try {
    log('\n🔍 PRUEBA 5: Enviando mensaje en la conversación...', 'blue');

    const response = await fetch(`${API_BASE_URL}/api/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken1}`
      },
      body: JSON.stringify({
        conversationId: conversationId,
        content: 'Mensaje de prueba para verificar funcionalidad',
        recipientId: testUser2.id
      })
    });

    const data = await response.json();
    messageId = data.message?.id;

    const success = response.ok && messageId;
    logTest('Send Message', success, `Message ID: ${messageId}`);
    return success;
  } catch (error) {
    logTest('Send Message', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 6: Verificar que el mensaje aparece en el historial
 */
async function checkMessageHistory() {
  try {
    log('\n🔍 PRUEBA 6: Verificando historial de mensajes...', 'blue');

    const response = await fetch(`${API_BASE_URL}/api/chat/messages/${conversationId}`, {
      headers: {
        'Authorization': `Bearer ${authToken1}`
      }
    });

    const data = await response.json();

    const success = response.ok && data.messages && data.messages.length > 0;
    logTest('Check Message History', success, `Messages found: ${data.messages?.length || 0}`);
    return success;
  } catch (error) {
    logTest('Check Message History', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 7: Probar marcar mensajes como leídos (CORRECCIÓN CRÍTICA)
 */
async function markMessagesAsRead() {
  try {
    log('\n🔍 PRUEBA 7: Probando marcar mensajes como leídos (corrección crítica)...', 'blue');

    const response = await fetch(`${API_BASE_URL}/api/chat/messages/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken2}` // Usuario 2 marca como leídos
      },
      body: JSON.stringify({
        conversationId: conversationId,
        messageIds: [messageId]
      })
    });

    const data = await response.json();

    const success = response.ok && data.success && data.messages_marked_read > 0;
    logTest('Mark Messages as Read', success, `Messages marked: ${data.messages_marked_read || 0}`);
    return success;
  } catch (error) {
    logTest('Mark Messages as Read', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 8: Verificar que los mensajes están marcados como leídos
 */
async function verifyMessagesRead() {
  try {
    log('\n🔍 PRUEBA 8: Verificando que los mensajes están marcados como leídos...', 'blue');

    const response = await fetch(`${API_BASE_URL}/api/chat/messages/${conversationId}`, {
      headers: {
        'Authorization': `Bearer ${authToken1}`
      }
    });

    const data = await response.json();

    // Verificar que al menos un mensaje tiene status 'read'
    const hasReadMessages = data.messages?.some(msg => msg.status === 'read');

    const success = response.ok && hasReadMessages;
    logTest('Verify Messages Read', success, `Read messages found: ${hasReadMessages}`);
    return success;
  } catch (error) {
    logTest('Verify Messages Read', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 9: Verificar lista de conversaciones
 */
async function checkConversationsList() {
  try {
    log('\n🔍 PRUEBA 9: Verificando lista de conversaciones...', 'blue');

    const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      headers: {
        'Authorization': `Bearer ${authToken1}`
      }
    });

    const data = await response.json();

    const success = response.ok && data.conversations && data.conversations.length > 0;
    logTest('Check Conversations List', success, `Conversations found: ${data.conversations?.length || 0}`);
    return success;
  } catch (error) {
    logTest('Check Conversations List', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 10: Limpiar datos de prueba
 */
async function cleanupTestData() {
  try {
    log('\n🧹 PRUEBA 10: Limpiando datos de prueba...', 'blue');

    if (conversationId) {
      await prisma.conversations.delete({ where: { id: conversationId } }).catch(() => {});
    }

    if (testUser1?.id) {
      await prisma.usuarios.delete({ where: { id: testUser1.id } }).catch(() => {});
    }

    if (testUser2?.id) {
      await prisma.usuarios.delete({ where: { id: testUser2.id } }).catch(() => {});
    }

    logTest('Cleanup Test Data', true, 'Datos de prueba eliminados');
    return true;
  } catch (error) {
    logTest('Cleanup Test Data', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Función principal que ejecuta todas las pruebas
 */
async function runAllTests() {
  log('🚀 INICIANDO PRUEBAS END-TO-END DEL SISTEMA DE CHAT', 'magenta');
  log('='.repeat(60), 'magenta');

  const results = [];

  // Ejecutar pruebas en secuencia
  results.push(await testServerHealth());
  results.push(await testChatEndpoints());
  results.push(await createTestUsers());

  if (results[2]) { // Solo continuar si los usuarios se crearon
    results.push(await createConversation());

    if (results[3]) { // Solo continuar si la conversación se creó
      results.push(await sendMessage());
      results.push(await checkMessageHistory());
      results.push(await markMessagesAsRead()); // PRUEBA CRÍTICA
      results.push(await verifyMessagesRead());
      results.push(await checkConversationsList());
    }
  }

  results.push(await cleanupTestData());

  // Calcular resultados
  const passed = results.filter(r => r === true).length;
  const total = results.length;

  log('\n' + '='.repeat(60), 'magenta');
  log(`📊 RESULTADOS FINALES: ${passed}/${total} pruebas pasaron`, passed === total ? 'green' : 'red');

  if (passed === total) {
    log('🎉 TODAS LAS PRUEBAS PASARON - EL SISTEMA ESTÁ FUNCIONANDO CORRECTAMENTE', 'green');
    log('✅ Correcciones implementadas exitosamente', 'green');
    log('✅ Endpoint POST /api/chat/messages/read funcionando', 'green');
    log('✅ Sistema de chat completamente operativo', 'green');
  } else {
    log('⚠️  ALGUNAS PRUEBAS FALLARON - REVISAR LOGS', 'red');
  }

  // Cerrar conexión a BD
  await prisma.$disconnect();

  // Salir con código apropiado
  process.exit(passed === total ? 0 : 1);
}

// Ejecutar pruebas
runAllTests().catch(error => {
  log(`❌ ERROR FATAL: ${error.message}`, 'red');
  process.exit(1);
});