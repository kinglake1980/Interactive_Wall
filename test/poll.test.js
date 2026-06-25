// 切片1 测试：投票逻辑（用临时数据库，不碰开发数据）
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 必须在 import poll.js（会连库）之前指定临时库路径
const tmpDb = path.join(os.tmpdir(), `wall-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

const poll = await import('../server/poll.js');

test('ensureDefaultQuestion 创建一道带选项的生效题目', () => {
  poll.ensureDefaultQuestion();
  const p = poll.getPoll();
  assert.ok(p, '应有当前题目');
  assert.ok(p.question.text.length > 0);
  assert.ok(p.options.length >= 2, '至少要有两个选项');
  assert.equal(p.totalVotes, 0, '初始为 0 票');
  assert.ok(p.options.every((o) => o.percent === 0));
});

test('ensureDefaultQuestion 幂等：重复调用不会再建一道题', () => {
  const before = poll.getPoll().question.id;
  poll.ensureDefaultQuestion();
  assert.equal(poll.getPoll().question.id, before);
});

test('castVote 累加对应选项票数并正确计算百分比', () => {
  const p0 = poll.getPoll();
  const optA = p0.options[0].id;
  const optB = p0.options[1].id;

  poll.castVote(optA);
  poll.castVote(optA);
  poll.castVote(optB);

  const p = poll.getPoll();
  const a = p.options.find((o) => o.id === optA);
  const b = p.options.find((o) => o.id === optB);

  assert.equal(a.votes, 2);
  assert.equal(b.votes, 1);
  assert.equal(p.totalVotes, 3);
  assert.equal(a.percent, 67); // round(2/3*100)
  assert.equal(b.percent, 33);
});

test('castVote 遇到不存在的选项返回错误', () => {
  const result = poll.castVote(999999);
  assert.equal(result.ok, false);
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
