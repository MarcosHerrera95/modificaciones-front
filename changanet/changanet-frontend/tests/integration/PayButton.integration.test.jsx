/**
 * Pruebas de integración para componente PayButton
 * Cubre: Interacción con API, estados de carga, validaciones, redirección
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import PayButton from '../../src/components/PayButton';

// Mock de secureFetch
jest.mock('../../src/utils/csrf', () => ({
  secureFetch: jest.fn()
}));

// Mock de sessionStorage y localStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
});

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock de window.location
delete window.location;
window.location = { href: '' };

describe('PayButton - Integration Tests', () => {
  const mockSecureFetch = jest.mocked(jest.requireMock('../../src/utils/csrf').secureFetch);

  const defaultProps = {
    amount: 5000,
    description: 'Servicio de plomería',
    serviceId: 'service-123',
    onSuccess: jest.fn(),
    onError: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue('mock-jwt-token');
    mockLocalStorage.getItem.mockReturnValue(null);
    window.location.href = '';
  });

  describe('Renderizado inicial', () => {
    test('debe renderizar correctamente con props básicas', () => {
      render(<PayButton {...defaultProps} />);

      expect(screen.getByText('Pagar con Custodia Segura - $5000')).toBeInTheDocument();
      expect(screen.getByText('🛡️')).toBeInTheDocument();
      expect(screen.getByText('Pago Seguro con Custodia')).toBeInTheDocument();
    });

    test('debe mostrar información de custodia de fondos', () => {
      render(<PayButton {...defaultProps} />);

      expect(screen.getByText('Pago Seguro con Custodia')).toBeInTheDocument();
      expect(screen.getByText(/Tu dinero queda protegido/)).toBeInTheDocument();
      expect(screen.getByText(/Pagas solo cuando estés 100% satisfecho/)).toBeInTheDocument();
    });

    test('debe tener accesibilidad correcta', () => {
      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Pagar.*5000.*plomería/ });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Pagar $5000 por Servicio de plomería');
    });
  });

  describe('Validaciones previas al pago', () => {
    test('debe mostrar error si no hay token de autenticación', async () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(null);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Debes iniciar sesión para realizar un pago')).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith('No autenticado');
    });

    test('debe mostrar error si falta serviceId', async () => {
      render(<PayButton {...defaultProps} serviceId={null} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Se requiere un servicio para procesar el pago')).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith('serviceId requerido');
    });

    test('debe validar monto mínimo', async () => {
      render(<PayButton {...defaultProps} amount={100} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Monto de pago inválido')).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith('Monto inválido');
    });

    test('debe validar monto máximo', async () => {
      render(<PayButton {...defaultProps} amount={1000000} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Monto de pago inválido')).toBeInTheDocument();
      });
    });

    test('debe validar descripción', async () => {
      render(<PayButton {...defaultProps} description="" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Descripción de pago inválida')).toBeInTheDocument();
      });
    });
  });

  describe('Flujo de pago exitoso', () => {
    test('debe procesar pago exitosamente y redirigir a MercadoPago', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: {
            init_point: 'https://mercadopago.com/checkout/test123'
          }
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockSecureFetch).toHaveBeenCalledWith('/api/payments/create-preference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token'
          },
          body: JSON.stringify({
            serviceId: 'service-123',
            amount: 5000,
            description: 'Servicio de plomería'
          })
        });
      });

      await waitFor(() => {
        expect(window.location.href).toBe('https://mercadopago.com/checkout/test123');
      });
    });

    test('debe usar sandbox_init_point en modo desarrollo', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: {
            sandbox_init_point: 'https://sandbox.mercadopago.com/checkout/test123'
          }
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(window.location.href).toBe('https://sandbox.mercadopago.com/checkout/test123');
      });
    });

    test('debe mostrar alerta en modo simulado', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: {
            simulated: true
          }
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Pago procesado exitosamente. Monto: 5000. Tu dinero está seguro en custodia.');
      });

      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });

    test('debe llamar callback onSuccess con datos correctos', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { paymentId: 'test-payment-123' }
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalledWith({ paymentId: 'test-payment-123' });
      });
    });
  });

  describe('Manejo de errores', () => {
    test('debe mostrar error de conexión', async () => {
      mockSecureFetch.mockRejectedValue(new Error('Network error'));

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Error de conexión. Inténtalo de nuevo.')).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalled();
    });

    test('debe mostrar error del servidor', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Servicio no encontrado'
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Servicio no encontrado')).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith('Servicio no encontrado');
    });

    test('debe manejar errores de respuesta JSON inválida', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Error de conexión. Inténtalo de nuevo.')).toBeInTheDocument();
      });
    });
  });

  describe('Estados de carga y UX', () => {
    test('debe mostrar estado de carga durante el procesamiento', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { init_point: 'https://mercadopago.com/test' }
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Debe mostrar loading state
      expect(screen.getByText('Procesando pago...')).toBeInTheDocument();
      expect(button).toBeDisabled();

      await waitFor(() => {
        expect(window.location.href).toBe('https://mercadopago.com/test');
      });
    });

    test('debe deshabilitar botón durante procesamiento', async () => {
      const mockResponse = new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({
            success: true,
            data: { init_point: 'https://mercadopago.com/test' }
          })
        }), 100);
      });

      mockSecureFetch.mockReturnValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50');

      await waitFor(() => {
        expect(window.location.href).toBe('https://mercadopago.com/test');
      });
    });

    test('debe limpiar errores anteriores al intentar nuevo pago', async () => {
      // Primer intento falla
      const errorResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Error inicial' })
      };

      mockSecureFetch.mockResolvedValueOnce(errorResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Error inicial')).toBeInTheDocument();
      });

      // Segundo intento exitoso
      const successResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { init_point: 'https://mercadopago.com/test' }
        })
      };

      mockSecureFetch.mockResolvedValue(successResponse);

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByText('Error inicial')).not.toBeInTheDocument();
      });
    });
  });

  describe('Autenticación y tokens', () => {
    test('debe usar token de sessionStorage preferentemente', async () => {
      mockSessionStorage.getItem.mockReturnValue('session-token');
      mockLocalStorage.getItem.mockReturnValue('local-token');

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { init_point: 'https://mercadopago.com/test' }
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockSecureFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer session-token'
            })
          })
        );
      });
    });

    test('debe usar token de localStorage como fallback', async () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue('local-token');

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { init_point: 'https://mercadopago.com/test' }
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockSecureFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer local-token'
            })
          })
        );
      });
    });
  });

  describe('Validaciones de seguridad', () => {
    test('debe prevenir inyección de scripts en descripción', async () => {
      const maliciousDescription = '<script>alert("xss")</script>Servicio legítimo';

      render(<PayButton {...defaultProps} description={maliciousDescription} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockSecureFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({
              serviceId: 'service-123',
              amount: 5000,
              description: maliciousDescription
            })
          })
        );
      });
    });

    test('debe validar formato de serviceId', async () => {
      const invalidServiceIds = [
        '../../../etc/passwd',
        'service<script>alert(1)</script>',
        'service\nDROP TABLE users',
        'service\x00nullbyte'
      ];

      for (const invalidId of invalidServiceIds) {
        render(<PayButton {...defaultProps} serviceId={invalidId} />);

        const button = screen.getByRole('button');
        fireEvent.click(button);

        await waitFor(() => {
          expect(screen.getByText('Se requiere un servicio para procesar el pago')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Casos límite y edge cases', () => {
    test('debe manejar montos con decimales', async () => {
      const decimalAmounts = [5000.50, 2500.99, 100.01];

      for (const amount of decimalAmounts) {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            success: true,
            data: { init_point: 'https://mercadopago.com/test' }
          })
        };

        mockSecureFetch.mockResolvedValue(mockResponse);

        render(<PayButton {...defaultProps} amount={amount} />);

        const button = screen.getByRole('button');
        fireEvent.click(button);

        await waitFor(() => {
          expect(mockSecureFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              body: JSON.stringify({
                serviceId: 'service-123',
                amount,
                description: 'Servicio de plomería'
              })
            })
          );
        });
      }
    });

    test('debe manejar props opcionales faltantes', () => {
      const { onSuccess: _onSuccess, onError: _onError, ...minimalProps } = defaultProps;

      expect(() => {
        render(<PayButton {...minimalProps} />);
      }).not.toThrow();

      expect(screen.getByText('Pagar con Custodia Segura - $5000')).toBeInTheDocument();
    });

    test('debe manejar múltiples clicks consecutivos', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { init_point: 'https://mercadopago.com/test' }
        })
      };

      mockSecureFetch.mockResolvedValue(mockResponse);

      render(<PayButton {...defaultProps} />);

      const button = screen.getByRole('button');

      // Múltiples clicks
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Solo debe hacer una llamada
      await waitFor(() => {
        expect(mockSecureFetch).toHaveBeenCalledTimes(1);
      });
    });
  });
});