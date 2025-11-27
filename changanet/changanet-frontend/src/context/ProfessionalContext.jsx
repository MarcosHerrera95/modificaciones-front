import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { professionalProfileAPI } from '../services/professionalProfileAPIService';

/**
 * ProfessionalContext
 * Contexto global para gestión sincronizada de datos profesionales
 *
 * Proporciona estado centralizado para:
 * - Perfil profesional del usuario actual
 * - Lista de profesionales (para búsquedas)
 * - Estado de carga y errores
 * - Métodos para actualizar y sincronizar datos
 */

const ProfessionalContext = createContext();

export const ProfessionalProvider = ({ children }) => {
  const { user } = useAuth();

  // Estado del perfil profesional del usuario actual
  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  // Estado de la lista de profesionales (para búsquedas)
  const [professionals, setProfessionals] = useState([]);
  const [professionalsLoading, setProfessionalsLoading] = useState(false);
  const [professionalsError, setProfessionalsError] = useState(null);

  // Estado de filtros y búsqueda
  const [searchFilters, setSearchFilters] = useState({
    specialty: '',
    zone: '',
    rating: 0,
    availability: null,
    priceRange: [0, 10000]
  });

  // Estado de paginación
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
  });

  /**
   * Cargar perfil profesional del usuario actual
   */
  const loadMyProfile = useCallback(async (force = false) => {
    if (!user || user.rol !== 'profesional') return;

    // Si ya tenemos datos y no es forzado, no recargar
    if (myProfile && !force) return;

    try {
      setProfileLoading(true);
      setProfileError(null);

      const result = await professionalProfileAPI.getMyProfile();

      if (result.success) {
        setMyProfile(result.profile);
        console.log('✅ Professional profile loaded:', result.profile);
      } else {
        throw new Error(result.message || 'Error loading profile');
      }
    } catch (error) {
      console.error('❌ Error loading professional profile:', error);
      setProfileError(error.message);
    } finally {
      setProfileLoading(false);
    }
  }, [user, myProfile]);

  /**
   * Actualizar perfil profesional
   */
  const updateMyProfile = useCallback(async (profileData, imageFiles = {}) => {
    try {
      setProfileLoading(true);
      setProfileError(null);

      const result = await professionalProfileAPI.updateMyProfile(profileData, imageFiles);

      if (result.success) {
        setMyProfile(result.profile);
        console.log('✅ Professional profile updated:', result.profile);
        return { success: true, profile: result.profile };
      } else {
        throw new Error(result.message || 'Error updating profile');
      }
    } catch (error) {
      console.error('❌ Error updating professional profile:', error);
      setProfileError(error.message);
      return { success: false, error: error.message };
    } finally {
      setProfileLoading(false);
    }
  }, []);

  /**
   * Buscar profesionales con filtros
   */
  const searchProfessionals = useCallback(async (filters = {}, page = 1, append = false) => {
    try {
      setProfessionalsLoading(true);
      setProfessionalsError(null);

      // Combinar filtros actuales con nuevos
      const combinedFilters = { ...searchFilters, ...filters };
      setSearchFilters(combinedFilters);

      // TODO: Implementar búsqueda en API
      // const result = await professionalProfileAPI.searchProfessionals(combinedFilters, page);

      // Simulación temporal hasta implementar API
      const mockResult = {
        success: true,
        professionals: [],
        pagination: {
          page,
          limit: 20,
          total: 0,
          hasMore: false
        }
      };

      if (append) {
        setProfessionals(prev => [...prev, ...mockResult.professionals]);
      } else {
        setProfessionals(mockResult.professionals);
      }

      setPagination(mockResult.pagination);

      return mockResult;
    } catch (error) {
      console.error('❌ Error searching professionals:', error);
      setProfessionalsError(error.message);
      return { success: false, error: error.message };
    } finally {
      setProfessionalsLoading(false);
    }
  }, [searchFilters]);

  /**
   * Obtener profesional por ID
   */
  const getProfessionalById = useCallback(async (professionalId) => {
    try {
      // Buscar en estado local primero
      const localProfessional = professionals.find(p => p.usuario_id === professionalId);
      if (localProfessional) {
        return { success: true, professional: localProfessional };
      }

      // TODO: Implementar API para obtener profesional individual
      // const result = await professionalProfileAPI.getProfessionalById(professionalId);

      // Simulación temporal
      return { success: false, error: 'Professional not found' };
    } catch (error) {
      console.error('❌ Error getting professional:', error);
      return { success: false, error: error.message };
    }
  }, [professionals]);

  /**
   * Limpiar estado al cambiar de usuario
   */
  const clearProfessionalData = useCallback(() => {
    setMyProfile(null);
    setProfileError(null);
    setProfessionals([]);
    setProfessionalsError(null);
    setSearchFilters({
      specialty: '',
      zone: '',
      rating: 0,
      availability: null,
      priceRange: [0, 10000]
    });
    setPagination({
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false
    });
  }, []);

  /**
   * Actualizar filtros de búsqueda
   */
  const updateSearchFilters = useCallback((newFilters) => {
    setSearchFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Calcular score de completitud del perfil
   */
  const getProfileCompletion = useCallback(() => {
    if (!myProfile) return { score: 0 };

    return professionalProfileAPI.calculateCompletionScore(myProfile);
  }, [myProfile]);

  // Efecto para cargar perfil cuando el usuario cambia
  useEffect(() => {
    if (user?.rol === 'profesional') {
      loadMyProfile();
    } else {
      clearProfessionalData();
    }
  }, [user, loadMyProfile, clearProfessionalData]);

  // Efecto para limpiar datos cuando el usuario se desautentica
  useEffect(() => {
    if (!user) {
      clearProfessionalData();
    }
  }, [user, clearProfessionalData]);

  const value = {
    // Estado del perfil propio
    myProfile,
    profileLoading,
    profileError,

    // Estado de lista de profesionales
    professionals,
    professionalsLoading,
    professionalsError,

    // Filtros y paginación
    searchFilters,
    pagination,

    // Métodos
    loadMyProfile,
    updateMyProfile,
    searchProfessionals,
    getProfessionalById,
    updateSearchFilters,
    getProfileCompletion,
    clearProfessionalData
  };

  return (
    <ProfessionalContext.Provider value={value}>
      {children}
    </ProfessionalContext.Provider>
  );
};

export default ProfessionalContext;