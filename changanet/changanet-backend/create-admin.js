const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Verificando si el admin ya existe...');

    const existingAdmin = await prisma.usuarios.findUnique({
      where: { email: 'admin@changánet.com' }
    });

    if (existingAdmin) {
      console.log('✅ Admin ya existe:', existingAdmin);
      return;
    }

    console.log('🔐 Generando hash de contraseña...');
    const hash = await bcrypt.hash('admin123', 10);

    console.log('👤 Creando usuario administrador...');
    const admin = await prisma.usuarios.create({
      data: {
        nombre: 'Administrador Changánet',
        email: 'admin@changánet.com',
        hash_contrasena: hash,
        rol: 'admin',
        esta_verificado: true,
        bloqueado: false
      }
    });

    console.log('✅ Admin creado exitosamente:', {
      id: admin.id,
      nombre: admin.nombre,
      email: admin.email,
      rol: admin.rol
    });

    console.log('🔑 Credenciales de acceso:');
    console.log('   Email: admin@changánet.com');
    console.log('   Password: admin123');
    console.log('   Dashboard: /admin/dashboard');

  } catch (error) {
    console.error('❌ Error creando admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();