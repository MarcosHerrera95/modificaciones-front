import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginModal from './modals/LoginModal';
import SignupModal from './modals/SignupModal';
import { useModal } from '../context/ModalContext';
import NotificationBell from './NotificationBell';
import useSmartNavigation from '../hooks/useSmartNavigation';
import { HomeIcon, WrenchIcon } from '@heroicons/react/24/outline';

const Header = () => {
  const smartNavigate = useSmartNavigation();
  const { user, logout } = useAuth();
  const { showSignup, setShowSignup, showLogin, setShowLogin } = useModal();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md border-b border-emerald-200/50 shadow-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => smartNavigate('/')}
            className="text-2xl font-bold text-gradient transition-all duration-300 flex items-center space-x-3 group"
            aria-label="Ir a Inicio"
            type="button"
          >
            <div className="w-8 h-8 bg-[#10B981] rounded-xl flex items-center justify-center transition-all duration-300">
              <svg className="w-6 h-6" fill="none" stroke="white" viewBox="0 0 32 32">
                <path d="M12 16L14 18L16 16L18 18L20 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 14L12 16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M22 14L20 16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 12L16 16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-gray-800 font-extrabold">Changánet</span>
          </button>

          <nav className="hidden md:flex space-x-8">
            <button onClick={() => smartNavigate('/')} type="button" aria-label="Ir a Inicio" className="bg-white text-gray-700 font-medium transition-all duration-300 px-4 py-3 rounded-lg hover:brightness-95 hover:scale-105 hover:shadow-md min-h-[44px] touch-manipulation">
              <span className="flex items-center space-x-2">
                <HomeIcon className="w-6 h-6" />
                <span>Inicio</span>
              </span>
            </button>
            <button onClick={() => smartNavigate('/profesionales')} type="button" aria-label="Ir a Servicios" className="bg-white text-gray-700 font-medium transition-all duration-300 px-4 py-3 rounded-lg hover:brightness-95 hover:scale-105 hover:shadow-md min-h-[44px] touch-manipulation">
              <span className="flex items-center space-x-2">
                <WrenchIcon className="w-6 h-6" />
                <span>Servicios</span>
              </span>
            </button>
          </nav>

          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <NotificationBell />
                <span className="text-gray-700 hidden lg:inline font-medium bg-emerald-50 px-3 py-1 rounded-full">Hola, {user.nombre}</span>
                <button onClick={() => smartNavigate('/mi-cuenta')} type="button" data-tutorial="mi-cuenta" className="bg-white text-black font-medium transition-all duration-300 px-4 py-2 rounded-lg hover:bg-gray-50 hover:shadow-md hover:scale-[1.02] flex items-center space-x-2 min-h-[44px] touch-manipulation">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Mi Cuenta</span>
                </button>
                <button onClick={handleLogout} type="button" className="bg-gray-500 text-white px-4 py-2 rounded-xl hover:bg-gray-600 hover:shadow-md hover:scale-[1.02] transition-all duration-300 font-medium flex items-center space-x-2 min-h-[44px] touch-manipulation">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cerrar Sesión</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setShowLogin(true)} type="button" className="bg-white text-black font-bold transition-all duration-300 px-6 py-3 rounded-lg hover:bg-gray-50 hover:shadow-md hover:scale-[1.02] flex items-center space-x-2 min-h-[44px] touch-manipulation">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Iniciar Sesión</span>
                </button>
                <button
                  onClick={() => setShowSignup(true)}
                  type="button"
                  className="bg-emerald-500 text-white font-bold px-6 py-3 rounded-lg hover:bg-emerald-600 hover:shadow-md hover:scale-[1.02] hover:brightness-105 transition-all duration-300 flex items-center space-x-2 min-h-[44px] touch-manipulation">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Publicar Servicio</span>
                </button>
              </>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              type="button"
              className="md:hidden text-cyan-600 hover:text-cyan-700 p-3 rounded-lg hover:bg-cyan-50/50 transition-all duration-300 min-h-[44px] touch-manipulation"
              aria-label="Alternar menú de navegación">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-emerald-100/50 shadow-xl animate-slide-up">
            <nav className="container mx-auto px-4 py-6 space-y-4">
              <button
                onClick={() => {
                  smartNavigate('/');
                  setIsMenuOpen(false);
                }}
                type="button"
                aria-label="Ir a Inicio"
                className="flex items-center space-x-3 bg-white text-gray-700 font-medium py-3 px-4 rounded-lg hover:brightness-95 hover:scale-105 hover:shadow-md transition-all duration-300 min-h-[44px] touch-manipulation">
                <HomeIcon className="w-6 h-6" />
                <span>Inicio</span>
              </button>
              <button
                onClick={() => {
                  smartNavigate('/profesionales');
                  setIsMenuOpen(false);
                }}
                type="button"
                aria-label="Ir a Servicios"
                className="flex items-center space-x-3 bg-white text-gray-700 font-medium py-3 px-4 rounded-lg hover:brightness-95 hover:scale-105 hover:shadow-md transition-all duration-300 min-h-[44px] touch-manipulation">
                <WrenchIcon className="w-6 h-6" />
                <span>Servicios</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Modales */}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSwitchToSignup={() => {
          setShowLogin(false);
          setShowSignup(true);
        }}
      />
      <SignupModal
        isOpen={showSignup}
        onClose={() => setShowSignup(false)}
        onSwitchToLogin={() => {
          setShowSignup(false);
          setShowLogin(true);
        }}
      />
    </>
  );
};

export default Header;
