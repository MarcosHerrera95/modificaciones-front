/**
 * Script para generar 50 usuarios profesionales con perfiles completos
 * Incluye datos realistas para testing de la plataforma ChangAnet
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Datos de especialidades disponibles
const especialidades = [
  'Plomero', 'Electricista', 'Carpintero', 'Pintor', 'Albañil',
  'Gasista', 'Herrero', 'Cerrajero', 'Mecánico', 'Jardinero',
  'Limpieza', 'Mudanzas', 'Ferretería', 'Techero', 'Yesero',
  'Instalador', 'Reparador', 'Constructores', 'Refrigeración',
  'Aire Acondicionado', 'Fontanero', 'Enmantelador', 'Pavimentador',
  'Pintura Decorativa', 'Restaurador', 'Tapicero', 'Vidriero',
  'Parquetero', 'Yeso Decorativo', 'Piedra Natural'
];

// Datos de zonas de cobertura (barrios de Buenos Aires)
const zonasCobertura = [
  'Palermo', 'Recoleta', 'Belgrano', 'Microcentro', 'San Telmo',
  'La Boca', 'Barracas', 'Avellaneda', 'Quilmes', 'Lanus',
  'Caballito', 'Almagro', 'Boedo', 'Villa Lugano', 'Villa Riachuelo',
  'Villa Soldati', 'Parque Patricios', 'Nueva Pompeya', 'Liniers',
  'Flores', 'Parque Chacabuco', 'Colegiales', 'Núñez', 'Saavedra',
  'Villa Urquiza', 'Villa del Parque', 'Monte Castro', 'Vélez Sarsfield',
  'Villa General Mitre', 'Tigre', 'San Fernando', 'Vicente López',
  'Martínez', 'San Isidro', 'Olivos', 'Beccar', 'Boulogne'
];

// Datos de nombres argentinos realistas
const nombres = [
  'Juan Carlos', 'María Elena', 'José Luis', 'Ana María', 'Carlos Alberto',
  'Laura Patricia', 'Roberto Carlos', 'Carmen Rosa', 'Francisco José',
  'Marta Lucía', 'Miguel Ángel', 'Silvia Beatriz', 'Diego Fernando',
  'Gabriela Alejandra', 'Ricardo José', 'Patricia Elena', 'Sergio Alejandro',
  'Monica Andrea', 'Fernando Gabriel', 'Claudia Patricia', 'Pablo Hernán',
  'Liliana Sandra', 'Martín Ezequiel', 'Andrea Celeste', 'Javier Ariel',
  'Mariana Isabel', 'Leonardo David', 'Verónica Sandra', 'Eduardo Miguel',
  'Claudia Cristina', 'Gustavo Adolfo', 'Sandra Elizabeth', 'Rodolfo Andrés',
  'Marcela Elena', 'Alberto Oscar', 'Susana Mercedes', 'Víctor Hugo',
  'Graciela Beatriz', 'Oscar Daniel', 'Nancy María', 'César Augusto',
  'Gloria Esperanza', 'Esteban Nicolás', 'Liliana Patricia', 'Roberto Mario',
  'Elena Cristina', 'Héctor Gabriel', 'Margarita Rosa', 'Nicolás David'
];

// Apellidos argentinos
const apellidos = [
  'García', 'Rodríguez', 'González', 'Fernández', 'López',
  'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
  'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno',
  'Álvarez', 'Muñoz', 'Romero', 'Alonso', 'Gutiérrez',
  'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos',
  'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina',
  'Suárez', 'Méndez', 'Castro', 'Ortega', 'Delgado',
  'Cortés', 'Castillo', 'Santos', 'Guerrero', 'Lozano',
  'Guerrero', 'Pascual', 'Merino', 'Iglesias', 'Medina',
  'Garrido', 'Cortes', 'Castaño', 'Crespo'
];

// URLs de imágenes de perfil (usando un servicio de avatares)
const generateAvatarUrl = (seed) => {
  const avatars = [
    `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=random&size=200`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`,
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ffdfbf`,
  ];
  return avatars[Math.floor(Math.random() * avatars.length)];
};

// Experiencias en años
const experiencias = [1, 2, 3, 5, 7, 10, 12, 15, 18, 20, 25];

// Tarifas por hora (en pesos argentinos)
const tarifas = [
  2500, 2800, 3000, 3200, 3500, 3800, 4000, 4200, 4500, 4800,
  5000, 5200, 5500, 5800, 6000, 6500, 7000, 7500, 8000, 9000
];

// Descripciones realistas para profesionales
const descripciones = [
  'Profesional con más de 10 años de experiencia en el área. Trabajo garantizado y puntual.',
  'Especialista certificado con amplia experiencia. Ofrezco presupuestos sin cargo.',
  'Técnico calificado con excelente reputación. Atención personalizada y precios competitivos.',
  'Profesional con más de 5 años de experiencia. Compromiso con la calidad y el cumplimiento.',
  'Especialista en soluciones rápidas y efectivas. Trabajo seguro y confiable.',
  'Técnico profesional con certificaciones vigentes. Experiencia comprobada en el sector.',
  'Profesional con amplia experiencia local. Servicio 24/7 para emergencias.',
  'Especialista en trabajos de alta calidad. Presupuesto detallado y sin sorpresas.',
  'Técnico confiable con excelentes referencias. Trabajo garantizado y puntual.',
  'Profesional con formación continua. Uso de materiales de primera calidad.'
];

// Estados de verificación
const estadosVerificacion = ['pendiente', 'verificado', 'rechazado'];

/**
 * Genera un nombre completo aleatorio
 */
