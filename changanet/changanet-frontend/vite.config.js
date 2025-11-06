/**
 * Configuración de Vite para el frontend de Changánet.
 * Configura el servidor de desarrollo con proxy para APIs backend y headers de seguridad relajados para desarrollo.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: {
    host: 'localhost',
    port: 5173,
    headers: {
      // Headers de desarrollo para facilitar OAuth y evitar problemas de CSP
      // NOTA: En producción, estos headers deben ser más restrictivos
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Content-Security-Policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
      // Headers de seguridad adicionales
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
