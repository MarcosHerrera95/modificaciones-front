#!/usr/bin/env node

/**
 * Script de Verificación Completa del Sistema de Pagos
 * Este script verifica que todas las funcionalidades del sistema de pagos estén funcionando correctamente
 */

const { PrismaClient } = require('@prisma/client');
const paymentService = require('./src/services/paymentsService');

const prisma = new PrismaClient();

class PaymentSystemVerifier {
  constructor() {
    this.testResults = [];
    this.errors = [];
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async addTestResult(testName, success, message = '') {
    this.testResults.push({ testName, success, message });
    if (success) {
      await this.log(`${testName}: ${message}`, 'success');
    } else {
      await this.log(`${testName}: ${message}`, 'error');
      this.errors.push(`${testName}: ${message}`);
    }
  }

  async verifyDatabaseConnection() {
    try {
      await prisma.$connect();
      await this.addTestResult('Conexión a Base de Datos', true, 'Conectado exitosamente');
      return true;
    } catch (error) {
      await this.addTestResult('Conexión a Base de Datos', false, error.message);
      return false;
    }
  }

  async verifyTablesExist() {
    try {
      // Verificar que las tablas principales existan
      const tableChecks = await Promise.all([
        prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='pagos'`,
        prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='eventos_pagos'`,
        prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='disputas_pagos'`,
        prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='servicios'`,
        prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'`
      ]);

      const expectedTables = ['pagos', 'eventos_pagos', 'disputas_pagos', 'servicios', 'usuarios'];
      const existingTables = tableChecks.map(check => check[0]?.name).filter(Boolean);

      const missingTables = expectedTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length === 0) {
        await this.addTestResult('Existencia de Tablas', true, 'Todas las tablas necesarias existen');
        return true;
      } else {
        await this.addTestResult('Existencia de Tablas', false, `Tablas faltantes: ${missingTables.join(', ')}`);
        return false;
      }
    } catch (error) {
      await this.addTestResult('Existencia de Tablas', false, error.message);
      return false;
    }
  }

