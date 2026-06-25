// 切片6 测试：CSV 导出（用临时数据库）
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDb = path.join(os.tmpdir(), `wall-export-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

const admin = await import('../server/admin.js');
const { getPoll, castVote } = await import('../server/poll.js');
const { createMessage } = await import('../server/messages.js');
const { buildExportCsv } = await import('../server/export.js');

test('导出含表头、票数行与留言行', () => {
  const q = admin.createQuestion('晚饭吃什么？', ['面', '饭']);
  admin.activateQuestion(q.id);
  const optId = getPoll().options[0].id; // “面”
  castVote(optId);
  castVote(optId);
  createMessage('大家好');

  const csv = buildExportCsv();
  const lines = csv.split('\r\n');

  assert.equal(lines[0], '类型,题目,选项,票数,留言内容,时间');
  assert.ok(csv.includes('投票,晚饭吃什么？,面,2,,'), '应有“面=2票”的投票行');
  assert.ok(csv.includes('投票,晚饭吃什么？,饭,0,,'), '应有“饭=0票”的投票行');
  assert.ok(/留言,,,,大家好,/.test(csv), '应有留言行');
});

test('含逗号/引号/换行的留言被正确转义', () => {
  createMessage('你好,世界"引号"');
  const csv = buildExportCsv();
  // 逗号与引号触发整格加引号、内部引号翻倍
  assert.ok(csv.includes('"你好,世界""引号"""'));
});

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(tmpDb + suffix);
    } catch {
      /* 忽略 */
    }
  }
});
