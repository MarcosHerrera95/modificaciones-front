// src/controllers/availabilityController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createAvailability = async (req, res) => {
  const { id: userId } = req.user;
  const { fecha, hora_inicio, hora_fin } = req.body;

  try {
    const user = await prisma.usuarios.findUnique({ where: { id: userId } });
    if (user.rol !== 'profesional') {
      return res.status(403).json({ error: 'Solo los profesionales pueden gestionar disponibilidad.' });
    }

    const availability = await prisma.disponibilidad.create({
      data: {
        profesional_id: userId,
        fecha: new Date(fecha),
        hora_inicio: new Date(hora_inicio),
        hora_fin: new Date(hora_fin)
      }
    });

    res.status(201).json(availability);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear disponibilidad.' });
  }
};

exports.getAvailability = async (req, res) => {
  const { professionalId } = req.params;
  const { date } = req.query;

  try {
    // Parse date properly - assuming date comes as YYYY-MM-DD
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1); // Next day for range

    const availabilities = await prisma.disponibilidad.findMany({
      where: {
        profesional_id: professionalId,
        fecha: {
          gte: startDate,
          lt: endDate
        }
      },
      orderBy: { hora_inicio: 'asc' }
    });
    res.status(200).json(availabilities);
  } catch (error) {
    console.error('Error getting availability:', error);
    res.status(500).json({ error: 'Error al obtener disponibilidad.' });
  }
};