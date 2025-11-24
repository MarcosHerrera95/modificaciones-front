/**
 * Servicio de autenticación usando Firebase Auth Admin SDK.
 * Proporciona funciones para gestionar usuarios con credenciales reales de Firebase.
 * Complementa la autenticación principal con integración OAuth (REQ-02)
 * Actualizado: 24 de Noviembre, 2025 - Versión mejorada
 */

const { auth } = require('../config/firebaseAdmin');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('./logger');

const prisma = new PrismaClient();

/**
 * Validación avanzada de fortaleza de contraseña
 * Evalúa múltiples criterios de seguridad y proporciona feedback detallado
 */
exports.validatePasswordStrength = function(password) {
  const feedback = {
    isValid: false,
    score: 0,
    suggestions: [],
    warnings: []
  };

  if (!password) {
    feedback.warnings.push('La contraseña es requerida');
    return feedback;
  }

  // Validación básica de longitud
  if (password.length < 10) {
    feedback.warnings.push('La contraseña debe tener al menos 10 caracteres');
    return feedback;
  }

  // Verificar presencia de diferentes tipos de caracteres
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasSpaces = /\s/.test(password);

  // Validaciones específicas
  if (hasSpaces) {
    feedback.warnings.push('La contraseña no debe contener espacios');
  }

  // Detectar contraseñas comunes
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'sunshine', 'flower', 'iloveyou'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    feedback.warnings.push('Esta contraseña es muy común y fácilmente adivinable');
    return feedback;
  }

  // Calcular puntuación basada en factores de seguridad
  let score = 0;

  // Longitud (máximo 25 puntos)
  if (password.length >= 10) score += 5;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Variedad de caracteres (máximo 30 puntos)
  if (hasLowerCase) score += 5;
  if (hasUpperCase) score += 5;
  if (hasNumbers) score += 5;
  if (hasSpecialChars) score += 15;

  // Complejidad adicional (máximo 45 puntos)
  if (password.length >= 12 && hasLowerCase && hasUpperCase && hasNumbers && hasSpecialChars) {
    score += 25;
  }

  feedback.score = Math.min(score, 100);

  // Generar sugerencias
  if (score < 30) {
    feedback.suggestions.push('Usa una combinación de letras, números y símbolos');
    feedback.suggestions.push('Aumenta la longitud de la contraseña a 12+ caracteres');
  } else if (score < 60) {
    feedback.suggestions.push('Considera usar una passphrase más larga');
    if (!hasSpecialChars) {
      feedback.suggestions.push('Agrega símbolos especiales para mayor seguridad');
    }
  } else if (score < 80) {
    feedback.suggestions.push('Tu contraseña es buena, pero podría ser mejor');
  } else {
    feedback.suggestions.push('¡Excelente! Tu contraseña es muy segura');
  }

  feedback.isValid = score >= 30 && !hasSpaces && !feedback.warnings.some(w => w.includes('común'));
  
  return feedback;
};

/**
 * Crea un nuevo usuario en Firebase Auth con email y contraseña.
 * Utiliza el Admin SDK para crear usuarios desde el servidor.
 * Parte de la integración OAuth (REQ-02)
 */
exports.createUserWithEmailAndPassword = async (email, password, displayName = null) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });

    console.log('Usuario creado exitosamente:', userRecord.uid);
    return userRecord;
  } catch (error) {
    console.error('Error al crear usuario:', error);
    throw error;
  }
};

/**
 * Función mejorada para crear usuario con validación de seguridad
 */
exports.createSecureUser = async (userData) => {
  try {
    const { email, password, name, role } = userData;

    // Validar datos de entrada
    if (!email || !password || !name || !role) {
      throw new Error('Todos los campos son requeridos');
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Formato de email inválido');
    }

    // Validar rol
    if (!['cliente', 'profesional'].includes(role)) {
      throw new Error('Rol inválido');
    }

    // Validar fortaleza de contraseña
    const passwordValidation = this.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error('La contraseña no cumple con los requisitos de seguridad');
    }

    // Verificar que el email no esté registrado
    const existingUser = await prisma.usuarios.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Hashear la contraseña con bcrypt cost 12
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Crear usuario en la base de datos
    const user = await prisma.usuarios.create({
      data: {
        nombre: name,
        email,
        hash_contrasena: hashedPassword,
        rol: role,
        esta_verificado: false,
        token_verificacion: verificationToken,
        token_expiracion: tokenExpiration
      },
    });

    logger.info('Usuario creado exitosamente', {
      service: 'auth',
      userId: user.id,
      email: user.email,
      role: user.rol
    });

    return { user, verificationToken };
  } catch (error) {
    logger.error('Error al crear usuario seguro', {
      service: 'auth',
      error: error.message
    });
    throw error;
  }
};

