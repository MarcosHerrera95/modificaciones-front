/**
 * @archivo tests/unit/components/UrgentRequestForm.test.jsx
 * @descripción Pruebas unitarias para UrgentRequestForm component
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests unitarios para componente de formulario de solicitud urgente
 * @impacto Social: Validación de interfaz de usuario para emergencias
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import UrgentRequestForm from '../../../src/components/UrgentRequestForm';

// Mock del contexto
const mockUrgentContext = {
  createUrgentRequest: jest.fn(),
  loading: false,
  error: null
};

jest.mock('../../../src/context/UrgentContext', () => ({
  useUrgent: () => mockUrgentContext
}));

// Mock de Google Maps
jest.mock('@googlemaps/js-api-loader', () => ({
  Loader: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue({
      maps: {
        Map: jest.fn().mockImplementation(() => ({
          setCenter: jest.fn(),
          setZoom: jest.fn()
        })),
        Marker: jest.fn().mockImplementation(() => ({
          setPosition: jest.fn(),
          setMap: jest.fn()
        })),
        Geocoder: jest.fn().mockImplementation(() => ({
          geocode: jest.fn().mockImplementation(({ address }, callback) => {
            callback([
              {
                geometry: {
                  location: {
                    lat: () => -34.6118,
                    lng: () => -58.3960
                  }
                }
              }
            ], 'OK');
          })
        }))
      }
    })
  }))
}));

describe('UrgentRequestForm - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.google
    global.google = {
      maps: {
        Map: jest.fn().mockImplementation(() => ({
          setCenter: jest.fn(),
          setZoom: jest.fn()
        })),
        Marker: jest.fn().mockImplementation(() => ({
          setPosition: jest.fn(),
          setMap: jest.fn()
        })),
        Geocoder: jest.fn().mockImplementation(() => ({
          geocode: jest.fn().mockImplementation(({ address }, callback) => {
            callback([
              {
                geometry: {
                  location: {
                    lat: () => -34.6118,
                    lng: () => -58.3960
                  }
                }
              }
            ], 'OK');
          })
        }))
      }
    };
  });

  afterEach(() => {
    delete global.google;
  });

  describe('Component Rendering', () => {
    test('should render form with all required fields', () => {
      render(<UrgentRequestForm />);

      expect(screen.getByText('Solicitar Servicio Urgente')).toBeInTheDocument();
      expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ubicación/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/radio/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /solicitar servicio urgente/i })).toBeInTheDocument();
    });

    test('should show loading state', () => {
      mockUrgentContext.loading = true;

      render(<UrgentRequestForm />);

      expect(screen.getByText('Procesando...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /procesando/i })).toBeDisabled();
    });

    test('should display error message', () => {
      mockUrgentContext.error = 'Error al crear solicitud';

      render(<UrgentRequestForm />);

      expect(screen.getByText('Error al crear solicitud')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('should validate required description', async () => {
      render(<UrgentRequestForm />);

      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('La descripción es obligatoria')).toBeInTheDocument();
      });
    });

    test('should validate description length', async () => {
      render(<UrgentRequestForm />);

      const descriptionInput = screen.getByLabelText(/descripción/i);
      fireEvent.change(descriptionInput, { target: { value: 'A' } });

      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('La descripción debe tener al menos 10 caracteres')).toBeInTheDocument();
      });
    });

    test('should validate location input', async () => {
      render(<UrgentRequestForm />);

      const locationInput = screen.getByLabelText(/ubicación/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      // Empty location
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('La ubicación es obligatoria')).toBeInTheDocument();
      });

      // Invalid location format
      fireEvent.change(locationInput, { target: { value: 'invalid location' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Ingrese una dirección válida')).toBeInTheDocument();
      });
    });

    test('should validate radius range', async () => {
      render(<UrgentRequestForm />);

      const radiusInput = screen.getByLabelText(/radio/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      // Radius too small
      fireEvent.change(radiusInput, { target: { value: '0' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('El radio debe estar entre 1 y 50 km')).toBeInTheDocument();
      });

      // Radius too large
      fireEvent.change(radiusInput, { target: { value: '60' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('El radio debe estar entre 1 y 50 km')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    test('should submit form with valid data', async () => {
      mockUrgentContext.createUrgentRequest.mockResolvedValue({
        id: 'request-123',
        status: 'pending'
      });

      render(<UrgentRequestForm />);

      // Fill form
      const descriptionInput = screen.getByLabelText(/descripción/i);
      const locationInput = screen.getByLabelText(/ubicación/i);
      const radiusInput = screen.getByLabelText(/radio/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      fireEvent.change(descriptionInput, {
        target: { value: 'Fuga de agua en la cocina, muy urgente' }
      });
      fireEvent.change(locationInput, {
        target: { value: 'Av. Corrientes 1234, Buenos Aires' }
      });
      fireEvent.change(radiusInput, { target: { value: '5' } });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockUrgentContext.createUrgentRequest).toHaveBeenCalledWith({
          description: 'Fuga de agua en la cocina, muy urgente',
          location: { lat: -34.6118, lng: -58.3960 },
          radiusKm: 5,
          serviceCategory: undefined
        });
      });
    });

    test('should handle submission success', async () => {
      mockUrgentContext.createUrgentRequest.mockResolvedValue({
        id: 'request-123',
        status: 'pending'
      });

      render(<UrgentRequestForm />);

      // Fill and submit form
      const descriptionInput = screen.getByLabelText(/descripción/i);
      const locationInput = screen.getByLabelText(/ubicación/i);
      const radiusInput = screen.getByLabelText(/radio/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      fireEvent.change(descriptionInput, { target: { value: 'Fuga de agua urgente' } });
      fireEvent.change(locationInput, { target: { value: 'Test address' } });
      fireEvent.change(radiusInput, { target: { value: '5' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('¡Solicitud urgente creada exitosamente!')).toBeInTheDocument();
      });
    });

    test('should handle submission error', async () => {
      mockUrgentContext.createUrgentRequest.mockRejectedValue(
        new Error('Error al crear solicitud')
      );

      render(<UrgentRequestForm />);

      // Fill and submit form
      const descriptionInput = screen.getByLabelText(/descripción/i);
      const locationInput = screen.getByLabelText(/ubicación/i);
      const radiusInput = screen.getByLabelText(/radio/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      fireEvent.change(descriptionInput, { target: { value: 'Fuga de agua urgente' } });
      fireEvent.change(locationInput, { target: { value: 'Test address' } });
      fireEvent.change(radiusInput, { target: { value: '5' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Error al crear solicitud')).toBeInTheDocument();
      });
    });
  });

  describe('Location Handling', () => {
    test('should geocode address on location change', async () => {
      render(<UrgentRequestForm />);

      const locationInput = screen.getByLabelText(/ubicación/i);

      fireEvent.change(locationInput, {
        target: { value: 'Av. Corrientes 1234, Buenos Aires' }
      });

      // Wait for geocoding
      await waitFor(() => {
        expect(global.google.maps.Geocoder).toHaveBeenCalled();
      });
    });

    test('should handle geocoding errors', async () => {
      // Mock geocoding failure
      global.google.maps.Geocoder = jest.fn().mockImplementation(() => ({
        geocode: jest.fn().mockImplementation((request, callback) => {
          callback([], 'ZERO_RESULTS');
        })
      }));

      render(<UrgentRequestForm />);

      const locationInput = screen.getByLabelText(/ubicación/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      fireEvent.change(locationInput, { target: { value: 'Invalid address' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('No se pudo geocodificar la dirección')).toBeInTheDocument();
      });
    });

    test('should update map marker on location change', async () => {
      render(<UrgentRequestForm />);

      const locationInput = screen.getByLabelText(/ubicación/i);

      fireEvent.change(locationInput, {
        target: { value: 'Test location' }
      });

      await waitFor(() => {
        expect(global.google.maps.Marker).toHaveBeenCalled();
      });
    });
  });

  describe('Service Category Selection', () => {
    test('should include service category in submission', async () => {
      mockUrgentContext.createUrgentRequest.mockResolvedValue({
        id: 'request-123',
        status: 'pending'
      });

      render(<UrgentRequestForm />);

      // Assuming there's a service category select
      const categorySelect = screen.getByLabelText(/categoría/i);
      const descriptionInput = screen.getByLabelText(/descripción/i);
      const locationInput = screen.getByLabelText(/ubicación/i);
      const radiusInput = screen.getByLabelText(/radio/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      fireEvent.change(categorySelect, { target: { value: 'plomero' } });
      fireEvent.change(descriptionInput, { target: { value: 'Fuga de agua urgente' } });
      fireEvent.change(locationInput, { target: { value: 'Test address' } });
      fireEvent.change(radiusInput, { target: { value: '5' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockUrgentContext.createUrgentRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            serviceCategory: 'plomero'
          })
        );
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(<UrgentRequestForm />);

      expect(screen.getByLabelText(/descripción/i)).toHaveAttribute('aria-describedby');
      expect(screen.getByLabelText(/ubicación/i)).toHaveAttribute('aria-describedby');
      expect(screen.getByLabelText(/radio/i)).toHaveAttribute('aria-describedby');
    });

    test('should support keyboard navigation', () => {
      render(<UrgentRequestForm />);

      const descriptionInput = screen.getByLabelText(/descripción/i);
      const locationInput = screen.getByLabelText(/ubicación/i);
      const radiusInput = screen.getByLabelText(/radio/i);

      // Tab through form
      descriptionInput.focus();
      expect(document.activeElement).toBe(descriptionInput);

      fireEvent.keyDown(descriptionInput, { key: 'Tab' });
      expect(document.activeElement).toBe(locationInput);

      fireEvent.keyDown(locationInput, { key: 'Tab' });
      expect(document.activeElement).toBe(radiusInput);
    });

    test('should announce form errors to screen readers', async () => {
      render(<UrgentRequestForm />);

      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);
        errorMessages.forEach(error => {
          expect(error).toHaveAttribute('aria-live', 'polite');
        });
      });
    });
  });

  describe('Performance', () => {
    test('should debounce geocoding requests', async () => {
      render(<UrgentRequestForm />);

      const locationInput = screen.getByLabelText(/ubicación/i);

      // Rapid typing
      fireEvent.change(locationInput, { target: { value: 'A' } });
      fireEvent.change(locationInput, { target: { value: 'Av' } });
      fireEvent.change(locationInput, { target: { value: 'Av.' } });
      fireEvent.change(locationInput, { target: { value: 'Av. C' } });

      // Should not call geocode immediately
      expect(global.google.maps.Geocoder).not.toHaveBeenCalled();

      // Wait for debounce
      await waitFor(() => {
        expect(global.google.maps.Geocoder).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });
    });

    test('should not re-render unnecessarily', () => {
      const { rerender } = render(<UrgentRequestForm />);

      const initialRender = screen.getByText('Solicitar Servicio Urgente');

      // Re-render with same props
      rerender(<UrgentRequestForm />);

      // Should be the same element
      expect(screen.getByText('Solicitar Servicio Urgente')).toBe(initialRender);
    });
  });

  describe('Edge Cases', () => {
    test('should handle network errors during geocoding', async () => {
      global.google.maps.Geocoder = jest.fn().mockImplementation(() => ({
        geocode: jest.fn().mockImplementation((request, callback) => {
          callback([], 'ERROR');
        })
      }));

      render(<UrgentRequestForm />);

      const locationInput = screen.getByLabelText(/ubicación/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      fireEvent.change(locationInput, { target: { value: 'Test address' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Error al geocodificar la dirección')).toBeInTheDocument();
      });
    });

    test('should handle very long descriptions', async () => {
      const longDescription = 'A'.repeat(1000);

      render(<UrgentRequestForm />);

      const descriptionInput = screen.getByLabelText(/descripción/i);
      const locationInput = screen.getByLabelText(/ubicación/i);
      const radiusInput = screen.getByLabelText(/radio/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      fireEvent.change(descriptionInput, { target: { value: longDescription } });
      fireEvent.change(locationInput, { target: { value: 'Test address' } });
      fireEvent.change(radiusInput, { target: { value: '5' } });

      // Should handle long text without crashing
      expect(() => {
        fireEvent.click(submitButton);
      }).not.toThrow();
    });

    test('should handle special characters in input', async () => {
      const specialDescription = 'Fuga de agua con símbolos: @#$%^&*()_+{}|:<>?[]\\;\'",./';

      render(<UrgentRequestForm />);

      const descriptionInput = screen.getByLabelText(/descripción/i);
      const locationInput = screen.getByLabelText(/ubicación/i);
      const radiusInput = screen.getByLabelText(/radio/i);

      fireEvent.change(descriptionInput, { target: { value: specialDescription } });
      fireEvent.change(locationInput, { target: { value: 'Test address' } });
      fireEvent.change(radiusInput, { target: { value: '5' } });

      expect(descriptionInput.value).toBe(specialDescription);
    });

    test('should handle form reset after successful submission', async () => {
      mockUrgentContext.createUrgentRequest.mockResolvedValue({
        id: 'request-123',
        status: 'pending'
      });

      render(<UrgentRequestForm />);

      const descriptionInput = screen.getByLabelText(/descripción/i);
      const locationInput = screen.getByLabelText(/ubicación/i);
      const radiusInput = screen.getByLabelText(/radio/i);
      const submitButton = screen.getByRole('button', { name: /solicitar servicio urgente/i });

      // Fill form
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
      fireEvent.change(locationInput, { target: { value: 'Test address' } });
      fireEvent.change(radiusInput, { target: { value: '5' } });

      // Submit
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockUrgentContext.createUrgentRequest).toHaveBeenCalled();
      });

      // Form should be reset
      await waitFor(() => {
        expect(descriptionInput.value).toBe('');
        expect(locationInput.value).toBe('');
        expect(radiusInput.value).toBe('5'); // Default value
      });
    });
  });
});