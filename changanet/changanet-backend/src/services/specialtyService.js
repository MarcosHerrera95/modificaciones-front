/**
 * SpecialtyService
 * Servicio para gestión de especialidades profesionales
 * 
 * Implementa REQ-07: Seleccionar una o más especialidades
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SpecialtyService {
  /**
   * Obtiene todas las especialidades disponibles
   */
  async getAllSpecialties(includeInactive = false) {
    try {
      const where = includeInactive ? {} : { is_active: true };

      const specialties = await prisma.specialties.findMany({
        where,
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          is_active: true,
          created_at: true
        },
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ]
      });

      return specialties;
    } catch (error) {
      console.error('Error getting all specialties:', error);
      throw error;
    }
  }

  /**
   * Obtiene especialidades agrupadas por categoría
   */
  async getSpecialtiesByCategory() {
    try {
      const specialties = await this.getAllSpecialties();

      // Agrupar por categoría
      const groupedSpecialties = specialties.reduce((acc, specialty) => {
        const category = specialty.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(specialty);
        return acc;
      }, {});

      return groupedSpecialties;
    } catch (error) {
      console.error('Error getting specialties by category:', error);
      throw error;
    }
  }

  /**
   * Busca especialidades por término de búsqueda
   */
  async searchSpecialties(searchTerm, limit = 20) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
      }

      const specialties = await prisma.specialties.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { category: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          category: true,
          description: true
        },
        take: limit,
        orderBy: { name: 'asc' }
      });

      return specialties;
    } catch (error) {
      console.error('Error searching specialties:', error);
      throw error;
    }
  }

  /**
   * Obtiene especialidades relacionadas basada en una especialidad
   */
  async getRelatedSpecialties(specialtyId, limit = 5) {
    try {
      // Obtener la categoría de la especialidad
      const targetSpecialty = await prisma.specialties.findUnique({
        where: { id: specialtyId },
        select: { category: true }
      });

      if (!targetSpecialty) {
        return [];
      }

      // Buscar otras especialidades de la misma categoría
      const relatedSpecialties = await prisma.specialties.findMany({
        where: {
          is_active: true,
          category: targetSpecialty.category,
          NOT: { id: specialtyId }
        },
        select: {
          id: true,
          name: true,
          category: true,
          description: true
        },
        take: limit,
        orderBy: { name: 'asc' }
      });

      return relatedSpecialties;
    } catch (error) {
      console.error('Error getting related specialties:', error);
      throw error;
    }
  }

  /**
   * Obtiene las especialidades de un profesional específico
   */
  async getProfessionalSpecialties(professionalId) {
    try {
      const professionalSpecialties = await prisma.professional_specialties.findMany({
        where: { professional_id: professionalId },
        include: {
          specialty: {
            select: {
              id: true,
              name: true,
              category: true,
              description: true
            }
          }
        },
        orderBy: { is_primary: 'desc' }
      });

      return professionalSpecialties.map(ps => ({
        id: ps.specialty.id,
        name: ps.specialty.name,
        category: ps.specialty.category,
        description: ps.specialty.description,
        is_primary: ps.is_primary
      }));
    } catch (error) {
      console.error('Error getting professional specialties:', error);
      throw error;
    }
  }

  /**
   * Actualiza las especialidades de un profesional
   */
  async updateProfessionalSpecialties(professionalId, specialtyIds, isPrimaryIndex = 0) {
    try {
      // Validar que las especialidades existen
      const validSpecialties = await prisma.specialties.findMany({
        where: {
          id: { in: specialtyIds },
          is_active: true
        },
        select: { id: true }
      });

      const validSpecialtyIds = validSpecialties.map(s => s.id);
      if (validSpecialtyIds.length !== specialtyIds.length) {
        throw new Error('Una o más especialidades no son válidas');
      }

      // Eliminar especialidades existentes
      await prisma.professional_specialties.deleteMany({
        where: { professional_id: professionalId }
      });

      // Crear nuevas relaciones
      const specialtyData = specialtyIds.map((specialtyId, index) => ({
        professional_id: professionalId,
        specialty_id: specialtyId,
        is_primary: index === isPrimaryIndex
      }));

      await prisma.professional_specialties.createMany({
        data: specialtyData
      });

      return {
        success: true,
        message: 'Especialidades actualizadas exitosamente',
        specialty_count: specialtyIds.length
      };
    } catch (error) {
      console.error('Error updating professional specialties:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de especialidades
   */
  async getSpecialtyStatistics() {
    try {
      // Contar profesionales por especialidad
      const specialtyStats = await prisma.professional_specialties.groupBy({
        by: ['specialty_id'],
        _count: {
          specialty_id: true
        },
        orderBy: {
          _count: {
            specialty_id: 'desc'
          }
        }
      });

      // Obtener detalles de las especialidades
      const specialtyDetails = await prisma.specialties.findMany({
        where: {
          id: { in: specialtyStats.map(s => s.specialty_id) }
        },
        select: {
          id: true,
          name: true,
          category: true
        }
      });

      // Combinar estadísticas con detalles
      const statistics = specialtyStats.map(stat => {
        const detail = specialtyDetails.find(d => d.id === stat.specialty_id);
        return {
          specialty_id: stat.specialty_id,
          name: detail?.name || 'Desconocido',
          category: detail?.category || 'Sin categoría',
          professional_count: stat._count.specialty_id
        };
      });

      return {
        total_specialties: specialtyStats.length,
        statistics
      };
    } catch (error) {
      console.error('Error getting specialty statistics:', error);
      throw error;
    }
  }

  /**
   * Valida si un array de especialidades es válido
   */
  validateSpecialtyIds(specialtyIds) {
    if (!Array.isArray(specialtyIds)) {
      throw new Error('Las especialidades deben ser un array');
    }

    if (specialtyIds.length === 0) {
      throw new Error('Debe seleccionar al menos una especialidad');
    }

    if (specialtyIds.length > 10) {
      throw new Error('No se pueden seleccionar más de 10 especialidades');
    }

    // Verificar que no hay IDs duplicados
    const uniqueIds = [...new Set(specialtyIds)];
    if (uniqueIds.length !== specialtyIds.length) {
      throw new Error('No se pueden repetir especialidades');
    }

    return true;
  }

  /**
   * Obtiene las categorías de especialidades disponibles
   */
  async getSpecialtyCategories() {
    try {
      const categories = await prisma.specialties.findMany({
        where: { is_active: true },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' }
      });

      return categories.map(c => c.category);
    } catch (error) {
      console.error('Error getting specialty categories:', error);
      throw error;
    }
  }

  /**
   * Obtiene especialidades por categoría específica
   */
  async getSpecialtiesByCategoryName(categoryName) {
    try {
      const specialties = await prisma.specialties.findMany({
        where: {
          category: categoryName,
          is_active: true
        },
        select: {
          id: true,
          name: true,
          description: true
        },
        orderBy: { name: 'asc' }
      });

      return specialties;
    } catch (error) {
      console.error('Error getting specialties by category name:', error);
      throw error;
    }
  }
}

module.exports = new SpecialtyService();