// src/controllers/searchController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.searchProfessionals = async (req, res) => {
  const { specialty, location, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

  try {
    const where = {};

    if (specialty) {
      where.especialidad = { contains: specialty, mode: 'insensitive' };
    }

    if (location) {
      where.zona_cobertura = { contains: location, mode: 'insensitive' };
    }

    if (minPrice || maxPrice) {
      where.tarifa_hora = {};
      if (minPrice) where.tarifa_hora.gte = parseFloat(minPrice);
      if (maxPrice) where.tarifa_hora.lte = parseFloat(maxPrice);
    }

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const professionals = await prisma.perfiles_profesionales.findMany({
      where,
      skip,
      take,
      include: {
        usuario: {
          select: { id: true, nombre: true, email: true },
        },
      },
    });

    const total = await prisma.perfiles_profesionales.count({ where });
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      professionals,
      total,
      page: parseInt(page),
      totalPages,
    });
  } catch (error) {
    console.error('Error searching professionals:', error);
    res.status(500).json({ error: 'Error al buscar profesionales.' });
  }
};