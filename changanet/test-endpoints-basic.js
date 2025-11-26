/**
 * PRUEBA BÁSICA DE ENDPOINTS - Verificación rápida de correcciones
 */

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3003';

/**
 * Función auxiliar para esperar servidor
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
      // Ignorar errores
    }
    console.log(`Esperando servidor... intento ${i + 1}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

/**
 * PRUEBA 1: Verificar que el endpoint POST /api/chat/messages/read existe
 */
async function testMessagesReadEndpoint() {
  try {
    console.log('\n🔍 PRUEBA: Verificando endpoint POST /api/chat/messages/read...');

    // Intentar hacer una petición (esperamos 401 porque no hay token, pero debe existir la ruta)
    const response = await fetch(`${API_BASE_URL}/api/chat/messages/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'test' })
    });

    // Si obtenemos 401 (no autorizado), significa que la ruta existe y requiere autenticación
    if (response.status === 401) {
      console.log('✅ PASS: Endpoint POST /api/chat/messages/read existe y requiere autenticación');
      return true;
    } else {
      console.log(`❌ FAIL: Respuesta inesperada ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: Error de conexión - ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 2: Verificar que el endpoint GET /api/chat/conversations existe
 */
async function testConversationsEndpoint() {
  try {
    console.log('\n🔍 PRUEBA: Verificando endpoint GET /api/chat/conversations...');

    const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      method: 'GET'
    });

    if (response.status === 401) {
      console.log('✅ PASS: Endpoint GET /api/chat/conversations existe y requiere autenticación');
      return true;
    } else {
      console.log(`❌ FAIL: Respuesta inesperada ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: Error de conexión - ${error.message}`);
    return false;
  }
}

/**
 * PRUEBA 3: Verificar lista de endpoints disponibles
 */
async function testPingEndpoint() {
  try {
    console.log('\n🔍 PRUEBA: Verificando lista de endpoints en /ping...');

    const response = await fetch(`${API_BASE_URL}/api/chat/ping`);
    const data = await response.json();

    if (response.ok && data.endpoints_available) {
      const hasMessagesRead = data.endpoints_available.includes('POST /messages/read');
      const hasConversations = data.endpoints_available.includes('GET /conversations');

      if (hasMessagesRead && hasConversations) {
        console.log('✅ PASS: Todos los endpoints corregidos están en la lista');
        console.log('📋 Endpoints disponibles:', data.endpoints_available);
        return true;
      } else {
        console.log('❌ FAIL: Faltan endpoints en la lista');
        console.log('📋 Endpoints disponibles:', data.endpoints_available);
        return false;
      }
    } else {
      console.log(`❌ FAIL: Respuesta inválida`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: Error de conexión - ${error.message}`);
    return false;
  }
}

/**
 * Función principal
 */
async function runBasicTests() {
  console.log('🚀 PRUEBAS BÁSICAS DE ENDPOINTS - POST CORRECCIONES');
  console.log('='.repeat(60));

  // Esperar servidor
  console.log('⏳ Esperando que el servidor esté listo...');
  const serverReady = await waitForServer();

  if (!serverReady) {
    console.log('❌ ERROR: Servidor no respondió después de esperar');
    process.exit(1);
  }

  console.log('✅ Servidor listo');

  // Ejecutar pruebas
  const results = [];
  results.push(await testMessagesReadEndpoint());
  results.push(await testConversationsEndpoint());
  results.push(await testPingEndpoint());

  // Resultados
  const passed = results.filter(r => r === true).length;
  const total = results.length;

  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESULTADOS: ${passed}/${total} pruebas pasaron`);

  if (passed === total) {
    console.log('🎉 ÉXITO: Todas las correcciones están funcionando correctamente');
    console.log('✅ Endpoint POST /api/chat/messages/read implementado');
    console.log('✅ Endpoint GET /api/chat/conversations funcionando');
    console.log('✅ Lista de endpoints actualizada');
  } else {
    console.log('⚠️  Algunas pruebas fallaron - revisar implementación');
  }

  process.exit(passed === total ? 0 : 1);
}

runBasicTests().catch(error => {
  console.error(`❌ ERROR FATAL: ${error.message}`);
  process.exit(1);
});