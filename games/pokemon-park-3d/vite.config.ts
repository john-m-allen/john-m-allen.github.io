import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      // Copy standalone HTML5 runtime assets (styles.css, vendor/, js/) into dist/
      // so the build works as a pure static HTML5 site without Node or TypeScript.
      {
        name: 'copy-static-html5-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
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
    ],
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
