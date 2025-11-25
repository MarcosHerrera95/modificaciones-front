/**
 * PasswordStrengthMeter - Componente React para validación visual de fortaleza de contraseñas
 * Proporciona feedback en tiempo real con barra de progreso y sugerencias específicas
 * 
 * Características:
 * - Barra de progreso con código de colores
 * - Feedback en tiempo real
 * - Sugerencias contextuales
 * - Integración perfecta con formularios
 * - Validación avanzada basada en múltiples factores
 */

import React, { useState, useEffect } from 'react';

/**
 * Calcula la fortaleza de la contraseña con scoring avanzado
 * @param {string} password - Contraseña a evaluar
 * @returns {Object} Objeto con score, nivel, color y sugerencias
 */
function calculatePasswordStrength(password) {
  const feedback = {
    score: 0,
    level: 0, // 0-4 (Muy débil a Excelente)
    color: '#dc2626', // Rojo por defecto
    bgColor: '#fee2e2',
    borderColor: '#dc2626',
    label: 'Muy Débil',
    suggestions: [],
    warnings: []
  };

  if (!password) {
    return feedback;
  }

  let score = 0;
  const suggestions = [];
  const warnings = [];

  // Longitud (máximo 25 puntos)
  if (password.length >= 8) score += 5;
  if (password.length >= 10) score += 10;
  if (password.length >= 12) score += 10;

  // Variedad de caracteres (máximo 30 puntos)
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasSpaces = /\s/.test(password);

  if (hasLowerCase) score += 5;
  if (hasUpperCase) score += 5;
  if (hasNumbers) score += 5;
  if (hasSpecialChars) score += 15; // Los especiales valen más

  // Validaciones específicas
  if (hasSpaces) {
    warnings.push('La contraseña no debe contener espacios');
  }

  // Detectar contraseñas comunes
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'sunshine', 'flower', 'iloveyou',
    'football', 'baseball', 'starwars', 'trustno1', 'hello'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    warnings.push('Esta contraseña es muy común y fácilmente adivinable');
    return { ...feedback, score: 0, warnings };
  }

  // Verificar patrones peligrosos
  const patterns = [
    { pattern: /(.)\1{2,}/, warning: 'Evita caracteres repetidos consecutivamente' },
    { pattern: /\d{4,}/, warning: 'Evita secuencias numéricas largas' },
    { pattern: /[a-zA-Z]{4,}/, warning: 'Evita secuencias de letras largas' },
    { pattern: /^[A-Z]/, warning: 'No comenzar con mayúscula' },
    { pattern: /[a-z]$/, warning: 'No terminar con minúscula' },
    { pattern: /012|123|234|345|456|567|678|789/, warning: 'Evita secuencias numéricas consecutivas' },
    { pattern: /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/, warning: 'Evita secuencias alfabéticas consecutivas' }
  ];

  patterns.forEach(({ pattern, warning }) => {
    if (pattern.test(password)) {
      warnings.push(warning);
    }
  });

  // Complejidad adicional (máximo 45 puntos)
  if (password.length >= 12 && hasLowerCase && hasUpperCase && hasNumbers && hasSpecialChars) {
    score += 25; // Bonus por contraseña muy fuerte
  }

  // Penalización por patrones débiles
  if (password.length < 8) {
    warnings.push('La contraseña es muy corta');
  }

  // Determinar nivel basado en score
  let level;
  let color, bgColor, borderColor, label;

  if (score < 20) {
    level = 0;
    color = '#dc2626'; // Rojo
    bgColor = '#fee2e2';
    borderColor = '#dc2626';
    label = 'Muy Débil';
    suggestions.push('Usa una combinación de letras, números y símbolos');
    suggestions.push('Aumenta la longitud a al menos 8 caracteres');
  } else if (score < 40) {
    level = 1;
    color = '#ea580c'; // Naranja
    bgColor = '#fed7aa';
    borderColor = '#ea580c';
    label = 'Débil';
    suggestions.push('Agrega más variedad de caracteres');
    suggestions.push('Considera usar una passphrase más larga');
  } else if (score < 60) {
    level = 2;
    color = '#d97706'; // Amarillo
    bgColor = '#fef3c7';
    borderColor = '#d97706';
    label = 'Regular';
    if (!hasSpecialChars) {
      suggestions.push('Agrega símbolos especiales para mayor seguridad');
    }
    if (password.length < 12) {
      suggestions.push('Aumenta la longitud a 12+ caracteres');
    }
  } else if (score < 80) {
    level = 3;
    color = '#16a34a'; // Verde
    bgColor = '#dcfce7';
    borderColor = '#16a34a';
    label = 'Buena';
    suggestions.push('Tu contraseña es buena, pero podría ser mejor');
  } else {
    level = 4;
    color = '#15803d'; // Verde oscuro
    bgColor = '#bbf7d0';
    borderColor = '#15803d';
    label = 'Excelente';
    suggestions.push('¡Excelente! Tu contraseña es muy segura');
  }

  feedback.score = Math.min(score, 100);
  feedback.level = level;
  feedback.color = color;
  feedback.bgColor = bgColor;
  feedback.borderColor = borderColor;
  feedback.label = label;
  feedback.suggestions = suggestions;
  feedback.warnings = warnings;

  return feedback;
}

