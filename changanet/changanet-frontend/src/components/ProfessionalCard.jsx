// src/components/ProfessionalCard.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QuoteRequestModal from './modals/QuoteRequestModal';

const ProfessionalCard = ({ professional }) => {
  const { user } = useAuth();
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const handleQuoteRequest = () => {
    if (!user) {
      alert('Debes iniciar sesión para solicitar un presupuesto.');
      return;
    }
    setShowQuoteModal(true);
  };

  return (
    <div className="card-glow p-8 rounded-3xl overflow-hidden group hover-lift animate-on-scroll">
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-cyan-50/50 opacity-0 group-hover:opacity-100 transition-all duration-500"></div>

      <div className="relative flex flex-col md:flex-row">
        <div className="flex-shrink-0 mb-6 md:mb-0 md:mr-8">
          <div className="relative">
            <img
              src={professional.url_foto_perfil || 'https://placehold.co/120x120?text=👷'}
              alt={`Foto de perfil de ${professional.usuario.nombre}`}
              className="w-28 h-28 md:w-32 md:h-32 rounded-3xl object-cover shadow-xl group-hover:shadow-2xl transition-all duration-300 border-4 border-white/50"
            />
            {professional.estado_verificacion === 'verificado' && (
              <div className="absolute -top-3 -right-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full p-2 shadow-xl animate-pulse">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="flex-grow">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800 group-hover:text-emerald-700 transition-colors duration-300 mb-1">
                {professional.usuario.nombre}
              </h2>
              <p className="text-emerald-600 font-semibold text-xl mb-2">{professional.especialidad}</p>
              <p className="text-gray-600 flex items-center text-lg">
                <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {professional.zona_cobertura}
              </p>
            </div>

            <div className="mt-4 md:mt-0 md:text-right">
              <div className="flex items-center justify-start md:justify-end mb-3">
                <div className="flex items-center bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 rounded-2xl shadow-md">
                  <svg className="w-6 h-6 text-amber-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span className="font-bold text-gray-800 text-lg">{professional.calificacion_promedio ? professional.calificacion_promedio.toFixed(1) : 'N/A'}</span>
                  <span className="text-gray-500 ml-2">(Calificación)</span>
                </div>
              </div>
              <p className="text-3xl font-black text-gradient">
                ${professional.tarifa_hora}
                <span className="text-base font-normal text-gray-500">/hora</span>
              </p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-3 mb-6">
            {professional.estado_verificacion === 'verificado' && (
              <span className="bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Verificado
              </span>
            )}
            <span className="bg-gradient-to-r from-cyan-100 to-teal-100 text-cyan-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Top Profesional
            </span>
            <span className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 text-sm px-4 py-2 rounded-full font-semibold flex items-center shadow-md">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Respuesta Rápida
            </span>
          </div>

          {/* Triple Impacto indicators */}
          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <div className="flex items-center bg-emerald-50 px-3 py-2 rounded-xl text-emerald-700 font-medium">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Inclusión Social
            </div>
            <div className="flex items-center bg-green-50 px-3 py-2 rounded-xl text-green-700 font-medium">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9a9 9 0 019-9" />
              </svg>
              Eco-friendly
            </div>
          </div>
        </div>

        <div className="md:ml-8 flex flex-col justify-between space-y-4">
          <Link
            to={`/profesional/${professional.usuario_id}`}
            className="bg-white text-emerald-600 hover:text-emerald-700 font-semibold transition-all duration-300 flex items-center group/link text-lg px-4 py-2 rounded-xl hover:bg-emerald-50 hover:shadow-md hover:scale-[1.02]"
            aria-label={`Ver perfil completo de ${professional.usuario.nombre}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Ver Perfil Completo</span>
          </Link>
          <button
            onClick={handleQuoteRequest}
            className="bg-amber-500 text-black px-8 py-4 rounded-2xl hover:bg-amber-600 hover:shadow-md hover:scale-[1.02] transition-all duration-300 font-bold shadow-xl text-lg flex items-center justify-center"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Solicitar Presupuesto
          </button>
        </div>
      </div>

      <QuoteRequestModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        professionalId={professional.usuario_id}
        professionalName={professional.usuario.nombre}
      />
    </div>
  );
};

export default ProfessionalCard;