function generarNombreCompleto() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)];
  const apellido1 = apellidos[Math.floor(Math.random() * apellidos.length)];
  const apellido2 = apellidos[Math.floor(Math.random() * apellidos.length)];
  
  return `${nombre} ${apellido1} ${apellido2}`;
}

/**
 * Genera un email único
 */
function generarEmail(nombreCompleto) {
  const baseEmail = nombreCompleto.toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/ñ/g, 'n')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ç]/g, 'c');
  
  const numero = Math.floor(Math.random() * 9999);
  const timestamp = Date.now().toString().slice(-6);
  
  return `${baseEmail}.${numero}${timestamp}@test.com`;
}

/**
 * Genera un número de teléfono argentino
 */
function generarTelefono() {
  const prefix = ['11', '351', '341', '261', '264', '260'];
  const numero = Math.floor(Math.random() * 10000000).toString().padStart(8, '0');
  const prefijo = prefix[Math.floor(Math.random() * prefix.length)];
  
  return `${prefijo}-${numero.slice(0, 4)}-${numero.slice(4)}`;
}

/**
 * Genera un profesional completo
 */
function generarProfesional(index) {
  const nombreCompleto = generarNombreCompleto();
  const email = generarEmail(nombreCompleto);
  const telefono = generarTelefono();
  const especialidad = especialidades[Math.floor(Math.random() * especialidades.length)];
  const zona = zonasCobertura[Math.floor(Math.random() * zonasCobertura.length)];
  const experiencia = experiencias[Math.floor(Math.random() * experiencias.length)];
  const tarifa = tarifas[Math.floor(Math.random() * tarifas.length)];
  const descripcion = descripciones[Math.floor(Math.random() * descripciones.length)];
  const estado = estadosVerificacion[Math.floor(Math.random() * estadosVerificacion.length)];
  
  // Generar ID único
  const userId = crypto.randomUUID();
  
  return {
    // Datos del usuario
    usuario: {
      id: userId,
      nombre: nombreCompleto,
      email,
      telefono,
      rol: 'profesional',
      esta_verificado: estado === 'verificado',
      hash_contrasena: null, // Sin contraseña para usuarios de prueba
      google_id: null,
      facebook_id: null,
      url_foto_perfil: generateAvatarUrl(nombreCompleto),
      creado_en: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Último año
      actualizado_en: new Date()
    },
    
    // Datos del perfil profesional
    perfil: {
      usuario_id: userId,
      especialidad,
      anos_experiencia: experiencia,
      zona_cobertura: zona,
      tipo_tarifa: 'hora',
      tarifa_hora: tarifa,
      descripcion,
      esta_disponible: Math.random() > 0.2, // 80% disponibles
      calificacion_promedio: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)), // 3.5 - 5.0
      estado_verificacion: estado,
      verificado_en: estado === 'verificado' ? new Date() : null,
      profile_completion_score: Math.floor(Math.random() * 40) + 60, // 60-100%
      profile_views_count: Math.floor(Math.random() * 500),
      last_profile_update: new Date()
    }
  };
}

