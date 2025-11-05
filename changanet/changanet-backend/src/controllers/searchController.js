// src/controllers/searchController.js
const { PrismaClient } = require('@prisma/client');
const { getCachedProfessionalSearch, cacheProfessionalSearch } = require('../services/cacheService');
const prisma = new PrismaClient();

exports.searchProfessionals = async (req, res) => {
  const { specialty, location, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

  try {
    // Crear objeto de filtros para el caché
    const filters = {
      specialty: specialty || null,
      location: location || null,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    // Intentar obtener resultados del caché
    const cachedResults = await getCachedProfessionalSearch(filters);
    if (cachedResults) {
      console.log('🔍 Resultados obtenidos del caché');
      return res.status(200).json(cachedResults);
    }

    const where = {};

    if (specialty) {
      where.especialidad = { contains: specialty };
    }

    if (location) {
      where.zona_cobertura = { contains: location };
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

    const results = {
      professionals,
      total,
      page: parseInt(page),
      totalPages,
    };

    // Almacenar en caché para futuras consultas
    await cacheProfessionalSearch(filters, results);
    console.log('💾 Resultados almacenados en caché');

    res.status(200).json(results);
  } catch (error) {
    console.error('Error searching professionals:', error);
    res.status(500).json({ error: 'Error al buscar profesionales.' });
  }
};