// 易错逻辑专项：票数统计（票数 + 百分比）
// 覆盖三种边界：没人投票 / 只投一个选项 / 多个选项都有票
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDb = path.join(os.tmpdir(), `wall-tally-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

const admin = await import('../server/admin.js');
const { getPoll, castVote } = await import('../server/poll.js');

// 每个用例前都新建并切换到一道全新的 3 选项题目，互不干扰
function freshQuestion() {
  const q = admin.createQuestion('测试题', ['A', 'B', 'C']);
  admin.activateQuestion(q.id);
  return getPoll(); // 取到带选项 id 的当前题目
}

test('没人投票：总票数 0，每个选项都是 0 票 / 0%', () => {
  freshQuestion();
  const poll = getPoll();
  assert.equal(poll.totalVotes, 0);
  assert.deepEqual(
    poll.options.map((o) => o.votes),
    [0, 0, 0]
  );
  assert.deepEqual(
    poll.options.map((o) => o.percent),
    [0, 0, 0]
  );
});

test('只投一个选项：该选项 100%，其余 0%', () => {
  const start = freshQuestion();
  const a = start.options[0].id;
  castVote(a);
  castVote(a);
  castVote(a); // A 投 3 票，B/C 不投

  const poll = getPoll();
  assert.equal(poll.totalVotes, 3);
  assert.deepEqual(
    poll.options.map((o) => o.votes),
    [3, 0, 0]
  );
  assert.deepEqual(
    poll.options.map((o) => o.percent),
    [100, 0, 0]
  );
});

test('多个选项都有票：票数与百分比对得上', () => {
  const start = freshQuestion();
  const [a, b] = [start.options[0].id, start.options[1].id];
  castVote(a);
  castVote(a);
  castVote(a); // A=3
  castVote(b); // B=1, C=0

  const poll = getPoll();
  assert.equal(poll.totalVotes, 4);
  assert.deepEqual(
    poll.options.map((o) => o.votes),
    [3, 1, 0]
  );
  assert.deepEqual(
    poll.options.map((o) => o.percent),
    [75, 25, 0] // 3/4=75%, 1/4=25%, 0/4=0%
  );
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
