/**
 * Tests para el servicio de auditoría
 * REQ-36 a REQ-40: Sistema de verificación de identidad y reputación
 */

const { PrismaClient } = require('@prisma/client');
const { logAction, logVerificationSubmitted, logVerificationApproved } = require('../services/auditService');

const prisma = new PrismaClient();

describe('Audit Service', () => {
  beforeAll(async () => {
    // Crear usuario de prueba
    await prisma.usuarios.upsert({
      where: { email: 'test-audit@example.com' },
      update: {},
      create: {
        id: 'test-audit-user',
        email: 'test-audit@example.com',
        nombre: 'Usuario Test Audit',
        hash_contrasena: 'hashed_password'
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.audit_log.deleteMany({
      where: { user_id: 'test-audit-user' }
    });
    await prisma.usuarios.deleteMany({
      where: { email: 'test-audit@example.com' }
    });
    await prisma.$disconnect();
  });

  describe('logAction', () => {
    test('debe registrar una acción básica', async () => {
      const actionData = {
        userId: 'test-audit-user',
        action: 'test_action',
        resource: 'test_resource',
        resourceId: 'test-resource-123',
        details: { test: 'data' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      };

      await logAction(actionData);

      // Verificar que se creó el registro
      const auditLog = await prisma.audit_log.findFirst({
        where: {
          user_id: 'test-audit-user',
          action: 'test_action',
          resource: 'test_resource'
        }
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.resource_id).toBe('test-resource-123');
      expect(JSON.parse(auditLog.details)).toEqual({ test: 'data' });
      expect(auditLog.ip_address).toBe('127.0.0.1');
      expect(auditLog.user_agent).toBe('Test Agent');
    });

    test('debe sanitizar inputs largos', async () => {
      const longString = 'a'.repeat(1000);
      const actionData = {
        userId: 'test-audit-user',
        action: longString,
        resource: longString,
        details: { longData: longString }
      };

      await logAction(actionData);

      const auditLog = await prisma.audit_log.findFirst({
        where: { user_id: 'test-audit-user' },
        orderBy: { created_at: 'desc' }
      });

      expect(auditLog.action.length).toBeLessThanOrEqual(50);
      expect(auditLog.resource.length).toBeLessThanOrEqual(50);
      expect(auditLog.details.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('Funciones específicas de auditoría', () => {
    test('logVerificationSubmitted debe registrar correctamente', async () => {
      await logVerificationSubmitted(
        'test-audit-user',
        'verification-123',
        'dni',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const auditLog = await prisma.audit_log.findFirst({
        where: {
          user_id: 'test-audit-user',
          action: 'verification_submitted',
          resource: 'identity_verification'
        },
        orderBy: { created_at: 'desc' }
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.resource_id).toBe('verification-123');
      const details = JSON.parse(auditLog.details);
      expect(details.document_type).toBe('dni');
    });

    test('logVerificationApproved debe registrar correctamente', async () => {
      await logVerificationApproved(
        'test-audit-user',
        'verification-123',
        'target-user-456',
        'Aprobado correctamente',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const auditLog = await prisma.audit_log.findFirst({
        where: {
          user_id: 'test-audit-user',
          action: 'verification_approved',
          resource: 'identity_verification'
        },
        orderBy: { created_at: 'desc' }
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.resource_id).toBe('verification-123');
      const details = JSON.parse(auditLog.details);
      expect(details.target_user_id).toBe('target-user-456');
      expect(details.review_notes).toBe('Aprobado correctamente');
    });
  });

  describe('Manejo de errores', () => {
    test('debe manejar errores sin fallar la operación principal', async () => {
      // Forzar un error pasando datos inválidos
      await expect(logAction({
        action: null, // Esto causará un error
        resource: 'test'
      })).resolves.not.toThrow();

      // Verificar que no se creó ningún registro
      const count = await prisma.audit_log.count({
        where: { action: null }
      });
      expect(count).toBe(0);
    });
  });
});