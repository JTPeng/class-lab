import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 监听所有网卡，便于手机在同一局域网扫码访问开发服务器（绘本打卡模块用）。
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/shared': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
