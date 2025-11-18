/**
 * Configuración de Vite para el frontend de Changánet.
 * Configura el servidor de desarrollo con proxy para APIs backend y headers de seguridad relajados para desarrollo.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom'],
    inline: ['react', 'react-dom']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    pool: 'threads',
    server: {
      deps: {
        inline: ['@sentry/browser', '@sentry/react', 'react', 'react-dom']
      }
    }
  },
  server: {
    host: 'localhost',
    port: 5175,
    deps: {
      inline: ['react', 'react-dom']
    },
    headers: {
      // Headers de desarrollo - COOP/COEP removidos para compatibilidad con Firebase Auth
      // NOTA: En producción, considera re-habilitar estos headers por seguridad
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' http://localhost:3002 http://localhost:3003 ws://localhost:3002 ws://localhost:3003 wss://localhost:3002 wss://localhost:3003 https://maps.googleapis.com https://places.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://apis.google.com https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://o4510260990574592.ingest.us.sentry.io; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://changanet-notifications.firebaseapp.com https://accounts.google.com;",
      // Headers de seguridad adicionales
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
