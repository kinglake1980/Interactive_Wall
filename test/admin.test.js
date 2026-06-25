// 切片4 测试：后台题目管理（用临时数据库）
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDb = path.join(os.tmpdir(), `wall-admin-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

const admin = await import('../server/admin.js');
const { castVote, getPoll } = await import('../server/poll.js');

test('createQuestion 新建题目（默认不生效）并能列出', () => {
  const r = admin.createQuestion('午饭吃什么？', ['面', '饭']);
  assert.equal(r.ok, true);
  const q = admin.listQuestions().find((x) => x.id === r.id);
  assert.ok(q);
  assert.equal(q.is_active, false);
  assert.equal(q.options.length, 2);
});

test('校验：题目为空或选项不足两个会被拒绝', () => {
  assert.equal(admin.createQuestion('', ['a', 'b']).ok, false);
  assert.equal(admin.createQuestion('题', ['只有一个']).ok, false);
});

test('activateQuestion 保证同一时刻只有一道生效', () => {
  const a = admin.createQuestion('题A', ['1', '2']);
  const b = admin.createQuestion('题B', ['3', '4']);
  admin.activateQuestion(a.id);
  let actives = admin.listQuestions().filter((q) => q.is_active);
  assert.equal(actives.length, 1);
  assert.equal(actives[0].id, a.id);

  admin.activateQuestion(b.id);
  actives = admin.listQuestions().filter((q) => q.is_active);
  assert.equal(actives.length, 1);
  assert.equal(actives[0].id, b.id);
});

test('切换题目后 getPoll 返回新题且票数为 0', () => {
  const c = admin.createQuestion('新题', ['X', 'Y']);
  admin.activateQuestion(c.id);
  const poll = getPoll();
  assert.equal(poll.question.id, c.id);
  assert.equal(poll.totalVotes, 0);
});

test('updateQuestion 改选项会重置该题票数', () => {
  const q = admin.createQuestion('计票题', ['甲', '乙']);
  admin.activateQuestion(q.id);
  const optId = getPoll().options[0].id;
  castVote(optId);
  castVote(optId);
  assert.equal(getPoll().totalVotes, 2);

  admin.updateQuestion(q.id, '计票题(改)', ['甲', '乙', '丙']);
  const poll = getPoll();
  assert.equal(poll.question.text, '计票题(改)');
  assert.equal(poll.options.length, 3);
  assert.equal(poll.totalVotes, 0); // 票数已重置
});

test('resetActiveVotes 清空当前题目票数', () => {
  const poll0 = getPoll();
  castVote(poll0.options[0].id);
  assert.ok(getPoll().totalVotes >= 1);
  const r = admin.resetActiveVotes();
  assert.equal(r.ok, true);
  assert.equal(getPoll().totalVotes, 0);
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
