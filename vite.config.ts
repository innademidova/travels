import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/travels/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      // Activate a new version right away, even when an old page that cannot ask for it is open
      workbox: { skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true },
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'My travels',
        short_name: 'Travels',
        description: 'Trips and travel dreams',
        theme_color: '#f6f1e9',
        background_color: '#f6f1e9',
        display: 'standalone',
        start_url: '/travels/',
        scope: '/travels/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
