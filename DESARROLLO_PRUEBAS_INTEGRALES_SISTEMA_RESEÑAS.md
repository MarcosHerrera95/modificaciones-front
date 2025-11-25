# Desarrollo de Pruebas Integrales - Sistema de Reseñas

## Fecha de Análisis
25 de Noviembre, 2025

## Resumen Ejecutivo

Este documento detalla el desarrollo de pruebas integrales para el Sistema de Reseñas y Valoraciones de Changánet, cubriendo pruebas unitarias, pruebas de integración y pruebas end-to-end, con el objetivo de garantizar la calidad y robustez del sistema.

## Estrategia de Pruebas

### Tipos de Pruebas

1. **Pruebas Unitarias**:
   - Prueban funciones y componentes de manera aislada
   - Verifican la lógica de negocio y el comportamiento de funciones específicas
   - Rápidas y fáciles de mantener

2. **Pruebas de Integración**:
   - Prueban la interacción entre diferentes componentes
   - Verifican que las partes del sistema trabajen juntas correctamente
   - Detectan problemas de integración

3. **Pruebas End-to-End (E2E)**:
   - Prueban flujos completos de trabajo
   - Verifican que el sistema funcione correctamente desde la perspectiva del usuario
   - Más lentas pero proporcionan mayor confianza

## Pruebas Unitarias

### Backend

#### 1. Pruebas para `createReview`

**Objetivo**: Verificar que la función `createReview` funcione correctamente en diferentes escenarios.

```javascript
// tests/unit/reviewController.test.js
const { createReview } = require('../../src/controllers/reviewController');
const { PrismaClient } = require('@prisma/client');

// Mock de Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    servicios: {
      findUnique: jest.fn()
    },
    resenas: {
      create: jest.fn(),
      findUnique: jest.fn()
    },
    perfiles_profesionales: {
      update: jest.fn()
    }
  };
  return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

describe('createReview', () => {
  let prisma;
  let req;
  let res;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    prisma = new PrismaClient();
    
    // Setup request and response objects
    req = {
      body: {
        servicio_id: 'test-service-id',
        calificacion: 5,
        comentario: 'Excelente servicio'
      },
      file: null,
      user: {
        id: 'test-user-id'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  test('debería crear una reseña exitosamente', async () => {
    // Arrange
    prisma.servicios.findUnique.mockResolvedValue({
      id: 'test-service-id',
      estado: 'completado',
      cliente_id: 'test-user-id',
      profesional_id: 'test-professional-id',
      cliente: { nombre: 'Test Client' },
      profesional: { id: 'test-professional-id' }
    });
    
    prisma.resenas.findUnique.mockResolvedValue(null);
    
    prisma.resenas.create.mockResolvedValue({
      id: 'test-review-id',
      servicio_id: 'test-service-id',
      cliente_id: 'test-user-id',
      calificacion: 5,
      comentario: 'Excelente servicio',
      url_foto: null,
      creado_en: new Date()
    });
    
    prisma.resenas.findMany.mockResolvedValue([
      { calificacion: 5 },
      { calificacion: 4 }
    ]);
    
    // Act
    await createReview(req, res);
    
    // Assert
    expect(prisma.servicios.findUnique).toHaveBeenCalledWith({
      where: { id: 'test-service-id' },
      include: { cliente: true, profesional: true }
    });
    
    expect(prisma.resenas.create).toHaveBeenCalled();
    
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      servicio_id: 'test-service-id',
      cliente_id: 'test-user-id',
      calificacion: 5,
      comentario: 'Excelente servicio'
    }));
  });

  test('debería devolver error 403 si el usuario no es el cliente del servicio', async () => {
    // Arrange
    prisma.servicios.findUnique.mockResolvedValue({
      id: 'test-service-id',
      estado: 'completado',
      cliente_id: 'different-user-id',
      profesional_id: 'test-professional-id'
    });
    
    // Act
    await createReview(req, res);
    
    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No puedes dejar una reseña para este servicio.'
    });
  });

  test('debería devolver error 400 si el servicio no está completado', async () => {
    // Arrange
    prisma.servicios.findUnique.mockResolvedValue({
      id: 'test-service-id',
      estado: 'pendiente',
      cliente_id: 'test-user-id',
      profesional_id: 'test-professional-id'
    });
    
    // Act
    await createReview(req, res);
    
    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No puedes dejar una reseña para este servicio.'
    });
  });

  test('debería devolver error 400 si ya existe una reseña para el servicio', async () => {
    // Arrange
    prisma.servicios.findUnique.mockResolvedValue({
      id: 'test-service-id',
      estado: 'completado',
      cliente_id: 'test-user-id',
      profesional_id: 'test-professional-id'
    });
    
    prisma.resenas.findUnique.mockResolvedValue({
      id: 'existing-review-id'
    });
    
    // Act
    await createReview(req, res);
    
    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Ya se ha dejado una reseña para este servicio. Solo se permite una reseña por servicio.'
    });
  });

  test('debería devolver error 400 si la calificación está fuera del rango', async () => {
    // Arrange
    req.body.calificacion = 6;
    
    // Act
    await createReview(req, res);
    
    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'La calificación debe ser un número entre 1 y 5.'
    });
  });

  test('debería devolver error 500 si ocurre un error interno', async () => {
    // Arrange
    prisma.servicios.findUnique.mockRejectedValue(new Error('Database error'));
    
    // Act
    await createReview(req, res);
    
    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Error al crear la reseña.'
    });
  });
});
```

