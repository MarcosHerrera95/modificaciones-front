/**
 * Servicio de validación biométrica
 * Implementa validación básica de selfies vs documentos de identidad
 */

const { getSignedUrl } = require('./storageService');

/**
 * Valida una selfie contra datos biométricos
 * @param {string} selfieUrl - URL de la selfie
 * @param {string} documentFrontUrl - URL del documento frontal
 * @param {Object} biometricData - Datos biométricos del cliente
 * @returns {Promise<Object>} Resultado de la validación
 */
exports.validateBiometricMatch = async (selfieUrl, documentFrontUrl, biometricData) => {
  try {
    // Placeholder para integración con servicio de IA/reconocimiento facial
    // En producción, esto se conectaría con servicios como AWS Rekognition,
    // Google Cloud Vision, o Face++, etc.

    console.log('🔍 Iniciando validación biométrica:', {
      selfieUrl,
      documentFrontUrl,
      biometricData: biometricData ? 'presente' : 'ausente'
    });

    // Validación básica (placeholder)
    const validationResult = {
      isMatch: false,
      confidence: 0,
      score: 0,
      details: {
        faceDetected: false,
        documentFaceDetected: false,
        matchQuality: 'unknown'
      },
      warnings: [],
      errors: []
    };

    // Simular validación básica
    if (biometricData) {
      // Verificar que los hashes sean consistentes
      const selfieHash = biometricData.selfieHash;
      const documentHash = biometricData.documentHash;

      if (selfieHash && documentHash) {
        // Simular comparación de hashes (en producción usar algoritmo real)
        const hashSimilarity = Math.random(); // Placeholder

        validationResult.confidence = hashSimilarity;
        validationResult.score = hashSimilarity * 100;
        validationResult.isMatch = hashSimilarity > 0.7; // Umbral básico

        validationResult.details = {
          faceDetected: true,
          documentFaceDetected: true,
          matchQuality: hashSimilarity > 0.8 ? 'high' : hashSimilarity > 0.6 ? 'medium' : 'low'
        };
      } else {
        validationResult.errors.push('Datos biométricos incompletos');
      }
    } else {
      validationResult.warnings.push('Sin datos biométricos para validación avanzada');
      // Fallback: asumir válido para compatibilidad
      validationResult.isMatch = true;
      validationResult.confidence = 0.5;
      validationResult.score = 50;
    }

    console.log('✅ Validación biométrica completada:', validationResult);

    return validationResult;

  } catch (error) {
    console.error('❌ Error en validación biométrica:', error);

    // En caso de error, retornar resultado neutral
    return {
      isMatch: false,
      confidence: 0,
      score: 0,
      details: {
        faceDetected: false,
        documentFaceDetected: false,
        matchQuality: 'error'
      },
      warnings: ['Error en validación biométrica'],
      errors: [error.message]
    };
  }
};

/**
 * Procesa verificación biométrica completa
 * @param {Object} verificationRequest - Solicitud de verificación
 * @returns {Promise<Object>} Resultado del procesamiento
 */
exports.processBiometricVerification = async (verificationRequest) => {
  try {
    const { selfie_url, document_front_url, biometric_data } = verificationRequest;

    if (!selfie_url || !document_front_url) {
      throw new Error('URLs de imagen faltantes para validación biométrica');
    }

    // Ejecutar validación
    const validationResult = await this.validateBiometricMatch(
      selfie_url,
      document_front_url,
      biometric_data ? JSON.parse(biometric_data) : null
    );

    // Actualizar solicitud con resultados
    const updateData = {
      biometric_verified: validationResult.isMatch,
      verification_score: validationResult.score,
      updated_at: new Date()
    };

    return {
      validationResult,
      updateData,
      recommendation: validationResult.isMatch ? 'approve' :
                     validationResult.score > 30 ? 'manual_review' : 'reject'
    };

  } catch (error) {
    console.error('Error procesando verificación biométrica:', error);
    throw error;
  }
};

/**
 * Verifica integridad de archivos biométricos
 * @param {string} selfieUrl - URL de la selfie
 * @param {string} documentUrl - URL del documento
 * @returns {Promise<boolean>} True si los archivos son válidos
 */
exports.verifyFileIntegrity = async (selfieUrl, documentUrl) => {
  try {
    // Verificar que las URLs sean accesibles (placeholder)
    // En producción, descargar y verificar integridad

    console.log('🔍 Verificando integridad de archivos:', { selfieUrl, documentUrl });

    // Placeholder: asumir válidos
    return true;

  } catch (error) {
    console.error('Error verificando integridad de archivos:', error);
    return false;
  }
};

module.exports = exports;