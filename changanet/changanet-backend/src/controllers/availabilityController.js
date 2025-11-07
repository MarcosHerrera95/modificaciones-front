// src/controllers/availabilityController.js
const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('../services/notificationService');
const prisma = new PrismaClient();

exports.createAvailability = async (req, res) => {
  const { id: userId } = req.user;
  const { fecha, hora_inicio, hora_fin, esta_disponible } = req.body;

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
        hora_fin: new Date(hora_fin),
        esta_disponible: esta_disponible !== undefined ? esta_disponible : true
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
        },
        esta_disponible: true // Solo mostrar horarios disponibles para clientes
      },
      orderBy: { hora_inicio: 'asc' }
    });
    res.status(200).json(availabilities);
  } catch (error) {
    console.error('Error getting availability:', error);
    res.status(500).json({ error: 'Error al obtener disponibilidad.' });
  }
};

exports.updateAvailability = async (req, res) => {
  const { id: userId } = req.user;
  const { slotId } = req.params;
  const { esta_disponible } = req.body;

  try {
    const slot = await prisma.disponibilidad.findUnique({ where: { id: slotId } });
    if (!slot || slot.profesional_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este horario.' });
    }

    const updatedSlot = await prisma.disponibilidad.update({
      where: { id: slotId },
      data: { esta_disponible }
    });

    res.status(200).json(updatedSlot);
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ error: 'Error al actualizar disponibilidad.' });
  }
};