#### 2. Pruebas para `getReviewStats`

**Objetivo**: Verificar que la función `getReviewStats` calcule correctamente las estadísticas.

```javascript
// tests/unit/reviewController.test.js
const { getReviewStats } = require('../../src/controllers/reviewController');

describe('getReviewStats', () => {
  let prisma;
  let req;
  let res;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    prisma = new PrismaClient();
    
    // Setup request and response objects
    req = {
      params: {
        professionalId: 'test-professional-id'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  test('debería devolver estadísticas correctas', async () => {
    // Arrange
    prisma.resenas.findMany.mockResolvedValue([
      { calificacion: 5, creado_en: new Date('2021-01-01') },
      { calificacion: 4, creado_en: new Date('2021-01-02') },
      { calificacion: 3, creado_en: new Date('2021-01-03') },
      { calificacion: 2, creado_en: new Date('2021-01-04') },
      { calificacion: 1, creado_en: new Date('2021-01-05') }
    ]);
    
    // Act
    await getReviewStats(req, res);
    
    // Assert
    expect(prisma.resenas.findMany).toHaveBeenCalledWith({
      where: {
        servicio: {
          profesional_id: 'test-professional-id'
        }
      },
      select: {
        calificacion: true,
        creado_en: true
      }
    });
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      professionalId: 'test-professional-id',
      totalReviews: 5,
      averageRating: 3.0,
      ratingDistribution: {
        1: 1,
        2: 1,
        3: 1,
        4: 1,
        5: 1
      },
      positivePercentage: 40
    }));
  });

  test('debería manejar el caso cuando no hay reseñas', async () => {
    // Arrange
    prisma.resenas.findMany.mockResolvedValue([]);
    
    // Act
    await getReviewStats(req, res);
    
    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      professionalId: 'test-professional-id',
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
      },
      positivePercentage: 0,
      lastReviewDate: null
    }));
  });
});
```

### Frontend

#### 1. Pruebas para `ReviewForm`

**Objetivo**: Verificar que el componente `ReviewForm` funcione correctamente.

