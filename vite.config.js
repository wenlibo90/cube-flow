import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'https' ? [basicSsl()] : [],
  build: {
    // 兼容安卓 WebView（Chrome 80+），避免旧版系统 WebView 因语法过新而整包解析失败
    target: ['es2019', 'chrome80', 'safari14'],
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
