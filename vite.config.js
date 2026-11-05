import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 650,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.cosmoplat.cn', '.cosmoplat.com', '.cosmoplat.net'],
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.cosmoplat.cn', '.cosmoplat.com', '.cosmoplat.net'],
  },
})
