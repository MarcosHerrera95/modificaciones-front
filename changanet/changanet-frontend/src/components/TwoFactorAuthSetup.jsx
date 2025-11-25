/**
 * TwoFactorAuthSetup - Componente para configurar 2FA
 * Maneja el flujo completo de activación de autenticación de dos factores
 * @version 1.0.0
 * @date 2025-11-25
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useApiState } from '../hooks/useApi';
import { api } from '../services/apiService';
import LoadingSpinner from './LoadingSpinner';

const TwoFactorAuthSetup = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const api = useApi();
  
  const [step, setStep] = useState(1); // 1: inicio, 2: configurar, 3: verificar, 4: completo
  const [secretData, setSecretData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');

  // Configurar reCAPTCHA v3
  useEffect(() => {
    if (window.grecaptcha && process.env.REACT_APP_RECAPTCHA_SITE_KEY) {
      window.grecaptcha.ready(() => {
        try {
          window.grecaptcha.execute(process.env.REACT_APP_RECAPTCHA_SITE_KEY, { action: '2fa_setup' })
            .then(setRecaptchaToken);
        } catch (err) {
          console.warn('Error configuring reCAPTCHA:', err);
        }
      });
    }
  }, []);

  const handleGenerateSecret = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/2fa/generate-secret', {
        recaptchaToken
      });

      if (response.success) {
        setSecretData(response.data);
        setStep(2);
      } else {
        setError(response.error || 'Error al generar secreto de autenticación');
      }
    } catch (error) {
      console.error('Error generating secret:', error);
      setError(error.message || 'Error al generar secreto de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndActivate = async () => {
    if (!verificationCode.trim()) {
      setError('Por favor ingresa el código de 6 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/2fa/activate', {
        token: verificationCode.trim(),
        tempData: secretData.tempData,
        recaptchaToken
      });

      if (response.success) {
        setBackupCodes(response.data.backupCodes || []);
        setShowBackupCodes(true);
        setStep(4);
        
        // Notificar éxito al componente padre
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(response.error || 'Código de verificación inválido');
      }
    } catch (error) {
      console.error('Error activating 2FA:', error);
      setError(error.message || 'Error al activar autenticación de dos factores');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Mostrar notificación de éxito
      alert('Copiado al portapapeles');
    }).catch(err => {
      console.error('Error copying to clipboard:', err);
    });
  };

  const renderStep1 = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Configurar Autenticación de Dos Factores
        </h3>
        <p className="text-gray-600 mb-4">
          La autenticación de dos factores añade una capa extra de seguridad a tu cuenta.
          Necesitarás una aplicación como Google Authenticator o Authy.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-blue-900 mb-2">¿Qué necesitas?</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Una aplicación de autenticación (Google Authenticator, Authy, etc.)</li>
            <li>• Tu teléfono móvil</li>
            <li>• Acceso a la cámara para escanear el código QR</li>
          </ul>
        </div>
      </div>

      <button
        onClick={handleGenerateSecret}
        disabled={loading || !recaptchaToken}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {loading ? 'Generando...' : 'Comenzar Configuración'}
      </button>
      
      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Configura tu Aplicación de Autenticación
        </h3>
        <p className="text-gray-600">
          Escanea este código QR con tu aplicación de autenticación:
        </p>
      </div>

      {secretData?.qrCodeImage && (
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <img 
              src={secretData.qrCodeImage} 
              alt="Código QR para configurar 2FA" 
              className="w-48 h-48 mx-auto"
            />
          </div>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Secreto (alternativa al QR):
          </label>
          <button
            onClick={() => handleCopyToClipboard(secretData?.secret || '')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Copiar
          </button>
        </div>
        <div className="bg-white p-3 rounded border font-mono text-sm break-all">
          {secretData?.secret}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Instrucciones:</h4>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>Abre tu aplicación de autenticación (Google Authenticator, Authy, etc.)</li>
          <li>Toca el botón "+" o "Agregar cuenta"</li>
          <li>Escanea el código QR o ingresa el secreto manualmente</li>
          <li>Tu aplicación mostrará un código de 6 dígitos</li>
        </ol>
      </div>

      <div className="border-t pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ingresa el código de 6 dígitos:
        </label>
        <input
          type="text"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono tracking-wider"
          maxLength={6}
        />
      </div>

      <div className="flex space-x-3">
        <button
          onClick={() => setStep(1)}
          className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium"
        >
          Volver
        </button>
        <button
          onClick={handleVerifyAndActivate}
          disabled={loading || verificationCode.length !== 6}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Verificando...' : 'Verificar y Activar'}
        </button>
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-green-900 mb-2">
          ¡Autenticación de Dos Factores Activada!
        </h3>
        <p className="text-green-700">
          Tu cuenta ahora está protegida con autenticación de dos factores.
        </p>
      </div>

      {backupCodes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Códigos de Respaldo
          </h4>
          <p className="text-yellow-800 text-sm mb-3">
            Guarda estos códigos en un lugar seguro. Úsalos si pierdes acceso a tu dispositivo:
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((code, index) => (
              <div key={index} className="bg-white p-2 rounded border">
                {code}
              </div>
            ))}
          </div>
          <button
            onClick={() => handleCopyToClipboard(backupCodes.join('\n'))}
            className="mt-3 text-yellow-700 hover:text-yellow-800 text-sm font-medium"
          >
            Copiar todos los códigos
          </button>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
      >
        Finalizar
      </button>
    </div>
  );

  if (loading && step === 1) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Configurar 2FA
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Indicador de progreso */}
        <div className="mt-4 flex items-center">
          {[1, 2, 3, 4].map((stepNumber) => (
            <React.Fragment key={stepNumber}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step >= stepNumber 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {stepNumber}
              </div>
              {stepNumber < 4 && (
                <div className={`flex-1 h-1 mx-2 ${
                  step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="min-h-[400px]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
};

export default TwoFactorAuthSetup;