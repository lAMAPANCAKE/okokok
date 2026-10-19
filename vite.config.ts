import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'push-sw.js'],
      manifest: {
        name: 'Gestionale Eventi',
        short_name: 'Gestionale',
        description: 'Gestione operativa interna: turni, ore e compensi',
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#0f172a',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // Le chiamate a Supabase non vanno mai in cache: dati personali e sempre aggiornati.
        navigateFallbackDenylist: [/^\/auth/],
        runtimeCaching: [],
        // Gestori di push e clic sulle notifiche
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
