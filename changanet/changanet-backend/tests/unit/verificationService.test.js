/**
 * Pruebas unitarias para verificationService.js
 * Cubre: REQ-36, REQ-37, REQ-40, RB-05 (Verificación de identidad)
 */

const { PrismaClient } = require('@prisma/client');
const verificationService = require('../../src/services/verificationService');
const { storageService } = require('../../src/services/storageService');

jest.mock('@prisma/client');
jest.mock('../../src/services/storageService');

const mockPrisma = {
  usuarios: {
    findUnique: jest.fn(),
  },
  perfiles_profesionales: {
    update: jest.fn(),
  },
  verification_requests: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

PrismaClient.mockImplementation(() => mockPrisma);

describe('Verification Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storageService.uploadDocument = jest.fn();
  });

  describe('createVerificationRequest', () => {
    test('debe crear solicitud de verificación exitosamente', async () => {
      const mockUser = {
        id: 'user-123',
        rol: 'profesional',
        perfil_profesional: { id: 'profile-123' }
      };

      const mockDocumentUrl = 'https://cloudinary.com/document.jpg';
      const mockVerificationRequest = {
        id: 'verification-123',
        usuario_id: 'user-123',
        documento_url: mockDocumentUrl,
        estado: 'pendiente'
      };

      mockPrisma.usuarios.findUnique.mockResolvedValue(mockUser);
      storageService.uploadDocument.mockResolvedValue(mockDocumentUrl);
      mockPrisma.verification_requests.create.mockResolvedValue(mockVerificationRequest);

      const result = await verificationService.createVerificationRequest(
        'user-123',
        Buffer.from('document content'),
        'document.jpg',
        'image/jpeg'
      );

      expect(result).toEqual(mockVerificationRequest);
      expect(storageService.uploadDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'document.jpg',
        'image/jpeg',
        'user-123'
      );
    });

    test('debe rechazar usuario no profesional', async () => {
      const mockUser = {
        id: 'user-123',
        rol: 'cliente'
      };

      mockPrisma.usuarios.findUnique.mockResolvedValue(mockUser);

      await expect(
        verificationService.createVerificationRequest(
          'user-123',
          Buffer.from('document'),
          'document.jpg',
          'image/jpeg'
        )
      ).rejects.toThrow('Solo los profesionales pueden solicitar verificación');
    });

    test('debe rechazar solicitud duplicada pendiente', async () => {
      const mockUser = {
        id: 'user-123',
        rol: 'profesional'
      };

      const mockExistingRequest = {
        id: 'verification-123',
        estado: 'pendiente'
      };

      mockPrisma.usuarios.findUnique.mockResolvedValue(mockUser);
      mockPrisma.verification_requests.findUnique.mockResolvedValue(mockExistingRequest);

      await expect(
        verificationService.createVerificationRequest(
          'user-123',
          Buffer.from('document'),
          'document.jpg',
          'image/jpeg'
        )
      ).rejects.toThrow('Ya existe una solicitud de verificación pendiente');
    });

    test('debe rechazar solicitud de usuario ya verificado', async () => {
      const mockUser = {
        id: 'user-123',
        rol: 'profesional'
      };

      const mockExistingRequest = {
        id: 'verification-123',
        estado: 'aprobado'
      };

      mockPrisma.usuarios.findUnique.mockResolvedValue(mockUser);
      mockPrisma.verification_requests.findUnique.mockResolvedValue(mockExistingRequest);

      await expect(
        verificationService.createVerificationRequest(
          'user-123',
          Buffer.from('document'),
          'document.jpg',
          'image/jpeg'
        )
      ).rejects.toThrow('El usuario ya está verificado');
    });
  });

  describe('approveVerification', () => {
    test('debe aprobar solicitud exitosamente', async () => {
      const mockRequest = {
        id: 'verification-123',
        usuario_id: 'user-123',
        estado: 'pendiente',
        usuario: { id: 'user-123' }
      };

      const mockUpdatedRequest = {
        id: 'verification-123',
        estado: 'aprobado',
        revisado_en: new Date(),
        revisado_por: 'admin-123'
      };

      mockPrisma.verification_requests.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.verification_requests.update.mockResolvedValue(mockUpdatedRequest);

      const result = await verificationService.approveVerification('verification-123', 'admin-123', 'Documento válido');

      expect(result).toEqual(mockUpdatedRequest);
      expect(mockPrisma.perfiles_profesionales.update).toHaveBeenCalledWith({
        where: { usuario_id: 'user-123' },
        data: {
          estado_verificacion: 'verificado',
          verificado_en: expect.any(Date)
        }
      });
      expect(mockPrisma.usuarios.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { esta_verificado: true }
      });
    });

    test('debe rechazar aprobación de solicitud ya procesada', async () => {
      const mockRequest = {
        id: 'verification-123',
        estado: 'aprobado'
      };

      mockPrisma.verification_requests.findUnique.mockResolvedValue(mockRequest);

      await expect(
        verificationService.approveVerification('verification-123', 'admin-123')
      ).rejects.toThrow('La solicitud ya fue procesada');
    });
  });

  describe('rejectVerification', () => {
    test('debe rechazar solicitud con comentario', async () => {
      const mockRequest = {
        id: 'verification-123',
        usuario_id: 'user-123',
        estado: 'pendiente',
        usuario: { id: 'user-123' }
      };

      const mockUpdatedRequest = {
        id: 'verification-123',
        estado: 'rechazado',
        comentario_admin: 'Documento ilegible',
        revisado_en: new Date(),
        revisado_por: 'admin-123'
      };

      mockPrisma.verification_requests.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.verification_requests.update.mockResolvedValue(mockUpdatedRequest);

      const result = await verificationService.rejectVerification('verification-123', 'admin-123', 'Documento ilegible');

      expect(result).toEqual(mockUpdatedRequest);
      expect(mockPrisma.perfiles_profesionales.update).toHaveBeenCalledWith({
        where: { usuario_id: 'user-123' },
        data: { estado_verificacion: 'rechazado' }
      });
    });

    test('debe rechazar solicitud sin comentario', async () => {
      const mockRequest = {
        id: 'verification-123',
        estado: 'pendiente'
      };

      mockPrisma.verification_requests.findUnique.mockResolvedValue(mockRequest);

      await expect(
        verificationService.rejectVerification('verification-123', 'admin-123', '')
      ).rejects.toThrow('Se requiere un comentario explicando el rechazo');
    });
  });

  describe('getVerificationStatus', () => {
    test('debe retornar estado de solicitud existente', async () => {
      const mockRequest = {
        id: 'verification-123',
        estado: 'pendiente',
        documento_url: 'https://cloudinary.com/doc.jpg',
        comentario_admin: null,
        creado_en: new Date(),
        revisado_en: null
      };

      mockPrisma.verification_requests.findUnique.mockResolvedValue(mockRequest);

      const result = await verificationService.getVerificationStatus('user-123');

      expect(result).toEqual({
        id: 'verification-123',
        estado: 'pendiente',
        documento_url: 'https://cloudinary.com/doc.jpg',
        comentario_admin: null,
        creado_en: expect.any(Date),
        revisado_en: null,
        revisado_por: undefined
      });
    });

    test('debe retornar estado "no_solicitado" para usuario sin solicitud', async () => {
      mockPrisma.verification_requests.findUnique.mockResolvedValue(null);

      const result = await verificationService.getVerificationStatus('user-123');

      expect(result).toEqual({
        estado: 'no_solicitado',
        documento_url: null,
        comentario_admin: null,
        creado_en: null,
        revisado_en: null
      });
    });
  });
});