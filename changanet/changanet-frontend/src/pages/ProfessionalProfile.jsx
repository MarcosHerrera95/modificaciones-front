import React from 'react';
import ProfessionalProfileForm from '../components/professional/ProfessionalProfileForm';

/**
 * ProfessionalProfile
 * Página principal para gestión de perfil profesional
 * 
 * Implementa REQ-06 a REQ-10 del PRD usando el componente moderno ProfessionalProfileForm
 * 
 * Requerimientos implementados:
 * - REQ-06: Subir foto de perfil y portada
 * - REQ-07: Seleccionar especialidades múltiples  
 * - REQ-08: Ingresar años de experiencia
 * - REQ-09: Definir zona de cobertura geográfica
 * - REQ-10: Indicar tarifas (hora, servicio, "a convenir")
 */

const ProfessionalProfile = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <ProfessionalProfileForm />
    </div>
  );
};

export default ProfessionalProfile;