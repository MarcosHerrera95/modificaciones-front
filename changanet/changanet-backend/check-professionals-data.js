const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProfessionalsData() {
  console.log('🔍 Checking professionals data...\n');

  try {
    // Get all professionals with profiles
    const professionals = await prisma.usuarios.findMany({
      where: {
        rol: 'profesional',
        perfiles_profesionales: {
          isNot: null
        }
      },
      include: {
        perfiles_profesionales: true
      }
    });

    console.log(`Total professionals with profiles: ${professionals.length}\n`);

    // Show especialidades
    const especialidades = new Set();
    const zonas = new Set();

    professionals.forEach(prof => {
      const perfil = prof.perfiles_profesionales;
      if (perfil) {
        especialidades.add(perfil.especialidad);
        zonas.add(perfil.zona_cobertura);
      }
    });

    console.log('Especialidades disponibles:');
    Array.from(especialidades).sort().forEach(esp => console.log(`  - ${esp}`));

    console.log('\nZonas de cobertura disponibles:');
    Array.from(zonas).sort().forEach(zona => console.log(`  - ${zona}`));

    // Check for 'Cerrajero' related
    const cerrajeros = professionals.filter(prof =>
      prof.perfiles_profesionales?.especialidad?.toLowerCase().includes('cerraj')
    );

    console.log(`\nProfesionales con especialidad relacionada a cerrajero: ${cerrajeros.length}`);
    cerrajeros.forEach(prof => {
      console.log(`  - ${prof.nombre}: ${prof.perfiles_profesionales.especialidad} - Zona: ${prof.perfiles_profesionales.zona_cobertura}`);
    });

    // Check for zona containing 'q'
    const zonasConQ = professionals.filter(prof =>
      prof.perfiles_profesionales?.zona_cobertura?.toLowerCase().includes('q')
    );

    console.log(`\nProfesionales con zona que contiene 'q': ${zonasConQ.length}`);
    zonasConQ.forEach(prof => {
      console.log(`  - ${prof.nombre}: ${prof.perfiles_profesionales.especialidad} - Zona: ${prof.perfiles_profesionales.zona_cobertura}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProfessionalsData();