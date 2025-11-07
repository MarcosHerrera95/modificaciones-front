// src/routes/availabilityRoutes.js
const express = require('express');
const { createAvailability, getAvailability, updateAvailability } = require('../controllers/availabilityController');

const router = express.Router();

router.post('/', createAvailability);
router.get('/:professionalId', getAvailability);
router.put('/:slotId', updateAvailability);
router.delete('/:slotId', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const { id: userId } = req.user;
  const { slotId } = req.params;

  try {
    const slot = await prisma.disponibilidad.findUnique({ where: { id: slotId } });
    if (!slot || slot.profesional_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este horario.' });
    }

    await prisma.disponibilidad.delete({ where: { id: slotId } });
    res.status(200).json({ message: 'Horario eliminado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar horario.' });
  }
});

module.exports = router;