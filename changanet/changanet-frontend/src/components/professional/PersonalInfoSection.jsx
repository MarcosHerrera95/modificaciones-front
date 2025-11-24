const PersonalInfoSection = ({ data, onChange, errors = {} }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Información Personal</h2>
        <p className="text-gray-600">
          Actualiza tu información básica de contacto y descripción profesional.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre Completo *
          </label>
          <input
            type="text"
            value={data.nombre || ''}
            onChange={(e) => onChange('nombre', e.target.value)}
            placeholder="Ej: Juan Pérez"
            className={`
              w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
              ${errors.nombre ? 'border-red-300 bg-red-50' : 'border-gray-200'}
            `}
            required
          />
          {errors.nombre && (
            <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            value={data.email || ''}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="Ej: juan@email.com"
            className={`
              w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
              ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'}
            `}
            required
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Teléfono
          </label>
          <input
            type="tel"
            value={data.telefono || ''}
            onChange={(e) => onChange('telefono', e.target.value)}
            placeholder="Ej: +54 9 11 1234-5678"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Disponibilidad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Disponibilidad
          </label>
          <select
            value={data.esta_disponible ? 'available' : 'unavailable'}
            onChange={(e) => onChange('esta_disponible', e.target.value === 'available')}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="available">Disponible para nuevos clientes</option>
            <option value="unavailable">No disponible temporalmente</option>
          </select>
        </div>
      </div>

      {/* Descripción */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción Profesional *
        </label>
        <textarea
          value={data.descripcion || ''}
          onChange={(e) => onChange('descripcion', e.target.value)}
          placeholder="Describe tu experiencia, servicios que ofreces, y por qué los clientes deberían elegirte..."
          rows={5}
          className={`
            w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
            ${errors.descripcion ? 'border-red-300 bg-red-50' : 'border-gray-200'}
          `}
          required
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-sm text-gray-600">
            {(data.descripcion || '').length}/1000 caracteres
          </p>
        </div>
        {errors.descripcion && (
          <p className="text-red-500 text-sm mt-1">{errors.descripcion}</p>
        )}
      </div>

      {/* Consejos para la descripción */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">💡 Consejos para una buena descripción:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Menciona tus años de experiencia y especialización</li>
          <li>• Describe los tipos de servicios que ofreces</li>
          <li>• Destaca tus fortalezas y diferenciadores</li>
          <li>• Incluye información sobre tu forma de trabajo</li>
          <li>• Mantén un tono profesional pero cercano</li>
        </ul>
      </div>
    </div>
  );
};

export default PersonalInfoSection;