/**
 * Controlador de gestión de disponibilidad y agenda
 * Implementa sección 7.6 del PRD: Gestión de Disponibilidad y Agenda
 * REQ-26: Calendario editable para profesionales
 * REQ-27: Marcar horarios disponibles/no disponibles
 * REQ-28: Clientes ven disponibilidad en tiempo real
 * REQ-29: Agendar servicios directamente
 * REQ-30: Confirmación automática al agendar
 */

// src/controllers/availabilityController.js
const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('../services/notificationService');
const prisma = new PrismaClient();

/**
 * Crea un nuevo horario de disponibilidad para profesional
 * REQ-26: Calendario editable
 * REQ-27: Marcar horarios disponibles
 * Valida solapamiento de horarios
 */
exports.createAvailability = async (req, res) => {
  const { id: userId } = req.user;
  const { fecha, hora_inicio, hora_fin, esta_disponible } = req.body;

  try {
    const user = await prisma.usuarios.findUnique({ where: { id: userId } });
    if (user.rol !== 'profesional') {
      return res.status(403).json({ error: 'Solo los profesionales pueden gestionar disponibilidad.' });
    }

    // Validar que no haya solapamiento de horarios
    const existingSlots = await prisma.disponibilidad.findMany({
      where: {
        profesional_id: userId,
        fecha: new Date(fecha),
        OR: [
          {
            AND: [
              { hora_inicio: { lte: new Date(hora_inicio) } },
              { hora_fin: { gt: new Date(hora_inicio) } }
            ]
          },
          {
            AND: [
              { hora_inicio: { lt: new Date(hora_fin) } },
              { hora_fin: { gte: new Date(hora_fin) } }
            ]
          }
        ]
      }
    });

    if (existingSlots.length > 0) {
      return res.status(400).json({ error: 'Ya existe un horario que se solapa con el horario seleccionado.' });
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

/**
 * Obtiene disponibilidad de un profesional para una fecha específica
 * REQ-28: Clientes ven disponibilidad en tiempo real
 * Solo muestra horarios marcados como disponibles
 */
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

exports.deleteAvailability = async (req, res) => {
  const { id: userId } = req.user;
  const { slotId } = req.params;

  try {
    const slot = await prisma.disponibilidad.findUnique({ where: { id: slotId } });
    if (!slot || slot.profesional_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este horario.' });
    }

    await prisma.disponibilidad.delete({
      where: { id: slotId }
    });

    res.status(200).json({ message: 'Horario eliminado exitosamente.' });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ error: 'Error al eliminar disponibilidad.' });
  }
};