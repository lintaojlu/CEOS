## CEOS：CEO Schedule System

**Slogan：每个人都是自己的 CEO**

CEOS 是一个为技术型 CEO / 创业者设计的每日时间与认知管理工具：用一套轻量的「里程碑 + 日程 + 灵感 DAG + 反思 + AI 日报」体系，帮助你像运营公司一样运营自己和事业。

---

### 项目亮点

- **日日清机制**：必做/选做按日管理；暂时做不了的事进入灵感箱，设 DDL 或前序后再捡起。
- **灵感 DAG**：灵感全局一份；可依赖其他灵感，或当前查看日的必做/选做；就绪后应用内提醒。
- **分层前端架构**：Domain / Application / Infrastructure / UI，可用 Vitest 单测核心规则。
- **每日 AI 复盘**：根据任务与感悟生成团队日报与《CEO的反思》。

---

### 设计原则：按日解耦

必做/选做按日隔离（例如 9/17 与 9/18 的任务互不相关）。灵感、项目、里程碑全局各一份。**只有**用户点击「同步任务」时，才会把前一天未完成的必做/选做拷到当前日，并沿用原来的任务 id；已完成的任务、灵感、项目、里程碑都不会被拷贝。

---

### 功能模块

- **目标里程碑（Milestones）**
  - 全局一份时间轴，每条里程碑自带目标日期。

- **任务清单（必做 / 选做）**
  - 自然语言时间解析、拖拽、置顶、周期、完成勾选。
  - 「同步任务」只拷贝昨日未完成的必做/选做，保留原任务 id。已完成任务不拷贝。

- **项目**
  - 全局一份。项目里的任务和当日清单是同一个任务 id 的两份记录，完成状态互相更新。
  - 从项目添加任务时，当日副本落在当前查看日的必做。用 `【项目名】标题` 新建时，落在正在输入的那一列，并在项目里补一条同 id 任务。

- **灵感收集箱（DAG）**
  - 全局一份，不随日期切换。
  - 每条灵感可设 **DDL**（到日才可捡起）与 **前序**（全部未完成灵感，或当前查看日未完成的必做/选做）。
  - **画布 / DAG 视图（默认）**：React Flow 可视化节点与依赖边；右上角 **DAG | 列表** 可切换。
  - **列表视图**：分区 **可捡起来 / 等待中 / 已完成**；标题角标显示「可捡起 N」。
  - 就绪时显示应用内横幅；「列入今日」写入当前查看日的必做。
  - 从必做/选做拖入灵感箱 = 从当天清单移出，放进灵感箱。

- **每日感悟 & 标签 / AI 日报 / 导出**
  - JSON 导出含按日 `schedule` 与全局 `workspace`。

---

### 架构

```text
UI  →  Application (ScheduleApp / Services / EventBus)
         →  Domain (纯函数：就绪规则、环检测、同步)
         →  Data (`src/data`：按日记录与全局 workspace 的形状与归一化)
         →  Infrastructure (localStorage Repository + Migration)
```

| 层 | 职责 | 禁止 |
|----|------|------|
| `src/data/` | 存储模型：`ScheduleDayRecord`、`WorkspaceRecord` 及归一化 | 同步、就绪、DOM、localStorage |
| `src/domain/` | 业务规则（无 IO） | 定义存储形状、DOM、localStorage、fetch |
| `src/application/` | 用例、事件、组合根 | 直接操作 DOM |
| `src/infrastructure/` | 持久化与 schema 迁移，只读写 data 模型 | UI、业务规则 |
| `src/ui/` | 视图与弹窗 | 直接读写 localStorage |

**就绪规则**：未完成 + 全部前序已完成（引用丢失视为已满足）+ 无 DDL 或 DDL ≤ 今天。

---

### 技术栈