  async verifyNewColumns() {
    try {
      // Verificar que las nuevas columnas existan en la tabla pagos
      const columns = await prisma.$queryRaw`PRAGMA table_info(pagos)`;
      const columnNames = columns.map(col => col.name);
      
      const requiredColumns = ['mercado_pago_preference_id', 'metadata', 'webhook_procesado', 'fecha_liberacion_programada'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      
      if (missingColumns.length === 0) {
        await this.addTestResult('Nuevas Columnas en Tabla pagos', true, 'Todas las nuevas columnas existen');
        return true;
      } else {
        await this.addTestResult('Nuevas Columnas en Tabla pagos', false, `Columnas faltantes: ${missingColumns.join(', ')}`);
        return false;
      }
    } catch (error) {
      await this.addTestResult('Nuevas Columnas en Tabla pagos', false, error.message);
      return false;
    }
  }

  async testPaymentCreation() {
    try {
      // Limpiar datos de prueba
      await this.cleanupTestData();

      // Crear datos de prueba
      const cliente = await prisma.usuarios.create({
        data: {
          id: 'test_cliente_verify',
          email: 'cliente.verify@test.com',
          nombre: 'Cliente Verificación',
          rol: 'cliente'
        }
      });

      const profesional = await prisma.usuarios.create({
        data: {
          id: 'test_profesional_verify',
          email: 'profesional.verify@test.com',
          nombre: 'Profesional Verificación',
          rol: 'profesional'
        }
      });

      const servicio = await prisma.servicios.create({
        data: {
          id: 'test_servicio_verify',
          cliente_id: 'test_cliente_verify',
          profesional_id: 'test_profesional_verify',
          descripcion: 'Servicio de verificación',
          estado: 'PENDIENTE'
        }
      });

      // Crear un pago de prueba
      const pago = await prisma.pagos.create({
        data: {
          id: 'test_pago_verify',
          servicio_id: 'test_servicio_verify',
          cliente_id: 'test_cliente_verify',
          profesional_id: 'test_profesional_verify',
          monto_total: 1000.00,
          comision_plataforma: 50.00,
          monto_profesional: 950.00,
          estado: 'aprobado',
          mercado_pago_id: 'mp_test_verify',
          metadata: JSON.stringify({ test: true }),
          fecha_liberacion_programada: new Date()
        }
      });

      await this.addTestResult('Creación de Pago', true, `Pago creado con ID: ${pago.id}`);
      
      // Limpiar datos de prueba
      await this.cleanupTestData();
      return true;
    } catch (error) {
      await this.addTestResult('Creación de Pago', false, error.message);
      return false;
    }
  }

  async testEventLogging() {
    try {
      // Limpiar datos de prueba
      await this.cleanupTestData();

      // Crear datos de prueba
      await this.createTestData();

      // Probar logging de eventos
      await paymentService.logPaymentEvent('test_pago_verify', 'test_event', { testData: 'verification' });

      // Verificar que el evento se registró
      const events = await prisma.eventos_pagos.findMany({
        where: {
          pago_id: 'test_pago_verify',
          tipo_evento: 'test_event'
        }
      });

      if (events.length > 0) {
        await this.addTestResult('Logging de Eventos', true, `Evento registrado: ${events[0].id}`);
      } else {
        await this.addTestResult('Logging de Eventos', false, 'No se registró el evento');
      }

      // Limpiar datos de prueba
      await this.cleanupTestData();
      return true;
    } catch (error) {
      await this.addTestResult('Logging de Eventos', false, error.message);
      return false;
    }
  }

  async testDisputeCreation() {
    try {
      // Limpiar datos de prueba
      await this.cleanupTestData();

      // Crear datos de prueba
      await this.createTestData();

      // Crear una disputa
      const dispute = await paymentService.createDispute(
        'test_pago_verify',
        'test_cliente_verify',
        'servicio_no_completado',
        'Disputa de verificación del sistema'
      );

      // Verificar que la disputa se creó
      const savedDispute = await prisma.disputas_pagos.findUnique({
        where: { id: dispute.disputeId }
      });

      if (savedDispute) {
        await this.addTestResult('Creación de Disputa', true, `Disputa creada: ${savedDispute.id}`);
      } else {
        await this.addTestResult('Creación de Disputa', false, 'No se pudo crear la disputa');
      }

      // Limpiar datos de prueba
      await this.cleanupTestData();
      return true;
    } catch (error) {
      await this.addTestResult('Creación de Disputa', false, error.message);
      return false;
    }
  }

  async testRefundProcessing() {
    try {
      // Limpiar datos de prueba
      await this.cleanupTestData();

      // Crear datos de prueba
      await this.createTestData();

      // Procesar un reembolso
      const refund = await paymentService.processRefund(
        'test_pago_verify',
        500.00,
        'servicio_no_completado',
        'test_cliente_verify'
      );

      // Verificar que el reembolso se procesó
      const updatedPayment = await prisma.pagos.findUnique({
        where: { id: 'test_pago_verify' }
      });

      if (updatedPayment && updatedPayment.estado === 'reembolsado_parcial') {
        await this.addTestResult('Procesamiento de Reembolso', true, `Reembolso procesado: ${refund.refundId}`);
      } else {
        await this.addTestResult('Procesamiento de Reembolso', false, 'No se pudo procesar el reembolso');
      }

      // Limpiar datos de prueba
      await this.cleanupTestData();
      return true;
    } catch (error) {
      await this.addTestResult('Procesamiento de Reembolso', false, error.message);
      return false;
    }
  }

  async testAvailableFundsCalculation() {
    try {
      // Limpiar datos de prueba
      await this.cleanupTestData();

      // Crear datos de prueba
      await this.createTestData();

      // Crear pagos liberados con diferentes montos
      await prisma.pagos.createMany({
        data: [
          {
            id: 'funds_test_1',
            servicio_id: 'funds_service_1',
            cliente_id: 'test_cliente_verify',
            profesional_id: 'test_profesional_verify',
            monto_total: 1000.00,
            monto_profesional: 950.00,
            estado: 'liberado'
          },
          {
            id: 'funds_test_2',
            servicio_id: 'funds_service_2',
            cliente_id: 'test_cliente_verify',
            profesional_id: 'test_profesional_verify',
            monto_total: 1500.00,
            monto_profesional: 1425.00,
            estado: 'liberado'
          }
        ]
      });

      // Calcular fondos disponibles
      const availableFunds = await paymentService.calculateAvailableFunds('test_profesional_verify');

      if (availableFunds === 2375.00) {
        await this.addTestResult('Cálculo de Fondos Disponibles', true, `Fondos calculados: ${availableFunds}`);
      } else {
        await this.addTestResult('Cálculo de Fondos Disponibles', false, `Resultado incorrecto: ${availableFunds}`);
      }

      // Limpiar datos de prueba
      await this.cleanupTestData();
      return true;
    } catch (error) {
      await this.addTestResult('Cálculo de Fondos Disponibles', false, error.message);
      return false;
    }
  }

  async testUserDisputes() {
    try {
      // Limpiar datos de prueba
      await this.cleanupTestData();

      // Crear datos de prueba
      await this.createTestData();

      // Crear una disputa
      await paymentService.createDispute(
        'test_pago_verify',
        'test_cliente_verify',
        'servicio_no_completado',
        'Test dispute'
      );

      // Obtener disputas del usuario
      const userDisputes = await paymentService.getUserDisputes('test_cliente_verify');

      if (userDisputes.length > 0 && userDisputes[0].estado === 'abierta') {
        await this.addTestResult('Obtención de Disputas de Usuario', true, `Disputas obtenidas: ${userDisputes.length}`);
      } else {
        await this.addTestResult('Obtención de Disputas de Usuario', false, 'No se pudieron obtener las disputas');
      }

      // Limpiar datos de prueba
      await this.cleanupTestData();
      return true;
    } catch (error) {
      await this.addTestResult('Obtención de Disputas de Usuario', false, error.message);
      return false;
    }
  }

  async createTestData() {
    // Crear datos de prueba básicos
    const cliente = await prisma.usuarios.upsert({
      where: { id: 'test_cliente_verify' },
      update: {},
      create: {
        id: 'test_cliente_verify',
        email: 'cliente.verify@test.com',
        nombre: 'Cliente Verificación',
        rol: 'cliente'
      }
    });

    const profesional = await prisma.usuarios.upsert({
      where: { id: 'test_profesional_verify' },
      update: {},
      create: {
        id: 'test_profesional_verify',
        email: 'profesional.verify@test.com',
        nombre: 'Profesional Verificación',
        rol: 'profesional'
      }
    });

    const servicio = await prisma.servicios.upsert({
      where: { id: 'test_servicio_verify' },
      update: {},
      create: {
        id: 'test_servicio_verify',
        cliente_id: 'test_cliente_verify',
        profesional_id: 'test_profesional_verify',
        descripcion: 'Servicio de verificación',
        estado: 'PENDIENTE'
      }
    });

    const pago = await prisma.pagos.upsert({
      where: { id: 'test_pago_verify' },
      update: {},
      create: {
        id: 'test_pago_verify',
        servicio_id: 'test_servicio_verify',
        cliente_id: 'test_cliente_verify',
        profesional_id: 'test_profesional_verify',
        monto_total: 1000.00,
        comision_plataforma: 50.00,
        monto_profesional: 950.00,
        estado: 'aprobado',
        mercado_pago_id: 'mp_test_verify',
        metadata: JSON.stringify({ test: true }),
        fecha_liberacion_programada: new Date()
      }
    });
  }

  async cleanupTestData() {
    try {
      await prisma.eventos_pagos.deleteMany({ where: { pago_id: { contains: 'test_' } } });
      await prisma.disputas_pagos.deleteMany({ where: { pago_id: { contains: 'test_' } } });
      await prisma.pagos.deleteMany({ where: { id: { contains: 'test_' } } });
      await prisma.servicios.deleteMany({ where: { id: { contains: 'test_' } } });
      await prisma.usuarios.deleteMany({ where: { id: { contains: 'test_' } } });
    } catch (error) {
      // Ignorar errores de limpieza
    }
  }

  async runAllTests() {
    await this.log('=== INICIANDO VERIFICACIÓN COMPLETA DEL SISTEMA DE PAGOS ===');

    // Verificaciones básicas
    await this.verifyDatabaseConnection();
    await this.verifyTablesExist();
    await this.verifyNewColumns();

    // Funcionalidades principales
    await this.testPaymentCreation();
    await this.testEventLogging();
    await this.testDisputeCreation();
    await this.testRefundProcessing();
    await this.testAvailableFundsCalculation();
    await this.testUserDisputes();

    // Reporte final
    await this.generateReport();
  }

  async generateReport() {
    await this.log('=== REPORTE FINAL ===');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(test => test.success).length;
    const failedTests = this.testResults.filter(test => !test.success).length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    await this.log(`Total de tests: ${totalTests}`);
    await this.log(`Tests exitosos: ${passedTests}`);
    await this.log(`Tests fallidos: ${failedTests}`);
    await this.log(`Tasa de éxito: ${successRate}%`);

    if (this.errors.length > 0) {
      await this.log('=== ERRORES ENCONTRADOS ===');
      this.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }

    await this.log('=== VERIFICACIÓN COMPLETADA ===');
    
    if (failedTests === 0) {
      await this.log('🎉 ¡Todos los tests pasaron exitosamente!', 'success');
      process.exit(0);
    } else {
      await this.log(`⚠️ ${failedTests} tests fallaron. Revisar errores arriba.`, 'error');
      process.exit(1);
    }
  }
}

// Ejecutar verificación
async function main() {
  const verifier = new PaymentSystemVerifier();
  await verifier.runAllTests();
}

// Manejo de errores globales
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('Error ejecutando verificación:', error);
    process.exit(1);
  });
}

module.exports = PaymentSystemVerifier;