import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data');

function serveCeosData() {
  return {
    name: 'serve-ceos-data',
    configureServer(server) {
      server.middlewares.use('/ceos-data/bundle.json', (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        try {
          const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'manifest.json'), 'utf8'));
          const workspace = JSON.parse(fs.readFileSync(path.join(dataDir, 'workspace.json'), 'utf8'));
          const schedule = {};
          const scheduleDir = path.join(dataDir, 'schedule');
          for (const name of fs.readdirSync(scheduleDir)) {
            if (!name.endsWith('.json')) continue;
            const dateKey = name.slice(0, -'.json'.length);
            schedule[dateKey] = JSON.parse(fs.readFileSync(path.join(scheduleDir, name), 'utf8'));
          }
          const body = JSON.stringify({
            schemaVersion: manifest.schemaVersion,
            exportedAt: manifest.exportedAt,
            schedule,
            workspace
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(req.method === 'HEAD' ? undefined : body);
        } catch (error) {
          next(error);
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [serveCeosData()],
  clearScreen: false,
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    // localStorage 按 协议+域名+端口 隔离：端口一变，之前记录的数据就看不到了。
    // strictPort 让 5173 被占用时直接报错，而不是静默换到 5174。
    strictPort: true,
    host: 'localhost',
    // 桌面端（tauri / ceos.sh）不自动打开浏览器；仅 npm run dev 时打开网页预览
    open: process.env.CEOS_NO_BROWSER ? false : '/ceo-schedule.html',
    watch: {
      ignored: ['**/src-tauri/**']
    }
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
