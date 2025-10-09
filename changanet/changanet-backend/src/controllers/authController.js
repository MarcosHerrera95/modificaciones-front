const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.register = async (req, res) => {
  const { email, password, name, role } = req.body;

  try {
    const existingUser = await prisma.usuarios.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este email ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.usuarios.create({
      data: {
        email,
        hash_contrasena: hashedPassword,
        nombre: name,
        rol: role,
        esta_verificado: true, // Para MVP, auto-verificar
      },
    });

    const token = jwt.sign({ userId: user.id, role: user.rol }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'Usuario creado. Revisa tu email para verificar tu cuenta.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el usuario.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.usuarios.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.hash_contrasena))) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (!user.esta_verificado) {
      return res.status(403).json({ error: 'Debes verificar tu email antes de iniciar sesión.' });
    }

    const token = jwt.sign({ userId: user.id, role: user.rol }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(200).json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.nombre, 
        role: user.rol 
      } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
};

// Controlador para manejar el callback de Google OAuth
exports.googleCallback = async (req, res) => {
  try {
    // Passport ya ha procesado la autenticación y ha agregado el usuario a req.user
    const { user, token } = req.user;

    // Para el flujo de popup, devolver HTML que comunica con la ventana padre
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Autenticación Completa</title>
        </head>
        <body>
          <script>
            // Enviar mensaje a la ventana padre con los datos de autenticación
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_SUCCESS',
                payload: {
                  token: '${token}',
                  user: ${JSON.stringify({
                    id: user.id,
                    email: user.email,
                    name: user.nombre,
                    role: user.rol
                  })}
                }
              }, window.location.origin);
            }

            // Cerrar la ventana popup
            window.close();
          </script>
        </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error en callback de Google:', error);

    // Enviar mensaje de error
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_ERROR',
                error: 'Error al procesar la autenticación con Google'
              }, window.location.origin);
            }
            window.close();
          </script>
        </body>
      </html>
    `;

    res.status(500).send(errorHtml);
  }
};