```javascript
// tests/unit/ReviewForm.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReviewForm from '../components/ReviewForm';
import { AuthProvider } from '../context/AuthContext';

// Mock del contexto de autenticación
jest.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', nombre: 'Test User' }
  })
}));

// Mock de fetch
global.fetch = jest.fn();

// Mock de ImageUpload
jest.mock('../components/ImageUpload', () => {
  return function MockImageUpload({ onImageSelect }) {
    return <div data-testid="mock-image-upload">Image Upload</div>;
  };
});

describe('ReviewForm', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup fetch mock
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ canReview: true })
    });
  });

  test('debería renderizar correctamente', () => {
    // Arrange & Act
    render(
      <AuthProvider>
        <ReviewForm servicio_id="test-service-id" onReviewSubmitted={() => {}} />
      </AuthProvider>
    );
    
    // Assert
    expect(screen.getByText('Calificación')).toBeInTheDocument();
    expect(screen.getByText('Comentario')).toBeInTheDocument();
    expect(screen.getByText('Foto (opcional)')).toBeInTheDocument();
    expect(screen.getByText('Enviar Reseña')).toBeInTheDocument();
  });

  test('debería mostrar error si la calificación no está seleccionada', async () => {
    // Arrange
    render(
      <AuthProvider>
        <ReviewForm servicio_id="test-service-id" onReviewSubmitted={() => {}} />
      </AuthProvider>
    );
    
    // Act
    fireEvent.click(screen.getByText('Enviar Reseña'));
    
    // Assert
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  test('debería enviar la reseña correctamente', async () => {
    // Arrange
    render(
      <AuthProvider>
        <ReviewForm servicio_id="test-service-id" onReviewSubmitted={() => {}} />
      </AuthProvider>
    );
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        id: 'test-review-id',
        servicio_id: 'test-service-id',
        calificacion: 5,
        comentario: 'Excelente servicio'
      })
    });
    
    // Act
    fireEvent.click(screen.getAllByText('⭐')[4]); // Seleccionar 5 estrellas
    fireEvent.change(screen.getByPlaceholderText('Comparte tu experiencia con este servicio...'), {
      target: { value: 'Excelente servicio' }
    });
    fireEvent.click(screen.getByText('Enviar Reseña'));
    
    // Assert
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/reviews', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  test('debería mostrar error si el usuario no puede reseñar', async () => {
    // Arrange
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ canReview: false, reason: 'El servicio debe estar completado para poder reseñar.' })
    });
    
    render(
      <AuthProvider>
        <ReviewForm servicio_id="test-service-id" onReviewSubmitted={() => {}} />
      </AuthProvider>
    );
    
    // Act & Assert
    await waitFor(() => {
      expect(screen.getByText('El servicio debe estar completado para poder reseñar.')).toBeInTheDocument();
    });
  });
});
```

#### 2. Pruebas para `ImageUpload`

**Objetivo**: Verificar que el componente `ImageUpload` funcione correctamente.

```javascript
// tests/unit/ImageUpload.test.js
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageUpload from '../components/ImageUpload';

describe('ImageUpload', () => {
  test('debería renderizar correctamente', () => {
    // Arrange & Act
    render(
      <ImageUpload 
        onImageSelect={() => {}} 
        onImageRemove={() => {}}
        placeholder="Seleccionar imagen"
      />
    );
    
    // Assert
    expect(screen.getByText('Seleccionar imagen')).toBeInTheDocument();
  });

  test('debería aceptar solo imágenes', () => {
    // Arrange
    const onImageSelect = jest.fn();
    
    render(
      <ImageUpload 
        onImageSelect={onImageSelect} 
        onImageRemove={() => {}}
      />
    );
    
    // Act
    const fileInput = screen.getByDisplayValue('');
    
    // Crear un archivo simulado de imagen
    const imageFile = new File(['(⌐□_□)'], 'test.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });
    
    // Assert
    expect(onImageSelect).toHaveBeenCalledWith(imageFile);
  });

  test('debería rechazar archivos no imagen', () => {
    // Arrange
    const onImageSelect = jest.fn();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ImageUpload 
        onImageSelect={onImageSelect} 
        onImageRemove={() => {}}
      />
    );
    
    // Act
    const fileInput = screen.getByDisplayValue('');
    
    // Crear un archivo simulado que no es imagen
    const nonImageFile = new File(['(⌐□_□)'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [nonImageFile] } });
    
    // Assert
    expect(onImageSelect).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    // Limpiar
    consoleErrorSpy.mockRestore();
  });

  test('debería rechazar archivos demasiado grandes', () => {
    // Arrange
    const onImageSelect = jest.fn();
    
    render(
      <ImageUpload 
        onImageSelect={onImageSelect} 
        onImageRemove={() => {}}
      />
    );
    
    // Act
    const fileInput = screen.getByDisplayValue('');
    
    // Crear un archivo simulado de imagen grande (más de 5MB)
    const largeImageFile = new File(['(⌐□_□)'.repeat(1000000)], 'test.png', { type: 'image/png' });
    Object.defineProperty(largeImageFile, 'size', { value: 6 * 1024 * 1024 }); // 6MB
    fireEvent.change(fileInput, { target: { files: [largeImageFile] } });
    
    // Assert
    expect(onImageSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/El archivo es demasiado grande/)).toBeInTheDocument();
  });
});
```

## Pruebas de Integración

### Backend

#### 1. Pruebas para las rutas de reseñas

**Objetivo**: Verificar que las rutas de reseñas funcionen correctamente con el controlador.

