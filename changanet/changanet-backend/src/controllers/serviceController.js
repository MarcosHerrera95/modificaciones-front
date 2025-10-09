// src/controllers/serviceController.js
const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('../services/notificationService');

const prisma = new PrismaClient();

exports.scheduleService = async (req, res) => {
  const { id: clientId } = req.user;
  const { profesional_id, descripcion, fecha_agendada } = req.body;

  try {
    // Check if there's an accepted quote between client and professional
    const acceptedQuote = await prisma.cotizaciones.findFirst({
      where: {
        cliente_id: clientId,
        profesional_id,
        estado: 'aceptado'
      }
    });

    if (!acceptedQuote) {
      return res.status(400).json({ error: 'Debes tener una cotización aceptada para agendar un servicio.' });
    }

    const service = await prisma.servicios.create({
      data: {
        cliente_id: clientId,
        profesional_id,
        descripcion,
        estado: 'agendado',
        fecha_agendada: new Date(fecha_agendada)
      }
    });

    // Send notification to professional
    await sendNotification(profesional_id, 'servicio_agendado', `Nuevo servicio agendado para ${new Date(fecha_agendada).toLocaleDateString()}`);

    res.status(201).json(service);
  } catch (error) {
    console.error('Error scheduling service:', error);
    res.status(500).json({ error: 'Error al agendar el servicio.' });
  }
};

exports.getClientServices = async (req, res) => {
  const { id: clientId } = req.user;

  try {
    const services = await prisma.servicios.findMany({
      where: { cliente_id: clientId },
      include: {
        profesional: { select: { nombre: true, email: true } }
      },
      orderBy: { creado_en: 'desc' }
    });

    res.status(200).json(services);
  } catch (error) {
    console.error('Error getting client services:', error);
    res.status(500).json({ error: 'Error al obtener servicios.' });
  }
};

exports.getProfessionalServices = async (req, res) => {
  const { id: professionalId } = req.user;

  try {
    const services = await prisma.servicios.findMany({
      where: { profesional_id: professionalId },
      include: {
        cliente: { select: { nombre: true, email: true } }
      },
      orderBy: { creado_en: 'desc' }
    });

    res.status(200).json(services);
  } catch (error) {
    console.error('Error getting professional services:', error);
    res.status(500).json({ error: 'Error al obtener servicios.' });
  }
};

exports.updateServiceStatus = async (req, res) => {
  const { id: userId } = req.user;
  const { serviceId } = req.params;
  const { estado } = req.body;

  try {
    const service = await prisma.servicios.findUnique({
      where: { id: serviceId },
      include: { cliente: true, profesional: true }
    });

    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado.' });
    }

    // Check permissions
    if (service.profesional_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este servicio.' });
    }

    const updatedService = await prisma.servicios.update({
      where: { id: serviceId },
      data: {
        estado,
        completado_en: estado === 'completado' ? new Date() : null
      }
    });

    // Send notification to client
    await sendNotification(service.cliente_id, 'servicio_agendado', `El estado de tu servicio ha cambiado a: ${estado}`);

    res.status(200).json(updatedService);
  } catch (error) {
    console.error('Error updating service status:', error);
    res.status(500).json({ error: 'Error al actualizar el servicio.' });
  }
};