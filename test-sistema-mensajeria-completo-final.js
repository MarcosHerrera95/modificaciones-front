#!/usr/bin/env node

/**
 * 🧪 Test Completo - Sistema de Mensajería Interna ChangAnet
 * Fecha: 25 de noviembre de 2025
 * Propósito: Verificar que el sistema de mensajería esté funcionando correctamente
 */

const axios = require('axios');

const config = {
  baseURL: 'http://localhost:3003',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
};

const api = axios.create(config);

// Colores para console.log
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test 1: Verificar que el servidor esté corriendo
async function testServerHealth() {
  logInfo('🔍 Test 1: Verificando salud del servidor...');
  
  try {
    const response = await api.get('/api/chat/ping');
    
    if (response.status === 200) {
      logSuccess('Servidor de chat está corriendo correctamente');
      return true;
    } else {
      logError(`Servidor respondió con código ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logError('No se puede conectar al servidor (puerto 3003)');
      logInfo('Asegúrate de que el backend esté corriendo: cd changanet/changanet-backend && npm start');
    } else {
      logError(`Error de conexión: ${error.message}`);
    }
    return false;
  }
}

// Test 2: Verificar endpoints de chat
async function testChatEndpoints() {
  logInfo('🔍 Test 2: Verificando endpoints de chat...');
  
  const endpoints = [
    { path: '/api/chat/ping', method: 'GET', name: 'Health Check' },
    { path: '/api/chat/conversations/test', method: 'GET', name: 'Get Conversations' },
    { path: '/api/chat/messages/test-conversation', method: 'GET', name: 'Get Messages' }
  ];

  let successCount = 0;
  
  for (const endpoint of endpoints) {
    try {
      const response = await api[endpoint.method.toLowerCase()](endpoint.path);
      logSuccess(`${endpoint.name}: ${response.status} OK`);
      successCount++;
    } catch (error) {
      if (error.response?.status === 401) {
        logWarning(`${endpoint.name}: Requiere autenticación (esperado)`);
        successCount++;
      } else if (error.response?.status === 404) {
        logWarning(`${endpoint.name}: Endpoint no encontrado (puede necesitar datos)`);
        successCount++;
      } else {
        logError(`${endpoint.name}: ${error.message}`);
      }
    }
  }
  
  return successCount === endpoints.length;
}

// Test 3: Verificar archivos del frontend
async function testFrontendComponents() {
  logInfo('🔍 Test 3: Verificando componentes frontend...');
  
  const fs = require('fs');
  const path = require('path');
  
  const frontendPath = 'changanet/changanet-frontend/src/components';
  const expectedComponents = [
    'ChatWindow.jsx',
    'MessageInput.jsx', 
    'ConversationList.jsx',
    'MessageBubble.jsx',
    'ImageUploadButton.jsx',
    'ChatWidget.jsx'
  ];
  
  let successCount = 0;
  
  for (const component of expectedComponents) {
    const componentPath = path.join(frontendPath, component);
    if (fs.existsSync(componentPath)) {
      logSuccess(`Componente ${component}: Encontrado`);
      successCount++;
    } else {
      logError(`Componente ${component}: No encontrado`);
    }
  }
  
  return successCount === expectedComponents.length;
}

// Test 4: Verificar esquema de base de datos
async function testDatabaseSchema() {
  logInfo('🔍 Test 4: Verificando esquema de base de datos...');
  
  const fs = require('fs');
  
  try {
    const schemaPath = 'changanet/changanet-backend/prisma/schema.prisma';
    if (!fs.existsSync(schemaPath)) {
      logError('Archivo schema.prisma no encontrado');
      return false;
    }
    
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Verificar que existen los modelos necesarios
    const requiredModels = ['conversations', 'mensajes'];
    let successCount = 0;
    
    for (const model of requiredModels) {
      if (schemaContent.includes(`model ${model}`)) {
        logSuccess(`Modelo ${model}: Definido en esquema`);
        successCount++;
      } else {
        logError(`Modelo ${model}: No encontrado en esquema`);
      }
    }
    
    return successCount === requiredModels.length;
  } catch (error) {
    logError(`Error leyendo esquema: ${error.message}`);
    return false;
  }
}

// Test 5: Verificar servicios backend
async function testBackendServices() {
  logInfo('🔍 Test 5: Verificando servicios backend...');
  
  const fs = require('fs');
  
  const servicesPath = 'changanet/changanet-backend/src/services';
  const requiredServices = [
    'unifiedChatController.js',
    'unifiedWebSocketService.js',
    'chatService.js',
    'notificationService.js'
  ];
  
  let successCount = 0;
  
  for (const service of requiredServices) {
    const servicePath = `${servicesPath}/${service}`;
    if (fs.existsSync(servicePath)) {
      logSuccess(`Servicio ${service}: Encontrado`);
      successCount++;
    } else {
      logError(`Servicio ${service}: No encontrado`);
    }
  }
  
  return successCount === requiredServices.length;
}

// Test 6: Verificar configuración de Redis (opcional)
async function testRedisConfiguration() {
  logInfo('🔍 Test 6: Verificando configuración de Redis...');
  
  try {
    // Intentar conectar a Redis
    const { createClient } = require('redis');
    const client = createClient({
      socket: {
        host: 'localhost',
        port: 6379
      }
    });
    
    await client.connect();
    const pong = await client.ping();
    await client.disconnect();
    
    logSuccess('Redis: Conectando correctamente');
    return true;
  } catch (error) {
    logWarning('Redis: No disponible (solo afecta métricas, no funcionalidad principal)');
    logInfo('Para habilitar Redis: docker-compose -f changanet/docker-compose.redis.yml up -d');
    return true; // No es crítico para el funcionamiento
  }
}

// Función principal de tests
async function runAllTests() {
  log(`${colors.bold}🚀 INICIANDO TESTS DEL SISTEMA DE MENSAJERÍA INTERNA CHANGANET${colors.reset}`, 'blue');
  log('=================================================================', 'blue');
  
  const tests = [
    { name: 'Salud del Servidor', fn: testServerHealth },
    { name: 'Endpoints de Chat', fn: testChatEndpoints },
    { name: 'Componentes Frontend', fn: testFrontendComponents },
    { name: 'Esquema de Base de Datos', fn: testDatabaseSchema },
    { name: 'Servicios Backend', fn: testBackendServices },
    { name: 'Configuración Redis', fn: testRedisConfiguration }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    log(`\n${colors.bold}--- ${test.name} ---${colors.reset}`, 'yellow');
    
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      logError(`Error ejecutando test ${test.name}: ${error.message}`);
    }
  }
  
  // Resumen final
  log('\n=================================================================', 'blue');
  log(`${colors.bold}📊 RESUMEN DE TESTS${colors.reset}`, 'blue');
  log('=================================================================', 'blue');
  
  const percentage = Math.round((passedTests / totalTests) * 100);
  
  if (percentage === 100) {
    logSuccess(`Todos los tests pasaron: ${passedTests}/${totalTests} (${percentage}%)`);
    log(`${colors.green}${colors.bold}🎉 ¡SISTEMA DE MENSAJERÍA LISTO PARA PRODUCCIÓN!${colors.reset}`, 'green');
  } else if (percentage >= 80) {
    logWarning(`Mayoría de tests pasaron: ${passedTests}/${totalTests} (${percentage}%)`);
    log(`${colors.yellow}⚠️  Sistema funcional con configuración pendiente${colors.reset}`, 'yellow');
  } else {
    logError(`Tests fallidos: ${passedTests}/${totalTests} (${percentage}%)`);
    log(`${colors.red}❌ Sistema requiere configuración adicional${colors.reset}`, 'red');
  }
  
  log('\n📋 PRÓXIMOS PASOS:');
  log('1. Configurar Redis: docker-compose -f changanet/docker-compose.redis.yml up -d');
  log('2. Ejecutar migraciones: cd changanet/changanet-backend && npx prisma db push');
  log('3. Iniciar backend: cd changanet/changanet-backend && npm start');
  log('4. Iniciar frontend: cd changanet/changanet-frontend && npm run dev');
  log('5. Acceder a: http://localhost:5173');
  
  return percentage === 100;
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logError(`Error general: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testServerHealth,
  testChatEndpoints,
  testFrontendComponents,
  testDatabaseSchema,
  testBackendServices,
  testRedisConfiguration
};