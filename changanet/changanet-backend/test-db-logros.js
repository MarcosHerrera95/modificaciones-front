const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient();

  try {
    // 1. Connect to database
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('✔ DB conectada');

    // 2. Test basic query
    console.log('Testing basic query...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✔ Prisma levantado');

    // 3. Test logros model
    console.log('Testing logros model...');
    const logro = await prisma.logros.findFirst();
    console.log('✔ Modelo logros funcional');

    // 4. Disconnect
    await prisma.$disconnect();
    console.log('Database connection test completed successfully.');

  } catch (error) {
    console.error('✗ Error during database test:', error.message);

    // Determine which step failed
    if (error.message.includes('connect')) {
      console.log('✗ DB conectada');
      console.log('✗ Prisma levantado');
      console.log('✗ Modelo logros funcional');
    } else if (error.message.includes('query') || error.message.includes('SELECT')) {
      console.log('✔ DB conectada');
      console.log('✗ Prisma levantado');
      console.log('✗ Modelo logros funcional');
    } else {
      console.log('✔ DB conectada');
      console.log('✔ Prisma levantado');
      console.log('✗ Modelo logros funcional');
    }

    process.exit(1);
  }
}

testDatabaseConnection();