import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Calculations, types and demo data live in ../shared, used by this app and the Expo app
  resolve: { alias: { '@shared': shared } },
  server: { fs: { allow: ['.', shared] } },
});
