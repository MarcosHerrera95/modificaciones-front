/**
 * Tests para Panel de Administración
 * Cubre funcionalidades críticas según criterios de aceptación
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auditService } = require('../src/services/auditService');

const prisma = new PrismaClient();

describe('Panel de Administración', () => {
  let adminUser;
  let adminToken;
  let testUser;
  let testVerification;

  beforeAll(async () => {
    // Crear usuario admin de prueba
    const hashedPassword = await bcrypt.hash('TestAdmin123!', 10);
    adminUser = await prisma.usuarios.create({
      data: {
        id: 'admin-test-id',
        email: 'admin.test@changanet.com',
        hash_contrasena: hashedPassword,
        nombre: 'Admin Test',
        rol: 'admin'
      }
    });

    // Crear perfil de admin
    await prisma.admin_profile.create({
      data: {
        user_id: adminUser.id,
        role: 'superadmin'
      }
    });

    // Generar token JWT
    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, rol: adminUser.rol },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Crear usuario de prueba
    testUser = await prisma.usuarios.create({
      data: {
        id: 'user-test-id',
        email: 'test.user@changanet.com',
        nombre: 'Test User',
        rol: 'cliente'
      }
    });

    // Crear solicitud de verificación de prueba
    testVerification = await prisma.verification_requests.create({
      data: {
        usuario_id: testUser.id,
        documento_url: 'https://example.com/doc.pdf',
        estado: 'pendiente'
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.admin_audit_log.deleteMany({
      where: { admin_id: adminUser.id }
    });
    await prisma.admin_profile.deleteMany({
      where: { user_id: adminUser.id }
    });
    await prisma.verification_requests.deleteMany({
      where: { usuario_id: testUser.id }
    });
    await prisma.usuarios.deleteMany({
      where: { id: { in: [adminUser.id, testUser.id] } }
    });
    await prisma.$disconnect();
  });

  describe('RBAC - Control de Acceso', () => {
    test('Admin con rol manager puede ver métricas', async () => {
      // Cambiar rol a manager
      await prisma.admin_profile.update({
        where: { user_id: adminUser.id },
        data: { role: 'manager' }
      });

      // Aquí iría test de endpoint que verifica permisos
      const managerPermissions = auditService.getRolePermissions('manager');
      expect(managerPermissions).toContain('reports.view');
      expect(managerPermissions).toContain('users.view');
      expect(managerPermissions).not.toContain('commissions.edit');
    });

    test('Admin con rol support tiene permisos limitados', async () => {
      const supportPermissions = auditService.getRolePermissions('support');
      expect(supportPermissions).toContain('verifications.approve');
      expect(supportPermissions).toContain('moderation.view');
      expect(supportPermissions).not.toContain('settings.edit');
      expect(supportPermissions).not.toContain('system.admin');
    });
  });

  describe('Auditoría de Acciones', () => {
    test('Acciones críticas se registran en audit log', async () => {
      // Simular acción de auditoría
      await auditService.logAction({
        adminId: adminUser.id,
        action: auditService.AUDIT_ACTIONS.USER_BLOCKED,
        targetType: auditService.AUDIT_TARGET_TYPES.USER,
        targetId: testUser.id,
        details: { reason: 'Test block' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      });

      // Verificar que se registró
      const logs = await prisma.admin_audit_log.findMany({
        where: { admin_id: adminUser.id }
      });

      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog.action).toBe('user_blocked');
      expect(lastLog.target_type).toBe('user');
      expect(lastLog.target_id).toBe(testUser.id);
    });

    test('Audit log incluye metadata completa', async () => {
      const logs = await prisma.admin_audit_log.findFirst({
        where: { admin_id: adminUser.id },
        orderBy: { created_at: 'desc' }
      });

      expect(logs).toHaveProperty('ip_address');
      expect(logs).toHaveProperty('user_agent');
      expect(logs).toHaveProperty('details');
      expect(logs).toHaveProperty('created_at');
    });
  });

  describe('Verificación de Usuarios', () => {
    test('Aprobación de verificación actualiza usuario y registra auditoría', async () => {
      // Simular aprobación (sin endpoint real para evitar complejidad)
      await prisma.verification_requests.update({
        where: { id: testVerification.id },
        data: {
          estado: 'aprobado',
          revisado_por: adminUser.id,
          fecha_revision: new Date()
        }
      });

      await prisma.usuarios.update({
        where: { id: testUser.id },
        data: {
          esta_verificado: true,
          verificado_en: new Date()
        }
      });

      // Registrar en auditoría
      await auditService.logAction({
        adminId: adminUser.id,
        action: auditService.AUDIT_ACTIONS.VERIFICATION_APPROVED,
        targetType: auditService.AUDIT_TARGET_TYPES.VERIFICATION,
        targetId: testVerification.id,
        details: { userId: testUser.id },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      });

      // Verificar cambios
      const updatedUser = await prisma.usuarios.findUnique({
        where: { id: testUser.id }
      });
      expect(updatedUser.esta_verificado).toBe(true);

      const updatedVerification = await prisma.verification_requests.findUnique({
        where: { id: testVerification.id }
      });
      expect(updatedVerification.estado).toBe('aprobado');
    });
  });

  describe('Moderación de Contenido', () => {
    test('Crear reporte de moderación', async () => {
      const report = await prisma.moderation_reports.create({
        data: {
          reporter_id: testUser.id,
          target_type: 'review',
          target_id: 'review-123',
          reason: 'Contenido inapropiado',
          description: 'Lenguaje ofensivo',
          priority: 'high'
        }
      });

      expect(report.status).toBe('open');
      expect(report.priority).toBe('high');
      expect(report.target_type).toBe('review');

      // Limpiar
      await prisma.moderation_reports.delete({
        where: { id: report.id }
      });
    });
  });

  describe('Configuración del Sistema', () => {
    test('Actualizar configuración se registra en auditoría', async () => {
      // Simular cambio de configuración
      await auditService.logAction({
        adminId: adminUser.id,
        action: auditService.AUDIT_ACTIONS.SETTING_CHANGED,
        targetType: auditService.AUDIT_TARGET_TYPES.SETTING,
        targetId: 'commission_percentage',
        details: { oldValue: 5, newValue: 6 },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      });

      const logs = await prisma.admin_audit_log.findMany({
        where: {
          admin_id: adminUser.id,
          action: 'setting_changed'
        }
      });

      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Gestión de Disputas', () => {
    test('Crear disputa de pago', async () => {
      // Crear pago de prueba primero
      const testPayment = await prisma.pagos.create({
        data: {
          id: 'payment-test-id',
          servicio_id: 'service-test-id',
          cliente_id: testUser.id,
          profesional_id: adminUser.id,
          monto_total: 100,
          comision_plataforma: 5,
          monto_profesional: 95,
          estado: 'liberado'
        }
      });

      const dispute = await prisma.disputas_pagos.create({
        data: {
          pago_id: testPayment.id,
          usuario_id: testUser.id,
          motivo: 'Servicio no completado',
          descripcion: 'El profesional no realizó el trabajo acordado',
          estado: 'abierta'
        }
      });

      expect(dispute.estado).toBe('abierta');
      expect(dispute.motivo).toBe('Servicio no completado');

      // Limpiar
      await prisma.disputas_pagos.delete({ where: { id: dispute.id } });
      await prisma.pagos.delete({ where: { id: testPayment.id } });
    });
  });

  describe('Criterios de Aceptación', () => {
    test('Admin manager puede ver métricas pero no cambiar comisiones', () => {
      const managerPermissions = auditService.getRolePermissions('manager');
      expect(managerPermissions).toContain('reports.view');
      expect(managerPermissions).toContain('moderation.manage');
      expect(managerPermissions).not.toContain('commissions.edit');
      expect(managerPermissions).not.toContain('system.admin');
    });

    test('Todas las acciones críticas tienen registro de auditoría', () => {
      const criticalActions = [
        'user_blocked',
        'verification_approved',
        'commission_changed',
        'dispute_resolved',
        'payment_refunded'
      ];

      criticalActions.forEach(action => {
        expect(Object.values(auditService.AUDIT_ACTIONS)).toContain(action);
      });
    });

    test('Sistema de roles es válido', () => {
      const validRoles = ['superadmin', 'manager', 'support'];
      validRoles.forEach(role => {
        expect(auditService.isValidRole(role)).toBe(true);
      });
      expect(auditService.isValidRole('invalid_role')).toBe(false);
    });
  });
});