import Hero from '../components/Hero';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div>
      <Hero />

      {/* Stats Section */}
      <div className="py-20 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="animate-fade-in">
              <div className="text-5xl font-black text-gradient mb-3">10,000+</div>
              <p className="text-gray-600 font-medium">Profesionales Registrados</p>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="text-5xl font-black text-gradient mb-3">50,000+</div>
              <p className="text-gray-600 font-medium">Servicios Completados</p>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="text-5xl font-black text-gradient mb-3">4.8/5</div>
              <p className="text-gray-600 font-medium">Calificación Promedio</p>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="text-5xl font-black text-gradient mb-3">25%</div>
              <p className="text-gray-600 font-medium">Reducción CO2</p>
            </div>
          </div>
        </div>
      </div>

      {/* Triple Impacto Section */}
      <div className="py-24 bg-white relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-black mb-8 text-gradient">
              Nuestro Triple Impacto
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Más que una plataforma de servicios, somos agentes de cambio positivo en la sociedad, creando un futuro sostenible y equitativo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="group card-glow p-10 rounded-3xl text-center hover-lift animate-fade-in">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl group-hover:shadow-glow transition-all duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold mb-6 text-emerald-700">Social</h3>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                Dignificamos el trabajo manual y promovemos la inclusión laboral para todos, creando oportunidades equitativas y fortaleciendo comunidades.
              </p>
              <div className="bg-emerald-50 px-4 py-3 rounded-2xl text-emerald-700 font-bold text-lg">
                +15% más inclusión laboral
              </div>
            </div>

            <div className="group card-glow p-10 rounded-3xl text-center hover-lift animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl group-hover:shadow-glow transition-all duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold mb-6 text-amber-700">Económico</h3>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                Pagos seguros con garantía total y transparencia absoluta en todos los precios y comisiones. Tu dinero siempre protegido.
              </p>
              <div className="bg-amber-50 px-4 py-3 rounded-2xl text-amber-700 font-bold text-lg">
                100% pagos protegidos
              </div>
            </div>

            <div className="group card-glow p-10 rounded-3xl text-center hover-lift animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl group-hover:shadow-glow transition-all duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold mb-6 text-cyan-700">Ambiental</h3>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                Optimizamos rutas de desplazamiento para reducir significativamente las emisiones de CO2 y minimizar nuestro impacto ambiental.
              </p>
              <div className="bg-cyan-50 px-4 py-3 rounded-2xl text-cyan-700 font-bold text-lg">
                -25% emisiones CO2
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-24 bg-gradient-to-br from-gray-50 via-emerald-50 to-teal-50 relative">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-black text-center mb-20 text-gray-800 animate-fade-in">
            Lo que dicen nuestros usuarios
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="card-glow p-8 rounded-3xl hover-lift animate-fade-in">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mr-6 shadow-lg">
                  <span className="text-white font-bold text-xl">MC</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-xl">María Clara</h4>
                  <div className="flex text-amber-400 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 italic text-lg leading-relaxed">
                "Encontré un plomero excelente en minutos. El servicio fue impecable y el precio justo. ¡Recomiendo Changánet!"
              </p>
            </div>

            <div className="card-glow p-8 rounded-3xl hover-lift animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl flex items-center justify-center mr-6 shadow-lg">
                  <span className="text-white font-bold text-xl">JR</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-xl">Juan Rodríguez</h4>
                  <div className="flex text-amber-400 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 italic text-lg leading-relaxed">
                "Como electricista, Changánet me ha dado visibilidad y clientes constantes. La plataforma es muy profesional."
              </p>
            </div>

            <div className="card-glow p-8 rounded-3xl hover-lift animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mr-6 shadow-lg">
                  <span className="text-white font-bold text-xl">LS</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-xl">Laura Sánchez</h4>
                  <div className="flex text-amber-400 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 italic text-lg leading-relaxed">
                "Me encanta que prioricen el impacto ambiental. Saber que optimizan rutas hace que me sienta bien contratando servicios."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action Section */}
      <div className="py-24 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-5xl md:text-6xl font-black mb-8 drop-shadow-lg">
            ¿Listo para transformar tu experiencia con servicios?
          </h2>
          <p className="text-xl mb-12 opacity-95 max-w-3xl mx-auto leading-relaxed">
            Únete a miles de usuarios que ya confían en Changánet para sus necesidades diarias y contribuyen a un futuro mejor.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
