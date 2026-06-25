# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库中工作时提供指引。

## 这是什么

现场互动墙，用于直播/课堂：观众扫码用手机投票（单选）并发一句话弹幕；投影出去的大屏页实时显示票数柱状图和从右往左滚动的留言；带密码的主持人后台页负责管理当前题目。完整的产品说明、范围、验收标准以及编号的竖切切片都在 [docs/PRD.md](docs/PRD.md) —— **做功能前先读它**。

PRD 的**切片 1~6 均已实现**（投票闭环、弹幕留言、敏感词过滤、主持人后台、扫码二维码、CSV 导出）。后端逻辑按切片拆成独立模块：[server/poll.js](server/poll.js)（投票）、[server/messages.js](server/messages.js)（留言）、[server/filter.js](server/filter.js)（敏感词）、[server/admin.js](server/admin.js)（题目管理）、[server/export.js](server/export.js)（CSV）——HTTP 路由统一在 [server/index.js](server/index.js)，每个模块都有对应的 `test/*.test.js`。继续做新功能时延续这种"逻辑模块 + 路由 + 测试"的拆法，每片独立可验证；未经要求不要跳着做。

## 常用命令

```bash
npm install        # 安装根依赖；postinstall 会自动安装 web/ 的依赖
npm run dev        # 通过 concurrently 同时启动后端（3001）和 Vite 前端（5173）
npm run server     # 只启动后端
npm run web        # 只启动前端（Vite 开发服务器）
npm run build      # 构建前端生产版本
npm test           # 运行 test/ 下的测试（Node 内置 node:test，无额外依赖）
```

测试用 Node 内置 `node:test`，测试文件放在 `test/*.test.js`，通过 `DB_PATH` 环境变量指向临时库以隔离开发数据。还没有配置 lint。端到端验证靠手动：访问 `http://localhost:3001/api/health` 确认后端 + 数据库，并打开下面三个网址。

开发环境网址：
- 观众页（手机）：`http://localhost:5173/`
- 大屏页（投影）：`http://localhost:5173/screen`
- 主持人后台：`http://localhost:5173/admin`

## 架构

开发时是两个进程，通过 Vite 代理连接：

- **后端** —— `server/` 是一个 ESM 的 Express 应用（根目录 `"type": "module"`）。[server/index.js](server/index.js) 是入口；[server/db.js](server/db.js) 负责 `better-sqlite3` 连接，并在被 import 时执行所有 `CREATE TABLE IF NOT EXISTS` 建表语句。数据库文件位于 `server/data/app.db`（已 gitignore，WAL 模式，外键开启）。后端启动时会往 `_healthcheck` 表写入并读回一行，以证明数据库已连通；`/api/health` 会返回数据库路径、那一行数据以及各表行数。
- **前端** —— `web/` 是一个独立的 Vite + React 包（有自己的 `package.json`）。路由由 [web/src/main.jsx](web/src/main.jsx) 中的 `react-router-dom` 在客户端完成：`/` → 观众页，`/screen` → 大屏页，`/admin` → 后台页（页面在 `web/src/pages/`）。Vite（[web/vite.config.js](web/vite.config.js)）跑在 5173，开启 `host: true`（让同局域网的手机也能访问），并把 `/api/*` 代理到 3001 的后端 —— 所以前端代码直接调 `/api/...` 即可，无需处理跨域/host。

数据库表结构（见 [server/db.js](server/db.js)）：`questions`、`options`（外键 → questions）、`votes`（外键 → questions + options）、`messages`（含敏感词过滤用的 `masked_content`/`status` 字段），外加自检用的 `_healthcheck` 表。

## 约定与关键决策（来自 PRD）

- **以 docs/PRD.md 为准**，每个切片都对照它的验收标准来做和验证。
- **实时 = 轮询，不是 WebSocket。** 大屏页/观众页每约 1.5 秒向后端轮询一次。除非 PRD 改变，不要引入 WebSocket/SSE。
- **投票和留言先存住、能读回来就行**（刷新页面数据还在即可；骨架/早期切片阶段不纠结持久化的严谨性）。
- **每加一个功能，配一个对应的测试。**
- **敏感词表**是纯文本 `server/sensitive-words.txt`（一行一个词，`#` 注释，改后重启生效）。过滤逻辑在 [server/filter.js](server/filter.js)，默认命中打码（`FILTER_MODE='mask'`，可改 `'block'` 改为拦截）；留言入库与展示在 [server/messages.js](server/messages.js)，打码版存 `masked_content`。
- **同一时刻只有一道生效的题目**，由后台页切换；后台密码从 `.env` 的 `ADMIN_PASSWORD` 读取。
- **不要把密钥、密码直接写死进代码**（`.env` 已 gitignore，参考 `.env.example`）。后台鉴权尚未接入（属于后面的切片）。
- 范围刻意做小：≤100 人同时在线、单服务器、观众无需登录、不做严格的一人一票。加任何东西前先看 PRD 里的"明确不做"。
- 界面文案和代码注释用中文，与现有文件保持一致。