/**
 * Función principal para generar los profesionales
 */
async function generarProfesionalesTest() {
  console.log('🚀 Iniciando generación de 50 usuarios profesionales...');
  
  try {
    // Verificar conexión a la base de datos
    await prisma.$connect();
    console.log('✅ Conexión a base de datos establecida');
    
    // Generar los profesionales
    const profesionales = [];
    for (let i = 0; i < 50; i++) {
      const profesional = generarProfesional(i);
      profesionales.push(profesional);
      
      // Progreso cada 10 profesionales
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Generados ${i + 1}/50 profesionales...`);
      }
    }
    
    console.log('💾 Insertando profesionales en la base de datos...');
    
    // Insertar profesionales individualmente para mejor control
    let insertedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < profesionales.length; i++) {
      const profesional = profesionales[i];
      
      try {
        // Verificar si el usuario ya existe
        const existingUser = await prisma.usuarios.findUnique({
          where: { email: profesional.usuario.email }
        });
        
        if (existingUser) {
          console.log(`⚠️ Usuario ya existe: ${profesional.usuario.email}`);
          continue;
        }
        
        // Crear usuario
        await prisma.usuarios.create({
          data: profesional.usuario
        });
        
        // Crear perfil profesional
        await prisma.perfiles_profesionales.create({
          data: profesional.perfil
        });
        
        insertedCount++;
        
        // Mostrar progreso cada 5 profesionales
        if (insertedCount % 5 === 0) {
          console.log(`✅ Insertados ${insertedCount}/50 profesionales...`);
        }
        
      } catch (individualError) {
        errorCount++;
        console.error(`❌ Error con ${profesional.usuario.email}:`, individualError.message);
      }
    }
    
    // Verificar inserción
    const totalProfesionales = await prisma.usuarios.count({
      where: { rol: 'profesional' }
    });
    
    console.log('\n🎉 ¡Generación completada!');
    console.log(`📊 Profesionales insertados: ${insertedCount}`);
    console.log(`❌ Errores encontrados: ${errorCount}`);
    console.log(`📈 Total de profesionales en BD: ${totalProfesionales}`);
    
    // Mostrar estadísticas
    const verificados = await prisma.usuarios.count({
      where: { rol: 'profesional', esta_verificado: true }
    });
    
    const perfilesCompletos = await prisma.perfiles_profesionales.count();
    
    console.log('\n📊 Estadísticas:');
    console.log(`   • Profesionales verificados: ${verificados}`);
    console.log(`   • Perfiles profesionales creados: ${perfilesCompletos}`);
    
    // Mostrar especialidades disponibles
    const especialidadesDisponibles = await prisma.perfiles_profesionales.groupBy({
      by: ['especialidad'],
      _count: { especialidad: true }
    });
    
    console.log('\n🏷️ Especialidades generadas:');
    especialidadesDisponibles.forEach(esp => {
      console.log(`   • ${esp.especialidad}: ${esp._count.especialidad} profesionales`);
    });
    
    // Mostrar zonas de cobertura
    const zonasDisponibles = await prisma.perfiles_profesionales.groupBy({
      by: ['zona_cobertura'],
      _count: { zona_cobertura: true }
    });
    
    console.log('\n📍 Zonas de cobertura generadas:');
    zonasDisponibles.forEach(zona => {
      console.log(`   • ${zona.zona_cobertura}: ${zona._count.zona_cobertura} profesionales`);
    });
    
  } catch (error) {
    console.error('❌ Error durante la generación:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Desconectado de la base de datos');
  }
}

// Ejecutar el script
if (require.main === module) {
  generarProfesionalesTest()
    .then(() => {
      console.log('\n✨ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script falló:', error);
      process.exit(1);
    });
}

module.exports = { generarProfesionalesTest, generarProfesional };