- **前端**（本目录）：HTML + ES Module（Vite）、React 岛屿（灵感画布）+ [@xyflow/react](https://reactflow.dev)、Tailwind CDN、Marked、localStorage
- **测试**：Vitest（Domain / Migration）
- **后端**（同级目录 `../ceos_backend`，独立 git）：Express 薄代理 `POST /api/ai-eval` → 火山引擎 Ark

---

### 项目结构

```text
.
├── ceo-schedule.html              # 主页面（布局）
├── css/ceo-schedule.css
├── src/
│   ├── main.js                    # 入口：bootstrap + window.app
│   ├── data/                      # ScheduleDayRecord、WorkspaceRecord
│   ├── domain/                    # 日程 / 灵感 DAG / 里程碑规则
│   ├── application/               # ScheduleService、IdeaInboxService、Export…
│   ├── infrastructure/            # Repository、Migration → v4（workspace，同名项目合并）
│   ├── ui/views/ · ui/components/
│   ├── ui/react/                  # 灵感 DAG 画布（React + React Flow 岛屿）
│   └── ai/ai-eval-client.js
├── vite.config.mjs
├── package.json
└── js/                            # 已废弃 shim（勿直接引用）
```

AI 代理在同级目录 `../ceos_backend`（`ai-server.js`、`ai-server/routes/ai-eval.js`），使用单独的 git 仓库。

**localStorage 键**

| 键 | 内容 |
|----|------|
| `ceoSchedule` | 按日：`required` / `optional` / reflection / aiEval |
| `ceoWorkspace` | 全局：`ideas` / `milestones` / `projects`（项目任务与当日任务同 id） |
| `ceoSchemaVersion` | schema 版本（v4 = 全局 workspace，同名项目合并成一个） |

`ceoIdeas` / `ceoMilestones` 为旧键。打开应用时会先收回各日（v2），再收成 `ceoWorkspace`（v3）。v4 把历史上每天各建一份、名称相同的项目合并成一个。

---

### 快速开始

```bash
# 在本目录（ceos_frontend）
npm install
npm run dev
# → http://localhost:5173/ceo-schedule.html

# 终端 2（可选）：AI 代理，在同级目录 ceos_backend
cd ../ceos_backend
npm install
# 配置 .env 中的 VOLCENGINE_MODEL_ID / VOLCENGINE_API_KEY
npm start
```

```bash
npm test          # Domain / Migration 单测
npm run build     # 产出 dist/
```

> 不要再直接双击打开 `ceo-schedule.html`（`type=module` 依赖 Vite 开发服务器）。

> **访问地址固定为 `http://localhost:5173`**。localStorage 按「协议 + 域名 + 端口」隔离，换端口（`8080` / `8765` / `python -m http.server`）或改用 `127.0.0.1` 都会进入另一份空存储，看起来就像数据丢了。`vite.config.mjs` 已开启 `strictPort`，5173 被占用时会直接报错而不是静默换端口。

---

### 使用说明（灵感箱）

1. 把暂时做不了的事拖进「灵感收集箱」，或点 `+` 新建。灵感不随日期切换。
2. **DAG 模式（默认）**：标题旁点 **DAG / 列表** 切换；从节点右侧手柄拖到另一节点左侧 = 设置前序依赖；拖动节点保存布局；点「列入今日」或双击「编辑」。
3. **列表模式**：按就绪状态浏览；编辑弹窗可设 DDL，前序可以是其他灵感或当天未完成任务。
4. 前序全部完成且日期已到 → 进入「可捡起来」，角标/横幅提醒。

---

### 数据与隐私

- 默认仅存本机；AI 调用才经本地代理出网。
- 定期用「导出 JSON」备份；历史一键导入见 `restore.html` + `backup/ceos-full-history.json`。

---

### 常见问题

- **页面空白 / 模块加载失败？** 请用 `npm run dev`，不要用 `file://`。
- **AI 无响应？** 在 `../ceos_backend` 确认 `npm start` 与 `.env` 密钥。
- **灵感、项目、里程碑存在哪？** schema v3 起它们在 `ceoWorkspace`，全局各一份。只有必做/选做按日隔离，并用「同步任务」拷贝未完成项。

---

**每个人都是自己的 CEO。**
