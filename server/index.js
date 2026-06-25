// 现场互动墙 - 最小后端（骨架阶段：只做健康检查与数据库自检，无业务功能）
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db, { dbPath } from './db.js';
import { ensureDefaultQuestion, getPoll, castVote } from './poll.js';
import { createMessage, getMessagesAfter } from './messages.js';
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  activateQuestion,
  resetActiveVotes,
} from './admin.js';
import { buildExportCsv } from './export.js';

const app = express();
app.use(cors());
app.use(express.json());

// 启动自检：往 _healthcheck 写一条，再读回来，证明 SQLite 通了
function dbSelfTest() {
  const info = db
    .prepare('INSERT INTO _healthcheck (note) VALUES (?)')
    .run('startup self-test @ ' + new Date().toISOString());
  const row = db
    .prepare('SELECT * FROM _healthcheck WHERE id = ?')
    .get(info.lastInsertRowid);
  return row;
}

// 表行数统计，便于在 /api/health 里直观看到库结构是否就绪
function tableCounts() {
  const tables = ['questions', 'options', 'votes', 'messages', '_healthcheck'];
  const counts = {};
  for (const t of tables) {
    counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  }
  return counts;
}

const lastHealthRow = dbSelfTest();

// 切片1：确保有一道写死的默认题目
ensureDefaultQuestion();

// 当前题目 + 各选项票数/百分比
app.get('/api/poll', (req, res) => {
  const poll = getPoll();
  if (!poll) return res.status(404).json({ ok: false, error: '暂无题目' });
  res.json({ ok: true, ...poll });
});

// 投票
app.post('/api/poll/vote', (req, res) => {
  const optionId = Number(req.body?.optionId);
  if (!Number.isInteger(optionId)) {
    return res.status(400).json({ ok: false, error: '缺少 optionId' });
  }
  const result = castVote(optionId);
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true, ...getPoll() });
});

// 留言（弹幕）：发一条
app.post('/api/messages', (req, res) => {
  const result = createMessage(req.body?.content);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// 留言（弹幕）：增量拉取 id 大于 after 的留言
app.get('/api/messages', (req, res) => {
  const after = Number(req.query.after) || 0;
  res.json({ ok: true, ...getMessagesAfter(after) });
});

// ---- 主持人后台（密码从环境变量 ADMIN_PASSWORD 读取）----
function requireAdmin(req, res, next) {
  const pw = req.get('x-admin-password');
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: '密码错误' });
  }
  next();
}

// 登录校验（仅用于后台页判断密码是否正确）
app.post('/api/admin/login', requireAdmin, (req, res) => res.json({ ok: true }));

// 列出所有题目
app.get('/api/admin/questions', requireAdmin, (req, res) => {
  res.json({ ok: true, questions: listQuestions() });
});

// 新建题目
app.post('/api/admin/questions', requireAdmin, (req, res) => {
  const r = createQuestion(req.body?.text, req.body?.options);
  res.status(r.ok ? 200 : 400).json(r);
});

// 编辑题目
app.put('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const r = updateQuestion(Number(req.params.id), req.body?.text, req.body?.options);
  res.status(r.ok ? 200 : 400).json(r);
});

// 设为当前题目
app.post('/api/admin/questions/:id/activate', requireAdmin, (req, res) => {
  const r = activateQuestion(Number(req.params.id));
  res.status(r.ok ? 200 : 400).json(r);
});

// 清空当前题目票数
app.post('/api/admin/reset-votes', requireAdmin, (req, res) => {
  const r = resetActiveVotes();
  res.status(r.ok ? 200 : 400).json(r);
});

// 导出票数与留言为 CSV（带 UTF-8 BOM，Excel 打开中文不乱码）
app.get('/api/admin/export', requireAdmin, (req, res) => {
  const BOM = '﻿'; // 让 Excel 按 UTF-8 解析，中文不乱码
  const csv = buildExportCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="interactive-wall-export.csv"'
  );
  res.send(BOM + csv);
});

// 健康检查接口：浏览器/前端都能用它确认后端与数据库状态
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'interactive-wall backend (scaffold)',
    time: new Date().toISOString(),
    db: {
      ok: true,
      path: dbPath,
      lastHealthcheckRow: lastHealthRow,
      counts: tableCounts(),
    },
  });
});

const PORT = process.env.PORT || 3001;

// 仅提示：后台密码是否已从环境变量读到（不打印明文）
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  未检测到 ADMIN_PASSWORD（请复制 .env.example 为 .env 并填写）');
} else {
  console.log('🔐 ADMIN_PASSWORD 已从环境变量读取（值不打印）');
}

app.listen(PORT, () => {
  console.log(`✅ 后端已启动：http://localhost:${PORT}`);
  console.log(`✅ SQLite 自检通过：写入并读回 _healthcheck id=${lastHealthRow.id}`);
  console.log(`   数据库文件：${dbPath}`);
  console.log(`   健康检查：http://localhost:${PORT}/api/health`);
});
