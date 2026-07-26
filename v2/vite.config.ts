import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Sertukan polyfill spesifik yang dibutuhkan
      include: ['buffer', 'process', 'util', 'stream'],
      globals: {
        Buffer: true, // Menyediakan global Buffer di window/globalThis
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    // Fallback opsional jika masih dibutuhkan oleh library legacy
    'process.env': {},
  },
});
