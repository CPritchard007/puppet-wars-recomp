import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    sourcemap: true,
    // Keep function names and readable generated code while the port is being debugged.
    minify: false,
    chunkSizeWarningLimit: 2000
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true }
});
