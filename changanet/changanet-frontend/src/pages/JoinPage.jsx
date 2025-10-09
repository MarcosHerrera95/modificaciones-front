import { Link } from 'react-router-dom';

const JoinPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          ¿Listo para transformar tu experiencia con servicios?
        </h1>
        <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto leading-relaxed">
          Únete a miles de usuarios que ya confían en Changánet para sus necesidades diarias y contribuyen a un futuro mejor.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Link
            to="/profesionales"
            className="group bg-white text-emerald-600 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-emerald-50 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center min-w-[280px]"
          >
            <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar Profesionales
          </Link>

          <Link
            to="/registro-profesional"
            className="group border-2 border-white text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-white hover:text-emerald-600 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center min-w-[280px]"
          >
            <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Convertirse en Profesional
          </Link>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;