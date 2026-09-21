import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    // localStorage 按 协议+域名+端口 隔离：端口一变，之前记录的数据就看不到了。
    // strictPort 让 5173 被占用时直接报错，而不是静默换到 5174。
    strictPort: true,
    host: 'localhost',
    open: '/ceo-schedule.html'
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'ceo-schedule.html'
      }
    }
  },
  test: {
    environment: 'node'
  }
});
