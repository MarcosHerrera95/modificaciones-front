import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext.jsx';
import Home from './pages/Home';
import Professionals from './pages/Professionals';
import ProfessionalDetail from './pages/ProfessionalDetail';
import Dashboard from './pages/Dashboard';
import Quotes from './pages/Quotes';
import Availability from './pages/Availability';
import ClientProfile from './pages/ClientProfile';
import ProfessionalProfile from './pages/ProfessionalProfile';
import AuthCallback from './pages/AuthCallback';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Cookies from './pages/Cookies';
import Custody from './pages/Custody';
import Ranking from './pages/Ranking';
import Header from './components/Header';
import Footer from './components/Footer';
import './index.css';

// Componente temporal para registro de profesional
const ProfessionalSignup = () => (
  <div className="container mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold mb-6">Registro de Profesional</h1>
    <p className="text-gray-600">Página de registro próximamente...</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
        <ModalProvider>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profesionales" element={<Professionals />} />
              <Route path="/profesional/:id" element={<ProfessionalDetail />} />
              <Route path="/mi-cuenta" element={<Dashboard />} />
              <Route path="/mis-cotizaciones" element={<Quotes />} />
              <Route path="/disponibilidad" element={<Availability />} />
              <Route path="/mi-perfil-cliente" element={<ClientProfile />} />
              <Route path="/mi-perfil-profesional" element={<ProfessionalProfile />} />
              <Route path="/registro-profesional" element={<ProfessionalSignup />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/terminos" element={<Terms />} />
              <Route path="/privacidad" element={<Privacy />} />
              <Route path="/cookies" element={<Cookies />} />
              <Route path="/custodia" element={<Custody />} />
              <Route path="/ranking" element={<Ranking />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
        </ModalProvider>
    </AuthProvider>
  );
}

export default App;
