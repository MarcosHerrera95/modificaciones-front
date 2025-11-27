/**
 * ProfessionalProfileService
 * Servicio de lógica de negocio para gestión de perfiles profesionales
 * 
 * Implementa REQ-06 a REQ-10 del PRD:
 * - REQ-06: Subir foto de perfil y portada
 * - REQ-07: Seleccionar especialidades múltiples
 * - REQ-08: Ingresar años de experiencia
 * - REQ-09: Definir zona de cobertura geográfica
 * - REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 */

const { PrismaClient } = require('@prisma/client');
const { uploadImage, deleteImage } = require('./storageService');
const { getCachedProfessionalProfile, cacheProfessionalProfile, invalidateProfessionalProfile } = require('./cacheService');
const unifiedWebSocketService = require('./unifiedWebSocketService');

const prisma = new PrismaClient();

class ProfessionalProfileService {
  /**
   * Obtiene el perfil completo de un profesional
   * Incluye especialidades, zona de cobertura y todas las tarifas
   */
  async getProfessionalProfile(professionalId, includePrivate = false) {
    try {
      // Intentar obtener del caché
      const cachedProfile = await getCachedProfessionalProfile(professionalId);
      if (cachedProfile && !includePrivate) {
        console.log('👤 Perfil obtenido del caché (público)');
        return cachedProfile;
      }

      const profile = await prisma.perfiles_profesionales.findUnique({
        where: { usuario_id: professionalId },
        include: {
          usuario: {
            select: {
              nombre: true,
              email: true,
              telefono: true,
              esta_verificado: true,
              url_foto_perfil: true
            }
          },
          coverage_zone: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              radius_km: true
            }
          },
          professional_specialties: {
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
          }
        }
      });

      if (!profile) {
        throw new Error('Perfil profesional no encontrado');
      }

      // Incrementar contador de visualizaciones si es perfil público
      if (!includePrivate) {
        await this.incrementProfileViews(professionalId);

        // Emitir evento WebSocket para visualización de perfil
        try {
          unifiedWebSocketService.emitToUser(professionalId, 'profile_viewed', {
            viewerId: null, // No sabemos quién lo vio
            timestamp: new Date().toISOString()
          });
        } catch (wsError) {
          console.warn('Error emitting WebSocket event for profile view:', wsError);
        }
      }

      // Formatear respuesta
      const formattedProfile = {
        usuario_id: profile.usuario_id,
        usuario: profile.usuario,
        especialidad: profile.especialidad,
        especialidades: this.formatSpecialties(profile.professional_specialties),
        anos_experiencia: profile.anos_experiencia,
        zona_cobertura: profile.zona_cobertura,
        latitud: profile.latitud,
        longitud: profile.longitud,
        coverage_zone: profile.coverage_zone,
        tipo_tarifa: profile.tipo_tarifa,
        tarifa_hora: profile.tarifa_hora,
        tarifa_servicio: profile.tarifa_servicio,
        tarifa_convenio: profile.tarifa_convenio,
        descripcion: profile.descripcion,
        url_foto_perfil: profile.url_foto_perfil,
        url_foto_portada: profile.url_foto_portada,
        esta_disponible: profile.esta_disponible,
        calificacion_promedio: profile.calificacion_promedio,
        estado_verificacion: profile.estado_verificacion,
        profile_completion_score: profile.profile_completion_score,
        profile_views_count: profile.profile_views_count,
        last_profile_update: profile.last_profile_update
      };

      // Solo añadir datos privados si se solicita
      if (includePrivate) {
        formattedProfile.verificado_en = profile.verificado_en;
        formattedProfile.url_documento_verificacion = profile.url_documento_verificacion;
      }

      // Almacenar en caché (solo datos públicos)
      if (!includePrivate) {
        await cacheProfessionalProfile(professionalId, formattedProfile);
        console.log('💾 Perfil almacenado en caché');
      }

