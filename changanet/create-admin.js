// Script para crear usuario administrador
const axios = require('axios');

async function createAdmin() {
  try {
    const response = await axios.post('http://localhost:3002/api/admin/create-admin-user', {
      nombre: 'Admin Test',
      email: 'admin@changanet.com',
      password: 'admin123456'
    });

    console.log('✅ Usuario administrador creado:', response.data);
  } catch (error) {
    console.error('❌ Error creando usuario admin:', error.response?.data || error.message);
  }
}

createAdmin();