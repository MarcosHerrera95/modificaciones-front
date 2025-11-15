import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext.jsx';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import Home from './pages/Home';
import Professionals from './pages/Professionals';
import ProfessionalDetail from './pages/ProfessionalDetail';
import Dashboard from './pages/Dashboard';
import Quotes from './pages/Quotes';
import Availability from './pages/Availability';
import ClientProfile from './pages/ClientProfile';
import ProfessionalProfile from './pages/ProfessionalProfile';
import ProfilePage from './pages/ProfilePage';
import AuthCallback from './pages/AuthCallback';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Cookies from './pages/Cookies';
import Custody from './pages/Custody';
import Ranking from './pages/Ranking';
import ContactPage from './pages/ContactPage';
import ProfessionalSignupPage from './pages/ProfessionalSignupPage';
import ClientSignupPage from './pages/ClientSignupPage';
import VerifyIdentity from './pages/VerifyIdentity';
import Header from './components/Header';
import Footer from './components/Footer';
import OnboardingTutorial from './components/OnboardingTutorial';
import ContextualHelp from './components/ContextualHelp';
import './index.css';

// Inicializar Firebase Messaging si está disponible (solo en producción)
if (import.meta.env.PROD && typeof window !== 'undefined') {
  import('./services/fcmService').then(({ onForegroundMessage }) => {
    onForegroundMessage();
  }).catch(error => {
    console.warn('FCM no disponible:', error.message);
  });
}

// Ejecutar diagnóstico básico en desarrollo
if (import.meta.env.DEV && typeof window !== 'undefined') {
  setTimeout(() => {
    console.log('🔍 Diagnóstico básico: App cargada correctamente');
  }, 1000);
}

// Componente temporal para registro de profesional (reemplazado por ProfessionalSignupPage)

function App() {
  console.log('🎯 App component rendering');
  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <ModalProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <div className="flex flex-col min-h-screen">
                {/* Skip link for accessibility */}
                <a href="#main-content" className="skip-link">
                  Saltar al contenido principal
                </a>
                <Header />
                <main id="main-content" className="flex-grow" role="main">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Navigate to="/" replace />} />
                    <Route path="/profesionales" element={<Professionals />} />
                    <Route path="/profesional/:id" element={<ProfessionalDetail />} />
                    <Route path="/mi-cuenta" element={<Dashboard />} />
                    <Route path="/mis-cotizaciones" element={<Quotes />} />
                    <Route path="/disponibilidad" element={<Availability />} />
                    <Route path="/mi-perfil-cliente" element={<ClientProfile />} />
                    <Route path="/mi-perfil-profesional" element={<ProfessionalProfile />} />
                    <Route path="/perfil" element={<ProfilePage />} />
                    <Route path="/registro-profesional" element={<ProfessionalSignupPage />} />
                    <Route path="/registro-cliente" element={<ClientSignupPage />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/terminos" element={<Terms />} />
                    <Route path="/privacidad" element={<Privacy />} />
                    <Route path="/cookies" element={<Cookies />} />
                    <Route path="/custodia" element={<Custody />} />
                    <Route path="/ranking" element={<Ranking />} />
                    <Route path="/contacto" element={<ContactPage />} />
                    <Route path="/verificar-identidad" element={<VerifyIdentity />} />
                  </Routes>
                </main>
                <Footer />
              </div>

              {/* Tutorial para primeros usuarios */}
              <OnboardingTutorial />

              {/* Ayuda contextual disponible en toda la app */}
              <ContextualHelp />
            </Router>
          </ModalProvider>
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
