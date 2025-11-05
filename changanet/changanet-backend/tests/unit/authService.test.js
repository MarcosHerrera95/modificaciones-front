/**
 * Pruebas unitarias para authService.js
 * Cubre: REQ-01, REQ-02, REQ-03 (Autenticación)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authService = require('../../src/services/authService');

jest.mock('@prisma/client');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockPrisma = {
  usuarios: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

PrismaClient.mockImplementation(() => mockPrisma);

describe('Auth Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserWithEmailAndPassword', () => {
    test('debe crear usuario exitosamente', async () => {
      const mockUser = {
        uid: 'firebase-uid',
        email: 'test@example.com',
        displayName: 'Test User'
      };

      mockPrisma.usuarios.create.mockResolvedValue(mockUser);

      const result = await authService.createUserWithEmailAndPassword(
        'test@example.com',
        'password123',
        'Test User'
      );

      expect(result).toEqual(mockUser);
      expect(mockPrisma.usuarios.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          hash_contrasena: 'password123',
          nombre: 'Test User',
          esta_verificado: false,
        }
      });
    });

    test('debe manejar errores de creación', async () => {
      mockPrisma.usuarios.create.mockRejectedValue(new Error('Database error'));

      await expect(
        authService.createUserWithEmailAndPassword('test@example.com', 'password123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getUserByEmail', () => {
    test('debe retornar usuario por email', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      mockPrisma.usuarios.findUnique.mockResolvedValue(mockUser);

      const result = await authService.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.usuarios.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
    });

    test('debe retornar null si usuario no existe', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);

      const result = await authService.getUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });
});