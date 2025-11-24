const ExperienceSection = ({ years, onChange, errors = {} }) => {
  const experienceLevels = [
    { value: 0, label: 'Sin experiencia', description: 'Recién comenzando' },
    { value: 1, label: '1 año', description: 'Principiante' },
    { value: 2, label: '2-3 años', description: 'Junior' },
    { value: 5, label: '4-6 años', description: 'Intermedio' },
    { value: 8, label: '7-10 años', description: 'Senior' },
    { value: 15, label: '10+ años', description: 'Experto' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Experiencia Profesional</h2>
        <p className="text-gray-600">
          Indica cuántos años de experiencia tienes en tu especialidad principal.
        </p>
      </div>

      {/* Input numérico */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Años de Experiencia *
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="number"
            value={years || ''}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            placeholder="0"
            min="0"
            max="50"
            className={`
              flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
              ${errors.anos_experiencia ? 'border-red-300 bg-red-50' : 'border-gray-200'}
            `}
          />
          <span className="text-gray-600 font-medium">años</span>
        </div>
        {errors.anos_experiencia && (
          <p className="text-red-500 text-sm mt-1">{errors.anos_experiencia}</p>
        )}
      </div>

      {/* Selector visual */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Selecciona tu nivel de experiencia</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {experienceLevels.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              className={`
                p-4 border-2 rounded-lg text-left transition-all duration-200
                ${years >= level.value && years < (level.value + (level.value === 0 ? 1 : 3))
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-25'
                }
              `}
            >
              <h4 className={`
                font-semibold 
                ${years >= level.value && years < (level.value + (level.value === 0 ? 1 : 3))
                  ? 'text-emerald-800' 
                  : 'text-gray-900'
                }
              `}>
                {level.label}
              </h4>
              <p className={`
                text-sm mt-1
                ${years >= level.value && years < (level.value + (level.value === 0 ? 1 : 3))
                  ? 'text-emerald-600' 
                  : 'text-gray-600'
                }
              `}>
                {level.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Información sobre impacto de la experiencia */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">📈 Cómo la experiencia afecta tu perfil:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Más años de experiencia pueden justificar tarifas más altas</li>
          <li>• Los clientes suelen preferir profesionales con experiencia comprobada</li>
          <li>• Tu nivel de experiencia es visible en tu perfil público</li>
          <li>• Puedes destacar proyectos importantes en tu descripción</li>
          <li>• La experiencia ayuda en el posicionamiento en búsquedas</li>
        </ul>
      </div>
    </div>
  );
};

export default ExperienceSection;