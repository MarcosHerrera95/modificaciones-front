const axios = require('axios');

async function testExistingUserScenario() {
  try {
    console.log('🧪 Probando escenario de usuario existente (reproduciendo error exacto)...');
    
    // Simular exactamente los datos que está enviando el frontend
    const requestData = {
      uid: 'O6Wl2iejTSeg6iygPqqPxltBFgc2',
      email: 'diegoeuler@gmail.com',
      nombre: 'Diego Eduardo Euler',
      photo: 'https://lh3.googleusercontent.com/a/ACg8ocIFZKIPW-5B2L0FtSPpzD2JsxCAAWO4eNiF9Eiuo5d_Pj0WzNRK=s96-c',
      rol: 'cliente'
    };

    console.log('📤 Enviando petición:', requestData);

    // Usar la misma URL que usa el frontend
    const response = await axios.post('http://localhost:5176/api/auth/google-login', requestData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; GoogleLoginButton/1.0)'
      },
      timeout: 30000
    });

    console.log('✅ Respuesta exitosa:', response.data);

  } catch (error) {
    console.error('❌ ERROR CAPTURADO:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      stack: error.stack
    });
  }
}

// Ejecutar inmediatamente
testExistingUserScenario();