import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      // Copy standalone HTML5 runtime assets (styles.css, vendor/, js/) into dist/
      // during writeBundle so Workbox precaches them cleanly without Node or TypeScript.
      {
        name: 'copy-static-html5-assets',
        apply: 'build',
        writeBundle(): void {
          const distDir = path.resolve(__dirname, 'dist');
          if (!fs.existsSync(distDir)) return;

          const cssSrc = path.resolve(__dirname, 'styles.css');
          if (fs.existsSync(cssSrc)) {
            fs.copyFileSync(cssSrc, path.resolve(distDir, 'styles.css'));
          }

          for (const folder of ['vendor', 'js']) {
            const srcFolder = path.resolve(__dirname, folder);
            const destFolder = path.resolve(distDir, folder);
            if (fs.existsSync(srcFolder)) {
              fs.cpSync(srcFolder, destFolder, {
                recursive: true,
                force: true,
                filter: (src) => !src.endsWith('.test.mjs'),
              });
            }
          }
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Pokémon Park 3D',
          short_name: 'PokéPark 3D',
          description:
            'Explore a sunlit 3D park, catch expressive Pokémon with swipe-to-throw Poké Balls, and walk with your favorite companion from your Poké Box.',
          theme_color: '#38bdf8',
          background_color: '#7dd3fc',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          categories: ['games', 'kids', 'entertainment'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
