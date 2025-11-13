/**
 * Script para crear usuarios de prueba en Firebase Auth y base de datos
 * Soluciona el problema de autenticación: usuarios en BD pero no en Firebase
 */

const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

require('dotenv').config();

// Configurar Firebase Admin
const serviceAccount = require('./src/config/serviceAccountKey.json');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || 'changanet-notifications'
  });
}

const prisma = new PrismaClient();

const testUsers = [
  {
    email: 'cliente1@changanet.com',
    password: 'Test123456!',
    nombre: 'Cliente de Prueba 1',
    rol: 'cliente'
  },
  {
    email: 'cliente2@changanet.com',
    password: 'Test123456!',
    nombre: 'Cliente de Prueba 2',
    rol: 'cliente'
  },
  {
    email: 'profesional1@changanet.com',
    password: 'Test123456!',
    nombre: 'Profesional de Prueba 1',
    rol: 'profesional'
  }
];

async function createTestUsers() {
  console.log('🚀 Creando usuarios de prueba...\n');

  for (const userData of testUsers) {
    try {
      console.log(`📝 Creando usuario: ${userData.email}`);

      // 1. Crear usuario en Firebase Auth
      const firebaseUser = await admin.auth().createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.nombre,
        emailVerified: true
      });

      console.log(`✅ Usuario creado en Firebase Auth: ${firebaseUser.uid}`);

      // 2. Crear usuario en base de datos
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const dbUser = await prisma.usuarios.upsert({
        where: { email: userData.email },
        update: {
          nombre: userData.nombre,
          rol: userData.rol,
          esta_verificado: true
        },
        create: {
          email: userData.email,
          hash_contrasena: hashedPassword,
          nombre: userData.nombre,
          rol: userData.rol,
          esta_verificado: true
        }
      });

      console.log(`✅ Usuario creado/actualizado en BD: ${dbUser.id}`);
      console.log(`🔑 Email: ${userData.email}`);
      console.log(`🔒 Password: ${userData.password}`);
      console.log('---');

    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log(`⚠️  Usuario ${userData.email} ya existe en Firebase Auth`);

        // Solo actualizar en BD si no existe
        const existingUser = await prisma.usuarios.findUnique({
          where: { email: userData.email }
        });

        if (!existingUser) {
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          await prisma.usuarios.create({
            data: {
              email: userData.email,
              hash_contrasena: hashedPassword,
              nombre: userData.nombre,
              rol: userData.rol,
              esta_verificado: true
            }
          });
          console.log(`✅ Usuario creado en BD: ${userData.email}`);
        } else {
          console.log(`⚠️  Usuario ${userData.email} ya existe en BD`);
        }
      } else {
        console.error(`❌ Error creando usuario ${userData.email}:`, error.message);
      }
    }
  }

  console.log('\n🎉 ¡Usuarios de prueba creados exitosamente!');
  console.log('\n📋 Credenciales para login:');
  testUsers.forEach(user => {
    console.log(`👤 ${user.nombre}: ${user.email} / ${user.password}`);
  });

  await prisma.$disconnect();
}

createTestUsers().catch(console.error);