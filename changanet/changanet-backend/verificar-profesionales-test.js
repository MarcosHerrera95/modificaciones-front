/**
 * Script para verificar los profesionales generados en la base de datos
 * Muestra estadísticas detalladas y algunos ejemplos de datos
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Función principal para verificar profesionales
 */
async function verificarProfesionalesTest() {
  console.log('🔍 Verificando profesionales generados...');
  
  try {
    // Conectar a la base de datos
    await prisma.$connect();
    console.log('✅ Conexión a base de datos establecida');
    
    // Contar total de profesionales
    const totalProfesionales = await prisma.usuarios.count({
      where: { rol: 'profesional' }
    });
    
    console.log(`\n📊 RESUMEN GENERAL:`);
    console.log(`   • Total de profesionales: ${totalProfesionales}`);
    
    if (totalProfesionales === 0) {
      console.log('❌ No se encontraron profesionales en la base de datos');
      return;
    }
    
    // Contar perfiles profesionales
    const totalPerfiles = await prisma.perfiles_profesionales.count();
    console.log(`   • Perfiles profesionales: ${totalPerfiles}`);
    
    // Contar usuarios verificados
    const verificados = await prisma.usuarios.count({
      where: { rol: 'profesional', esta_verificado: true }
    });
    console.log(`   • Profesionales verificados: ${verificados} (${Math.round(verificados/totalProfesionales*100)}%)`);
    
    // Estados de verificación
    const estadosVerificacion = await prisma.perfiles_profesionales.groupBy({
      by: ['estado_verificacion'],
      _count: { estado_verificacion: true }
    });
    
    console.log(`\n🏷️ ESTADOS DE VERIFICACIÓN:`);
    estadosVerificacion.forEach(estado => {
      console.log(`   • ${estado.estado_verificacion}: ${estado._count.estado_verificacion} profesionales`);
    });
    
    // Especialidades más populares
    const especialidades = await prisma.perfiles_profesionales.groupBy({
      by: ['especialidad'],
      _count: { especialidad: true },
      orderBy: { _count: { especialidad: 'desc' } }
    });
    
    console.log(`\n🔧 ESPECIALIDADES (Top 10):`);
    especialidades.slice(0, 10).forEach(esp => {
      console.log(`   • ${esp.especialidad}: ${esp._count.especialidad} profesionales`);
    });
    
    // Zonas de cobertura más populares
    const zonas = await prisma.perfiles_profesionales.groupBy({
      by: ['zona_cobertura'],
      _count: { zona_cobertura: true },
      orderBy: { _count: { zona_cobertura: 'desc' } }
    });
    
    console.log(`\n📍 ZONAS DE COBERTURA (Top 10):`);
    zonas.slice(0, 10).forEach(zona => {
      console.log(`   • ${zona.zona_cobertura}: ${zona._count.zona_cobertura} profesionales`);
    });
    
    // Estadísticas de tarifas
    const tarifas = await prisma.perfiles_profesionales.findMany({
      where: { tarifa_hora: { not: null } },
      select: { tarifa_hora: true }
    });
    
    if (tarifas.length > 0) {
      const minTarifa = Math.min(...tarifas.map(t => t.tarifa_hora));
      const maxTarifa = Math.max(...tarifas.map(t => t.tarifa_hora));
      const avgTarifa = tarifas.reduce((sum, t) => sum + t.tarifa_hora, 0) / tarifas.length;
      
      console.log(`\n💰 TARIFAS POR HORA:`);
      console.log(`   • Tarifa mínima: $${minTarifa.toLocaleString()}`);
      console.log(`   • Tarifa máxima: $${maxTarifa.toLocaleString()}`);
      console.log(`   • Tarifa promedio: $${Math.round(avgTarifa).toLocaleString()}`);
    }
    
    // Estadísticas de experiencia
    const experiencias = await prisma.perfiles_profesionales.findMany({
      where: { anos_experiencia: { not: null } },
      select: { anos_experiencia: true }
    });
    
    if (experiencias.length > 0) {
      const minExp = Math.min(...experiencias.map(e => e.anos_experiencia));
      const maxExp = Math.max(...experiencias.map(e => e.anos_experiencia));
      const avgExp = experiencias.reduce((sum, e) => sum + e.anos_experiencia, 0) / experiencias.length;
      
      console.log(`\n📅 EXPERIENCIA (años):`);
      console.log(`   • Mínima: ${minExp} años`);
      console.log(`   • Máxima: ${maxExp} años`);
      console.log(`   • Promedio: ${Math.round(avgExp * 10) / 10} años`);
    }
    
    // Estadísticas de calificaciones
    const calificaciones = await prisma.perfiles_profesionales.findMany({
      where: { calificacion_promedio: { not: null } },
      select: { calificacion_promedio: true }
    });
    
    if (calificaciones.length > 0) {
      const minCal = Math.min(...calificaciones.map(c => c.calificacion_promedio));
      const maxCal = Math.max(...calificaciones.map(c => c.calificacion_promedio));
      const avgCal = calificaciones.reduce((sum, c) => sum + c.calificacion_promedio, 0) / calificaciones.length;
      
      console.log(`\n⭐ CALIFICACIONES:`);
      console.log(`   • Mínima: ${minCal.toFixed(1)} estrellas`);
      console.log(`   • Máxima: ${maxCal.toFixed(1)} estrellas`);
      console.log(`   • Promedio: ${avgCal.toFixed(1)} estrellas`);
    }
    
    // Profesionales disponibles vs no disponibles
    const disponibilidad = await prisma.perfiles_profesionales.groupBy({
      by: ['esta_disponible'],
      _count: { esta_disponible: true }
    });
    
    console.log(`\n🟢 DISPONIBILIDAD:`);
    disponibilidad.forEach(disp => {
      const estado = disp.esta_disponible ? 'Disponible' : 'No disponible';
      console.log(`   • ${estado}: ${disp._count.esta_disponible} profesionales`);
    });
    
    // Ejemplos de profesionales (muestra aleatoria)
    const ejemplos = await prisma.usuarios.findMany({
      where: { rol: 'profesional' },
      include: {
        perfiles_profesionales: true
      },
      take: 5,
      orderBy: { creado_en: 'desc' }
    });
    
    console.log(`\n👥 EJEMPLOS DE PROFESIONALES GENERADOS:`);
    ejemplos.forEach((prof, index) => {
      const perfil = prof.perfiles_profesionales;
      console.log(`\n   ${index + 1}. ${prof.nombre}`);
      console.log(`      • Email: ${prof.email}`);
      console.log(`      • Teléfono: ${prof.telefono || 'No registrado'}`);
      console.log(`      • Especialidad: ${perfil?.especialidad || 'N/A'}`);
      console.log(`      • Zona: ${perfil?.zona_cobertura || 'N/A'}`);
      console.log(`      • Experiencia: ${perfil?.anos_experiencia || 'N/A'} años`);
      const tarifaTexto = perfil?.tarifa_hora ? '$' + perfil.tarifa_hora.toLocaleString() : 'N/A';
      console.log(`      • Tarifa: ${tarifaTexto}`);
      console.log(`      • Verificado: ${prof.esta_verificado ? 'Sí' : 'No'}`);
      console.log(`      • Foto: ${prof.url_foto_perfil ? 'Sí' : 'No'}`);
    });
    
    console.log(`\n✅ Verificación completada exitosamente!`);
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Desconectado de la base de datos');
  }
}

// Ejecutar el script
if (require.main === module) {
  verificarProfesionalesTest()
    .then(() => {
      console.log('\n✨ Script de verificación completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script de verificación falló:', error);
      process.exit(1);
    });
}

module.exports = { verificarProfesionalesTest };