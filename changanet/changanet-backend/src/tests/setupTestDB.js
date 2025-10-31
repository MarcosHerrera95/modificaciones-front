// src/tests/setupTestDB.js - Configuración de base de datos para pruebas
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

// Configurar variables de entorno para pruebas
require('dotenv').config({ path: '.env.test' });

const prisma = new PrismaClient();

/**
 * Configurar base de datos de prueba antes de todas las pruebas
 */
beforeAll(async () => {
  try {
    console.log('🗄️ Configurando base de datos de prueba...');

    // Crear base de datos de prueba si no existe
    try {
      execSync('createdb changanet_test', { stdio: 'pipe' });
      console.log('✅ Base de datos changanet_test creada');
    } catch (error) {
      // La base de datos ya existe, continuar
      console.log('ℹ️ Base de datos changanet_test ya existe');
    }

    // Ejecutar migraciones de Prisma
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });

    console.log('✅ Migraciones aplicadas a base de datos de prueba');
  } catch (error) {
    console.error('❌ Error configurando base de datos de prueba:', error.message);
    throw error;
  }
});

/**
 * Limpiar base de datos después de cada prueba
 */
afterEach(async () => {
  try {
    // Limpiar todas las tablas en orden correcto (respetando foreign keys)
    const tables = [
      'mensajes',
      'cotizaciones',
      'servicios',
      'perfiles_profesionales',
      'usuarios'
    ];

    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }

    console.log('🧹 Base de datos limpiada después de la prueba');
  } catch (error) {
    console.error('❌ Error limpiando base de datos:', error.message);
  }
});

/**
 * Cerrar conexión después de todas las pruebas
 */
afterAll(async () => {
  await prisma.$disconnect();
  console.log('🔌 Conexión a base de datos cerrada');
});

module.exports = { prisma };