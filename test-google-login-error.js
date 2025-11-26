const axios = require('axios');

async function testGoogleLoginError() {
  try {
    console.log('🧪 Probando Google Login para reproducir error 500...');
    
    const requestData = {
      uid: 'O6Wl2iejTSeg6iygPqqPxltBFgc2',
      email: 'diegoeuler@gmail.com',
      nombre: 'Diego Eduardo Euler',
      photo: 'https://lh3.googleusercontent.com/a/ACg8ocIFZKIPW-5B2L0FtSPpzD2JsxCAAWO4eNiF9Eiuo5d_Pj0WzNRK=s96-c',
      rol: 'cliente'
    };

    console.log('📤 Enviando petición:', requestData);

    const response = await axios.post('http://localhost:5176/api/auth/google-login', requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Respuesta exitosa:', response.data);

  } catch (error) {
    console.error('❌ Error capturado:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
  }
}

testGoogleLoginError();