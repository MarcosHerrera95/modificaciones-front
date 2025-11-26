/**
 * Script de prueba básico para verificar que la plataforma Changanet funciona
 * después de las correcciones aplicadas
 */

const http = require('http');

// Configuración
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 3007;

// Función para hacer requests HTTP
function makeRequest(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

// Tests
async function runTests() {
  console.log('🧪 Iniciando pruebas de la plataforma Changanet...\n');

  const tests = [
    {
      name: '✅ API Root',
      path: '/',
      expectedStatus: 200
    },
    {
      name: '✅ Health Check',
      path: '/health',
      expectedStatus: 200
    },
    {
      name: '✅ API Status',
      path: '/api/status',
      expectedStatus: 200
    },
    {
      name: '✅ Chat API Ping',
      path: '/api/chat/ping',
      expectedStatus: 200
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🔍 Probando: ${test.name}`);
      const response = await makeRequest(test.path);

      if (response.status === test.expectedStatus) {
        console.log(`   ✅ PASÓ - Status: ${response.status}`);
        passed++;
      } else {
        console.log(`   ❌ FALLÓ - Status esperado: ${test.expectedStatus}, recibido: ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR - ${error.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('📊 RESULTADOS FINALES:');
  console.log(`   ✅ Tests pasados: ${passed}`);
  console.log(`   ❌ Tests fallidos: ${failed}`);
  console.log(`   📈 Tasa de éxito: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 ¡Todas las pruebas básicas pasaron! La plataforma está funcionando correctamente.');
  } else {
    console.log('\n⚠️  Algunas pruebas fallaron. Verificar configuración del backend.');
  }
}

// Ejecutar tests
runTests().catch(console.error);