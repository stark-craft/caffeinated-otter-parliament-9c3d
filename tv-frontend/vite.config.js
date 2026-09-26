import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2019',
    rollupOptions: {
      input: {
        tv: fileURLToPath(new URL('./index.html', import.meta.url)),
        mobile: fileURLToPath(new URL('./mobile/index.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://107.109.219.138:8077',
        changeOrigin: true,
      },
    },
  },
})
