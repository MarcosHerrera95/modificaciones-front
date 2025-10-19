import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { registerWithEmail } from '../../services/authService';

const SignupModal = ({ isOpen, onClose, onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cliente');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!name || !email || !password) {
      setError('Por favor, completa todos los campos');
      setLoading(false);
      return;
    }

    try {
      // INTEGRACIÓN CON FIREBASE: Usar Firebase Authentication para registro
      const result = await registerWithEmail(email, password);

      if (result.success) {
        alert('Cuenta creada exitosamente. Revisa tu correo para verificar tu cuenta.');
        onSwitchToLogin();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error al crear la cuenta. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-[400px] overflow-hidden transition-opacity duration-300 opacity-100">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="relative">
            <h2 className="text-3xl font-bold mb-2">¡Únete a Changánet!</h2>
            <p className="text-amber-100">Crea tu cuenta y comienza</p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-6 flex items-center">
              <span className="text-red-500 mr-3">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Nombre Completo</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  👤
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400"
                  placeholder="Tu nombre completo"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Correo electrónico</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  📧
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Contraseña</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🔒
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-4">¿Qué tipo de cuenta deseas?</label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-center p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                  role === 'cliente'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="cliente"
                    checked={role === 'cliente'}
                    onChange={(e) => setRole(e.target.value)}
                    className="mr-3 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-semibold">Cliente</div>
                    <div className="text-sm opacity-75">Busco servicios</div>
                  </div>
                </label>

                <label className={`flex items-center p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                  role === 'profesional'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="profesional"
                    checked={role === 'profesional'}
                    onChange={(e) => setRole(e.target.value)}
                    className="mr-3 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="font-semibold">Profesional</div>
                    <div className="text-sm opacity-75">Ofrezco servicios</div>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-black py-4 rounded-2xl hover:bg-amber-600 hover:shadow-md hover:scale-[1.02] transition-all duration-200 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                  Creando cuenta...
                </>
              ) : (
                <>
                  <span className="mr-2">🎉</span>
                  Crear Cuenta
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">
              ¿Ya tienes cuenta?
            </p>
            <button
              onClick={onSwitchToLogin}
              className="text-amber-600 font-semibold hover:text-amber-700 transition-colors duration-200 underline underline-offset-2"
            >
              Inicia sesión aquí
            </button>
          </div>

          {/* Benefits */}
          <div className="mt-8 bg-gradient-to-r from-emerald-50 to-turquoise-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-800 mb-3 text-center">Beneficios de registrarte</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <span className="text-emerald-500 mr-2">✓</span>
                Acceso a miles de profesionales verificados
              </div>
              <div className="flex items-center">
                <span className="text-emerald-500 mr-2">✓</span>
                Pagos seguros y garantizados
              </div>
              <div className="flex items-center">
                <span className="text-emerald-500 mr-2">✓</span>
                Soporte 24/7
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SignupModal;
