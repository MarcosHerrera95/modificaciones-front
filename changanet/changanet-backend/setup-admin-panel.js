/**
 * Script de configuración inicial del Panel de Administración
 * Crea configuraciones por defecto y un administrador inicial
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function setupAdminPanel() {
  try {
    console.log('🚀 Configurando Panel de Administración...');

    // 1. Crear configuraciones por defecto
    console.log('📝 Creando configuraciones por defecto...');

    const defaultSettings = [
      {
        key: 'commission_percentage',
        value: JSON.stringify(5.0),
        description: 'Porcentaje de comisión por defecto (5-10%)',
        category: 'commission'
      },
      {
        key: 'minimum_commission_fee',
        value: JSON.stringify(0),
        description: 'Monto mínimo de comisión por transacción',
        category: 'commission'
      },
      {
        key: 'platform_name',
        value: JSON.stringify('Changánet'),
        description: 'Nombre de la plataforma',
        category: 'general'
      },
      {
        key: 'support_email',
        value: JSON.stringify('soporte@changanet.com'),
        description: 'Email de soporte al cliente',
        category: 'general'
      },
      {
        key: 'timezone',
        value: JSON.stringify('America/Argentina/Buenos_Aires'),
        description: 'Zona horaria por defecto',
        category: 'general'
      },
      {
        key: 'max_file_size_mb',
        value: JSON.stringify(10),
        description: 'Tamaño máximo de archivos en MB',
        category: 'general'
      },
      {
        key: 'urgent_services_enabled',
        value: JSON.stringify(true),
        description: 'Habilitar servicios urgentes',
        category: 'services'
      },
      {
        key: 'quote_requests_enabled',
        value: JSON.stringify(true),
        description: 'Habilitar solicitudes de presupuesto',
        category: 'services'
      },
      {
        key: 'chat_enabled',
        value: JSON.stringify(true),
        description: 'Habilitar sistema de chat',
        category: 'services'
      },
      {
        key: 'mfa_required_for_admins',
        value: JSON.stringify(false),
        description: 'Requerir MFA para administradores',
        category: 'security'
      },
      {
        key: 'session_timeout_minutes',
        value: JSON.stringify(480), // 8 horas
        description: 'Tiempo de expiración de sesión en minutos',
        category: 'security'
      },
      {
        key: 'max_login_attempts',
        value: JSON.stringify(5),
        description: 'Máximo número de intentos de login fallidos',
        category: 'security'
      },
      {
        key: 'notifications_admin_login',
        value: JSON.stringify(true),
        description: 'Notificar logins de administradores',
        category: 'notifications'
      },
      {
        key: 'notifications_verification_pending',
        value: JSON.stringify(true),
        description: 'Notificar verificaciones pendientes',
        category: 'notifications'
      },
      {
        key: 'notifications_disputes',
        value: JSON.stringify(true),
        description: 'Notificar nuevas disputas',
        category: 'notifications'
      }
    ];

    for (const setting of defaultSettings) {
      await prisma.settings.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          description: setting.description,
          category: setting.category
        },
        create: setting
      });
    }

    console.log('✅ Configuraciones por defecto creadas');

    // 2. Crear configuración de comisiones inicial
    console.log('💰 Creando configuración inicial de comisiones...');

    await prisma.commission_settings.upsert({
      where: { id: 'default' },
      update: {
        commission_percentage: 0.05, // 5%
        minimum_fee: 0,
        active: true
      },
      create: {
        id: 'default',
        commission_percentage: 0.05, // 5%
        minimum_fee: 0,
        active: true
      }
    });

    console.log('✅ Configuración de comisiones creada');

    // 3. Crear administrador por defecto (si no existe)
    console.log('👤 Verificando administrador por defecto...');

    const existingAdmin = await prisma.usuarios.findFirst({
      where: { email: 'admin@changanet.com' }
    });

    if (!existingAdmin) {
      // Crear usuario admin
      const hashedPassword = await bcrypt.hash('Admin123!', 10);

      const adminUser = await prisma.usuarios.create({
        data: {
          id: crypto.randomUUID(),
          email: 'admin@changanet.com',
          hash_contrasena: hashedPassword,
          nombre: 'Administrador',
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

      console.log('✅ Administrador por defecto creado:');
      console.log('   Email: admin@changanet.com');
      console.log('   Password: Admin123!');
      console.log('   ⚠️  IMPORTANTE: Cambia esta contraseña en producción!');
    } else {
      console.log('ℹ️  Administrador por defecto ya existe');
    }

    console.log('🎉 Panel de Administración configurado exitosamente!');
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('1. Inicia sesión como admin@changanet.com');
    console.log('2. Cambia la contraseña por defecto');
    console.log('3. Configura los permisos de administradores');
    console.log('4. Revisa las configuraciones del sistema');

  } catch (error) {
    console.error('❌ Error configurando Panel de Administración:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupAdminPanel();
}

module.exports = { setupAdminPanel };