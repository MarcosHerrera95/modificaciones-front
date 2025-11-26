const fetch = require('node-fetch');

async function testChatEndpoint() {
  try {
    // First, register a user to get a token
    console.log('Registering test user...');
    const registerResponse = await fetch('http://localhost:3005/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User Chat',
        email: 'testchat@example.com',
        password: 'TestPassword123!',
        rol: 'cliente'
      })
    });

    if (!registerResponse.ok) {
      console.log('Registration failed, trying to login...');
      // Try to login instead
      const loginResponse = await fetch('http://localhost:3006/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testchat@example.com',
          password: 'TestPassword123!'
        })
      });

      if (!loginResponse.ok) {
        console.error('Login failed too');
        return;
      }

      const loginData = await loginResponse.json();
      console.log('Login successful, token:', loginData.token ? 'YES' : 'NO');
      return;
    }

    const registerData = await registerResponse.json();
    console.log('Registration successful, token:', registerData.token ? 'YES' : 'NO');

    // Now test the chat endpoint
    console.log('Testing chat endpoint...');
    const chatResponse = await fetch('http://localhost:3005/api/chat/open-or-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${registerData.token}`
      },
      body: JSON.stringify({
        professionalId: 'some-professional-id'
      })
    });

    console.log('Chat endpoint status:', chatResponse.status);
    console.log('Chat endpoint ok:', chatResponse.ok);

    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('Chat response:', chatData);
    } else {
      const errorText = await chatResponse.text();
      console.log('Chat error:', errorText);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testChatEndpoint();