```javascript
// tests/integration/reviewRoutes.test.js
const request = require('supertest');
const app = require('../../src/server');
const { PrismaClient } = require('@prisma/client');

// Mock de Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    servicios: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    resenas: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    perfiles_profesionales: {
      update: jest.fn()
    }
  };
  return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

describe('Review Routes', () => {
  let prisma;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    prisma = new PrismaClient();
  });

  describe('POST /api/reviews', () => {
    test('debería crear una reseña exitosamente', async () => {
      // Arrange
      prisma.servicios.findUnique.mockResolvedValue({
        id: 'test-service-id',
        estado: 'completado',
        cliente_id: 'test-user-id',
        profesional_id: 'test-professional-id',
        cliente: { nombre: 'Test Client' },
        profesional: { id: 'test-professional-id' }
      });
      
      prisma.resenas.findUnique.mockResolvedValue(null);
      
      prisma.resenas.create.mockResolvedValue({
        id: 'test-review-id',
        servicio_id: 'test-service-id',
        cliente_id: 'test-user-id',
        calificacion: 5,
        comentario: 'Excelente servicio',
        url_foto: null,
        creado_en: new Date()
      });
      
      prisma.resenas.findMany.mockResolvedValue([
        { calificacion: 5 },
        { calificacion: 4 }
      ]);
      
      // Act
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', 'Bearer test-token')
        .field('servicio_id', 'test-service-id')
        .field('calificacion', '5')
        .field('comentario', 'Excelente servicio');
      
      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 'test-review-id');
    });

    test('debería devolver error 403 si el usuario no está autenticado', async () => {
      // Act
      const response = await request(app)
        .post('/api/reviews')
        .field('servicio_id', 'test-service-id')
        .field('calificacion', '5');
      
      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/reviews/professional/:id', () => {
    test('debería obtener las reseñas de un profesional', async () => {
      // Arrange
      prisma.resenas.findMany.mockResolvedValue([
        {
          id: 'test-review-id-1',
          servicio_id: 'test-service-id-1',
          calificacion: 5,
          comentario: 'Excelente servicio',
          url_foto: null,
          creado_en: new Date(),
          servicio: { id: 'test-service-id-1' },
          cliente: { nombre: 'Test Client 1' }
        },
        {
          id: 'test-review-id-2',
          servicio_id: 'test-service-id-2',
          calificacion: 4,
          comentario: 'Buen servicio',
          url_foto: 'https://example.com/image.jpg',
          creado_en: new Date(),
          servicio: { id: 'test-service-id-2' },
          cliente: { nombre: 'Test Client 2' }
        }
      ]);
      
      // Act
      const response = await request(app)
        .get('/api/reviews/professional/test-professional-id');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });
  });
});
```

### Frontend

#### 1. Pruebas para la página de reseñas del cliente

**Objetivo**: Verificar que la página `ClientReviews` funcione correctamente.

```javascript
// tests/integration/ClientReviews.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ClientReviews from '../pages/ClientReviews';
import { AuthProvider } from '../context/AuthContext';

// Mock del contexto de autenticación
jest.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', role: 'cliente', nombre: 'Test User' }
  })
}));

// Mock de fetch
global.fetch = jest.fn();

describe('ClientReviews', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup fetch mock
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        reviews: [
          {
            id: 'test-review-id-1',
            calificacion: 5,
            comentario: 'Excelente servicio',
            url_foto: null,
            creado_en: new Date(),
            servicio: {
              id: 'test-service-id-1',
              profesional: {
                id: 'test-professional-id-1',
                nombre: 'Test Professional 1',
                perfil_profesional: {
                  especialidad: 'Plomería'
                }
              },
              completado_en: new Date()
            }
          },
          {
            id: 'test-review-id-2',
            calificacion: 4,
            comentario: 'Buen servicio',
            url_foto: 'https://example.com/image.jpg',
            creado_en: new Date(),
            servicio: {
              id: 'test-service-id-2',
              profesional: {
                id: 'test-professional-id-2',
                nombre: 'Test Professional 2',
                perfil_profesional: {
                  especialidad: 'Electricidad'
                }
              },
              completado_en: new Date()
            }
          }
        ]
      })
    });
  });

  test('debería renderizar la página correctamente', async () => {
    // Arrange & Act
    render(
      <AuthProvider>
        <ClientReviews />
      </AuthProvider>
    );
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('Mis Reseñas')).toBeInTheDocument();
    });
  });

  test('debería mostrar las reseñas del cliente', async () => {
    // Arrange & Act
    render(
      <AuthProvider>
        <ClientReviews />
      </AuthProvider>
    );
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('Test Professional 1')).toBeInTheDocument();
      expect(screen.getByText('Test Professional 2')).toBeInTheDocument();
      expect(screen.getByText('Plomería')).toBeInTheDocument();
      expect(screen.getByText('Electricidad')).toBeInTheDocument();
    });
  });
});
```

