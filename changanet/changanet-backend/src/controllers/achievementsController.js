const prisma = require('../config/prismaClient');

const defaultAchievements = [
  { nombre: "Primer mensaje enviado", descripcion: "Envió su primer mensaje", puntos: 10 },
  { nombre: "Cuenta verificada", descripcion: "Completó el proceso de verificación", puntos: 20 },
  { nombre: "Reseña recibida", descripcion: "Recibió su primera reseña", puntos: 15 },
  { nombre: "5 servicios completados", descripcion: "Completó 5 trabajos satisfactoriamente", puntos: 50 }
];

async function initializeDefaultAchievements() {
  console.log("Inicializando logros por defecto...");
  try {
    for (const achievement of defaultAchievements) {
      const exists = await prisma.logros.findFirst({
        where: { nombre: achievement.nombre }
      });
      if (!exists) {
        await prisma.logros.create({ data: achievement });
        console.log(`🏆 Logro agregado: ${achievement.nombre}`);
      }
    }
    console.log("🏅 Logros por defecto inicializados correctamente.");
  } catch (err) {
    console.error("❌ Error inicializando logros:", err.message);
  }
}

async function getAllAchievements(req, res) {
  try {
    const achievements = await prisma.logros.findMany();
    res.json(achievements);
  } catch (err) {
    console.error("Error obteniendo logros:", err.message);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

async function getUserAchievements(req, res) {
  try {
    const { userId } = req.params;
    // Assuming there's a user_achievements table or similar
    // For now, return all achievements (placeholder)
    const achievements = await prisma.logros.findMany();
    res.json(achievements);
  } catch (err) {
    console.error("Error obteniendo logros del usuario:", err.message);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

async function createAchievement(req, res) {
  try {
    const { nombre, descripcion, puntos } = req.body;
    const achievement = await prisma.logros.create({
      data: { nombre, descripcion, puntos }
    });
    res.status(201).json(achievement);
  } catch (err) {
    console.error("Error creando logro:", err.message);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

module.exports = {
  initializeDefaultAchievements,
  getAllAchievements,
  getUserAchievements,
  createAchievement,
};