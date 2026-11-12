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
          if (error && error.code === 'ENOENT') {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: 'missing-backup' }));
            return;
          }
          next(error);
        }
      });
    }
  };
}

// Web 预览固定 5173；桌面开发（tauri）固定 1420。两边可同时跑，localStorage 也按端口隔离。
const port = Number(process.env.CEOS_PORT || 5173);

export default defineConfig({
  plugins: [serveCeosData()],
  clearScreen: false,
  root: '.',
  publicDir: 'public',
  server: {
    port,
    // strictPort：占用时直接报错，避免静默换端口导致「数据不见了」。
    strictPort: true,
    host: 'localhost',
    // 桌面端不自动打开浏览器；仅 npm run dev 时打开网页预览
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
