## CEOS：CEO Schedule System

**Slogan：每个人都是自己的 CEO**

CEOS 是一个为技术型 CEO / 创业者设计的每日时间与认知管理工具：用一套轻量的「里程碑 + 日程 + 灵感 DAG + 反思 + AI 日报」体系，帮助你像运营公司一样运营自己和事业。

---

### 项目亮点

- **日日清机制**：必做/选做按日管理；暂时做不了的事进入**当天**灵感箱，设 DDL 或前序后再捡起。
- **灵感 DAG**：灵感挂在当前日期下；可依赖**当天**其他灵感或当天必做/选做；就绪后应用内提醒。
- **分层前端架构**：Domain / Application / Infrastructure / UI，可用 Vitest 单测核心规则。
- **每日 AI 复盘**：根据任务与感悟生成团队日报与《CEO的反思》。

---

### 设计原则：按日解耦

每一天的任务与灵感彼此独立（例如 9/17 与 9/18 互不相关）。**只有**用户点击「同步任务」或「同步灵感」时，才会把前一天未完成项拷贝到当前日；切日期不会自动迁移。

---

### 功能模块

- **目标里程碑（Milestones）**
  - 按**目标日期**存在对应那天的 `milestones[]`；界面按当前查看日展示。

- **任务清单（必做 / 选做）**
  - 自然语言时间解析、拖拽、置顶、周期、完成勾选。
  - 「同步任务」**仅**拷贝昨日未完成的必做/选做；不碰灵感与里程碑。

- **灵感收集箱（按日 DAG）**
  - **随日期切换**：翻到哪天只看/改那天的灵感；删 9/16 不影响 9/18。
  - 「同步灵感」显式拷贝昨日未完成灵感；依赖边按当日重映射（目标日不存在的前序会丢弃）。
  - 每条灵感可设 **DDL**（到日才可捡起）与 **前序任务**（仅当天灵感 / 必做 / 选做）。
  - **画布 / DAG 视图（默认）**：React Flow 可视化当天节点与依赖边；右上角 **DAG | 列表** 可切换。
  - **列表视图**：分区 **可捡起来 / 等待中 / 已完成**；标题角标显示「可捡起 N」。
  - 就绪时显示应用内横幅；「列入今日」写入今日必做。
  - 从必做/选做拖入灵感箱 = 暂缓到当天。

- **每日感悟 & 标签 / AI 日报 / AI 反思 / 导出 JSON**
  - 导出以 `schedule`（含按日 ideas / milestones）与 `schemaVersion` 为主。

---

### 架构

```text
UI  →  Application (ScheduleApp / Services / EventBus)
         →  Domain (纯函数：就绪规则、环检测、日任务)
         →  Infrastructure (localStorage Repository + Migration)
```

| 层 | 职责 | 禁止 |
|----|------|------|
| `src/domain/` | 实体与规则（无 IO） | DOM、localStorage、fetch |
| `src/application/` | 用例、事件、组合根 | 直接操作 DOM |
| `src/infrastructure/` | 持久化与 schema 迁移 | UI |
| `src/ui/` | 视图与弹窗 | 直接读写 localStorage |

**就绪规则**：未完成 + 全部前序已完成（引用丢失视为已满足）+ 无 DDL 或 DDL ≤ 今天。

---

### 技术栈

- **前端**：HTML + ES Module（Vite）、React 岛屿（灵感画布）+ [@xyflow/react](https://reactflow.dev)、Tailwind CDN、Marked、localStorage
- **测试**：Vitest（Domain / Migration）
- **后端**：Express 薄代理 `POST /api/ai-eval` → 火山引擎 Ark

---

### 项目结构

```text
.
├── ceo-schedule.html              # 主页面（布局）
├── css/ceo-schedule.css
├── src/
│   ├── main.js                    # 入口：bootstrap + window.app
│   ├── domain/                    # 日程 / 灵感 DAG / 里程碑
│   ├── application/               # ScheduleService、IdeaInboxService、Export…
│   ├── infrastructure/            # Repository、Migration → v2（按日 ideas/milestones）
│   ├── ui/views/ · ui/components/
│   ├── ui/react/                  # 灵感 DAG 画布（React + React Flow 岛屿）
│   └── ai/ai-eval-client.js
├── ai-server.js                   # AI 代理入口
├── ai-server/routes/ai-eval.js
├── vite.config.mjs
├── package.json
└── js/                            # 已废弃 shim（勿直接引用）
```

**localStorage 键**

| 键 | 内容 |
|----|------|
| `ceoSchedule` | 按日：`required` / `optional` / `ideas` / `milestones` / reflection / aiEval |
| `ceoSchemaVersion` | schema 版本（v2 = 灵感与里程碑按日隔离） |

`ceoIdeas` / `ceoMilestones` 为旧键；打开应用时会迁回各日并清空。

---

### 快速开始

```bash
npm install

# 终端 1：前端（必须用 Vite，才能加载 ES Module）
npm run dev
# → http://localhost:5173/ceo-schedule.html

# 终端 2（可选）：AI 代理
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

1. 翻到目标日期，把暂时做不了的事拖进「灵感收集箱」，或点 `+` 新建（只属于当天）。
2. **DAG 模式（默认）**：标题旁点 **DAG / 列表** 切换；从节点右侧手柄拖到另一节点左侧 = 设置前序依赖；拖动节点保存布局；点「列入今日」或双击「编辑」。
3. **列表模式**：按就绪状态浏览；编辑弹窗可设 DDL 与日任务前序。
4. 前序全部完成且日期已到 → 进入「可捡起来」，角标/横幅提醒。

---

### 数据与隐私

- 默认仅存本机；AI 调用才经本地代理出网。
- 定期用「导出 JSON」备份；历史一键导入见 `restore.html` + `backup/ceos-full-history.json`。

---

### 常见问题

- **页面空白 / 模块加载失败？** 请用 `npm run dev`，不要用 `file://`。
- **AI 无响应？** 确认 `npm start` 与 `.env` 密钥。
- **灵感怎么按天了？** schema v2 起灵感与里程碑都挂在 `ceoSchedule[日期]` 下；打开应用会把旧的全局 `ceoIdeas` / `ceoMilestones` 迁回各日。

---

**每个人都是自己的 CEO。**
