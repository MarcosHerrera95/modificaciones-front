import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import professionalProfileService from '../../services/professionalProfileService';

const SpecialtySelector = ({ specialties, selectedSpecialties, onChange, errors = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Obtener categorías únicas de las especialidades
  const categories = useMemo(() => {
    const uniqueCategories = new Set();
    Object.keys(specialties).forEach(category => {
      if (Array.isArray(specialties[category])) {
        uniqueCategories.add(category);
      }
    });
    return Array.from(uniqueCategories).sort();
  }, [specialties]);

  // Filtrar especialidades basado en búsqueda y categoría
  const filteredSpecialties = useMemo(() => {
    let allSpecialties = [];
    
    // Recopilar todas las especialidades
    if (selectedCategory === 'all') {
      Object.keys(specialties).forEach(category => {
        if (Array.isArray(specialties[category])) {
          allSpecialties = allSpecialties.concat(
            specialties[category].map(s => ({ ...s, category }))
          );
        }
      });
    } else {
      if (Array.isArray(specialties[selectedCategory])) {
        allSpecialties = specialties[selectedCategory].map(s => ({ ...s, category: selectedCategory }));
      }
    }

    // Filtrar por término de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      allSpecialties = allSpecialties.filter(specialty =>
        specialty.name.toLowerCase().includes(term) ||
        specialty.description?.toLowerCase().includes(term)
      );
    }

    return allSpecialties;
  }, [specialties, selectedCategory, searchTerm]);

  // Buscar sugerencias cuando cambia el término de búsqueda
  useEffect(() => {
    const searchSuggestions = async () => {
      if (searchTerm.trim().length >= 2) {
        setLoading(true);
        try {
          const results = await professionalProfileService.searchSpecialties(searchTerm, 5);
          setSuggestions(results);
        } catch (error) {
          console.error('Error searching specialties:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setSuggestions([]);
      }
    };

    const timeoutId = setTimeout(searchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  /**
   * Maneja la selección de una especialidad
   */
  const handleSpecialtyToggle = (specialty) => {
    const isSelected = selectedSpecialties.some(s => s.id === specialty.id);
    
    if (isSelected) {
      // Remover especialidad
      const updated = selectedSpecialties.filter(s => s.id !== specialty.id);
      onChange(updated);
    } else {
      // Agregar especialidad (máximo 10)
      if (selectedSpecialties.length >= 10) {
        toast.error('Máximo 10 especialidades permitidas');
        return;
      }
      const updated = [...selectedSpecialties, specialty];
      onChange(updated);
    }
  };

  /**
   * Maneja la selección de una sugerencia
   */
  const handleSuggestionSelect = (suggestion) => {
    handleSpecialtyToggle(suggestion);
    setSearchTerm('');
    setSuggestions([]);
  };

  /**
   * Maneja el cambio de categoría
   */
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSearchTerm('');
    setSuggestions([]);
  };

  /**
   * Remueve una especialidad seleccionada
   */
  const handleRemoveSpecialty = (specialtyId) => {
    const updated = selectedSpecialties.filter(s => s.id !== specialtyId);
    onChange(updated);
  };

  /**
   * Obtiene el icono para cada categoría
   */
  const getCategoryIcon = (category) => {
    const icons = {
      'Construcción': '🏗️',
      'Automotriz': '🚗',
      'Tecnología': '💻',
      'Jardinería': '🌱',
      'Limpieza': '🧽',
      'Climatización': '❄️',
      'Seguridad': '🔒',
      'Transporte': '🚚'
    };
    return icons[category] || '🔧';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Especialidades</h2>
        <p className="text-gray-600">
          Selecciona una o más especialidades que ofreces. Puedes elegir hasta 10 especialidades.
        </p>
      </div>

      {/* Especialidades seleccionadas */}
      {selectedSpecialties.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">
            Especialidades Seleccionadas ({selectedSpecialties.length}/10)
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedSpecialties.map((specialty, index) => (
              <div
                key={specialty.id}
                className={`
                  inline-flex items-center px-4 py-2 rounded-full text-sm font-medium
                  transition-all duration-200
                  ${index === 0 
                    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300' 
                    : 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                  }
                `}
              >
                <span className="mr-2">
                  {index === 0 ? '⭐' : getCategoryIcon(specialty.category)}
                </span>
                <span>{specialty.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSpecialty(specialty.id)}
                  className="ml-2 text-gray-500 hover:text-red-500 transition-colors"
                  title="Remover especialidad"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {selectedSpecialties.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              La primera especialidad marcada con ⭐ será tu especialidad principal.
            </p>
          )}
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar especialidades..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <div className="absolute right-3 top-3">
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500"></div>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Sugerencias de búsqueda */}
        {suggestions.length > 0 && (
          <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{suggestion.name}</div>
                    <div className="text-sm text-gray-500">{suggestion.category}</div>
                  </div>
                  <div className="text-gray-400">
                    {getCategoryIcon(suggestion.category)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filtro por categoría */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCategoryChange('all')}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${selectedCategory === 'all' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            Todas las categorías
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleCategoryChange(category)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${selectedCategory === category 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {getCategoryIcon(category)} {category}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de especialidades */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">
          {selectedCategory === 'all' ? 'Todas las especialidades' : selectedCategory}
          <span className="text-sm font-normal text-gray-500 ml-2">
            ({filteredSpecialties.length} disponibles)
          </span>
        </h3>
        
        {filteredSpecialties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29 1.007-5.824 2.582M15 18.128l-3-3L9 12l3-3" />
            </svg>
            <p>No se encontraron especialidades</p>
            <p className="text-sm">Intenta con otro término de búsqueda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSpecialties.map((specialty) => {
              const isSelected = selectedSpecialties.some(s => s.id === specialty.id);
              return (
                <div
                  key={specialty.id}
                  className={`
                    border-2 rounded-lg p-4 cursor-pointer transition-all duration-200
                    ${isSelected 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-25'
                    }
                  `}
                  onClick={() => handleSpecialtyToggle(specialty)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="text-lg mr-2">
                          {getCategoryIcon(specialty.category)}
                        </span>
                        <h4 className={`
                          font-medium 
                          ${isSelected ? 'text-emerald-800' : 'text-gray-900'}
                        `}>
                          {specialty.name}
                        </h4>
                      </div>
                      <p className={`
                        text-sm 
                        ${isSelected ? 'text-emerald-600' : 'text-gray-600'}
                      `}>
                        {specialty.description}
                      </p>
                      <div className={`
                        text-xs mt-2 px-2 py-1 rounded-full inline-block
                        ${isSelected 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-gray-100 text-gray-600'
                        }
                      `}>
                        {specialty.category}
                      </div>
                    </div>
                    <div className="ml-3">
                      {isSelected ? (
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mensajes de error */}
      {errors.especialidades && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{errors.especialidades}</p>
        </div>
      )}

      {/* Información adicional */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">💡 Consejos para seleccionar especialidades:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Selecciona las especialidades en las que realmente tienes experiencia</li>
          <li>• Puedes elegir hasta 10 especialidades diferentes</li>
          <li>• La primera especialidad será tu especialidad principal</li>
          <li>• Los clientes podrán filtrar por especialidades específicas</li>
          <li>• Usar términos claros ayuda a que te encuentren más fácilmente</li>
        </ul>
      </div>
    </div>
  );
};

export default SpecialtySelector;