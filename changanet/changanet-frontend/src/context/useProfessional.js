import { useContext } from 'react';
import ProfessionalContext from './ProfessionalContext';

/**
 * Hook personalizado para acceder al contexto profesional
 */
export const useProfessional = () => {
  const context = useContext(ProfessionalContext);
  if (!context) {
    throw new Error('useProfessional must be used within a ProfessionalProvider');
  }
  return context;
};

export default useProfessional;