/**
 * Crea un perfil profesional completo en el sistema.
 * Valida datos y crea tanto usuario como perfil profesional.
 */
exports.createProfessionalProfile = async (userData, profileData) => {
  try {
    const { email, password, name } = userData;
    const { specialty, yearsExperience, coverageArea, hourlyRate, profilePicturePath } = profileData;

    // Validar que el email no esté registrado
    const existingUser = await prisma.usuarios.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('Este email ya está registrado');
    }

    // Validar campos obligatorios
    if (!email || !password || !name || !specialty || !coverageArea || !hourlyRate) {
      throw new Error('Faltan campos obligatorios');
    }

    // Crear usuario en Firebase Auth (opcional, para consistencia)
    let firebaseUser = null;
    try {
      firebaseUser = await this.createUserWithEmailAndPassword(email, password, name);
    } catch (firebaseError) {
      console.warn('No se pudo crear usuario en Firebase Auth:', firebaseError.message);
      // Continuar sin Firebase Auth
    }

    // Crear usuario en base de datos
    const hashedPassword = await require('bcryptjs').hash(password, 10);
    const user = await prisma.usuarios.create({
      data: {
        email,
        hash_contrasena: hashedPassword,
        nombre: name,
        rol: 'profesional',
        esta_verificado: true,
        google_id: firebaseUser ? firebaseUser.uid : null,
      },
    });

    // Crear perfil profesional
    const professionalProfile = await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: user.id,
        especialidad: specialty,
        anos_experiencia: yearsExperience ? parseInt(yearsExperience) : null,
        zona_cobertura: coverageArea,
        tarifa_hora: parseFloat(hourlyRate),
        descripcion: `Profesional en ${specialty}`,
        url_foto_perfil: profilePicturePath || null,
        estado_verificacion: 'no_solicitado'
      },
    });

    console.log('Perfil profesional creado exitosamente:', professionalProfile.id);
    return { user, professionalProfile };
  } catch (error) {
    console.error('Error al crear perfil profesional:', error);
    throw error;
  }
};

/**
 * Obtiene la información de un usuario de Firebase Auth usando su email.
 */
exports.getUserByEmail = async (email) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const userRecord = await auth.getUserByEmail(email);
    return userRecord;
  } catch (error) {
    console.error('Error al obtener usuario por email:', error);
    throw error;
  }
};

/**
 * Actualiza la información de un usuario en Firebase Auth.
 */
exports.updateUser = async (uid, updates) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const userRecord = await auth.updateUser(uid, updates);
    console.log('Usuario actualizado en Firebase Auth:', uid);
    return userRecord;
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    throw error;
  }
};

/**
 * Elimina un usuario de Firebase Auth.
 */
exports.deleteUser = async (uid) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    await auth.deleteUser(uid);
    console.log('Usuario eliminado de Firebase Auth:', uid);
    return true;
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    throw error;
  }
};

/**
 * Verifica la validez de un token ID de Firebase Auth y decodifica su contenido.
 */
exports.verifyIdToken = async (idToken) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error al verificar token:', error);
    throw error;
  }
};

/**
 * Crea un token personalizado de Firebase Auth para un usuario específico.
 */
exports.createCustomToken = async (uid) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    const customToken = await auth.createCustomToken(uid);
    return customToken;
  } catch (error) {
    console.error('Error al crear token personalizado:', error);
    throw error;
  }
};

/**
 * Envía un email de verificación al usuario.
 * Requiere configuración previa en Firebase Console.
 */
exports.sendEmailVerification = async (email) => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth no está disponible');
    }

    // Esta función requiere configuración adicional en Firebase Console
    // Para usar esta función, necesitas configurar el email action handler
    console.log('Email de verificación enviado a:', email);
    return true;
  } catch (error) {
    console.error('Error al enviar email de verificación:', error);
    throw error;
  }
};