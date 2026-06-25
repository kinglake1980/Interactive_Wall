// 易错逻辑专项：留言校验与敏感词过滤
// 覆盖四种边界：正常留言 / 含敏感词 / 空留言 / 超过 50 字
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDb = path.join(os.tmpdir(), `wall-msgval-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

const { createMessage, getMessagesAfter, MESSAGE_MAX_LEN } = await import(
  '../server/messages.js'
);

// 读回某条留言落库后的展示内容
function readBack(id) {
  return getMessagesAfter(0).messages.find((m) => m.id === id)?.content;
}

test('正常留言：通过，原样上墙', () => {
  const r = createMessage('今天讲得很好');
  assert.equal(r.ok, true);
  assert.equal(r.content, '今天讲得很好');
  assert.ok(!r.content.includes('●'));
  assert.equal(readBack(r.id), '今天讲得很好');
});

test('含敏感词：通过但被打码，原词不上墙', () => {
  const r = createMessage('快来看广告');
  assert.equal(r.ok, true);
  assert.ok(r.content.includes('●'), '返回内容应含打码符');
  assert.ok(!r.content.includes('广告'), '返回内容不应含原敏感词');
  const stored = readBack(r.id);
  assert.ok(stored.includes('●') && !stored.includes('广告'), '落库/上墙的也应是打码版');
});

test('空留言：拦下（空串与纯空白都拦）', () => {
  assert.equal(createMessage('').ok, false);
  assert.equal(createMessage('   ').ok, false);
  assert.equal(createMessage(null).ok, false);
});

test('超过 50 字：拦下；正好 50 字：通过（边界两侧都测）', () => {
  assert.equal(createMessage('字'.repeat(MESSAGE_MAX_LEN + 1)).ok, false); // 51 字
  assert.equal(createMessage('字'.repeat(MESSAGE_MAX_LEN)).ok, true); // 50 字
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
