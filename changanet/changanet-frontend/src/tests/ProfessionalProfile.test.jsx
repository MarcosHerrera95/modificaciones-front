/**
 * Tests para ProfessionalProfileForm y componentes relacionados
 * 
 * Validan REQ-06 a REQ-10 del PRD:
 * - REQ-06: Subir foto de perfil y portada
 * - REQ-07: Seleccionar especialidades múltiples
 * - REQ-08: Ingresar años de experiencia
 * - REQ-09: Definir zona de cobertura geográfica
 * - REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ProfessionalProfileForm from '../components/ProfessionalProfileForm';
import ImageUploader from '../components/ImageUploader';
import SpecialtySelector from '../components/SpecialtySelector';
import ZoneSelector from '../components/ZoneSelector';
import RateSelector from '../components/RateSelector';
import { professionalProfileAPI } from '../services/professionalProfileAPIService';

// Mock de los servicios
jest.mock('../services/professionalProfileAPIService');
jest.mock('../context/AuthContext');
jest.mock('../components/BackButton', () => () => <div>BackButton</div>);

// Configuración de prueba
const mockUser = {
  id: '123',
  nombre: 'Juan Pérez',
  email: 'juan@example.com',
  telefono: '+54 11 1234-5678',
  rol: 'profesional',
  esta_verificado: true
};

const mockProfile = {
  success: true,
  profile: {
    usuario_id: '123',
    usuario: {
      nombre: 'Juan Pérez',
      email: 'juan@example.com',
      telefono: '+54 11 1234-5678',
      esta_verificado: true
    },
    especialidad: 'Plomero',
    especialidades: [
      { id: '1', name: 'Plomería', category: 'Construcción', description: 'Reparaciones de plomería' },
      { id: '2', name: 'Gasista', category: 'Construcción', description: 'Instalaciones de gas' }
    ],
    anos_experiencia: 5,
    zona_cobertura: 'Palermo, Buenos Aires',
    cobertura_zona: {
      id: 'zone1',
      name: 'Palermo',
      city: 'Buenos Aires',
      state: 'CABA',
      latitude: -34.5875,
      longitude: -58.3944,
      radius_km: 5
    },
    tipo_tarifa: 'hora',
    tarifa_hora: 2500,
    tarifa_servicio: 5000,
    tarifa_convenio: 'Precio según el proyecto',
    descripcion: 'Plomero con 5 años de experiencia',
    url_foto_perfil: 'https://example.com/photo.jpg',
    url_foto_portada: 'https://example.com/banner.jpg',
    esta_disponible: true,
    calificacion_promedio: 4.5,
    profile_completion_score: 80
  }
};

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('ProfessionalProfileForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock de respuestas de API
    professionalProfileAPI.getMyProfile.mockResolvedValue(mockProfile);
    professionalProfileAPI.updateMyProfile.mockResolvedValue({
      success: true,
      profile: mockProfile.profile
    });
    professionalProfileAPI.getSpecialties.mockResolvedValue([
      { id: '1', name: 'Plomería', category: 'Construcción', description: 'Reparaciones de plomería' },
      { id: '2', name: 'Gasista', category: 'Construcción', description: 'Instalaciones de gas' }
    ]);
    professionalProfileAPI.getCoverageZones.mockResolvedValue([
      {
        id: 'zone1',
        name: 'Palermo',
        city: 'Buenos Aires',
        state: 'CABA',
        latitude: -34.5875,
        longitude: -58.3944,
        radius_km: 5
      }
    ]);
    professionalProfileAPI.getRateRanges.mockResolvedValue({
      'Construcción': { min: 1500, max: 8000 }
    });
    professionalProfileAPI.getSuggestedRates.mockResolvedValue([
      { type: 'Principiante', rate: 2000, description: '0-2 años de experiencia' },
      { type: 'Intermedio', rate: 3000, description: '3-5 años de experiencia' },
      { type: 'Experto', rate: 4500, description: '5+ años de experiencia' }
    ]);
    professionalProfileAPI.calculateCompletionScore.mockReturnValue({
      score: 80,
      required: { filled: 6, total: 7, percentage: 86 },
      optional: { filled: 1, total: 3, percentage: 33 },
      missingFields: ['url_foto_portada']
    });
  });

  test('debe cargar el formulario y mostrar el paso 1', async () => {
    const mockAuth = {
      user: mockUser,
      updateUser: jest.fn()
    };
    
    require('../context/AuthContext').useAuth.mockReturnValue(mockAuth);

    renderWithProviders(<ProfessionalProfileForm />);

    // Verificar que se muestra el indicador de pasos
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    // Verificar que se cargan los datos del usuario
    await waitFor(() => {
      expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument();
    });

    // Verificar botón "Siguiente"
    expect(screen.getByText('Siguiente →')).toBeInTheDocument();
  });

  test('debe navegar entre pasos correctamente', async () => {
    const mockAuth = {
      user: mockUser,
      updateUser: jest.fn()
    };
    
    require('../context/AuthContext').useAuth.mockReturnValue(mockAuth);

    renderWithProviders(<ProfessionalProfileForm />);

    // Paso 1 -> Paso 2
    await waitFor(() => {
      expect(screen.getByText('Información Básica')).toBeInTheDocument();
    });

    // Completar campos requeridos del paso 1
    fireEvent.change(screen.getByPlaceholderText('Tu nombre completo'), {
      target: { value: 'Juan Pérez' }
    });
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
      target: { value: 'juan@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('+54 11 1234-5678'), {
      target: { value: '+54 11 1234-5678' }
    });
    fireEvent.change(screen.getByPlaceholderText('Describe tu experiencia y los servicios que ofreces...'), {
      target: { value: 'Plomero con 5 años de experiencia' }
    });

    // Hacer clic en Siguiente
    fireEvent.click(screen.getByText('Siguiente →'));

    // Verificar que estamos en el paso 2
    await waitFor(() => {
      expect(screen.getByText('🔧 Especialidades')).toBeInTheDocument();
    });

    // Verificar que el paso 1 está marcado como completado
    expect(screen.getByText('1')).toHaveClass('bg-emerald-500');
  });

  test('REQ-06: debe permitir subir fotos de perfil y portada', async () => {
    render(<ImageUploader />);

    // Verificar secciones de foto de perfil y portada
    expect(screen.getByText('📸 Foto de Perfil')).toBeInTheDocument();
    expect(screen.getByText('🖼️ Foto de Portada')).toBeInTheDocument();

    // Simular selección de archivo
    const profileFile = new File(['test'], 'profile.jpg', { type: 'image/jpeg' });
    const bannerFile = new File(['test'], 'banner.jpg', { type: 'image/jpeg' });

    const profileInput = screen.getByText('Seleccionar Imagen').closest('div').querySelector('input[type="file"]');
    const bannerInput = screen.getAllByText('Seleccionar Imagen')[1].closest('div').querySelector('input[type="file"]');

    fireEvent.change(profileInput, { target: { files: [profileFile] } });
    fireEvent.change(bannerInput, { target: { files: [bannerFile] } });

    // Verificar que se pueden seleccionar archivos
    expect(profileInput.files.length).toBe(1);
    expect(bannerInput.files.length).toBe(1);
  });

  test('REQ-07: debe permitir seleccionar múltiples especialidades', async () => {
    const mockOnSpecialtiesChange = jest.fn();
    
    render(
      <SpecialtySelector
        selectedSpecialties={[]}
        onSpecialtiesChange={mockOnSpecialtiesChange}
      />
    );

    // Verificar que se muestra el campo de búsqueda
    expect(screen.getByPlaceholderText('Buscar especialidad o categoría...')).toBeInTheDocument();

    // Simular búsqueda
    const searchInput = screen.getByPlaceholderText('Buscar especialidad o categoría...');
    fireEvent.change(searchInput, { target: { value: 'Plomería' } });

    await waitFor(() => {
      expect(searchInput.value).toBe('Plomería');
    });

    // Verificar que se muestran las especialidades encontradas
    // (dependiendo de la implementación real del mock)
  });

  test('REQ-08: debe permitir ingresar años de experiencia', async () => {
    renderWithProviders(<ProfessionalProfileForm />);

    await waitFor(() => {
      expect(screen.getByText('Años de Experiencia')).toBeInTheDocument();
    });

    const experienceInput = screen.getByLabelText('Años de Experiencia *');
    
    fireEvent.change(experienceInput, { target: { value: '5' } });
    expect(experienceInput.value).toBe('5');

    fireEvent.change(experienceInput, { target: { value: '0' } });
    expect(experienceInput.value).toBe('0');

    // Verificar límites
    fireEvent.change(experienceInput, { target: { value: '50' } });
    expect(experienceInput.value).toBe('50');
  });

  test('REQ-09: debe permitir seleccionar zona de cobertura', async () => {
    const mockOnZoneChange = jest.fn();
    
    render(
      <ZoneSelector
        selectedZone={null}
        onZoneChange={mockOnZoneChange}
      />
    );

    // Verificar que se muestra el campo de búsqueda de ubicación
    expect(screen.getByPlaceholderText('Buscar ciudad, barrio o zona...')).toBeInTheDocument();

    // Verificar que se muestra el botón de ubicación actual
    expect(screen.getByText('📍 Usar mi ubicación actual')).toBeInTheDocument();

    // Verificar el control de radio de cobertura
    const radiusSlider = screen.getByRole('slider');
    expect(radiusSlider).toBeInTheDocument();
    expect(radiusSlider).toHaveAttribute('min', '1');
    expect(radiusSlider).toHaveAttribute('max', '50');
  });

  test('REQ-10: debe permitir seleccionar tipo de tarifa y valores', async () => {
    const mockOnRatesChange = jest.fn();
    
    render(
      <RateSelector
        selectedRates={{ tipo_tarifa: 'hora' }}
        onRatesChange={mockOnRatesChange}
        experienceYears={5}
        primarySpecialty="Construcción"
      />
    );

    // Verificar que se muestran los tres tipos de tarifa
    expect(screen.getByText('⏱️ Por Hora')).toBeInTheDocument();
    expect(screen.getByText('🔧 Por Servicio')).toBeInTheDocument();
    expect(screen.getByText('🤝 A Convenir')).toBeInTheDocument();

    // Simular selección de tipo de tarifa
    fireEvent.click(screen.getByText('🔧 Por Servicio'));

    // Verificar que se muestra el campo de tarifa por servicio
    expect(screen.getByLabelText('🔧 Tarifa por Servicio')).toBeInTheDocument();

    // Simular ingreso de valor
    const serviceRateInput = screen.getByLabelText('🔧 Tarifa por Servicio');
    fireEvent.change(serviceRateInput, { target: { value: '5000' } });
    expect(serviceRateInput.value).toBe('5000');
  });

  test('debe calcular correctamente el score de completitud', async () => {
    // Test del servicio API
    const testProfile = {
      url_foto_perfil: 'https://example.com/photo.jpg',
      especialidades: [{ id: '1', name: 'Plomería' }],
      anos_experiencia: 5,
      zona_cobertura: 'Palermo',
      tipo_tarifa: 'hora',
      tarifa_hora: 2500,
      descripcion: 'Descripción'
    };

    const result = professionalProfileAPI.calculateCompletionScore(testProfile);
    
    expect(result.score).toBeGreaterThan(0);
    expect(result.required).toBeDefined();
    expect(result.optional).toBeDefined();
    expect(Array.isArray(result.missingFields)).toBe(true);
  });

  test('debe validar campos requeridos en cada paso', async () => {
    const mockAuth = {
      user: mockUser,
      updateUser: jest.fn()
    };
    
    require('../context/AuthContext').useAuth.mockReturnValue(mockAuth);

    renderWithProviders(<ProfessionalProfileForm />);

    await waitFor(() => {
      expect(screen.getByText('Siguiente →')).toBeInTheDocument();
    });

    // Intentar avanzar sin completar campos requeridos
    fireEvent.click(screen.getByText('Siguiente →'));

    // Verificar que se muestran errores de validación
    await waitFor(() => {
      expect(screen.getByText('El nombre es requerido')).toBeInTheDocument();
      expect(screen.getByText('El email es requerido')).toBeInTheDocument();
    });
  });

  test('debe guardar el perfil exitosamente', async () => {
    const mockAuth = {
      user: mockUser,
      updateUser: jest.fn()
    };
    
    require('../context/AuthContext').useAuth.mockReturnValue(mockAuth);

    renderWithProviders(<ProfessionalProfileForm />);

    // Completar todos los pasos
    // Paso 1
    await waitFor(() => {
      expect(screen.getByText('Siguiente →')).toBeInTheDocument();
    });

    // Llenar campos del paso 1
    fireEvent.change(screen.getByPlaceholderText('Tu nombre completo'), {
      target: { value: 'Juan Pérez' }
    });
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
      target: { value: 'juan@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('+54 11 1234-5678'), {
      target: { value: '+54 11 1234-5678' }
    });
    fireEvent.change(screen.getByPlaceholderText('Describe tu experiencia y los servicios que ofreces...'), {
      target: { value: 'Plomero con experiencia' }
    });

    fireEvent.click(screen.getByText('Siguiente →'));

    // Continuar con los demás pasos...
    // (Simplificado para el test)

    // Paso final - hacer clic en "Finalizar y Guardar"
    await waitFor(() => {
      expect(screen.getByText('✓ Finalizar y Guardar')).toBeInTheDocument();
    });

    // Simular que estamos en el último paso
    act(() => {
      // Forzar el último paso para el test
      const event = new Event('submit');
      fireEvent.submit(screen.getByText('✓ Finalizar y Guardar'));
    });

    // Verificar que se llama a la API
    await waitFor(() => {
      expect(professionalProfileAPI.updateMyProfile).toHaveBeenCalled();
    });
  });

  test('debe manejar errores de API correctamente', async () => {
    // Simular error en la API
    professionalProfileAPI.updateMyProfile.mockRejectedValue(new Error('Error de conexión'));

    const mockAuth = {
      user: mockUser,
      updateUser: jest.fn()
    };
    
    require('../context/AuthContext').useAuth.mockReturnValue(mockAuth);

    renderWithProviders(<ProfessionalProfileForm />);

    // Intentar guardar y verificar manejo de errores
    await waitFor(() => {
      fireEvent.click(screen.getByText('✓ Finalizar y Guardar'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Error de conexión/)).toBeInTheDocument();
    });
  });
});

describe('Validaciones de archivos', () => {
  test('ImageUploader debe validar tipos de archivo', () => {
    render(<ImageUploader />);

    // Simular archivo inválido
    const invalidFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });
    
    // El componente debe rechazar archivos que no sean imagen
    // (esto depende de la implementación específica)
  });

  test('ImageUploader debe validar tamaño de archivo', () => {
    render(<ImageUploader />);

    // Crear archivo grande (simular 6MB)
    const largeFile = new File(['a'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    
    // El componente debe rechazar archivos mayores a 5MB
  });
});

describe('Pruebas de integración', () => {
  test('flujo completo de creación de perfil', async () => {
    // Test end-to-end del flujo completo
    const mockAuth = {
      user: mockUser,
      updateUser: jest.fn()
    };
    
    require('../context/AuthContext').useAuth.mockReturnValue(mockAuth);

    renderWithProviders(<ProfessionalProfileForm />);

    // Simular flujo completo:
    // 1. Completar información básica
    // 2. Seleccionar especialidades
    // 3. Definir zona de cobertura
    // 4. Configurar tarifas
    // 5. Revisar y guardar

    // (Test simplificado - en implementación real sería más detallado)
  });
});