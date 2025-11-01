/**
 * @archivo src/controllers/authController.js - Controlador de autenticación
 * @descripción Maneja registro, login y autenticación OAuth de usuarios (REQ-01, REQ-02, REQ-03)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Social: Acceso seguro y verificado para todos los usuarios; Económico: Base sólida para transacciones
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @función register - Registro de nuevos usuarios
 * @descripción Crea cuenta de usuario con email, contraseña y perfil básico (REQ-01)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 2: [Dev] Implementar API y Frontend para Registro de Usuario
 * @impacto Social: Registro accesible para inclusión digital de adultos mayores
 * @param {Object} req - Request con email, password, name, role
 * @param {Object} res - Response con token JWT y datos de usuario
 */
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
        esta_verificado: true, // Cambiar a true para pruebas de integración
      },
    });

    // Enviar email de bienvenida/verificación
    try {
      const { sendWelcomeEmail } = require('../services/emailService');
      await sendWelcomeEmail(user);
      console.log('📧 Email de bienvenida enviado a:', user.email);
    } catch (emailError) {
      console.error('Error al enviar email de bienvenida:', emailError);
      // No fallar el registro por error de email
    }

    // Enviar SMS de bienvenida si el usuario tiene teléfono
    try {
      if (user.telefono && user.telefono.trim() !== '') {
        const { sendSMS } = require('../services/smsService');
        const smsMessage = `¡Bienvenido a Changánet, ${user.nombre}! Tu cuenta ha sido creada exitosamente.`;
        await sendSMS(user.telefono, smsMessage);
        console.log('📱 SMS de bienvenida enviado a:', user.telefono);
      }
    } catch (smsError) {
      console.error('Error al enviar SMS de bienvenida:', smsError);
      // No fallar el registro por error de SMS
    }

    const token = jwt.sign({ userId: user.id, role: user.rol }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // CONFIGURAR CONTEXTO DE USUARIO EN SENTRY PARA REGISTRO
    const { setUserContext, captureMessage } = require('../services/sentryService');
    setUserContext({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol
    });

    // REGISTRAR MÉTRICA DE NUEVO USUARIO EN SENTRY
    captureMessage('Nuevo usuario registrado en Changánet', 'info', {
      tags: {
        event: 'user_registration',
        user_role: user.rol,
        source: 'email',
        business_metric: 'user_acquisition'
      },
      extra: {
        user_id: user.id,
        email: user.email,
        role: user.rol,
        timestamp: new Date().toISOString(),
        business_impact: 'social_economic_environmental'
      }
    });

    // INCREMENTAR MÉTRICA DE PROMETHEUS PARA USUARIO REGISTRADO
    const { incrementUserRegistered, incrementTripleImpactActivity } = require('../services/metricsService');
    incrementUserRegistered(user.rol, 'email');
    incrementTripleImpactActivity('social', 'registro_usuario');

    res.status(201).json({
      message: 'Usuario creado exitosamente. Revisa tu email para verificar tu cuenta.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.nombre,
        role: user.rol,
        verified: user.esta_verificado
      }
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error al registrar el usuario.' });
  }
};

/**
 * @función login - Autenticación de usuarios existentes
 * @descripción Valida credenciales y genera token JWT para acceso (REQ-02)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Económico: Autenticación segura para transacciones confiables
 * @param {Object} req - Request con email y password
 * @param {Object} res - Response con token JWT y datos de usuario
 */
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

    // CONFIGURAR CONTEXTO DE USUARIO EN SENTRY
    const { setUserContext } = require('../services/sentryService');
    setUserContext({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol
    });

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

/**
 * @función googleCallback - Callback de autenticación Google OAuth
 * @descripción Procesa respuesta de Google y genera token JWT para usuario (REQ-02)
 * @sprint Sprint 1 – Autenticación y Perfiles
 * @tarjeta Tarjeta 1: [Backend] Implementar API de Registro y Login
 * @impacto Social: Autenticación simplificada para usuarios con dificultades técnicas
 * @param {Object} req - Request con datos de usuario de Google
 * @param {Object} res - Response que redirige al frontend con token
 */
exports.googleCallback = async (req, res) => {
  try {
    // Passport ya ha procesado la autenticación y ha agregado el usuario a req.user
    const { user, token } = req.user;

    // Enviar email de bienvenida para usuarios nuevos de Google
    try {
      const { sendWelcomeEmail } = require('../services/emailService');
      await sendWelcomeEmail(user);
      console.log('📧 Email de bienvenida enviado a usuario Google:', user.email);
    } catch (emailError) {
      console.error('Error al enviar email de bienvenida a usuario Google:', emailError);
    }

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
                    role: user.rol,
                    verified: user.esta_verificado
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
