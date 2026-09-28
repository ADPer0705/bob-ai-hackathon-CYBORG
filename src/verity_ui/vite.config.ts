import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const API_TARGET = process.env.VERITY_API ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Carbon v11 still emits legacy-JS-API warnings under Dart Sass 1.79+.
        silenceDeprecations: ['legacy-js-api', 'mixed-decls', 'global-builtin', 'import'],
        quietDeps: true,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // The dev server talks to uvicorn; SSE needs buffering off.
      '/api': { target: API_TARGET, changeOrigin: true, ws: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
  },
})
