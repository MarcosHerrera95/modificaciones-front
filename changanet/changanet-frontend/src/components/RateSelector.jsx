import React, { useState, useEffect } from 'react';
import { professionalProfileAPI } from '../services/professionalProfileAPIService';

/**
 * RateSelector
 * Componente para seleccionar tipo de tarifa y valores
 * 
 * Implementa REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 * 
 * Características:
 * - Tres tipos de tarifa: hora, servicio, convenio
 * - Validación de rangos por categoría
 * - Sugerencias de tarifas
 * - Calculadora de precios
 * - Formato de moneda Argentina
 */

const RateSelector = ({
  selectedRates,
  onRatesChange,
  isLoading = false,
  experienceYears = 0,
  primarySpecialty = ''
}) => {
  const [rateRanges, setRateRanges] = useState({});
  const [suggestedRates, setSuggestedRates] = useState([]);
  const [errors, setErrors] = useState({});
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    loadRateData();
  }, []);

  useEffect(() => {
    if (experienceYears > 0 && primarySpecialty) {
      loadSuggestedRates();
    }
  }, [experienceYears, primarySpecialty]);

  const loadRateData = async () => {
    try {
      const ranges = await professionalProfileAPI.getRateRanges();
      setRateRanges(ranges);
    } catch (error) {
      console.error('Error loading rate data:', error);
    }
  };

  const loadSuggestedRates = async () => {
    try {
      const suggestions = await professionalProfileAPI.getSuggestedRates(
        experienceYears,
        primarySpecialty
      );
      setSuggestedRates(suggestions);
    } catch (error) {
      console.error('Error loading suggested rates:', error);
    }
  };

  const updateRateType = (type) => {
    const updatedRates = {
      ...selectedRates,
      tipo_tarifa: type
    };
    
    // Limpiar errores al cambiar tipo
    setErrors({});
    onRatesChange(updatedRates);
  };

  const updateRateValue = (field, value) => {
    const updatedRates = {
      ...selectedRates,
      [field]: value === '' ? null : parseFloat(value)
    };

    // Validar en tiempo real
    const newErrors = { ...errors };
    if (field === 'tarifa_hora' && value) {
      const minRate = getMinRate();
      const maxRate = getMaxRate();
      const rate = parseFloat(value);
      
      if (rate < minRate) {
        newErrors[field] = `La tarifa debe ser al menos $${minRate.toLocaleString()}`;
      } else if (rate > maxRate) {
        newErrors[field] = `La tarifa no puede exceder $${maxRate.toLocaleString()}`;
      } else {
        delete newErrors[field];
      }
    }

    setErrors(newErrors);
    onRatesChange(updatedRates);
  };

  const updateConvenioText = (text) => {
    const updatedRates = {
      ...selectedRates,
      tarifa_convenio: text
    };
    setErrors({ ...errors, tarifa_convenio: text.length > 200 ? 'Máximo 200 caracteres' : '' });
    onRatesChange(updatedRates);
  };

  const getMinRate = () => {
    if (!primarySpecialty) return 1000;
    const range = rateRanges[primarySpecialty];
    return range?.min || 1000;
  };

  const getMaxRate = () => {
    if (!primarySpecialty) return 50000;
    const range = rateRanges[primarySpecialty];
    return range?.max || 50000;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const RateTypeButton = ({ type, icon, label, description }) => (
    <button
      type="button"
      onClick={() => updateRateType(type)}
      disabled={isLoading}
      className={`
        flex-1 p-4 rounded-xl border-2 transition-all duration-300 text-left
        ${selectedRates.tipo_tarifa === type
          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
          : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-center mb-2">
        <span className="text-2xl mr-3">{icon}</span>
        <span className="font-semibold">{label}</span>
      </div>
      <p className="text-sm opacity-75">{description}</p>
    </button>
  );

  const RateInput = ({ 
    label, 
    value, 
    onChange, 
    placeholder, 
    error, 
    icon,
    min = 0,
    step = "100"
  }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {icon && <span className="mr-2">{icon}</span>}
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          step={step}
          className={`
            w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
            ${error ? 'border-red-300 bg-red-50' : 'border-gray-200'}
          `}
          disabled={isLoading}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-gray-500 text-sm">ARS</span>
        </div>
      </div>
      {error && (
        <p className="text-red-600 text-sm mt-1">{error}</p>
      )}
      {value && !error && (
        <p className="text-emerald-600 text-sm mt-1">
          {formatCurrency(parseFloat(value))}
        </p>
      )}
    </div>
  );

  const SuggestedRatesCard = () => {
    if (suggestedRates.length === 0) return null;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h4 className="text-sm font-medium text-blue-800 mb-3">
          💡 Tarifas Sugeridas para {primarySpecialty}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {suggestedRates.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => updateRateValue('tarifa_hora', suggestion.rate)}
              className="text-left p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-400 transition-colors"
            >
              <div className="text-sm font-medium text-gray-800">
                {suggestion.type}
              </div>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(suggestion.rate)}
              </div>
              <div className="text-xs text-gray-600">
                {suggestion.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const CalculatorModal = () => {
    const [hours, setHours] = useState(1);
    const [serviceValue, setServiceValue] = useState(selectedRates.tarifa_hora || 0);

    const calculatePrice = () => {
      const total = hours * serviceValue;
      return formatCurrency(total);
    };

    if (!showCalculator) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Calculadora de Precios</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Horas de trabajo
              </label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
                min="0.5"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa por hora
              </label>
              <input
                type="number"
                value={serviceValue}
                onChange={(e) => setServiceValue(parseFloat(e.target.value) || 0)}
                min="0"
                step="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div className="bg-emerald-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Precio Total</div>
              <div className="text-2xl font-bold text-emerald-600">
                {calculatePrice()}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowCalculator(false)}
              className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => {
                updateRateValue('tarifa_hora', serviceValue);
                setShowCalculator(false);
              }}
              className="flex-1 bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600"
            >
              Aplicar Tarifa
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">💰 Tarifas</h2>
        <p className="text-gray-600">Define cómo cobras tus servicios</p>
      </div>

      {/* Tarjetas de tipos de tarifa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <RateTypeButton
          type="hora"
          icon="⏱️"
          label="Por Hora"
          description="Cobras por cada hora de trabajo"
        />
        <RateTypeButton
          type="servicio"
          icon="🔧"
          label="Por Servicio"
          description="Precio fijo por tipo de trabajo"
        />
        <RateTypeButton
          type="convenio"
          icon="🤝"
          label="A Convenir"
          description="Precio según el proyecto"
        />
      </div>

      {/* Tarifas sugeridas */}
      <SuggestedRatesCard />

      {/* Formulario de tarifas */}
      {selectedRates.tipo_tarifa === 'hora' && (
        <div className="space-y-4">
          <RateInput
            label="Tarifa por Hora"
            value={selectedRates.tarifa_hora}
            onChange={(value) => updateRateValue('tarifa_hora', value)}
            placeholder="Ej: 2500"
            error={errors.tarifa_hora}
            icon="⏱️"
            min={getMinRate()}
            step="100"
          />
          
          <div className="bg-gray-50 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Rango recomendado:</span>
              <span className="text-sm font-medium text-gray-800">
                {formatCurrency(getMinRate())} - {formatCurrency(getMaxRate())}
              </span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setShowCalculator(true)}
            className="w-full bg-blue-500 text-white py-2 rounded-xl hover:bg-blue-600 transition-colors"
          >
            🧮 Usar Calculadora
          </button>
        </div>
      )}

      {selectedRates.tipo_tarifa === 'servicio' && (
        <div className="space-y-4">
          <RateInput
            label="Tarifa por Servicio"
            value={selectedRates.tarifa_servicio}
            onChange={(value) => updateRateValue('tarifa_servicio', value)}
            placeholder="Ej: 5000"
            error={errors.tarifa_servicio}
            icon="🔧"
            min={getMinRate() * 2} // Los servicios suelen costar más que 1 hora
            step="100"
          />
          
          <div className="bg-gray-50 p-4 rounded-xl">
            <div className="text-sm text-gray-600 mb-2">
              💡 <strong>Consejo:</strong> Los servicios suelen costar entre 2-8 horas de trabajo.
            </div>
            <div className="text-sm text-gray-600">
              Rango estimado: {formatCurrency(getMinRate() * 2)} - {formatCurrency(getMaxRate() * 8)}
            </div>
          </div>
        </div>
      )}

      {selectedRates.tipo_tarifa === 'convenio' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📝 Descripción del Acuerdo
            </label>
            <textarea
              value={selectedRates.tarifa_convenio || ''}
              onChange={(e) => updateConvenioText(e.target.value)}
              placeholder="Ej: Precio a convenir según el proyecto. Incluye materiales y mano de obra..."
              rows="4"
              maxLength="200"
              className={`
                w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                ${errors.tarifa_convenio ? 'border-red-300 bg-red-50' : 'border-gray-200'}
              `}
              disabled={isLoading}
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>Describe cómo determinas tus precios</span>
              <span>{(selectedRates.tarifa_convenio || '').length}/200</span>
            </div>
            {errors.tarifa_convenio && (
              <p className="text-red-600 text-sm mt-1">{errors.tarifa_convenio}</p>
            )}
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Importante</h4>
            <p className="text-sm text-yellow-700">
              Los clientes prefieren tarifas claras. Considera especificar rangos o métodos de cálculo.
            </p>
          </div>
        </div>
      )}

      {/* Resumen de tarifas */}
      {selectedRates.tipo_tarifa && (
        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <h4 className="text-sm font-medium text-emerald-800 mb-2">📋 Resumen de Tarifas</h4>
          <div className="text-sm text-emerald-700">
            {selectedRates.tipo_tarifa === 'hora' && selectedRates.tarifa_hora && (
              <p>💰 Cobras {formatCurrency(selectedRates.tarifa_hora)} por hora</p>
            )}
            {selectedRates.tipo_tarifa === 'servicio' && selectedRates.tarifa_servicio && (
              <p>🔧 Precio fijo por servicio: {formatCurrency(selectedRates.tarifa_servicio)}</p>
            )}
            {selectedRates.tipo_tarifa === 'convenio' && (
              <p>🤝 Precio a convenir según el proyecto</p>
            )}
          </div>
        </div>
      )}

      <CalculatorModal />
    </div>
  );
};

export default RateSelector;