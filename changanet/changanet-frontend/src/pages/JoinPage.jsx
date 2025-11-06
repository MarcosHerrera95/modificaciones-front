import { Link } from 'react-router-dom';

const JoinPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          ¿Qué necesitas hoy?
        </h1>
        <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto leading-relaxed">
          Encuentra profesionales confiables o ofrece tus servicios. Simple, seguro y con impacto positivo.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Cliente Section */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Soy Cliente</h2>
            <p className="text-white/90 mb-6 text-lg">Necesito contratar un servicio</p>
            <Link
              to="/registro-cliente"
              className="inline-block bg-white text-emerald-600 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-emerald-50 hover:shadow-xl hover:scale-105 transition-all duration-300 w-full text-center min-h-[44px] touch-manipulation"
              aria-label="Registrarme como cliente"
            >
              Registrarme como Cliente
            </Link>
          </div>

          {/* Profesional Section */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Soy Profesional</h2>
            <p className="text-white/90 mb-6 text-lg">Quiero ofrecer mis servicios</p>
            <Link
              to="/registro-profesional"
              className="inline-block border-2 border-white text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-white hover:text-emerald-600 hover:shadow-xl hover:scale-105 transition-all duration-300 w-full text-center min-h-[44px] touch-manipulation"
              aria-label="Registrarme como profesional"
            >
              Convertirse en Profesional
            </Link>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-white/80 text-lg">
          <p>¿No sabes por dónde empezar? <Link to="/profesionales" className="underline hover:text-white">Explora profesionales cerca tuyo</Link></p>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;