/**
 * Componente PasswordStrengthMeter
 * @param {Object} props - Propiedades del componente
 * @param {string} props.password - Contraseña a evaluar
 * @param {Function} props.onStrengthChange - Callback cuando cambia la fortaleza
 * @param {boolean} props.showSuggestions - Mostrar sugerencias
 * @param {boolean} props.showWarnings - Mostrar advertencias
 * @param {string} props.className - Clases CSS adicionales
 */
const PasswordStrengthMeter = ({
  password = '',
  onStrengthChange,
  showSuggestions = true,
  showWarnings = true,
  className = ''
}) => {
  const [strength, setStrength] = useState({
    score: 0,
    level: 0,
    color: '#dc2626',
    bgColor: '#fee2e2',
    borderColor: '#dc2626',
    label: 'Muy Débil',
    suggestions: [],
    warnings: []
  });

  // Recalcular fortaleza cuando cambia la contraseña
  useEffect(() => {
    const newStrength = calculatePasswordStrength(password);
    setStrength(newStrength);
    
    // Notificar al componente padre si hay callback
    if (onStrengthChange) {
      onStrengthChange(newStrength);
    }
  }, [password, onStrengthChange]);

  const percentage = Math.min((strength.score / 100) * 100, 100);

  return (
    <div className={`password-strength-meter ${className}`}>
      {/* Barra de progreso */}
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-300 ease-out rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: strength.color,
            boxShadow: `0 0 8px ${strength.color}40`
          }}
        />
      </div>

      {/* Etiqueta de nivel */}
      <div className="flex justify-between items-center mt-1">
        <span
          className="text-sm font-medium"
          style={{ color: strength.color }}
        >
          {strength.label}
        </span>
        <span className="text-xs text-gray-500">
          {strength.score}/100
        </span>
      </div>

      {/* Sugerencias */}
      {showSuggestions && strength.suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-700 mb-1">Sugerencias:</p>
          <ul className="text-xs text-gray-600 space-y-1">
            {strength.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-500 mr-1">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Advertencias */}
      {showWarnings && strength.warnings.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-red-700 mb-1">Advertencias:</p>
          <ul className="text-xs text-red-600 space-y-1">
            {strength.warnings.map((warning, index) => (
              <li key={index} className="flex items-start">
                <span className="text-red-500 mr-1">⚠</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Requisitos mínimos */}
      <div className="mt-3 p-2 bg-gray-50 rounded-md">
        <p className="text-xs font-medium text-gray-700 mb-2">Requisitos mínimos:</p>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className={`flex items-center ${password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
            <span className="mr-1">{password.length >= 8 ? '✓' : '○'}</span>
            8+ caracteres
          </div>
          <div className={`flex items-center ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
            <span className="mr-1">{/[A-Z]/.test(password) ? '✓' : '○'}</span>
            Mayúscula
          </div>
          <div className={`flex items-center ${/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
            <span className="mr-1">{/[a-z]/.test(password) ? '✓' : '○'}</span>
            Minúscula
          </div>
          <div className={`flex items-center ${/\d/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
            <span className="mr-1">{/[\d]/.test(password) ? '✓' : '○'}</span>
            Número
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;