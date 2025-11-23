/**
 * Script de prueba para verificar la conexión de Prisma con la base de datos
 * Valida que la configuración DATABASE_URL funciona correctamente
 */

const { PrismaClient } = require('@prisma/client');

// Crear instancia del cliente Prisma
const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🟡 Probando conexión a la base de datos...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    // Probar conexión básica
    await prisma.$connect();
    console.log('✅ Conexión a base de datos establecida');
    
    // Probar una consulta simple
    const userCount = await prisma.usuarios.count();
    console.log(`✅ Consulta exitosa - Usuarios en BD: ${userCount}`);
    
    // Verificar estructura de la tabla usuarios
    const usuarios = await prisma.usuarios.findFirst({
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        esta_verificado: true
      }
    });
    
    if (usuarios) {
      console.log('✅ Estructura de tabla usuarios correcta:');
      console.log('   Ejemplo de usuario:', usuarios);
    } else {
      console.log('ℹ️ Tabla usuarios existe pero está vacía');
    }
    
    // Probar relaciones con perfiles_profesionales
    try {
      const profileCount = await prisma.perfiles_profesionales.count();
      console.log(`✅ Tabla perfiles_profesionales accesible - Registros: ${profileCount}`);
    } catch (error) {
      console.log('⚠️ Tabla perfiles_profesionales no encontrada (normal si no hay migración)');
    }
    
    console.log('🎉 Todas las pruebas de conexión pasaron exitosamente');
    
  } catch (error) {
    console.error('❌ Error en la conexión:', error.message);
    console.error('Detalles del error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar pruebas
testConnection();
