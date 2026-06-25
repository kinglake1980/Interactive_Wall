import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端开发服务器跑在 5173；/api 请求代理到后端 3001
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // 允许同局域网/手机访问（后续切片用得到）
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
