/**
 * Servicio de políticas de contraseñas mejoradas
 * Implementa validaciones estrictas y configuraciones avanzadas de seguridad
 * @version 2.0.0
 * @date 2025-11-25
 */

const crypto = require('crypto');
const logger = require('./logger');

class EnhancedPasswordPolicy {
  constructor() {
    // Configuración de políticas de contraseña
    this.policies = {
      basic: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxRepeatChars: 3,
        forbidCommonPasswords: true,
        forbidSequentialChars: true,
        minUniqueChars: 5
      },
      strong: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxRepeatChars: 2,
        forbidCommonPasswords: true,
        forbidSequentialChars: true,
        minUniqueChars: 8,
        requireMixedCase: true,
        forbidDictionaryWords: true,
        maxSimilarity: 0.8
      },
      enterprise: {
        minLength: 16,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxRepeatChars: 2,
        forbidCommonPasswords: true,
        forbidSequentialChars: true,
        minUniqueChars: 10,
        requireMixedCase: true,
        forbidDictionaryWords: true,
        maxSimilarity: 0.7,
        requireNonAlphabetic: true,
        historyCheck: 5, // Verificar últimas 5 contraseñas
        expirationDays: 90
      }
    };

    // Base de datos de contraseñas comunes y comprometidas
    this.commonPasswords = [
      // Contraseñas muy comunes
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master',
      'sunshine', 'flower', 'iloveyou', 'princess', 'football',
      
      // Variaciones con números y símbolos
      'password1', 'password123', 'admin123', 'welcome123',
      'qwerty123', 'abc123456', 'password!', 'admin!', 'root123',
      
      // Nombres comunes
      'michael', 'jennifer', 'jessica', 'joshua', 'ashley',
      'daniel', 'matthew', 'andrew', 'joseph', 'david',
      
      // Fechas comunes
      'password2023', 'password2024', 'welcome2024',
      
      // Patrones predecibles
      'aaaaaa', 'bbbbbb', 'cccccc', '111111', '222222',
      '123123', 'abcabc', 'passwordpassword'
    ];

    // Lista de palabras que no deben estar en la contraseña
    this.forbiddenWords = [
      'changanet', 'changá', 'changÁ', 'servicio', 'profesional',
      'cliente', 'contraseña', 'password', 'admin', 'user',
      'email', 'telefono', 'direccion'
    ];

    // Diccionario básico de palabras comunes en español/inglés
    this.commonWords = [
      'amor', 'vida', 'familia', 'casa', 'trabajo', 'dinero', 'tiempo',
      'amor', 'paz', 'feliz', 'bebe', 'mama', 'papa', 'hijo', 'hija',
      'water', 'fire', 'earth', 'air', 'love', 'life', 'family',
      'home', 'work', 'money', 'time', 'peace', 'happy'
    ];
  }

  /**
   * Valida una contraseña contra las políticas especificadas
   * @param {string} password - Contraseña a validar
   * @param {Object} userContext - Contexto del usuario (nombre, email, etc.)
   * @param {string} policyLevel - Nivel de política ('basic', 'strong', 'enterprise')
   * @returns {Object} Resultado de la validación con score y feedback
   */
  validatePassword(password, userContext = {}, policyLevel = 'strong') {
    const policy = this.policies[policyLevel] || this.policies.strong;
    const feedback = {
      isValid: false,
      score: 0,
      level: policyLevel,
      warnings: [],
      suggestions: [],
      errors: [],
      requirements: [],
      timeToBreak: null,
      entropy: 0
    };

    if (!password) {
      feedback.errors.push('La contraseña es requerida');
      return feedback;
    }

    // Calcular entropía de la contraseña
    feedback.entropy = this.calculateEntropy(password);

    // Validaciones básicas
    this.validateBasicRequirements(password, policy, feedback);

    // Validaciones avanzadas
    this.validateAdvancedRequirements(password, userContext, policy, feedback);

    // Validaciones de seguridad
    this.validateSecurityRequirements(password, policy, feedback);

    // Verificar historial de contraseñas (para enterprise)
    if (policyLevel === 'enterprise' && userContext.passwordHistory) {
      this.validatePasswordHistory(password, userContext.passwordHistory, feedback);
    }

    // Calcular score final
    feedback.score = this.calculatePasswordScore(password, policy, feedback);

    // Estimar tiempo para romper la contraseña
    feedback.timeToBreak = this.estimateTimeToBreak(password, feedback.score);

    // Determinar si es válida
    feedback.isValid = feedback.errors.length === 0 && feedback.score >= this.getMinimumScore(policyLevel);

    // Agregar sugerencias de mejora
    if (!feedback.isValid) {
      feedback.suggestions = this.generateImprovementSuggestions(password, policy, feedback);
    }

    // Log de validación para auditoría
    this.logPasswordValidation(password, feedback, userContext, policyLevel);

    return feedback;
  }

  /**
   * Valida requerimientos básicos
   */
  validateBasicRequirements(password, policy, feedback) {
    // Longitud mínima
    if (password.length < policy.minLength) {
      feedback.errors.push(`La contraseña debe tener al menos ${policy.minLength} caracteres`);
      feedback.requirements.push(`Longitud mínima: ${policy.minLength}`);
    } else {
      feedback.requirements.push(`Longitud mínima: ✅ ${policy.minLength}`);
    }

    // Mayúsculas
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      feedback.errors.push('La contraseña debe contener al menos una letra mayúscula');
      feedback.requirements.push('Mayúsculas: ❌');
    } else {
      feedback.requirements.push('Mayúsculas: ✅');
    }

    // Minúsculas
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      feedback.errors.push('La contraseña debe contener al menos una letra minúscula');
      feedback.requirements.push('Minúsculas: ❌');
    } else {
      feedback.requirements.push('Minúsculas: ✅');
    }

    // Números
    if (policy.requireNumbers && !/\d/.test(password)) {
      feedback.errors.push('La contraseña debe contener al menos un número');
      feedback.requirements.push('Números: ❌');
    } else {
      feedback.requirements.push('Números: ✅');
    }

    // Caracteres especiales
    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.errors.push('La contraseña debe contener al menos un carácter especial');
      feedback.requirements.push('Caracteres especiales: ❌');
    } else {
      feedback.requirements.push('Caracteres especiales: ✅');
    }
  }

  /**
   * Valida requerimientos avanzados
   */
  validateAdvancedRequirements(password, userContext, policy, feedback) {
    // Caracteres únicos
    const uniqueChars = new Set(password.toLowerCase()).size;
    if (uniqueChars < policy.minUniqueChars) {
      feedback.warnings.push(`La contraseña debe usar al menos ${policy.minUniqueChars} caracteres únicos (actuales: ${uniqueChars})`);
    }

    // Caracteres repetidos
    const maxRepeat = this.getMaxConsecutiveRepeats(password);
    if (maxRepeat > policy.maxRepeatChars) {
      feedback.warnings.push(`La contraseña no debe tener más de ${policy.maxRepeatChars} caracteres repetidos consecutivamente`);
    }

    // Secuencias de teclado
    if (policy.forbidSequentialChars && this.hasSequentialChars(password)) {
      feedback.warnings.push('La contraseña no debe contener secuencias de teclado (ej: abc, 123, qwerty)');
    }

    // Contraseñas comunes
    if (policy.forbidCommonPasswords && this.isCommonPassword(password)) {
      feedback.errors.push('Esta contraseña es muy común y fácilmente adivinable');
    }

    // Verificar información personal
    if (userContext.name && this.containsPersonalInfo(password, userContext.name)) {
      feedback.warnings.push('La contraseña no debe contener información personal como tu nombre');
    }

    if (userContext.email && this.containsPersonalInfo(password, userContext.email.split('@')[0])) {
      feedback.warnings.push('La contraseña no debe contener tu nombre de usuario o email');
    }

    // Verificar palabras del diccionario
    if (policy.forbidDictionaryWords && this.containsDictionaryWords(password)) {
      feedback.warnings.push('La contraseña no debe contener palabras comunes del diccionario');
    }

    // Mezcla de mayúsculas y minúsculas
    if (policy.requireMixedCase && !this.hasMixedCase(password)) {
      feedback.warnings.push('La contraseña debe mezclar mayúsculas y minúsculas de manera no predecible');
    }

    // Caracteres no alfabéticos
    if (policy.requireNonAlphabetic && !this.hasNonAlphabetic(password)) {
      feedback.warnings.push('La contraseña debe incluir números o símbolos');
    }
  }

  /**
   * Valida requerimientos de seguridad específicos
   */
  validateSecurityRequirements(password, policy, feedback) {
    // Verificar patrones peligrosos
    const dangerousPatterns = [
      /(.)\1{4,}/, // 5+ caracteres repetidos
      /\d{4,}/,    // 4+ dígitos consecutivos
      /[a-zA-Z]{4,}/, // 4+ letras consecutivas
      /^[A-Z]/,   // Empieza con mayúscula
      /[a-z]$/    // Termina con minúscula
    ];

    dangerousPatterns.forEach((pattern, index) => {
      if (pattern.test(password)) {
        switch (index) {
          case 0:
            feedback.warnings.push('Evita usar el mismo carácter más de 4 veces seguidas');
            break;
          case 1:
            feedback.warnings.push('Evita secuencias largas de números');
            break;
          case 2:
            feedback.warnings.push('Evita secuencias largas de letras');
            break;
          case 3:
            feedback.warnings.push('No empieces la contraseña con mayúscula');
            break;
          case 4:
            feedback.warnings.push('No termines la contraseña con minúscula');
            break;
        }
      }
    });
  }

  /**
   * Valida historial de contraseñas (enterprise)
   */
  validatePasswordHistory(password, passwordHistory, feedback) {
    if (!passwordHistory || passwordHistory.length === 0) return;

    const enterprisePolicy = this.policies.enterprise;
    const recentPasswords = passwordHistory.slice(0, enterprisePolicy.historyCheck || 5);
    
    for (const historyPassword of recentPasswords) {
      const similarity = this.calculateSimilarity(password.toLowerCase(), historyPassword.toLowerCase());
      if (similarity > (enterprisePolicy.maxSimilarity || 0.8)) {
        feedback.errors.push('No puedes reutilizar contraseñas recientes');
        break;
      }
    }
  }

  /**
   * Calcula el score de la contraseña (0-100)
   */
  calculatePasswordScore(password, policy, feedback) {
    let score = 0;

    // Base por longitud
    const lengthScore = Math.min(password.length * 2, 30);
    score += lengthScore;

    // Variedad de caracteres
    let varietyScore = 0;
    if (/[a-z]/.test(password)) varietyScore += 10;
    if (/[A-Z]/.test(password)) varietyScore += 10;
    if (/\d/.test(password)) varietyScore += 10;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) varietyScore += 15;
    score += varietyScore;

    // Caracteres únicos
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars, 15);

    // Penalizaciones
    if (this.isCommonPassword(password)) score -= 50;
    if (this.hasSequentialChars(password)) score -= 15;
    if (this.getMaxConsecutiveRepeats(password) > 2) score -= 10;

    // Bonus por entropía alta
    if (feedback.entropy > 60) score += 15;
    else if (feedback.entropy > 40) score += 10;
    else if (feedback.entropy > 30) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calcula la entropía de la contraseña
   */
  calculateEntropy(password) {
    if (!password) return 0;

    const charSet = this.getCharacterSetSize(password);
    const entropy = Math.log2(Math.pow(charSet, password.length));
    
    return Math.round(entropy);
  }

  /**
   * Obtiene el tamaño del conjunto de caracteres
   */
  getCharacterSetSize(password) {
    let chars = 0;
    
    if (/[a-z]/.test(password)) chars += 26; // minúsculas
    if (/[A-Z]/.test(password)) chars += 26; // mayúsculas
    if (/[0-9]/.test(password)) chars += 10; // números
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) chars += 32; // especiales
    
    return chars || 1;
  }

  /**
   * Estima el tiempo para romper la contraseña
   */
  estimateTimeToBreak(password, score) {
    // Estimación básica basada en entropía y complejidad
    const entropy = this.calculateEntropy(password);
    
    // Suposiciones de velocidad de ataque (hash por segundo)
    const attackSpeeds = {
      online: 100,           // 100 intentos/segundo
      offline_fast: 1000000, // 1 millón de intentos/segundo
      offline_slow: 10000    // 10 mil intentos/segundo
    };

    const combinations = Math.pow(2, entropy); // Entropía en bits
    const results = {};

    Object.keys(attackSpeeds).forEach(type => {
      const seconds = combinations / attackSpeeds[type];
      results[type] = this.formatTime(seconds);
    });

    return results;
  }

  /**
   * Formatea el tiempo en unidades legibles
   */
  formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds)} segundos`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutos`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} horas`;
    if (seconds < 31536000) return `${Math.round(seconds / 86400)} días`;
    
    const years = seconds / 31536000;
    if (years < 1000) return `${Math.round(years)} años`;
    
    const millennia = years / 1000;
    if (millennia < 1000) return `${Math.round(millennia)} milenios`;
    
    return `${Math.round(millennia / 1000)} millones de años`;
  }

  /**
   * Genera sugerencias de mejora
   */
  generateImprovementSuggestions(password, policy, feedback) {
    const suggestions = [];

    if (password.length < policy.minLength) {
      suggestions.push(`Aumenta la longitud a al menos ${policy.minLength} caracteres`);
    }

    if (!/[A-Z]/.test(password)) {
      suggestions.push('Agrega letras mayúsculas en posiciones no predecibles');
    }

    if (!/[a-z]/.test(password)) {
      suggestions.push('Incluye letras minúsculas');
    }

    if (!/\d/.test(password)) {
      suggestions.push('Agrega números en lugares no obvios');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      suggestions.push('Incluye símbolos especiales');
    }

    const uniqueChars = new Set(password).size;
    if (uniqueChars < policy.minUniqueChars) {
      suggestions.push(`Usa más variedad de caracteres (actuales: ${uniqueChars}/${policy.minUniqueChars})`);
    }

    if (this.hasSequentialChars(password)) {
      suggestions.push('Evita secuencias como "123" o "abc"');
    }

    suggestions.push('Considera usar una passphrase larga con palabras aleatorias');
    suggestions.push('Usa un administrador de contraseñas para generar y guardar contraseñas únicas');

    return suggestions;
  }

  // Métodos auxiliares
  getMaxConsecutiveRepeats(password) {
    let maxRepeats = 1;
    let currentRepeats = 1;

    for (let i = 1; i < password.length; i++) {
      if (password[i] === password[i - 1]) {
        currentRepeats++;
        maxRepeats = Math.max(maxRepeats, currentRepeats);
      } else {
        currentRepeats = 1;
      }
    }

    return maxRepeats;
  }

  hasSequentialChars(password) {
    const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const lowerPassword = password.toLowerCase();

    return sequences.some(seq => {
      for (let i = 0; i <= seq.length - 3; i++) {
        const substring = seq.substring(i, i + 3);
        if (lowerPassword.includes(substring) || lowerPassword.includes(substring.split('').reverse().join(''))) {
          return true;
        }
      }
      return false;
    });
  }

  isCommonPassword(password) {
    const lowerPassword = password.toLowerCase();
    return this.commonPasswords.some(common => 
      lowerPassword === common || lowerPassword.includes(common)
    );
  }

  containsPersonalInfo(password, personalInfo) {
    if (!personalInfo) return false;
    
    const cleanInfo = personalInfo.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPassword = password.toLowerCase();
    
    return cleanPassword.includes(cleanInfo) || 
           cleanInfo.includes(cleanPassword.substring(0, 4));
  }

  containsDictionaryWords(password) {
    const lowerPassword = password.toLowerCase();
    
    // Verificar palabras prohibidas específicas
    if (this.forbiddenWords.some(word => lowerPassword.includes(word))) {
      return true;
    }
    
    // Verificar palabras comunes
    return this.commonWords.some(word => {
      if (word.length < 4) return false;
      return lowerPassword.includes(word) || word.includes(lowerPassword.substring(0, 4));
    });
  }

  hasMixedCase(password) {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    
    // Verificar que no esté en patrón predecible
    const isPredictable = /^[A-Z][a-z]+[0-9]+$/.test(password) || 
                         /^[a-z]+[A-Z][0-9]+$/.test(password);
    
    return hasUpper && hasLower && !isPredictable;
  }

  hasNonAlphabetic(password) {
    return /[^a-zA-Z]/.test(password);
  }

  calculateSimilarity(str1, str2) {
    // Coeficiente de Dice
    const bigrams1 = this.getBigrams(str1);
    const bigrams2 = this.getBigrams(str2);
    
    const intersection = bigrams1.filter(bigram => bigrams2.includes(bigram));
    return (2 * intersection.length) / (bigrams1.length + bigrams2.length);
  }

  getBigrams(str) {
    const bigrams = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  }

  getMinimumScore(policyLevel) {
    const minimums = {
      basic: 40,
      strong: 60,
      enterprise: 75
    };
    return minimums[policyLevel] || 60;
  }

  logPasswordValidation(password, feedback, userContext, policyLevel) {
    logger.info('Password validation performed', {
      policyLevel,
      score: feedback.score,
      isValid: feedback.isValid,
      entropy: feedback.entropy,
      errors: feedback.errors.length,
      warnings: feedback.warnings.length,
      requirements: feedback.requirements.filter(r => r.includes('❌')).length,
      userId: userContext.userId,
      email: userContext.email ? 'provided' : 'not_provided',
      hasName: !!userContext.name
    });
  }

  /**
   * Obtiene configuración de política para el frontend
   */
  getFrontendPolicy(policyLevel = 'strong') {
    const policy = this.policies[policyLevel] || this.policies.strong;
    
    return {
      enabled: true,
      level: policyLevel,
      requirements: {
        minLength: policy.minLength,
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireNumbers: policy.requireNumbers,
        requireSpecialChars: policy.requireSpecialChars,
        minUniqueChars: policy.minUniqueChars
      },
      messages: {
        minLength: `Mínimo ${policy.minLength} caracteres`,
        uppercase: 'Al menos una letra mayúscula',
        lowercase: 'Al menos una letra minúscula',
        numbers: 'Al menos un número',
        specialChars: 'Al menos un carácter especial',
        uniqueChars: `Al menos ${policy.minUniqueChars} caracteres únicos`
      }
    };
  }
}

module.exports = EnhancedPasswordPolicy;