## Pruebas End-to-End (E2E)

### 1. Flujo completo de creación de reseña

**Objetivo**: Verificar que el flujo completo de creación de reseña funcione correctamente.

```javascript
// tests/e2e/reviewFlow.test.js
const { chromium } = require('playwright');

describe('Review Flow E2E', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  test('debería permitir crear una reseña exitosamente', async () => {
    // Arrange
    // Iniciar sesión como cliente
    await page.goto('http://localhost:3000/login');
    await page.fill('[data-testid="email-input"]', 'cliente@test.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Ir a la página de servicios completados
    await page.goto('http://localhost:3000/cliente/servicios');
    
    // Act
    // Hacer clic en el botón de reseñar para un servicio completado
    await page.click('[data-testid="review-button-1"]');
    
    // Seleccionar 5 estrellas
    await page.click('[data-testid="star-5"]');
    
    // Escribir un comentario
    await page.fill('[data-testid="comment-input"]', 'Excelente servicio, muy recomendado');
    
    // Subir una imagen
    await page.setInputFiles('[data-testid="image-upload"]', 'test-image.jpg');
    
    // Enviar la reseña
    await page.click('[data-testid="submit-review-button"]');
    
    // Assert
    // Verificar que se muestra un mensaje de éxito
    await page.waitForSelector('[data-testid="success-message"]');
    const successMessage = await page.textContent('[data-testid="success-message"]');
    expect(successMessage).toContain('Reseña enviada exitosamente');
    
    // Verificar que la reseña aparece en la lista de reseñas
    await page.goto('http://localhost:3000/cliente/resenas');
    await page.waitForSelector('[data-testid="review-list"]');
    const reviewText = await page.textContent('[data-testid="review-1"]');
    expect(reviewText).toContain('Excelente servicio, muy recomendado');
  });
});
```

## Configuración de las Pruebas

### Backend

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/index.js',
    '!src/server.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/?(*.)(spec|test).{js,jsx}'
  ]
};
```

```javascript
// tests/setup.js
const { PrismaClient } = require('@prisma/client');

// Mock de Prisma para todas las pruebas
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    // Añadir otros métodos que necesites mockear
  };
  return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

// Configuración global para todas las pruebas
beforeAll(async () => {
  // Configuraciones que se ejecutan antes de todas las pruebas
});

afterAll(async () => {
  // Configuraciones que se ejecutan después de todas las pruebas
});
```

### Frontend

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  testMatch: [
    '<rootDir>/src/**/?(*.)(spec|test).{js,jsx}'
  ]
};
```

```javascript
// src/tests/setup.js
import 'jest-dom/extend-expect';

// Configuración global para todas las pruebas
beforeAll(() => {
  // Configuraciones que se ejecutan antes de todas las pruebas
});

afterAll(() => {
  // Configuraciones que se ejecutan después de todas las pruebas
});
```

## Cobertura de Pruebas

La cobertura de pruebas debe incluir:

- **Funcionalidad principal**: Al menos el 90% del código
- **Casos de borde**: Escenarios poco frecuentes pero posibles
- **Casos de error**: Situaciones de error y cómo se manejan

Para medir la cobertura de pruebas, se puede utilizar:

- **Backend**: Istanbul (JaCoCo para Java, pero existe un equivalente para Node.js)
- **Frontend**: jest coverage o similar

## Conclusión

Las pruebas son una parte esencial del desarrollo de software y deben ser una prioridad en el proyecto. Las pruebas unitarias, de integración y end-to-end garantizan que el sistema funcione correctamente en diferentes niveles y detecten problemas temprano en el proceso de desarrollo.

La estrategia de pruebas propuesta cubre todos los aspectos importantes del Sistema de Reseñas y Valoraciones, desde funciones individuales hasta flujos completos de usuario. Implementar estas pruebas ayudará a garantizar la calidad y robustez del sistema.