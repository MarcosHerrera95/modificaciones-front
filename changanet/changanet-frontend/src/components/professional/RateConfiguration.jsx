import { useState } from 'react';
import { toast } from 'react-hot-toast';
import professionalProfileService from '../../services/professionalProfileService';

const RateConfiguration = ({ 
  rateTypes, 
  rateRanges, 
  rateData, 
  specialty, 
  experienceYears, 
  onChange, 
  errors = {} 
}) => {
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  /**
   * Obtiene sugerencias de tarifas
   */
  const getRateSuggestions = async () => {
    if (!specialty || !experienceYears) {
      toast.error('Selecciona una especialidad y años de experiencia para obtener sugerencias');
      return;
    }

    setLoadingSuggestions(true);
    try {
      const suggestionData = await professionalProfileService.getSuggestedRates(
        experienceYears, 
        specialty
      );
      setSuggestions(suggestionData);
    } catch (error) {
      console.error('Error getting rate suggestions:', error);
      toast.error('Error al obtener sugerencias de tarifas');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  /**
   * Aplica una sugerencia de tarifa
   */
  const applySuggestion = (suggestionType) => {
    if (!suggestions) return;

    switch (suggestionType) {
      case 'hourly':
        onChange({
          tipo_tarifa: 'hora',
          tarifa_hora: suggestions.suggested_rates.tarifa_hora,
          tarifa_servicio: 0,
          tarifa_convenio: ''
        });
        break;
      case 'service':
        onChange({
          tipo_tarifa: 'servicio',
          tarifa_hora: 0,
          tarifa_servicio: suggestions.suggested_rates.tarifa_servicio,
          tarifa_convenio: ''
        });
        break;
      case 'custom':
        onChange({
          tipo_tarifa: 'convenio',
          tarifa_hora: 0,
          tarifa_servicio: 0,
          tarifa_convenio: suggestions.suggested_rates.tarifa_convenio
        });
        break;
    }
    toast.success('Sugerencia aplicada');
  };

  /**
   * Maneja el cambio de tipo de tarifa
   */
  const handleRateTypeChange = (newType) => {
    onChange({
      ...rateData,
      tipo_tarifa: newType
    });
  };

  /**
   * Obtiene el rango recomendado para la especialidad
   */
  const getRecommendedRange = () => {
    if (!rateRanges || !specialty) return null;
    
    // Buscar la categoría que coincida con la especialidad
    const categories = Object.keys(rateRanges);
    for (const category of categories) {
      if (specialty.toLowerCase().includes(category.toLowerCase().split(' ')[0])) {
        return rateRanges[category];
      }
    }
    return rateRanges.default;
  };

  const recommendedRange = getRecommendedRange();

  /**
   * Valida si una tarifa está dentro del rango recomendado
   */
  const isRateInRange = (type, value) => {
    if (!recommendedRange || !value) return true;
    
    const min = recommendedRange.min;
    const max = recommendedRange.max * (type === 'servicio' ? 2 : 1.5);
    
    return value >= min && value <= max;
  };

  /**
   * Formatea el número como moneda
   */
  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Configuración de Tarifas</h2>
        <p className="text-gray-600">
          Define cómo cobras tus servicios. Los clientes verán esta información en tu perfil.
        </p>
      </div>

      {/* Tipos de tarifa */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Tipo de Tarifa</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rateTypes.map((type) => (
            <div
              key={type.value}
              className={`
                border-2 rounded-lg p-4 cursor-pointer transition-all duration-200
                ${rateData.tipo_tarifa === type.value 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-25'
                }
              `}
              onClick={() => handleRateTypeChange(type.value)}
            >
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">{type.icon}</span>
                <h4 className={`
                  font-semibold text-lg
                  ${rateData.tipo_tarifa === type.value ? 'text-emerald-800' : 'text-gray-900'}
                `}>
                  {type.label}
                </h4>
              </div>
              <p className={`
                text-sm
                ${rateData.tipo_tarifa === type.value ? 'text-emerald-600' : 'text-gray-600'}
              `}>
                {type.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Configuración específica por tipo */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Detalles de la Tarifa</h3>
        
        {rateData.tipo_tarifa === 'hora' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa por Hora (ARS)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={rateData.tarifa_hora || ''}
                  onChange={(e) => onChange({
                    ...rateData,
                    tarifa_hora: parseFloat(e.target.value) || 0
                  })}
                  placeholder="Ej: 2500"
                  min="0"
                  step="100"
                  className={`
                    w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                    ${errors.tarifa_hora || !isRateInRange('hora', rateData.tarifa_hora) 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-200'
                    }
                  `}
                />
                <div className="absolute right-3 top-3 text-gray-500">
                  {formatCurrency(rateData.tarifa_hora || 0)}
                </div>
              </div>
              {recommendedRange && (
                <p className="text-sm text-gray-600 mt-1">
                  Rango recomendado: {formatCurrency(recommendedRange.min)} - {formatCurrency(recommendedRange.max)}
                </p>
              )}
              {errors.tarifa_hora && (
                <p className="text-red-500 text-sm mt-1">{errors.tarifa_hora}</p>
              )}
            </div>
          </div>
        )}

        {rateData.tipo_tarifa === 'servicio' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa por Servicio (ARS)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={rateData.tarifa_servicio || ''}
                  onChange={(e) => onChange({
                    ...rateData,
                    tarifa_servicio: parseFloat(e.target.value) || 0
                  })}
                  placeholder="Ej: 5000"
                  min="0"
                  step="100"
                  className={`
                    w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                    ${errors.tarifa_servicio || !isRateInRange('servicio', rateData.tarifa_servicio) 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-200'
                    }
                  `}
                />
                <div className="absolute right-3 top-3 text-gray-500">
                  {formatCurrency(rateData.tarifa_servicio || 0)}
                </div>
              </div>
              {recommendedRange && (
                <p className="text-sm text-gray-600 mt-1">
                  Rango recomendado: {formatCurrency(recommendedRange.min)} - {formatCurrency(recommendedRange.max * 2)}
                </p>
              )}
              {errors.tarifa_servicio && (
                <p className="text-red-500 text-sm mt-1">{errors.tarifa_servicio}</p>
              )}
            </div>
          </div>
        )}

        {rateData.tipo_tarifa === 'convenio' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción "A Convenir"
              </label>
              <textarea
                value={rateData.tarifa_convenio || ''}
                onChange={(e) => onChange({
                  ...rateData,
                  tarifa_convenio: e.target.value
                })}
                placeholder="Ej: Consultar precio según proyecto específico. Incluye evaluación inicial gratuita."
                rows={4}
                className={`
                  w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                  ${errors.tarifa_convenio ? 'border-red-300 bg-red-50' : 'border-gray-200'}
                `}
              />
              <p className="text-sm text-gray-600 mt-1">
                Explica cómo determinas el precio para este tipo de servicios.
              </p>
              {errors.tarifa_convenio && (
                <p className="text-red-500 text-sm mt-1">{errors.tarifa_convenio}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sección avanzada */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <span>Configuración Avanzada</span>
          <svg 
            className={`w-5 h-5 ml-2 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Configura tarifas adicionales para diferentes tipos de servicios.
            </p>
            
            {/* Tarifa por hora (alternativa) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa por Hora (Alternativa) - ARS
              </label>
              <input
                type="number"
                value={rateData.tarifa_hora || ''}
                onChange={(e) => onChange({
                  ...rateData,
                  tarifa_hora: parseFloat(e.target.value) || 0
                })}
                placeholder="Precio alternativo por hora"
                min="0"
                step="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Tarifa por servicio (alternativa) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa por Servicio (Alternativa) - ARS
              </label>
              <input
                type="number"
                value={rateData.tarifa_servicio || ''}
                onChange={(e) => onChange({
                  ...rateData,
                  tarifa_servicio: parseFloat(e.target.value) || 0
                })}
                placeholder="Precio alternativo por servicio"
                min="0"
                step="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sugerencias de tarifas */}
      {(specialty || experienceYears) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Sugerencias de Tarifas</h3>
            <button
              type="button"
              onClick={getRateSuggestions}
              disabled={loadingSuggestions}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {loadingSuggestions ? 'Calculando...' : 'Obtener Sugerencias'}
            </button>
          </div>

          {suggestions && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">💰 Por Hora</h4>
                <p className="text-2xl font-bold text-emerald-600 mb-2">
                  {formatCurrency(suggestions.suggested_rates.tarifa_hora)}
                </p>
                <button
                  type="button"
                  onClick={() => applySuggestion('hourly')}
                  className="w-full px-3 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors text-sm"
                >
                  Usar Esta
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">🔧 Por Servicio</h4>
                <p className="text-2xl font-bold text-blue-600 mb-2">
                  {formatCurrency(suggestions.suggested_rates.tarifa_servicio)}
                </p>
                <button
                  type="button"
                  onClick={() => applySuggestion('service')}
                  className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                >
                  Usar Esta
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">🤝 A Convenir</h4>
                <p className="text-sm text-gray-600 mb-2 line-clamp-3">
                  {suggestions.suggested_rates.tarifa_convenio}
                </p>
                <button
                  type="button"
                  onClick={() => applySuggestion('custom')}
                  className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-sm"
                >
                  Usar Esta
                </button>
              </div>
            </div>
          )}

          {suggestions && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                <strong>Nota:</strong> {suggestions.note}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Información sobre competitividad */}
      {recommendedRange && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">📊 Análisis de Competitividad</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Categoría: <strong>{specialty || 'General'}</strong></p>
            <p>• Rango de mercado: <strong>{formatCurrency(recommendedRange.min)} - {formatCurrency(recommendedRange.max)}</strong></p>
            <p>• Tu tarifa actual: <strong>
              {rateData.tipo_tarifa === 'hora' && formatCurrency(rateData.tarifa_hora)}
              {rateData.tipo_tarifa === 'servicio' && formatCurrency(rateData.tarifa_servicio)}
              {rateData.tipo_tarifa === 'convenio' && 'A convenir'}
            </strong></p>
          </div>
        </div>
      )}

      {/* Consejos */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">💡 Consejos para establecer tarifas:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Investiga las tarifas del mercado en tu área</li>
          <li>• Considera tu experiencia y especialización</li>
          <li>• Incluye el costo de materiales y herramientas</li>
          <li>• Las tarifas competitivas te ayudan a conseguir más clientes</li>
          <li>• Puedes ajustar las tarifas según la complejidad del trabajo</li>
        </ul>
      </div>
    </div>
  );
};

export default RateConfiguration;