      return formattedProfile;
    } catch (error) {
      console.error('Error al obtener perfil profesional:', error);
      throw error;
    }
  }

  /**
   * Actualiza el perfil de un profesional
   * Maneja la actualización de todos los campos requeridos por REQ-06 a REQ-10
   */
  async updateProfessionalProfile(professionalId, updateData, imageFiles = {}) {
    try {
      const { 
        nombre, email, telefono,
        especialidad, specialtyIds, // especialidades
        anos_experiencia, zona_cobertura,
        latitud, longitud, coverage_zone_id,
        tipo_tarifa, tarifa_hora, tarifa_servicio, tarifa_convenio,
        descripcion, esta_disponible
      } = updateData;

      // Verificar que el perfil existe
      const existingProfile = await prisma.perfiles_profesionales.findUnique({
        where: { usuario_id: professionalId },
        include: {
          professional_specialties: true
        }
      });

      if (!existingProfile) {
        throw new Error('Perfil profesional no encontrado');
      }

      // Iniciar transacción para actualización segura
      const result = await prisma.$transaction(async (tx) => {
        // 1. Actualizar datos básicos del usuario si es necesario
        if (nombre || email || telefono) {
          await tx.usuarios.update({
            where: { id: professionalId },
            data: {
              ...(nombre && { nombre }),
              ...(email && { email }),
              ...(telefono && { telefono })
            }
          });
        }

        // 2. Manejar subida de imágenes (REQ-06)
        let url_foto_perfil = existingProfile.url_foto_perfil;
        let url_foto_portada = existingProfile.url_foto_portada;

        if (imageFiles.profilePhoto) {
          if (url_foto_perfil) {
            const publicId = this.extractPublicId(url_foto_perfil);
            await deleteImage(publicId);
          }
          const result = await uploadImage(imageFiles.profilePhoto.buffer, { 
            folder: 'changanet/professionals/profile-photos' 
          });
          url_foto_perfil = result.secure_url;
        }

        if (imageFiles.bannerPhoto) {
          if (url_foto_portada) {
            const publicId = this.extractPublicId(url_foto_portada);
            await deleteImage(publicId);
          }
          const result = await uploadImage(imageFiles.bannerPhoto.buffer, { 
            folder: 'changanet/professionals/banners' 
          });
          url_foto_portada = result.secure_url;
        }

        // 3. Procesar especialidades (REQ-07)
        if (specialtyIds && Array.isArray(specialtyIds)) {
          // Eliminar especialidades existentes
          await tx.professional_specialties.deleteMany({
            where: { professional_id: professionalId }
          });

          // Añadir nuevas especialidades
          const specialtyData = specialtyIds.map((specialtyId, index) => ({
            professional_id: professionalId,
            specialty_id: specialtyId,
            is_primary: index === 0 // La primera es la principal
          }));

          await tx.professional_specialties.createMany({
            data: specialtyData
          });
        }

        // 4. Actualizar perfil profesional
        const updatedProfile = await tx.perfiles_profesionales.update({
          where: { usuario_id: professionalId },
          data: {
            // REQ-07: Especialidades
            ...(especialidad && { especialidad }),
            
            // REQ-08: Años de experiencia
            ...(anos_experiencia !== undefined && { 
              anos_experiencia: parseInt(anos_experiencia, 10) 
            }),
            
            // REQ-09: Zona de cobertura geográfica
            ...(zona_cobertura && { zona_cobertura }),
            ...(latitud !== undefined && { latitud: parseFloat(latitud) }),
            ...(longitud !== undefined && { longitud: parseFloat(longitud) }),
            ...(coverage_zone_id && { coverage_zone_id }),
            
            // REQ-10: Tarifas
            ...(tipo_tarifa && { 
              tipo_tarifa: this.validateRateType(tipo_tarifa) 
            }),
            ...(tarifa_hora !== undefined && { 
              tarifa_hora: tarifa_hora ? parseFloat(tarifa_hora) : null 
            }),
            ...(tarifa_servicio !== undefined && { 
              tarifa_servicio: tarifa_servicio ? parseFloat(tarifa_servicio) : null 
            }),
            ...(tarifa_convenio !== undefined && { 
              tarifa_convenio: tarifa_convenio || null 
            }),
            
            // Campos generales
            ...(descripcion !== undefined && { descripcion }),
            ...(esta_disponible !== undefined && { esta_disponible: Boolean(esta_disponible) }),
            
            // Fotos (REQ-06)
            ...(url_foto_perfil !== undefined && { url_foto_perfil }),
            ...(url_foto_portada !== undefined && { url_foto_portada }),
            
            // Timestamp de actualización
            last_profile_update: new Date()
          },
          include: {
            usuario: {
              select: {
                nombre: true,
                email: true,
                telefono: true,
                esta_verificado: true
              }
            },
            coverage_zone: true,
            professional_specialties: {
              include: {
                specialty: true
              }
            }
          }
        });

        return updatedProfile;
      });

      // Invalidar caché después de actualización
      await invalidateProfessionalProfile(professionalId);
      console.log('🗑️ Professional profile cache invalidated');

      // Calcular y retornar perfil actualizado
      const finalProfile = await this.getProfessionalProfile(professionalId, true);

      // Emitir evento WebSocket para actualización de perfil
      try {
        unifiedWebSocketService.emitToUser(professionalId, 'profile_updated', {
          profile: finalProfile,
          timestamp: new Date().toISOString()
        });

        // Emitir evento global para notificaciones de actualización
        unifiedWebSocketService.emitGlobal('professional_profile_updated', {
          professionalId,
          profile: finalProfile,
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        console.warn('Error emitting WebSocket event for profile update:', wsError);
      }

      console.log('✅ Professional profile updated successfully');
      return {
        success: true,
        profile: finalProfile,
        message: 'Perfil profesional actualizado exitosamente'
      };

    } catch (error) {
      console.error('Error updating professional profile:', error);
      throw error;
    }
  }

  /**
   * Valida el tipo de tarifa
   */
  validateRateType(tipo) {
    const validTypes = ['hora', 'servicio', 'convenio'];
    return validTypes.includes(tipo) ? tipo : 'hora';
  }

  /**
   * Formatea especialidades para la respuesta
   */
  formatSpecialties(professionalSpecialties) {
    return professionalSpecialties.map(ps => ({
      id: ps.specialty.id,
      name: ps.specialty.name,
      category: ps.specialty.category,
      description: ps.specialty.description,
      is_primary: ps.is_primary
    }));
  }

  /**
   * Extrae el public ID de una URL de Cloudinary
   */
  extractPublicId(cloudinaryUrl) {
    try {
      const parts = cloudinaryUrl.split('/');
      const filename = parts[parts.length - 1];
      return filename.split('.')[0];
    } catch (error) {
      console.warn('No se pudo extraer public ID de:', cloudinaryUrl);
      return null;
    }
  }

  /**
   * Incrementa el contador de visualizaciones del perfil
   */
  async incrementProfileViews(professionalId) {
    try {
      await prisma.perfiles_profesionales.update({
        where: { usuario_id: professionalId },
        data: {
          profile_views_count: {
            increment: 1
          }
        }
      });
    } catch (error) {
      console.error('Error incrementing profile views:', error);
    }
  }

  /**
   * Crea un nuevo perfil profesional
   */
  async createProfessionalProfile(professionalId, profileData) {
    try {
      const profile = await prisma.perfiles_profesionales.create({
        data: {
          usuario_id: professionalId,
          ...profileData,
          estado_verificacion: 'no_solicitado',
          esta_disponible: true,
          profile_completion_score: 0,
          profile_views_count: 0,
          last_profile_update: new Date()
        }
      });

      // Emitir evento WebSocket para creación de perfil
      try {
        unifiedWebSocketService.emitToUser(professionalId, 'profile_created', {
          profile,
          timestamp: new Date().toISOString()
        });

        unifiedWebSocketService.emitGlobal('professional_profile_created', {
          professionalId,
          profile,
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        console.warn('Error emitting WebSocket event for profile creation:', wsError);
      }

      return profile;
    } catch (error) {
      console.error('Error creating professional profile:', error);
      throw error;
    }
  }

  /**
   * Verifica un perfil profesional
   */
  async verifyProfessionalProfile(professionalId, adminId) {
    try {
      const profile = await prisma.perfiles_profesionales.update({
        where: { usuario_id: professionalId },
        data: {
          estado_verificacion: 'aprobado',
          verificado_en: new Date()
        }
      });

      // Emitir evento WebSocket para verificación de perfil
      try {
        unifiedWebSocketService.emitToUser(professionalId, 'profile_verified', {
          verified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy: adminId
        });

        unifiedWebSocketService.emitGlobal('professional_profile_verified', {
          professionalId,
          verifiedBy: adminId,
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        console.warn('Error emitting WebSocket event for profile verification:', wsError);
      }

      return profile;
    } catch (error) {
      console.error('Error verifying professional profile:', error);
      throw error;
    }
  }

  /**
   * Elimina un perfil profesional
   */
  async deleteProfessionalProfile(professionalId) {
    try {
      // Eliminar especialidades relacionadas primero
      await prisma.professional_specialties.deleteMany({
        where: { professional_id: professionalId }
      });

      // Eliminar el perfil
      const deletedProfile = await prisma.perfiles_profesionales.delete({
        where: { usuario_id: professionalId }
      });

      // Emitir evento WebSocket para eliminación de perfil
      try {
        unifiedWebSocketService.emitGlobal('professional_profile_deleted', {
          professionalId,
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        console.warn('Error emitting WebSocket event for profile deletion:', wsError);
      }

      return deletedProfile;
    } catch (error) {
      console.error('Error deleting professional profile:', error);
      throw error;
    }
  }

  /**
   * Obtiene sugerencias de especialidades basadas en una búsqueda
   */
  async getSpecialtySuggestions(searchTerm, limit = 10) {
    try {
      const suggestions = await prisma.specialties.findMany({
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

      return suggestions;
    } catch (error) {
      console.error('Error getting specialty suggestions:', error);
      throw error;
    }
  }

  /**
   * Obtiene zonas de cobertura disponibles
   */
  async getCoverageZones(searchTerm = null, limit = 50) {
    try {
      const where = {
        is_active: true,
        ...(searchTerm && {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { city: { contains: searchTerm, mode: 'insensitive' } },
            { state: { contains: searchTerm, mode: 'insensitive' } }
          ]
        })
      };

      const zones = await prisma.coverage_zones.findMany({
        where,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
          radius_km: true
        },
        take: limit,
        orderBy: [
          { state: 'asc' },
          { city: 'asc' }
        ]
      });

      return zones;
    } catch (error) {
      console.error('Error getting coverage zones:', error);
      throw error;
    }
  }

  /**
   * Calcula la distancia entre dos puntos geográficos
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distancia en kilómetros
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Busca profesionales por criterios geográficos y de especialidad
   */
  async searchProfessionals(criteria) {
    try {
      const {
        specialtyIds = [],
        location,
        maxDistance = 25, // km
        rateType,
        minRate,
        maxRate,
        availableOnly = true,
        sortBy = 'calificacion_promedio',
        page = 1,
        limit = 20
      } = criteria;

      const where = {
        rol: 'profesional',
        perfil_profesional: {
          isNot: null,
          ...(availableOnly && { esta_disponible: true }),
          ...(specialtyIds.length > 0 && {
            professional_specialties: {
              some: {
                specialty_id: { in: specialtyIds }
              }
            }
          }),
          ...(rateType && { tipo_tarifa: rateType }),
          ...(minRate && { tarifa_hora: { gte: parseFloat(minRate) } }),
          ...(maxRate && { tarifa_hora: { lte: parseFloat(maxRate) } })
        }
      };

      // Ordenamiento
      let orderBy = {};
      switch (sortBy) {
        case 'calificacion_promedio':
          orderBy = { perfil_profesional: { calificacion_promedio: 'desc' } };
          break;
        case 'tarifa_hora':
          orderBy = { perfil_profesional: { tarifa_hora: 'asc' } };
          break;
        case 'profile_completion_score':
          orderBy = { perfil_profesional: { profile_completion_score: 'desc' } };
          break;
        case 'profile_views_count':
          orderBy = { perfil_profesional: { profile_views_count: 'desc' } };
          break;
        default:
          orderBy = { perfil_profesional: { calificacion_promedio: 'desc' } };
      }

      const skip = (page - 1) * limit;

      const professionals = await prisma.usuarios.findMany({
        where,
        include: {
          perfil_profesional: {
            include: {
              coverage_zone: true,
              professional_specialties: {
                include: {
                  specialty: true
                }
              }
            }
          }
        },
        orderBy,
        skip,
        take: limit
      });

      // Aplicar filtro de distancia si se proporciona ubicación
      let filteredProfessionals = professionals;
      if (location && location.lat && location.lng) {
        filteredProfessionals = professionals.filter(prof => {
          if (!prof.perfil_profesional.latitud || !prof.perfil_profesional.longitud) {
            return false;
          }
          
          const distance = this.calculateDistance(
            location.lat,
            location.lng,
            prof.perfil_profesional.latitud,
            prof.perfil_profesional.longitud
          );
          
          return distance <= maxDistance;
        }).map(prof => ({
          ...prof,
          distance: this.calculateDistance(
            location.lat,
            location.lng,
            prof.perfil_profesional.latitud,
            prof.perfil_profesional.longitud
          )
        }));
      }

      const total = filteredProfessionals.length;

      return {
        professionals: filteredProfessionals,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      };

    } catch (error) {
      console.error('Error searching professionals:', error);
      throw error;
    }
  }
}

module.exports = new ProfessionalProfileService();