import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  output: 'static',
  integrations: [svelte()],
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: 'TaskPulse', short_name: 'TaskPulse', lang: 'id', start_url: '/', display: 'standalone',
          background_color: '#F5F3EE', theme_color: '#F5F3EE',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'], cleanupOutdatedCaches: true },
        devOptions: { enabled: false }
      })
    ]
  }
});
