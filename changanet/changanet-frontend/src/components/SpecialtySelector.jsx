import React, { useState, useEffect, useRef } from 'react';
import { professionalProfileAPI } from '../services/professionalProfileAPIService';

/**
 * SpecialtySelector
 * Componente para seleccionar especialidades múltiples
 * 
 * Implementa REQ-07: Seleccionar una o más especialidades
 * 
 * Características:
 * - Autocompletado en tiempo real
 * - Selección múltiple con chips
 * - Agrupación por categorías
 * - Búsqueda inteligente
 * - Validación de cantidad (1-5 especialidades)
 * - Indicador de especialidad principal
 */

const SpecialtySelector = ({
  selectedSpecialties,
  onSpecialtiesChange,
  isLoading = false
}) => {
  const [allSpecialties, setAllSpecialties] = useState([]);
  const [groupedSpecialties, setGroupedSpecialties] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSpecialties, setFilteredSpecialties] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    loadSpecialties();
  }, []);

  useEffect(() => {
    filterSpecialties();
  }, [searchTerm, allSpecialties, selectedSpecialties]);

  useEffect(() => {
    // Cerrar dropdown al hacer clic fuera
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSpecialties = async () => {
    try {
      const [specialties, grouped] = await Promise.all([
        professionalProfileAPI.getSpecialties(false),
        professionalProfileAPI.getSpecialties(true)
      ]);

      setAllSpecialties(specialties);
      setGroupedSpecialties(grouped);
    } catch (error) {
      setError('Error cargando especialidades');
      console.error('Error loading specialties:', error);
    }
  };

  const filterSpecialties = () => {
    if (!searchTerm.trim()) {
      setFilteredSpecialties(allSpecialties);
      return;
    }

    const filtered = allSpecialties.filter(specialty =>
      specialty.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      specialty.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (specialty.description && specialty.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    setFilteredSpecialties(filtered);
  };

  const isSelected = (specialtyId) => {
    return selectedSpecialties.some(s => s.id === specialtyId);
  };

  const addSpecialty = (specialty) => {
    if (selectedSpecialties.length >= 5) {
      setError('Máximo 5 especialidades permitidas');
      return;
    }

    if (isSelected(specialty.id)) {
      setError('Esta especialidad ya está seleccionada');
      return;
    }

    const updatedSpecialties = [...selectedSpecialties, specialty];
    onSpecialtiesChange(updatedSpecialties);
    setSearchTerm('');
    setError('');
    setIsDropdownOpen(false);
  };

  const removeSpecialty = (specialtyId) => {
    const updatedSpecialties = selectedSpecialties.filter(s => s.id !== specialtyId);
    onSpecialtiesChange(updatedSpecialties);
    setError('');
  };



  const getSpecialtyIcon = (category) => {
    const icons = {
      'Construcción': '🏗️',
      'Automotriz': '🚗',
      'Tecnología': '💻',
      'Jardinería': '🌱',
      'Limpieza': '🧹',
      'Climatización': '❄️',
      'Seguridad': '🛡️',
      'Transporte': '🚛',
      'default': '🔧'
    };
    return icons[category] || icons.default;
  };

  const SpecialtyChip = ({ specialty, index, isPrimary }) => (
    <div className={`
      inline-flex items-center px-3 py-2 rounded-full text-sm font-medium mr-2 mb-2 transition-all duration-300
      ${isPrimary 
        ? 'bg-emerald-500 text-white ring-2 ring-emerald-300' 
        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
      }
    `}>
      <span className="mr-2">{getSpecialtyIcon(specialty.category)}</span>
      <span>{specialty.name}</span>
      
      <div className="ml-2 flex items-center space-x-1">
        {index === 0 && (
          <span className="text-xs bg-white bg-opacity-20 px-1 rounded">Principal</span>
        )}
        <button
          type="button"
          onClick={() => removeSpecialty(specialty.id)}
          className="text-current opacity-70 hover:opacity-100 ml-1"
        >
          ×
        </button>
      </div>
    </div>
  );

  const DropdownContent = () => {
    if (searchTerm && filteredSpecialties.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500">
          <p>No se encontraron especialidades para "{searchTerm}"</p>
        </div>
      );
    }

    const specialtiesToShow = searchTerm ? filteredSpecialties : allSpecialties;

    // Agrupar especialidades por categoría para mejor UX
    const groupedByCategory = specialtiesToShow.reduce((acc, specialty) => {
      const category = specialty.category || 'Otros';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(specialty);
      return acc;
    }, {});

    return (
      <div className="max-h-80 overflow-y-auto">
        {Object.entries(groupedByCategory).map(([category, specialties]) => (
          <div key={category} className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-3 py-2 bg-gray-50">
              {getSpecialtyIcon(category)} {category}
            </h4>
            <div className="py-1">
              {specialties.map(specialty => (
                <button
                  key={specialty.id}
                  type="button"
                  onClick={() => addSpecialty(specialty)}
                  disabled={isSelected(specialty.id) || selectedSpecialties.length >= 5}
                  className={`
                    w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center justify-between
                    ${isSelected(specialty.id) ? 'bg-emerald-100 text-emerald-800' : 'text-gray-800'}
                    ${selectedSpecialties.length >= 5 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center">
                    <span className="mr-3 text-lg">{getSpecialtyIcon(specialty.category)}</span>
                    <div>
                      <div className="font-medium">{specialty.name}</div>
                      {specialty.description && (
                        <div className="text-xs text-gray-600">{specialty.description}</div>
                      )}
                    </div>
                  </div>
                  {isSelected(specialty.id) && (
                    <span className="text-emerald-500">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">🔧 Especialidades</h2>
        <p className="text-gray-600">Selecciona una o más especialidades (máximo 5)</p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buscar Especialidades
        </label>
        <div className="relative" ref={dropdownRef}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Buscar especialidad o categoría..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isLoading}
          />
          
          {isDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-hidden">
              <DropdownContent />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Especialidades Seleccionadas ({selectedSpecialties.length}/5)
        </label>
        
        {selectedSpecialties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl mb-2 block">🔍</span>
            <p>Aún no has seleccionado ninguna especialidad</p>
            <p className="text-sm">Comienza a buscar arriba para ver opciones disponibles</p>
          </div>
        ) : (
          <div className="flex flex-wrap">
            {selectedSpecialties.map((specialty, index) => (
              <SpecialtyChip
                key={specialty.id}
                specialty={specialty}
                index={index}
                isPrimary={index === 0}
              />
            ))}
          </div>
        )}
      </div>

      {selectedSpecialties.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Sugerencia</h4>
          <p className="text-sm text-blue-700">
            Puedes establecer tu especialidad principal haciendo clic en el botón "Principal" en el chip que más uses.
          </p>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <h4 className="text-sm font-medium text-gray-700 mb-2">📋 Categorías Populares</h4>
        <div className="flex flex-wrap gap-2">
          {Object.keys(groupedSpecialties).slice(0, 6).map(category => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setSearchTerm(category);
                setIsDropdownOpen(true);
              }}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
            >
              <span className="mr-1">{getSpecialtyIcon(category)}</span>
              {category}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpecialtySelector;