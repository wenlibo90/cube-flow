import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'https' ? [basicSsl()] : [],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      input: {
        main: 'index.html',
        desktop: 'desktop.html',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.cosmoplat.cn', '.cosmoplat.com', '.cosmoplat.net'],
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.cosmoplat.cn', '.cosmoplat.com', '.cosmoplat.net'],
  },
}))
