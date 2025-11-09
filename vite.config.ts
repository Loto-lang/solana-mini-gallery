// Comments in English
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // Provides Buffer, process, and other Node shims in the browser
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // Make sure "buffer" resolves to the browser polyfill
      buffer: 'buffer',
      process: 'process',
    },
  },
  optimizeDeps: {
    // Pre-bundle these so they are available to the client
    include: ['buffer', 'process'],
    esbuildOptions: {
      define: { global: 'globalThis' },
    },
  },
});
