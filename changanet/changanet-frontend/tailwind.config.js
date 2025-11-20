export default {
    content: [
      "./index.html",
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // Colores institucionales Changánet
          'changanet-red': '#E30613',      // Rojo institucional - botones principales, bordes, iconos clave
          'changanet-white': '#FFFFFF',    // Fondo principal - pantalla, tarjetas, secciones
          'changanet-text': '#343A40',     // Texto principal - títulos, subtítulos, texto general
          'changanet-text-secondary': '#6C757D', // Texto secundario - descripciones, etiquetas, ayuda
          'changanet-success': '#28A745',  // Éxito/Verificado - estado verificado, reseñas, confirmaciones
          'changanet-warning': '#FFC107',  // Advertencia - alertas, notificaciones informativas
          'changanet-error': '#DC3545',    // Error - errores, estado no disponible
          'changanet-placeholder': '#F8F9FA', // Placeholder fondo - tarjetas, cajas de búsqueda

          // Alias para compatibilidad
          primary: '#E30613',              // Rojo institucional como primary
          secondary: '#343A40',            // Texto principal como secondary
          success: '#28A745',              // Verde éxito
          warning: '#FFC107',              // Amarillo advertencia
          error: '#DC3545',                // Rojo error
          gray: {
            50: '#F8F9FA',                // Placeholder
            100: '#F8F9FA',
            200: '#E9ECEF',
            300: '#DEE2E6',
            400: '#CED4DA',
            500: '#ADB5BD',
            600: '#6C757D',               // Texto secundario
            700: '#495057',
            800: '#343A40',               // Texto principal
            900: '#212529',
          },
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
        },
        animation: {
          'fade-in': 'fadeIn 1s ease-in-out',
          'bounce-slow': 'bounce 2s infinite',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
        },
      },
    },
    plugins: [],
  }
