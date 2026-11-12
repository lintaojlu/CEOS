# 开发运行约定

Web 只用来测 UI、快速查看和改界面。正式应用是 Tauri 桌面端。

## 分工

| 形态 | 命令 | 用途 |
| --- | --- | --- |
| Web | `npm run dev` | 改样式、调交互、热更新预览 |
| Tauri | `npm run desktop` | 日常使用、持久化、灵感 / Agent / 画板落盘 |

不要把 Web 当主数据源。两边存储互不共享，Web 上改的日程不会自动进桌面。

## 端口

两边固定不同端口，可同时跑；`localStorage` 也按端口隔离。

| 形态 | 端口 | 地址 |
| --- | --- | --- |
| Web | `5173` | `http://localhost:5173/ceo-schedule.html` |
| Tauri 开发 | `1420` | 由 `tauri.conf.json` 的 `devUrl` 加载；Vite 由 `npm run dev:tauri` 拉起 |

占用时直接报错（`strictPort`），不会静默换端口。

打包后的 `.app` 不依赖开发端口，前端打进包内。

## 数据存储

| 数据 | Tauri | Web |
| --- | --- | --- |
| 日程、标签、设置、洞察等 | `~/Library/Application Support/com.ceos.schedule/` 下的 JSON（如 `schedule.json`、`workspace.json`） | 浏览器 `localStorage`（`ceoSchedule` 等键） |
| 灵感 | `ideas/<id>.json` | 仅内存，刷新即丢 |
| Agent 会话 | `agent/` | 基本不持久化 |
| 画板 | `board.json` | 基本不持久化 |

桌面端启动时若应用数据文件还不存在，会尝试把当前窗口 `localStorage` 抄进文件一次；两边都空才用开发备份。

测持久化、灵感文件、Agent 记录时用 Tauri。测界面用 Web。

## 相关配置

- `vite.config.mjs`：`CEOS_PORT`（默认 `5173`），`CEOS_NO_BROWSER` 关闭自动开浏览器
- `package.json`：`dev` / `dev:tauri` / `desktop`
- `src-tauri/tauri.conf.json`：`devUrl`、`beforeDevCommand`
