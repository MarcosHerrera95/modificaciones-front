const ValidationSummary = ({ profileData, completionScore, errors = {} }) => {
  const completionFields = [
    { key: 'nombre', label: 'Nombre completo', icon: '👤' },
    { key: 'especialidades', label: 'Especialidades', icon: '🔧' },
    { key: 'anos_experiencia', label: 'Años de experiencia', icon: '📅' },
    { key: 'zona_cobertura', label: 'Zona de cobertura', icon: '🗺️' },
    { key: 'tipo_tarifa', label: 'Tipo de tarifa', icon: '💰' },
    { key: 'descripcion', label: 'Descripción profesional', icon: '📝' },
    { key: 'url_foto_perfil', label: 'Foto de perfil', icon: '📸' }
  ];

  const getFieldStatus = (key) => {
    if (errors[key]) return 'error';
    
    let value = profileData[key];
    if (Array.isArray(value)) return value.length > 0 ? 'complete' : 'missing';
    if (typeof value === 'boolean') return 'complete';
    
    return value && value !== '' && value !== 0 ? 'complete' : 'missing';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      case 'missing':
        return '⏳';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete':
        return 'text-emerald-600';
      case 'error':
        return 'text-red-600';
      case 'missing':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const completeFields = completionFields.filter(field => getFieldStatus(field.key) === 'complete').length;
  const errorFields = completionFields.filter(field => getFieldStatus(field.key) === 'error').length;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Resumen del Perfil</h2>
        <p className="text-gray-600">
          Revisa el estado de completitud de tu perfil profesional.
        </p>
      </div>

      {/* Score de completitud */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Completitud del Perfil</h3>
          <span className="text-2xl font-bold text-emerald-600">{completionScore}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
          <div 
            className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${completionScore}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-emerald-50 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600">{completeFields}</div>
            <div className="text-sm text-emerald-700">Campos completos</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{errorFields}</div>
            <div className="text-sm text-red-700">Con errores</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">
              {completionFields.length - completeFields - errorFields}
            </div>
            <div className="text-sm text-gray-700">Pendientes</div>
          </div>
        </div>
      </div>

      {/* Estado de campos */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Estado de los Campos</h3>
        <div className="space-y-3">
          {completionFields.map((field) => {
            const status = getFieldStatus(field.key);
            return (
              <div
                key={field.key}
                className={`
                  flex items-center justify-between p-3 rounded-lg border
                  ${status === 'complete' ? 'border-emerald-200 bg-emerald-50' : 
                    status === 'error' ? 'border-red-200 bg-red-50' : 
                    'border-gray-200 bg-gray-50'}
                `}
              >
                <div className="flex items-center">
                  <span className="text-xl mr-3">{field.icon}</span>
                  <div>
                    <div className={`
                      font-medium 
                      ${status === 'complete' ? 'text-emerald-800' : 
                        status === 'error' ? 'text-red-800' : 
                        'text-gray-700'}
                    `}>
                      {field.label}
                    </div>
                    {errors[field.key] && (
                      <div className="text-sm text-red-600">{errors[field.key]}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${getStatusColor(status)}`}>
                    {status === 'complete' ? 'Completo' : 
                     status === 'error' ? 'Error' : 'Pendiente'}
                  </span>
                  <span className="text-lg">{getStatusIcon(status)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">💡 Recomendaciones</h3>
        <div className="space-y-2">
          {completionScore < 30 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                <strong>Completitud baja:</strong> Completa los campos básicos para mejorar tu visibilidad.
              </p>
            </div>
          )}
          
          {completionScore >= 30 && completionScore < 70 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Buen progreso:</strong> Sigue completando los campos para destacar entre otros profesionales.
              </p>
            </div>
          )}
          
          {completionScore >= 70 && completionScore < 100 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-emerald-800 text-sm">
                <strong>¡Casi listo!</strong> Completa los últimos campos para tener un perfil 100% optimizado.
              </p>
            </div>
          )}
          
          {completionScore === 100 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-emerald-800 text-sm">
                <strong>¡Perfil completo!</strong> Tu perfil está 100% optimizado para atraer clientes.
              </p>
            </div>
          )}

          {profileData.especialidades?.length === 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Selecciona especialidades:</strong> Esto es crucial para que los clientes te encuentren.
              </p>
            </div>
          )}

          {!profileData.zona_cobertura && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Define tu zona:</strong> Los clientes buscan profesionales por ubicación cercana.
              </p>
            </div>
          )}

          {!profileData.tarifa_hora && !profileData.tarifa_servicio && !profileData.tarifa_convenio && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Establece tarifas:</strong> Los clientes necesitan saber cuánto cobras antes de contactarte.
              </p>
            </div>
          )}

          {!profileData.url_foto_perfil && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Sube una foto:</strong> Los perfiles con foto generan más confianza y contactos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Consejos finales */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">🚀 Para destacar en la plataforma:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Mantén tu información actualizada y disponible</li>
          <li>• Responde rápidamente a las consultas de clientes</li>
          <li>• Pide reseñas a clientes satisfechos</li>
          <li>• Completa al menos el 80% de tu perfil</li>
          <li>• Usa fotos de alta calidad en tu perfil</li>
        </ul>
      </div>
    </div>
  );
};

export default ValidationSummary;