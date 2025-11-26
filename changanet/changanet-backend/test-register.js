const fetch = require('node-fetch');

async function testRegister() {
  try {
    const response = await fetch('http://localhost:3006/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123!',
        rol: 'cliente'
      })
    });

    console.log('Status:', response.status);
    console.log('OK:', response.ok);

    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testRegister();